import sys
import json
import os
import warnings

# Suppress ALL warnings before any imports
warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TRANSFORMERS_VERBOSITY'] = 'error'
os.environ['HF_HUB_DISABLE_PROGRESS_BARS'] = '1'

def detect_ai(image_path):
    try:
        # Suppress transformers logging
        import logging
        logging.disable(logging.CRITICAL)

        from image import EnsembleAIImageDetector

        detector = EnsembleAIImageDetector(silent=True)
        ai_score = detector.get_ai_score(image_path)

        # Re-enable logging after detection
        logging.disable(logging.NOTSET)

        print(json.dumps({
            "success": True,
            "is_ai": float(ai_score) > 0.5,
            "confidence": float(ai_score),
            "threshold": 0.5
        }))
        return 0

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "is_ai": False,
            "confidence": 0.0
        }))
        return 1

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"success": False, "error": "No image path provided"}))
        sys.exit(1)

    image_path = sys.argv[1]

    if not os.path.exists(image_path):
        err_msg = "Image not found: " + image_path
        print(json.dumps({"success": False, "error": err_msg}))
        sys.exit(1)

    sys.exit(detect_ai(image_path))