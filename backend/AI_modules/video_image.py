import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

import torch
from transformers import AutoFeatureExtractor, AutoModelForImageClassification, CLIPProcessor, CLIPModel
from PIL import Image
import numpy as np
import warnings
warnings.filterwarnings('ignore')


class EnsembleAIImageDetector:
    def __init__(self, silent=False):
        """Initialize multiple AI detection models for ensemble prediction"""
        print("Loading AI detection models...")
        print("(First run will download models - please wait)\n")

        self.models = []
        self.processors = []
        self.model_names = []

        # Model 1: Specialized AI detector
        try:
            print("Loading Model 1: AI Image Detector...")
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
            self.model_names.append("AI-Detector")
            print("OK Model 1 loaded\n")
        except Exception as e:
            print(f"WARNING Model 1 failed: {e}\n")

        # Model 2: SDXL Detector
        try:
            print("Loading Model 2: Stable Diffusion Detector...")
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
            print("OK Model 2 loaded\n")
        except Exception as e:
            print(f"WARNING Model 2 failed: {e}\n")

        # Model 3: Anime AI detector
        try:
            print("Loading Model 3: Alternative AI Detector...")
            model_name = "saltacc/anime-ai-detect"
            try:
                from transformers import AutoImageProcessor
                processor = AutoImageProcessor.from_pretrained(model_name)
            except Exception:
                processor = AutoFeatureExtractor.from_pretrained(model_name)
            model = AutoModelForImageClassification.from_pretrained(model_name)
            model.eval()
            self.models.append(model)
            self.processors.append(processor)
            self.model_names.append("Anime-AI-Detector")
            print("OK Model 3 loaded\n")
        except Exception as e:
            print(f"WARNING Model 3 failed: {e}\n")

        if not self.models:
            raise RuntimeError("Failed to load any detection models!")

        print(f"OK Successfully loaded {len(self.models)} model(s)!\n")

    def classify_image_type(self, image_path):
        import cv2
        try:
            img = cv2.imread(image_path)
            if img is None:
                return 'general'

            hsv  = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            saturation     = hsv[:, :, 1]
            avg_saturation = np.mean(saturation)

            edges        = cv2.Canny(gray, 50, 150)
            edge_density = np.sum(edges > 0) / edges.size

            rgb         = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            pixels      = rgb.reshape(-1, 3)
            sample_size = min(10000, len(pixels))
            sampled     = pixels[np.random.choice(len(pixels), sample_size, replace=False)]
            color_div   = len(np.unique(sampled, axis=0)) / sample_size
            noise_level = cv2.Laplacian(gray, cv2.CV_64F).var()

            is_anime = False
            if edge_density > 0.10:
                is_anime = True
            if edge_density > 0.08 and avg_saturation < 120:
                is_anime = True
            if edge_density > 0.07 and color_div < 0.5:
                is_anime = True

            if is_anime:
                return 'anime'
            elif noise_level > 100 and color_div > 0.5:
                return 'photo'
            else:
                return 'general'

        except Exception as e:
            print(f"Image classification failed: {e}")
            return 'general'

    def analyze_with_heuristics(self, image_path, image_type='general'):
        import cv2
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
                hist_variance       = np.var(hist_r) + np.var(hist_g) + np.var(hist_b)
                color_banding_score = 1.0 if hist_variance > 5000000 else 0.0

                patch_size    = 30
                h, w          = gray.shape
                smooth_patches, total_patches = 0, 0
                for y in range(0, h - patch_size, patch_size):
                    for x in range(0, w - patch_size, patch_size):
                        patch = gray[y:y+patch_size, x:x+patch_size]
                        if np.var(patch) < 200:
                            smooth_patches += 1
                        total_patches += 1
                smoothness_score = smooth_patches / total_patches if total_patches > 0 else 0

                grad_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
                grad_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
                gradient_mag          = np.sqrt(grad_x**2 + grad_y**2)
                smooth_gradient_ratio = np.sum(gradient_mag < 30) / gradient_mag.size
                gradient_score        = 1.0 if smooth_gradient_ratio > 0.6 else 0.0

                overall_score = (color_banding_score * 0.4 +
                                 smoothness_score    * 0.4 +
                                 gradient_score      * 0.2)
                details = {
                    'color_banding'      : color_banding_score,
                    'smoothness'         : smoothness_score,
                    'gradient_perfection': gradient_score,
                    'type'               : 'anime'
                }

            else:
                noise       = cv2.Laplacian(gray, cv2.CV_64F).var()
                noise_score = 1.0 if noise < 10 else 0.0

                edges        = cv2.Canny(gray, 50, 150)
                edge_density = np.sum(edges > 0) / edges.size
                smooth_score = 1.0 if edge_density < 0.05 else 0.0

                rgb         = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                pixels      = rgb.reshape(-1, 3)
                color_ratio = len(np.unique(pixels, axis=0)) / pixels.shape[0]
                color_score = 1.0 if color_ratio < 0.15 else 0.0

                f          = np.fft.fft2(gray)
                fshift     = np.fft.fftshift(f)
                magnitude  = np.abs(fshift)
                cy, cx     = magnitude.shape[0]//2, magnitude.shape[1]//2
                radius     = min(cx, cy) // 4
                center_reg = magnitude[cy-radius:cy+radius, cx-radius:cx+radius]
                freq_ratio = np.mean(center_reg) / (np.mean(magnitude) + 1e-10)
                freq_score = 1.0 if freq_ratio > 50 else 0.0

                overall_score = (noise_score + smooth_score + color_score + freq_score) / 4
                details = {
                    'noise_level'    : noise,
                    'edge_density'   : edge_density,
                    'color_diversity': color_ratio,
                    'frequency_ratio': freq_ratio,
                    'type'           : 'photo'
                }

            return overall_score, details

        except Exception as e:
            print(f"Heuristic analysis failed: {e}")
            return 0, {}

    def predict_single_model(self, image, model, processor):
        try:
            inputs = processor(images=image, return_tensors="pt")
            with torch.no_grad():
                outputs       = model(**inputs)
                logits        = outputs.logits
                probabilities = torch.nn.functional.softmax(logits, dim=-1)

            predicted_class = logits.argmax(-1).item()
            confidence      = probabilities[0][predicted_class].item()
            predicted_label = model.config.id2label[predicted_class]

            is_ai = any(k in predicted_label.lower()
                        for k in ['artificial', 'ai', 'fake', 'generated', 'synthetic'])

            if any(k in predicted_label.lower()
                   for k in ['real', 'human', 'authentic', 'natural']):
                is_ai    = False
                ai_score = 1 - confidence
            else:
                ai_score = confidence if is_ai else 1 - confidence

            return ai_score, confidence, predicted_label, probabilities[0].tolist()

        except Exception as e:
            print(f"Error in model prediction: {e}")
            return 0.5, 0.5, "error", []

    def get_ai_score(self, image_path: str) -> float:
        """
        Returns a float [0, 1] representing AI likelihood.
        Called by video.py for per-frame analysis.
        """
        try:
            image      = Image.open(image_path).convert('RGB')
            image_type = self.classify_image_type(image_path)

            ai_scores = []
            weights   = []

            for model, processor, name in zip(self.models, self.processors, self.model_names):
                score, _, _, _ = self.predict_single_model(image, model, processor)
                ai_scores.append(score)
                weights.append(1.0)

            # Heuristic at low weight
            h_score, _ = self.analyze_with_heuristics(image_path, image_type)
            ai_scores.append(h_score)
            weights.append(0.5)

            return float(np.average(ai_scores, weights=weights))

        except Exception:
            return 0.0

    def analyze(self, image_path):
        """Full verbose analysis — CLI use only."""
        print("=" * 70)
        print("ENHANCED AI IMAGE DETECTION (Multi-Model Ensemble)")
        print("=" * 70)
        print(f"\nAnalyzing: {image_path}")

        try:
            image = Image.open(image_path).convert('RGB')
            print(f"Image size: {image.size}")
        except Exception as e:
            print(f"Error loading image: {e}")
            return

        image_type = self.classify_image_type(image_path)
        print(f"Image type: {image_type.upper()}\n")

        ai_scores   = []
        all_weights = []

        for i, (model, processor, name) in enumerate(
            zip(self.models, self.processors, self.model_names)
        ):
            print(f"Model {i+1} ({name}):")
            ai_score, confidence, label, _ = self.predict_single_model(image, model, processor)
            ai_scores.append(ai_score)
            all_weights.append(1.0)
            verdict = "AI-Generated" if ai_score > 0.5 else "Authentic"
            print(f"   Verdict  : {verdict}")
            print(f"   AI Score : {ai_score*100:.1f}%")
            print(f"   Label    : {label}")
            print()

        print("Heuristic Analysis:")
        heuristic_score, _ = self.analyze_with_heuristics(image_path, image_type)
        ai_scores.append(heuristic_score)
        all_weights.append(0.5)
        print(f"   AI Score : {heuristic_score*100:.1f}%\n")

        weighted_score = float(np.average(ai_scores, weights=all_weights))
        average_score  = float(np.mean(ai_scores))

        print("=" * 70)
        print(f"Average Score  : {average_score*100:.1f}%")
        print(f"Weighted Score : {weighted_score*100:.1f}%")

        if weighted_score > 0.75:
            verdict = "HIGHLY LIKELY AI-GENERATED"
        elif weighted_score > 0.5:
            verdict = "LIKELY AI-GENERATED"
        elif weighted_score > 0.35:
            verdict = "UNCERTAIN"
        else:
            verdict = "LIKELY AUTHENTIC"

        print(f"\nResult: {verdict}")
        print("=" * 70)
        return weighted_score


def detect_ai_image(image_path):
    detector = EnsembleAIImageDetector()
    detector.analyze(image_path)


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        detect_ai_image(sys.argv[1])
    else:
        print("Usage: python video_image.py <image_path>")