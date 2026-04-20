"""
SIMPLE WORKING AI Video Detector
No overthinking - just what works

Strategy:
1. Your image detector is GOOD - trust it (80% weight)
2. Temporal as backup (20% weight)
3. ONE threshold for everything
4. No complex logic

Usage:
    from video import detect_ai_video
    is_ai, confidence = detect_ai_video("video.mp4")

Silent by default — zero console output unless verbose=True.
Safe for use inside video_detect_wrapper.py (JSON output only).
"""

import cv2
import numpy as np
import warnings
import os
import sys

warnings.filterwarnings('ignore')

# Suppress all ML framework noise BEFORE importing the image detector
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TRANSFORMERS_VERBOSITY'] = 'error'
os.environ['HF_HUB_DISABLE_PROGRESS_BARS'] = '1'

import logging
logging.disable(logging.CRITICAL)

# Import image detector
try:
    from video_image import EnsembleAIImageDetector
    IMAGE_DETECTOR_AVAILABLE = True
except Exception:
    IMAGE_DETECTOR_AVAILABLE = False

class SimpleWorkingDetector:
    """
    Simple detector that just works.

    silent=True  (default) → zero console output, safe for JSON wrappers.
    silent=False           → full human-readable progress output.
    """

    def __init__(self, silent: bool = True):
        self.silent = silent

        self._print("\n" + "=" * 70)
        self._print("SIMPLE WORKING AI VIDEO DETECTOR")
        self._print("=" * 70 + "\n")

        if not IMAGE_DETECTOR_AVAILABLE:
            raise RuntimeError("Image detector (image.py) not found or failed to import")

        try:
            self._print("Loading Image Detector...")
            self.image_detector = EnsembleAIImageDetector()
            self._print("✓ Loaded successfully\n")
        except Exception as e:
            self._print(f"ERROR: {e}\n")
            raise RuntimeError(f"Image detector failed to load: {e}")

        self._print("=" * 70 + "\n")

    # ------------------------------------------------------------------
    # Internal print helper — the ONLY place stdout is written
    # ------------------------------------------------------------------
    def _print(self, msg: str = ""):
        """Print msg only when not in silent mode."""
        if not self.silent:
            print(msg)

    # ------------------------------------------------------------------
    # Frame extraction
    # ------------------------------------------------------------------
    def extract_frames(self, video_path: str, num_frames: int = 20):
        """Extract evenly-spaced frames from a video file."""
        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        if total_frames == 0:
            cap.release()
            raise ValueError(f"Could not read video (0 frames): {video_path}")

        frame_indices = np.linspace(0, total_frames - 1, num_frames, dtype=int)
        frames = []

        for idx in frame_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if ret:
                frames.append(frame)

        cap.release()
        return frames

    # ------------------------------------------------------------------
    # Frame analysis — primary signal (image detector)
    # ------------------------------------------------------------------
    def analyze_frames(self, frames: list, temp_dir: str = "./temp_frames") -> float:
        """
        Run the image detector on every extracted frame.
        Returns the mean AI score across all frames.
        """
        os.makedirs(temp_dir, exist_ok=True)
        ai_scores = []

        for idx, frame in enumerate(frames):
            frame_path = os.path.join(temp_dir, f"frame_{idx}.jpg")
            cv2.imwrite(frame_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 95])

            try:
                ai_score = self.image_detector.get_ai_score(frame_path)
                ai_scores.append(ai_score)

                if idx < 5:                           # show first 5 when verbose
                    self._print(f"  Frame {idx}: {ai_score:.3f}")

            except Exception as e:
                self._print(f"  Frame {idx} error: {e}")
            finally:
                if os.path.exists(frame_path):
                    os.remove(frame_path)

        # Remove temp dir if now empty
        try:
            os.rmdir(temp_dir)
        except OSError:
            pass

        if not ai_scores:
            return 0.0

        avg_score = float(np.mean(ai_scores))
        self._print("  ...")
        self._print(f"  Average: {avg_score:.3f}")
        return avg_score

    # ------------------------------------------------------------------
    # Temporal analysis — secondary signal
    # ------------------------------------------------------------------
    def analyze_temporal(self, frames: list) -> float:
        """
        Optical-flow inconsistency check.
        Backup only — contributes 20% to the final score.
        """
        if len(frames) < 3:
            return 0.0

        flow_scores = []

        for i in range(1, len(frames)):
            prev = cv2.cvtColor(frames[i - 1], cv2.COLOR_BGR2GRAY)
            curr = cv2.cvtColor(frames[i],     cv2.COLOR_BGR2GRAY)

            flow = cv2.calcOpticalFlowFarneback(
                prev, curr, None,
                pyr_scale=0.5, levels=5, winsize=15,
                iterations=3, poly_n=5, poly_sigma=1.2, flags=0
            )

            magnitude = np.sqrt(flow[..., 0] ** 2 + flow[..., 1] ** 2)
            flow_scores.append(np.mean(magnitude))

        flow_std = np.std(flow_scores)
        return float(min(flow_std * 0.08, 1.0))

    # ------------------------------------------------------------------
    # Main prediction
    # ------------------------------------------------------------------
    def predict(self, video_path: str, verbose: bool = None):
        """
        Analyse a video and return (is_ai, final_score, details).

        Args:
            video_path: Path to the video file.
            verbose:    Optional per-call override.
                        True  → force output regardless of self.silent
                        False → force silent regardless of self.silent
                        None  → use self.silent (default)

        Returns:
            (is_ai: bool, final_score: float, details: dict)
        """
        # Per-call silent override — restore afterwards
        original_silent = self.silent
        if verbose is not None:
            self.silent = not verbose

        try:
            self._print(f"\n{'=' * 70}")
            self._print(f"ANALYZING: {video_path}")
            self._print(f"{'=' * 70}\n")

            # 1. Extract frames
            self._print("Extracting frames...")
            frames = self.extract_frames(video_path, num_frames=20)
            self._print(f"✓ Extracted {len(frames)} frames\n")

            # 2. Image detector (PRIMARY — 80%)
            self._print("→ Image Detector Analysis:")
            image_score = self.analyze_frames(frames)
            self._print("")

            # 3. Temporal (SECONDARY — 20%)
            self._print("→ Temporal Analysis:")
            temporal_score = self.analyze_temporal(frames)
            self._print(f"  Score: {temporal_score:.3f}\n")

            # 4. Weighted combination
            final_score = image_score * 0.80 + temporal_score * 0.20
            threshold   = 0.50
            is_ai       = final_score > threshold

            details = {
                'image_score':     float(image_score),
                'temporal_score':  float(temporal_score),
                'final_score':     float(final_score),
                'threshold':       threshold,
                'frames_analyzed': len(frames)
            }

            self._print(f"{'=' * 70}")
            self._print("RESULTS:")
            self._print(f"{'=' * 70}")
            self._print(f"Image Detector:  {image_score:.3f} (80% weight)")
            self._print(f"Temporal:        {temporal_score:.3f} (20% weight)")
            self._print(f"\nFinal Score:     {final_score:.3f}")
            self._print(f"Threshold:       {threshold:.3f}")
            self._print(f"\n{'🤖 AI GENERATED' if is_ai else '✓ AUTHENTIC'}")
            self._print(f"{'=' * 70}\n")

            return is_ai, final_score, details

        finally:
            self.silent = original_silent   # always restore

