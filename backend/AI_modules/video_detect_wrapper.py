import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

import json
import os
import warnings
import logging

# Suppress all noise before any imports
warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TRANSFORMERS_VERBOSITY'] = 'error'
os.environ['HF_HUB_DISABLE_PROGRESS_BARS'] = '1'
logging.disable(logging.CRITICAL)


def detect_ai_video(video_path):
    """Run Enhanced detector and output a single JSON line to stdout."""
    try:
        from video import SimpleWorkingDetector

        detector = SimpleWorkingDetector(silent=True)
        is_ai, confidence, details = detector.predict(video_path, verbose=False)

        result = {
            "success":        True,
            "is_ai":          bool(is_ai),
            "confidence":     float(confidence),
            "threshold":      float(details.get('threshold', 0.5)),
            "image_score":    float(details.get('image_score', 0.0)),
            "temporal_score": float(details.get('temporal_score', 0.0)),
            "has_faces":      bool(details.get('has_faces', False)),
        }

        print(json.dumps(result))
        return 0

    except Exception as e:
        print(json.dumps({
            "success":    False,
            "error":      str(e),
            "is_ai":      False,
            "confidence": 0.0,
        }))
        return 1


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"success": False, "error": "No video path provided"}))
        sys.exit(1)

    video_path = sys.argv[1]

    if not os.path.exists(video_path):
        print(json.dumps({"success": False, "error": f"Video not found: {video_path}"}))
        sys.exit(1)

    sys.exit(detect_ai_video(video_path))