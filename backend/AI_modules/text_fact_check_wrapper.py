import sys
import json
import os
import io

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

_real_stdout = sys.stdout
sys.path.insert(0, os.path.dirname(__file__))


def fact_check_claim(claim, api_key, search_engine_id):
    try:
        sys.stdout = io.StringIO()
        print(f"DEBUG api_key={api_key[:10]}... search_id={search_engine_id}", file=sys.stderr)

        from text import ClaimVerifier
        verifier = ClaimVerifier(api_key, search_engine_id, use_nli=True)
        result   = verifier.verify_claim_advanced(claim, num_sources=10)

        # Capture what text.py printed
        captured = sys.stdout.getvalue()
        sys.stdout = _real_stdout

        # Log captured output to stderr so we can see it in Node
        print(captured, file=sys.stderr)

        output = {
            "success":  True,
            "claim":    result["claim"],
            "verdict":  result["verdict"],
            "confidence": result["confidence"],
            "supporting_sources":    result.get("supporting_sources", [])[:3],
            "contradicting_sources": result.get("contradicting_sources", [])[:3],
            "total_sources":         result.get("total_sources", 0),
            "supporting_weight":     result.get("supporting_weight", 0),
            "contradicting_weight":  result.get("contradicting_weight", 0),
            "timestamp":             result.get("timestamp", ""),
        }
        print(json.dumps(output))
        return 0
    except Exception as e:
        sys.stdout = _real_stdout
        print(json.dumps({"success": False, "error": str(e), "verdict": "UNVERIFIABLE", "confidence": "Error"}))
        return 1


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(json.dumps({
            "success": False,
            "error":   "Usage: python text_fact_check_wrapper.py <claim_file> <api_key> <search_engine_id>",
        }))
        sys.exit(1)

    claim_file       = sys.argv[1]
    api_key          = sys.argv[2]
    search_engine_id = sys.argv[3]

    # Read claim from temp file (avoids Windows argument escaping issues)
    try:
        with open(claim_file, 'r', encoding='utf-8') as f:
            claim = f.read().strip()
        os.remove(claim_file)
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error":   f"Could not read claim file: {e}",
            "verdict": "UNVERIFIABLE",
        }))
        sys.exit(1)

    if not claim or len(claim) < 10:
        print(json.dumps({
            "success": False,
            "error":   "Claim too short (minimum 10 characters)",
            "verdict": "UNVERIFIABLE",
        }))
        sys.exit(1)

    sys.exit(fact_check_claim(claim, api_key, search_engine_id))