# ============================================================================
# Module-level convenience API
# ============================================================================

_detector = None

def get_detector(silent: bool = True) -> SimpleWorkingDetector:
    """Return (and lazily create) the shared detector instance."""
    global _detector
    if _detector is None:
        _detector = SimpleWorkingDetector(silent=silent)
    return _detector

def detect_ai_video(video_path: str, detailed: bool = False, verbose: bool = False):
    """
    Detect whether a video is AI-generated.

    Args:
        video_path : Path to the video file.
        detailed   : True → return a dict; False → return (is_ai, confidence).
        verbose    : True → print progress to stdout (human use).
                     False (default) → silent, safe for JSON wrapper usage.

    Returns:
        detailed=False → (is_ai: bool, confidence: float)
        detailed=True  → {is_ai_generated, confidence, image_score,
                           temporal_score, threshold}
    """
    detector = get_detector(silent=not verbose)
    is_ai, confidence, details = detector.predict(video_path, verbose=verbose)

    if detailed:
        return {
            'is_ai_generated': is_ai,
            'confidence':      confidence,
            'image_score':     details['image_score'],
            'temporal_score':  details['temporal_score'],
            'threshold':       details['threshold']
        }
    return is_ai, confidence

# ============================================================================
# CLI entry-point  →  python video.py <path>
# ============================================================================

if __name__ == "__main__":
    if len(sys.argv) > 1:
        _path = sys.argv[1]
    else:
        _path = r"C:\Users\HP\OneDrive\Desktop\instagram_clone-main\backend\AI_modules\test_video.mp4"

    try:
        result = detect_ai_video(_path, detailed=True, verbose=True)

        print("\nSUMMARY:")
        print(f"  Image:    {result['image_score']:.1%}")
        print(f"  Temporal: {result['temporal_score']:.1%}")
        print(f"  Final:    {result['confidence']:.1%}")
        print(f"\n  {'⚠️  AI GENERATED' if result['is_ai_generated'] else '✓ REAL / AUTHENTIC'}")

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

