import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

import torch
import os
import warnings
warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TRANSFORMERS_VERBOSITY'] = 'error'
os.environ['HF_HUB_DISABLE_PROGRESS_BARS'] = '1'

import random
import time
import csv
import subprocess
from pathlib import Path
from transformers import AutoFeatureExtractor, AutoModelForImageClassification
from PIL import Image
import numpy as np
import cv2

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, roc_curve,
    confusion_matrix, classification_report
)
from tqdm import tqdm


# =============================================================================
#  ENSEMBLE STRATEGY
#
#  Models (AUC-weighted):
#    1. dima806/ai_vs_real_image_detection  — weight 3.0  (98.25% on CIFAKE)
#    2. Organika/sdxl-detector              — weight 0.5  (strong on SD images)
#    3. umm-maybe/AI-image-detector         — weight 0.3  (general fallback)
#
#  Majority Consensus Gate:
#    If fewer than 2/3 models individually exceed threshold,
#    cap the score just below threshold to prevent single-model false positives.
#
#  Threshold: 0.50 (balanced precision / recall)
# =============================================================================


class EnsembleAIImageDetector:
    def __init__(self, silent=False):
        """Initialize improved AI detection models for ensemble prediction."""
        if not silent:
            print("Loading AI detection models...")
            print("(First run will download models - please wait)\n")

        self.models      = []
        self.processors  = []
        self.model_names = []

        # Model 1: dima806 ViT — trained directly on CIFAKE (98.25% accuracy)
        try:
            if not silent:
                print("Loading Model 1: dima806 ViT AI vs Real Detector...")
            model_name = "dima806/ai_vs_real_image_detection"
            try:
                from transformers import AutoImageProcessor
                processor = AutoImageProcessor.from_pretrained(model_name)
            except Exception:
                processor = AutoFeatureExtractor.from_pretrained(model_name)
            model = AutoModelForImageClassification.from_pretrained(model_name)
            model.eval()
            self.models.append(model)
            self.processors.append(processor)
            self.model_names.append("dima806-ViT")
            if not silent:
                print("OK Model 1 loaded\n")
        except Exception as e:
            if not silent:
                print(f"WARNING Model 1 failed: {e}\n")

        # Model 2: Organika SDXL Detector — strong on Stable Diffusion images
        try:
            if not silent:
                print("Loading Model 2: Organika SDXL Detector...")
            model_name = "Organika/sdxl-detector"
            try:
                from transformers import AutoImageProcessor
                processor = AutoImageProcessor.from_pretrained(model_name)
            except Exception:
                processor = AutoFeatureExtractor.from_pretrained(model_name)
            model = AutoModelForImageClassification.from_pretrained(model_name)
            model.eval()
            self.models.append(model)
            self.processors.append(processor)
            self.model_names.append("SDXL-Detector")
            if not silent:
                print("OK Model 2 loaded\n")
        except Exception as e:
            if not silent:
                print(f"WARNING Model 2 failed: {e}\n")

        # Model 3: umm-maybe — broad coverage general fallback
        try:
            if not silent:
                print("Loading Model 3: umm-maybe General AI Detector...")
            model_name = "umm-maybe/AI-image-detector"
            try:
                from transformers import AutoImageProcessor
                processor = AutoImageProcessor.from_pretrained(model_name)
            except Exception:
                processor = AutoFeatureExtractor.from_pretrained(model_name)
            model = AutoModelForImageClassification.from_pretrained(model_name)
            model.eval()
            self.models.append(model)
            self.processors.append(processor)
            self.model_names.append("General-Detector")
            if not silent:
                print("OK Model 3 loaded\n")
        except Exception as e:
            if not silent:
                print(f"WARNING Model 3 failed: {e}\n")

        if not self.models:
            raise RuntimeError("Failed to load any detection models!")

        if not silent:
            print(f"OK Successfully loaded {len(self.models)} model(s)!\n")

        # AUC-based weights — dima806 dominates (benchmarked 0.9825 AUC on CIFAKE)
        # SDXL & General reduced to limit false positives on non-SD images
        self._default_weights = {
            "dima806-ViT"      : 3.0,
            "SDXL-Detector"    : 0.5,
            "General-Detector" : 0.3,
        }

    # -------------------------------------------------------------------------

    def _preprocess_image(self, image: Image.Image) -> Image.Image:
        """Upscale small images (e.g. 32×32 CIFAKE) to 224×224 with LANCZOS."""
        w, h = image.size
        if w < 224 or h < 224:
            image = image.resize((224, 224), Image.LANCZOS)
        return image

    # -------------------------------------------------------------------------

    def classify_image_type(self, image_path):
        try:
            img = cv2.imread(image_path)
            if img is None:
                return 'general'

            hsv  = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            avg_saturation = np.mean(hsv[:, :, 1])
            edges          = cv2.Canny(gray, 50, 150)
            edge_density   = np.sum(edges > 0) / edges.size

            rgb         = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            pixels      = rgb.reshape(-1, 3)
            sample_size = min(10000, len(pixels))
            sampled     = pixels[np.random.choice(len(pixels), sample_size, replace=False)]
            color_div   = len(np.unique(sampled, axis=0)) / sample_size
            noise_level = cv2.Laplacian(gray, cv2.CV_64F).var()

            is_anime = (
                edge_density > 0.10 or
                (edge_density > 0.08 and avg_saturation < 120) or
                (edge_density > 0.07 and color_div < 0.5)
            )

            if is_anime:
                return 'anime'
            elif noise_level > 100 and color_div > 0.5:
                return 'photo'
            else:
                return 'general'

        except Exception:
            return 'general'

    # -------------------------------------------------------------------------

    def analyze_with_heuristics(self, image_path, image_type='general'):
        try:
            img = cv2.imread(image_path)
            if img is None:
                return 0, {}

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            if image_type == 'anime':
                rgb    = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                hist_r = cv2.calcHist([rgb], [0], None, [256], [0, 256])
                hist_g = cv2.calcHist([rgb], [1], None, [256], [0, 256])
                hist_b = cv2.calcHist([rgb], [2], None, [256], [0, 256])
                hist_var            = np.var(hist_r) + np.var(hist_g) + np.var(hist_b)
                color_banding_score = 1.0 if hist_var > 5000000 else 0.0

                patch_size = 30
                h, w       = gray.shape
                smooth_patches = total_patches = 0
                for y in range(0, h - patch_size, patch_size):
                    for x in range(0, w - patch_size, patch_size):
                        if np.var(gray[y:y+patch_size, x:x+patch_size]) < 200:
                            smooth_patches += 1
                        total_patches += 1
                smoothness_score = smooth_patches / total_patches if total_patches else 0

                grad_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
                grad_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
                mag    = np.sqrt(grad_x**2 + grad_y**2)
                gradient_score = 1.0 if np.sum(mag < 30) / mag.size > 0.6 else 0.0

                overall_score = (color_banding_score * 0.4 +
                                 smoothness_score    * 0.4 +
                                 gradient_score      * 0.2)
                details = {
                    'color_banding'      : color_banding_score,
                    'smoothness'         : smoothness_score,
                    'gradient_perfection': gradient_score,
                    'type'               : 'anime',
                }

            else:
                noise       = cv2.Laplacian(gray, cv2.CV_64F).var()
                noise_score = 1.0 if noise < 10 else 0.0

                edges        = cv2.Canny(gray, 50, 150)
                smooth_score = 1.0 if np.sum(edges > 0) / edges.size < 0.05 else 0.0

                rgb         = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                pixels      = rgb.reshape(-1, 3)
                color_ratio = len(np.unique(pixels, axis=0)) / pixels.shape[0]
                color_score = 1.0 if color_ratio < 0.15 else 0.0

                f          = np.fft.fft2(gray)
                magnitude  = np.abs(np.fft.fftshift(f))
                cy, cx     = magnitude.shape[0]//2, magnitude.shape[1]//2
                radius     = min(cx, cy) // 4
                freq_ratio = np.mean(magnitude[cy-radius:cy+radius,
                                               cx-radius:cx+radius]) / (np.mean(magnitude) + 1e-10)
                freq_score = 1.0 if freq_ratio > 50 else 0.0

                overall_score = (noise_score + smooth_score + color_score + freq_score) / 4
                details = {
                    'noise_level'    : noise,
                    'edge_density'   : np.sum(edges > 0) / edges.size,
                    'color_diversity': color_ratio,
                    'frequency_ratio': freq_ratio,
                    'type'           : 'photo',
                }

            return overall_score, details

        except Exception:
            return 0, {}

    # -------------------------------------------------------------------------

    def predict_single_model(self, image, model, processor):
        try:
            image = self._preprocess_image(image)

            inputs = processor(images=image, return_tensors="pt")
            with torch.no_grad():
                outputs = model(**inputs)
                logits  = outputs.logits
                probs   = torch.nn.functional.softmax(logits, dim=-1)

            pred_idx   = logits.argmax(-1).item()
            confidence = probs[0][pred_idx].item()
            pred_label = model.config.id2label[pred_idx].lower()

            real_kw = {"real", "human", "authentic", "natural"}
            ai_kw   = {"artificial", "ai", "fake", "generated", "synthetic"}

            if any(k in pred_label for k in real_kw):
                ai_score = 1.0 - confidence
            elif any(k in pred_label for k in ai_kw):
                ai_score = confidence
            else:
                ai_score = probs[0][1].item() if len(probs[0]) > 1 else confidence

            return ai_score, confidence, pred_label, probs[0].tolist()

        except Exception as e:
            print(f"Error in model prediction: {e}")
            return 0.5, 0.5, "error", []

    # -------------------------------------------------------------------------

    def get_ai_score(self, image_path: str, threshold: float = 0.50) -> float:
        """
        Returns a float in [0, 1] representing AI likelihood.
        1.0 = definitely AI, 0.0 = definitely real.
        Called by detect_wrapper.py and video.py for frame-level analysis.

        Majority consensus gate: if fewer than 2/3 models individually exceed
        threshold, cap the score just below threshold to prevent a single noisy
        model from causing false positives.
        """
        try:
            image      = Image.open(image_path).convert('RGB')
            image_type = self.classify_image_type(image_path)

            ai_scores = []
            weights   = []

            for model, processor, name in zip(
                self.models, self.processors, self.model_names
            ):
                score, _, _, _ = self.predict_single_model(image, model, processor)
                ai_scores.append(score)
                weights.append(self._default_weights.get(name, 1.0))

            raw_score = float(np.average(ai_scores, weights=weights))

            # Majority consensus gate
            n_votes  = sum(1 for s in ai_scores if s > threshold)
            majority = max(2, len(ai_scores) // 2 + 1)
            if n_votes < majority and raw_score > threshold:
                raw_score = threshold - 0.01

            return raw_score

        except Exception:
            return 0.0

    # -------------------------------------------------------------------------

    def analyze(self, image_path, threshold=0.50):
        """Full verbose analysis — for CLI use only, not called by wrapper."""
        print("=" * 70)
        print("ENHANCED AI IMAGE DETECTION (Multi-Model Ensemble)")
        print("=" * 70)
        print(f"\nAnalyzing: {image_path}")

        try:
            image = Image.open(image_path).convert('RGB')
            print(f"Image size: {image.size}")
        except Exception as e:
            print(f"Error loading image: {e}")
            return 0.0

        image_type = self.classify_image_type(image_path)
        print(f"Image type: {image_type.upper()}\n")
        print("-" * 70)
        print("Running ensemble detection...")
        print("-" * 70 + "\n")

        ai_scores          = []
        model_weights_list = []

        for i, (model, processor, name) in enumerate(
            zip(self.models, self.processors, self.model_names)
        ):
            print(f"Model {i+1} ({name}):")
            ai_score, confidence, label, _ = self.predict_single_model(
                image, model, processor
            )
            ai_scores.append(ai_score)
            w = self._default_weights.get(name, 1.0)
            model_weights_list.append(w)
            verdict = "AI-Generated" if ai_score > threshold else "Authentic"
            print(f"   Verdict  : {verdict}")
            print(f"   AI Score : {ai_score*100:.1f}%")
            print(f"   Label    : {label}")
            print(f"   Weight   : {w}")
            print()

        print("Heuristic Analysis: DISABLED (model-only ensemble)\n")

        weighted_score = float(np.average(ai_scores, weights=model_weights_list))
        average_score  = float(np.mean(ai_scores))

        # Apply majority consensus gate in analyze too
        n_votes  = sum(1 for s in ai_scores if s > threshold)
        majority = max(2, len(ai_scores) // 2 + 1)
        gated    = n_votes < majority and weighted_score > threshold
        if gated:
            weighted_score = threshold - 0.01

        print("=" * 70)
        print("ENSEMBLE RESULT:")
        print("-" * 70)
        print(f"\nAverage Score (unweighted) : {average_score*100:.1f}%")
        print(f"Weighted Score             : {weighted_score*100:.1f}%")
        print(f"Decision Threshold         : {threshold*100:.0f}%")
        if gated:
            print(f"Consensus Gate             : TRIGGERED ({n_votes}/{len(ai_scores)} votes) — capped")

        if weighted_score > 0.70:
            verdict          = "HIGHLY LIKELY AI-GENERATED"
            confidence_level = "Very High"
        elif weighted_score > threshold:
            verdict          = "LIKELY AI-GENERATED"
            confidence_level = "High"
        elif weighted_score > 0.25:
            verdict          = "UNCERTAIN"
            confidence_level = "Low"
        else:
            verdict          = "LIKELY AUTHENTIC"
            confidence_level = "High"

        print(f"\n{verdict}")
        print(f"Confidence : {confidence_level}")
        print(f"Final Score: {weighted_score*100:.1f}% AI likelihood")
        print(f"\nModel Agreement: {n_votes}/{len(ai_scores)} detectors flagged as AI")
        print("\n" + "=" * 70)

        return weighted_score


def detect_ai_image(image_path):
    """Simple function to detect if image is AI-generated"""
    detector = EnsembleAIImageDetector()
    detector.analyze(image_path)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        detect_ai_image(sys.argv[1])
    else:
        print("Usage: python image.py <image_path>")