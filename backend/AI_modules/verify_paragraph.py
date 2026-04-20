"""
verify_paragraph.py — Extract claims from a paragraph and verify each one
=========================================================================

Pipeline:
  1. Takes a paragraph of text as input
  2. Uses claimextractor.py to extract factual claims (filtering out opinions)
  3. Feeds each claim into text.py's ClaimVerifier for fact-checking
  4. Displays combined report and saves results

Usage:
    python verify_paragraph.py --text "Your paragraph here..."
    python verify_paragraph.py --file input.txt
    python verify_paragraph.py                     # interactive mode
    python verify_paragraph.py --simple             # rule-based only (no BART model)
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

# Import claim extractor
from claimextractor import extract_claims_hybrid, extract_claims_simple

# Import claim verifier
from text import ClaimVerifier


def parse_args():
    parser = argparse.ArgumentParser(
        description="Extract claims from a paragraph and verify each one"
    )
    parser.add_argument(
        "--text", type=str, default=None,
        help="The paragraph text to analyze"
    )
    parser.add_argument(
        "--file", type=str, default=None,
        help="Path to a text file containing the paragraph"
    )
    parser.add_argument(
        "--simple", action="store_true",
        help="Use simple rule-based extraction only (faster, no BART model)"
    )
    parser.add_argument(
        "--threshold", type=float, default=0.5,
        help="NLI confidence threshold for hybrid extraction (default: 0.5)"
    )
    parser.add_argument(
        "--output", type=str, default="paragraph_results.json",
        help="Output JSON file (default: paragraph_results.json)"
    )
    return parser.parse_args()


def get_input_text(args):
    """Get the paragraph text from args, file, or interactive input."""
    if args.text:
        return args.text
    elif args.file:
        if not os.path.exists(args.file):
            print(f"[ERROR] File not found: {args.file}")
            sys.exit(1)
        with open(args.file, 'r', encoding='utf-8') as f:
            return f.read()
    else:
        # Interactive mode
        print("Enter your paragraph (press Enter twice to submit):")
        print("-" * 50)
        lines = []
        empty_count = 0
        while True:
            try:
                line = input()
                if line == "":
                    empty_count += 1
                    if empty_count >= 2:
                        break
                    lines.append(line)
                else:
                    empty_count = 0
                    lines.append(line)
            except EOFError:
                break
        return "\n".join(lines).strip()


def main():
    args = parse_args()

    # API credentials (same as text.py)
    API_KEY = "AIzaSyCN52gJ1knhmrKzwoSHLKOflPBSjIGA1hU"
    SEARCH_ENGINE_ID = "2766c633cb7764283"

    print("=" * 70)
    print("  CLAIM EXTRACTION + VERIFICATION PIPELINE")
    print("=" * 70)

    # ── Step 1: Get input text ────────────────────────────────────────────
    paragraph = get_input_text(args)

    if not paragraph.strip():
        print("[ERROR] No input text provided.")
        sys.exit(1)

    print(f"\n[INPUT] Paragraph ({len(paragraph)} chars):")
    print("-" * 50)
    print(paragraph)
    print("-" * 50)

    # ── Step 2: Extract claims ────────────────────────────────────────────
    print(f"\n{'=' * 70}")
    print("  STEP 1: EXTRACTING FACTUAL CLAIMS")
    print(f"{'=' * 70}")

    if args.simple:
        print("[MODE] Simple rule-based extraction\n")
        claims = extract_claims_simple(paragraph)
    else:
        print(f"[MODE] Hybrid extraction (rules + NLI, threshold={args.threshold})\n")
        claims = extract_claims_hybrid(paragraph, confidence_threshold=args.threshold)

    print(f"\n{'=' * 70}")
    print(f"  EXTRACTION RESULTS: {len(claims)} claims found")
    print(f"{'=' * 70}")

    if not claims:
        print("\n[INFO] No factual claims were extracted from the paragraph.")
        print("       The text may contain only opinions, questions, or suggestions.")
        sys.exit(0)

    for i, claim in enumerate(claims, 1):
        print(f"  {i}. {claim}")

    # ── Step 3: Verify each claim ─────────────────────────────────────────
    print(f"\n{'=' * 70}")
    print("  STEP 2: VERIFYING EXTRACTED CLAIMS")
    print(f"{'=' * 70}")
    print(f"\n[INFO] Verifying {len(claims)} claims against web sources...\n")

    verifier = ClaimVerifier(API_KEY, SEARCH_ENGINE_ID, use_nli=True)

    results = []
    for i, claim in enumerate(claims, 1):
        print(f"\n{'#' * 70}")
        print(f"  [{i}/{len(claims)}] Verifying: {claim}")
        print(f"{'#' * 70}")

        try:
            result = verifier.verify_claim_advanced(claim)
            verifier.display_results(result)
            results.append(result)
        except Exception as e:
            print(f"  [ERROR] Failed to verify: {e}")
            results.append({
                "claim": claim,
                "verdict": "ERROR",
                "confidence": str(e),
                "supporting_sources": [],
                "contradicting_sources": [],
                "neutral_sources": [],
                "total_sources": 0,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })

        # Rate limiting between claims
        if i < len(claims):
            time.sleep(1)

    # ── Step 4: Summary report ────────────────────────────────────────────
    print(f"\n{'=' * 70}")
    print("  FINAL REPORT")
    print(f"{'=' * 70}")

    print(f"\n  Input paragraph: {len(paragraph)} characters")
    print(f"  Claims extracted: {len(claims)}")
    print(f"  Claims verified: {len(results)}")

    print(f"\n  {'─' * 60}")

    for r in results:
        verdict = r.get('verdict', 'UNKNOWN')
        if "TRUE" in verdict:
            icon = "[TRUE]"
        elif "FALSE" in verdict:
            icon = "[FALSE]"
        elif "DISPUTED" in verdict:
            icon = "[DISPUTED]"
        elif "ERROR" in verdict:
            icon = "[ERROR]"
        else:
            icon = "[?]"

        claim_text = r['claim'][:65]
        print(f"  {icon:>12}  {claim_text}")
        if r.get('supporting_weight') is not None:
            print(f"               Support: {r.get('supporting_weight', 0):.2f} | "
                  f"Contradict: {r.get('contradicting_weight', 0):.2f} | "
                  f"Sources: {r.get('total_sources', 0)}")

    # ── Save results ──────────────────────────────────────────────────────
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), args.output)
    output_data = {
        "input_paragraph": paragraph,
        "extraction_method": "simple" if args.simple else "hybrid",
        "claims_extracted": claims,
        "verification_results": results,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"\n  [OK] Results saved to: {output_path}")
    print(f"\n{'=' * 70}\n")


if __name__ == "__main__":
    main()