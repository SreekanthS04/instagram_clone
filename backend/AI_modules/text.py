import requests
import json
from typing import List, Dict, Tuple
from datetime import datetime
import re
import numpy as np
from bs4 import BeautifulSoup  
import time  
import sys
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass  
try:
    from transformers import pipeline
    NLI_AVAILABLE = True
    print("[OK] NLI model available")
except ImportError:
    NLI_AVAILABLE = False
    print("[WARNING] transformers not found. Install: pip install transformers torch")



class ClaimVerifier:
    def __init__(self, api_key: str, search_engine_id: str, use_nli: bool = True):
        self.api_key = api_key
        self.search_engine_id = search_engine_id
        self.base_url = "https://www.googleapis.com/customsearch/v1"

        self.use_nli = use_nli and NLI_AVAILABLE
        if self.use_nli:
            print("Loading NLI model (DeBERTa-v3-base-mnli-fever-anli)...")
            self.nli_model = pipeline(
                "zero-shot-classification",
                model="MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli",
                device=-1  
            )
            print("[OK] NLI model loaded\n")
        else:
            self.nli_model = None

        self.trusted_domains = {
            'wikipedia.org': 0.9, 'britannica.com': 0.9, 'snopes.com': 0.95,
            'factcheck.org': 0.95, 'politifact.com': 0.95, 'reuters.com': 0.85,
            'apnews.com': 0.85, 'bbc.com': 0.8, 'nature.com': 0.9,
            'science.org': 0.9, 'nih.gov': 0.95, 'nasa.gov': 0.95,
            'cdc.gov': 0.95, '.edu': 0.85, '.gov': 0.9
        }

    def extract_top_chunks(self, claim: str, text: str, chunk_size: int = 500, overlap: int = 200, top_k: int = 3) -> List[Tuple[str, float]]:
        """
        Splits text into overlapping chunks and returns the top-K most relevant to the claim.
        Uses word coverage scoring. Returns list of (chunk, score) tuples.
        """
        if len(text) <= chunk_size:
            return [(text, 1.0)]

        stop_words = {'the', 'a', 'an', 'is', 'are', 'of', 'to', 'in', 'and', 'or', 'at', 'on', 'for', 'with', 'by'}
        claim_words = set(re.findall(r'\w+', claim.lower())) - stop_words
        if not claim_words:
            return [(text[:chunk_size], 0.0)]

        scored_chunks = []
        stride = chunk_size - overlap
        for i in range(0, len(text), stride):
            chunk = text[i : i + chunk_size]
            if len(chunk) < 80:
                continue
            chunk_words = set(re.findall(r'\w+', chunk.lower()))
            intersection = len(claim_words.intersection(chunk_words))
            score = intersection / len(claim_words)
            scored_chunks.append((chunk, score))

        # Sort by relevance and return top K
        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        return scored_chunks[:top_k] if scored_chunks else [(text[:chunk_size], 0.0)]

    def fetch_page_content(self, url: str, max_length: int = 15000) -> str:
        """Fetch and extract clean text from webpage HTML. Skips PDF URLs."""
        try:
            # Skip PDFs - they return binary garbage
            if url.lower().endswith('.pdf'):
                print(f"    [SKIP] PDF URL: {url[:60]}")
                return ""

            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()

            # Check content type - skip non-HTML
            content_type = response.headers.get('content-type', '')
            if 'html' not in content_type and 'text' not in content_type:
                print(f"    [SKIP] Non-HTML content: {content_type[:40]}")
                return ""

            soup = BeautifulSoup(response.text, 'html.parser')
            # Remove unwanted elements
            for element in soup(['script', 'style', 'nav', 'footer', 'header', 'aside']):
                element.decompose()
            # Prioritize paragraph text which usually contains the main content
            paragraphs = soup.find_all('p')
            if len(paragraphs) > 3: # If we have enough paragraphs, rely on them
                 text = ' '.join(p.get_text().strip() for p in paragraphs)
            else:
                 # Fallback to general text extraction
                 text = soup.get_text(separator=' ', strip=True)
            
            # Clean whitespace
            text = re.sub(r'\n+', '\n', text)
            text = re.sub(r'\s+', ' ', text).strip()
            return text[:max_length]
        except Exception as e:
            print(f"    [WARN] Failed to fetch {url}: {str(e)[:50]}")
            return ""

    def search(self, query: str, num_results: int = 10) -> Dict:
        """Perform Google search."""
        params = {
            'key': self.api_key,
            'cx': self.search_engine_id,
            'q': query,
            'num': num_results
        }

        try:
            print(f"   Querying: '{query[:50]}...'")
            response = requests.get(self.base_url, params=params, timeout=10)

            print(f"   Response status: {response.status_code}")

            if response.status_code == 429:
                return {"error": "Quota exceeded"}
            elif response.status_code == 400:
                print(f"   Response: {response.text[:200]}")
                return {"error": f"Bad request: {response.text[:100]}"}
            elif response.status_code == 403:
                return {"error": "API key invalid or unauthorized"}
            elif response.status_code != 200:
                return {"error": f"API error: {response.status_code}"}

            data = response.json()

            if 'items' in data:
                print(f"   [OK] Found {len(data['items'])} results")
                return data
            else:
                print(f"   [INFO] No 'items' in response. Keys: {list(data.keys())}")
                return {"items": []}

        except Exception as e:
            print(f"   [WARN] Exception: {str(e)}")
            return {"error": str(e)}

    def detect_stance_nli(self, claim: str, text: str, title: str) -> Tuple[str, float]:
        """
        USE NLI MODEL with zero-shot classification and multi-chunk aggregation.
        Tests each chunk against candidate labels to determine if the evidence
        supports or contradicts the claim.
        """
        full_text = title + " " + text
        text_lower = full_text.lower()
        title_lower = title.lower()

        if not self.use_nli:
            return self.keyword_based_stance(claim, full_text, text_lower, title_lower)

        # Get top-K most relevant chunks from the page
        top_chunks = self.extract_top_chunks(claim, text, top_k=3)
        print(f"   Evaluating {len(top_chunks)} chunks...")

        # Candidate labels for zero-shot classification
        # These are what the model will test the evidence against
        candidate_labels = [
            f"{claim}",
            f"It is not true that {claim.lower()}",
        ]

        support_scores = []
        contradict_scores = []

        try:
            for i, (chunk, relevance) in enumerate(top_chunks):
                # Skip chunks that are barely relevant to the claim
                # Raised to 0.4 to prevent false contradictions from
                # broad articles that only loosely mention the topic
                if relevance < 0.4:
                    print(f"     Chunk {i+1} (rel={relevance:.2f}): SKIPPED (too low relevance) | \"{chunk[:50]}...\"")
                    continue

                # Build the evidence text
                evidence = f"{title}. {chunk}"
                if len(evidence) > 1200:
                    evidence = evidence[:1200]

                # Zero-shot: "Given this evidence, which label fits best?"
                result = self.nli_model(
                    evidence,
                    candidate_labels=candidate_labels,
                    multi_label=False
                )

                # result['labels'] is sorted by score descending
                # result['scores'] corresponds to each label
                top_label = result['labels'][0]
                top_score = result['scores'][0]
                second_score = result['scores'][1]

                is_support = (top_label == candidate_labels[0])
                nli_margin = top_score - second_score
                print(f"     Chunk {i+1} (rel={relevance:.2f}): {'SUPPORT' if is_support else 'CONTRADICT'} ({top_score:.3f} vs {second_score:.3f}, margin={nli_margin:.2f}) | \"{chunk[:50]}...\"")

                # Require minimum NLI confidence margin to count
                # Prevents weak/ambiguous signals from broad articles
                if nli_margin < 0.15:
                    print(f"     -> margin too low ({nli_margin:.2f} < 0.15), treating as neutral")
                    continue

                # Weight by relevance
                weight = 0.5 + 0.5 * relevance
                if is_support:
                    support_scores.append(top_score * weight)
                    contradict_scores.append(second_score * weight)
                else:
                    contradict_scores.append(top_score * weight)
                    support_scores.append(second_score * weight)

            total_support = sum(support_scores)
            total_contra = sum(contradict_scores)
            print(f"   [AGG] Support={total_support:.3f} | Contra={total_contra:.3f}")

            # If no chunks were relevant enough, default to neutral
            if not support_scores and not contradict_scores:
                print(f"   [AGG] No relevant chunks found, defaulting to neutral")
                return 'neutral', 0.5

            # Require a meaningful margin to declare support/contradiction
            margin = abs(total_support - total_contra) / (total_support + total_contra + 1e-9)
            if margin < 0.1:
                # Too close to call
                return 'neutral', 0.5

            if total_contra > total_support:
                confidence = total_contra / (total_contra + total_support + 1e-9)
                return 'contradicting', min(0.99, confidence)
            elif total_support > total_contra:
                confidence = total_support / (total_contra + total_support + 1e-9)
                return 'supporting', min(0.99, confidence)
            else:
                return 'neutral', 0.5

        except Exception as e:
            print(f"   [WARN] NLI failed: {e}")
            return self.keyword_based_stance(claim, full_text, text_lower, title_lower)

    def keyword_based_stance(self, claim: str, full_text: str, text_lower: str, title_lower: str) -> Tuple[str, float]:
        """Fallback when NLI not available."""
        strong_contradiction = ['myth', 'hoax', 'false', 'debunk', 'disproven', 'fake', 'not true']
        has_contradiction = any(word in text_lower for word in strong_contradiction)

        title_has_not = 'not' in title_lower or "isn't" in title_lower

        if title_has_not or has_contradiction:
            return 'contradicting', 0.75
        else:
            # Simple word overlap
            claim_words = set(claim.lower().split()) - {'the', 'is', 'are', 'a', 'an'}
            text_words = set(text_lower.split())
            overlap = len(claim_words.intersection(text_words)) / max(len(claim_words), 1)

            if overlap > 0.3:
                return 'supporting', min(0.8, overlap + 0.2)
            else:
                return 'neutral', overlap

    def calculate_credibility(self, domain: str) -> float:
        """Calculate source credibility."""
        domain_lower = domain.lower()
        for trusted, score in self.trusted_domains.items():
            if trusted in domain_lower:
                return score
        return 0.5

    def is_relevant(self, claim: str, snippet: str, title: str) -> bool:
        """Check if source is relevant to claim."""
        full_text = (snippet + " " + title).lower()
        claim_lower = claim.lower()

        # Extract key words from claim (length > 3 to avoid common words)
        stop_words = {'the', 'is', 'are', 'was', 'were', 'a', 'an', 'in', 'on', 'at', 'to',
                      'for', 'of', 'and', 'or', 'that', 'this', 'with', 'from', 'than',
                      'more', 'most', 'also', 'about', 'been', 'have', 'has', 'all',
                      'which', 'their', 'only', 'roughly', 'approximately', 'over',
                      'combined', 'currently'}
        claim_words = set(w for w in claim_lower.split() if len(w) > 3) - stop_words
        text_words = set(w for w in full_text.split() if len(w) > 3) - stop_words

        # Check word overlap
        overlap = len(claim_words.intersection(text_words))
        overlap_ratio = overlap / len(claim_words) if claim_words else 0

        # Check number matching for numerical claims
        claim_numbers = set(re.findall(r'\d+', claim))
        text_numbers = set(re.findall(r'\d+', full_text))
        has_numbers = len(claim_numbers.intersection(text_numbers)) > 0

        # Extract key entities (capitalized words)
        claim_entities = set(w for w in claim.split() if w and w[0].isupper())
        text_entities = set(w for w in (snippet + " " + title).split() if w and w[0].isupper())
        entity_match = len(claim_entities.intersection(text_entities)) > 0

        # TOPIC CHECK: The title must contain at least one topic-specific
        # content word from the claim. This prevents broad pages like
        # 'Greenhouse gas emissions' from being treated as relevant to
        # 'fashion industry carbon emissions'.
        title_words = set(w for w in title.lower().split() if len(w) > 3) - stop_words
        topic_match = len(claim_words.intersection(title_words)) >= 1

        # Relevant if topic matches AND has supporting evidence:
        # 1. Title mentions the topic AND (overlap >= 2 or numbers match)
        # 2. OR very high overlap ratio (>40%) even without title match
        is_rel = (topic_match and (overlap >= 2 or has_numbers or entity_match)) or overlap_ratio > 0.4

        if not is_rel:
            print(f"   [X] Filtered: {title[:60]}... (overlap: {overlap}, topic: {topic_match}, numbers: {has_numbers})")

        return is_rel

    def verify_claim_advanced(self, claim: str, num_sources: int = 10) -> Dict:
        """Verify claim using NLI + full page content for top sources."""
        print(f"\n{'='*70}")
        print(f"VERIFYING: {claim}")
        print(f"{'='*70}\n")

        # Search
        print(f"[SEARCH] Searching...")
        results1 = self.search(claim, num_sources)
        results2 = self.search(f"fact check {claim}", 5)

        # Debug: check if we got results
        if "error" in results1:
            print(f"   [WARN] Search 1 error: {results1['error']}")
        elif "items" in results1:
            print(f"   [OK] Search 1: {len(results1['items'])} results")
        else:
            print(f"   [INFO] Search 1: No items found")

        if "error" in results2:
            print(f"   [WARN] Search 2 error: {results2['error']}")
        elif "items" in results2:
            print(f"   [OK] Search 2: {len(results2['items'])} results")
        else:
            print(f"   [INFO] Search 2: No items found")

        all_sources = []
        supporting = []
        contradicting = []
        neutral = []

        for results in [results1, results2]:
            if "error" in results or "items" not in results:
                continue

            for item in results.get('items', []):
                title = item.get('title', '')
                snippet = item.get('snippet', '')
                url = item.get('link', '')
                domain = item.get('displayLink', '')

                # Skip duplicates
                if url in [s['url'] for s in all_sources]:
                    continue

                # Check relevance
                if not self.is_relevant(claim, snippet, title):
                    continue

                print(f"   [DOC] Fetching full content: {title[:60]}...")
                full_content = self.fetch_page_content(url)  # Get full page content
                time.sleep(0.5)  # Rate limiting

                # >>> CHANGE: skip this result if full_content is empty <<<
                if not full_content:
                    print(f"   [X] Skipping (no content): {title[:60]}...")
                    continue

                # Detect stance using NLI with full content only
                stance, confidence = self.detect_stance_nli(claim, full_content, title)
                credibility = self.calculate_credibility(domain)

                source = {
                    "title": title,
                    "url": url,
                    "snippet": snippet[:200],
                    "full_content_preview": full_content[:150] + "...",
                    "domain": domain,
                    "credibility": credibility,
                    "stance": stance,
                    "stance_confidence": round(confidence, 3)
                }

                all_sources.append(source)

                if stance == 'contradicting':
                    contradicting.append(source)
                elif stance == 'supporting':
                    supporting.append(source)
                else:
                    neutral.append(source)

        # Calculate weighted scores
        supporting.sort(key=lambda x: x['credibility'] * x['stance_confidence'], reverse=True)
        contradicting.sort(key=lambda x: x['credibility'] * x['stance_confidence'], reverse=True)

        support_weight = sum(s['credibility'] * s['stance_confidence'] for s in supporting)
        contradict_weight = sum(s['credibility'] * s['stance_confidence'] for s in contradicting)
        
        # Expert Veto Logic: Check what high-credibility sources say
        # If reputable sources (> 0.9) strongly disagree with the rest, trust them.
        high_cred_support = sum(s['stance_confidence'] for s in supporting if s['credibility'] >= 0.9)
        high_cred_contra = sum(s['stance_confidence'] for s in contradicting if s['credibility'] >= 0.9)

        avg_cred = sum(s['credibility'] for s in all_sources) / len(all_sources) if all_sources else 0

        # Verdict Logic
        if not all_sources:
            verdict = "UNVERIFIABLE"
            confidence = "No sources"
        
        # Expert Override: If experts strongly contradict, even if total weight is close
        elif high_cred_contra > high_cred_support * 1.3:
             verdict = "LIKELY FALSE"
             confidence = "High (Expert Consensus)"
        elif high_cred_support > high_cred_contra * 1.3:
             verdict = "LIKELY TRUE"
             confidence = "High (Expert Consensus)"
             
        elif contradict_weight > support_weight * 1.3:
            verdict = "LIKELY FALSE"
            confidence = "High" if avg_cred > 0.7 else "Medium"
        elif support_weight > contradict_weight * 1.3:
            verdict = "LIKELY TRUE"
            confidence = "High" if avg_cred > 0.7 else "Medium"
        else:
            verdict = "DISPUTED"
            confidence = "Mixed evidence"

        print(f"\n[OK] Found {len(all_sources)} sources")
        print(f"  Supporting: {len(supporting)} (weight: {support_weight:.2f}, expert: {high_cred_support:.2f})")
        print(f"  Contradicting: {len(contradicting)} (weight: {contradict_weight:.2f}, expert: {high_cred_contra:.2f})")

        return {
            "claim": claim,
            "verdict": verdict,
            "confidence": confidence,
            "supporting_sources": supporting[:5],
            "contradicting_sources": contradicting[:5],
            "neutral_sources": neutral[:3],
            "total_sources": len(all_sources),
            "avg_credibility": round(avg_cred, 3),
            "supporting_weight": round(support_weight, 3),
            "contradicting_weight": round(contradict_weight, 3),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    def display_results(self, result: Dict):
        """Display results."""
        print(f"\n{'='*70}")
        print(f"Results")
        print(f"{'='*70}")
        print(f"Verdict: {result['verdict']}")
        print(f"Confidence: {result['confidence']}")
        print(f"Support: {result['supporting_weight']} | Contradict: {result['contradicting_weight']}")

        if result['supporting_sources']:
            print(f"\n[SUPPORT] SUPPORTING ({len(result['supporting_sources'])}):")
            for i, s in enumerate(result['supporting_sources'], 1):
                print(f"\n{i}. {s['title'][:80]}")
                print(f"   {s['domain']} | {s['stance_confidence']} | Preview: {s['full_content_preview']}")

        if result['contradicting_sources']:
            print(f"\n[CONTRADICT] CONTRADICTING ({len(result['contradicting_sources'])}):")
            for i, s in enumerate(result['contradicting_sources'], 1):
                print(f"\n{i}. {s['title'][:80]}")
                print(f"   {s['domain']} | {s['stance_confidence']} | Preview: {s['full_content_preview']}")

        print(f"\n{'='*70}\n")

    def batch_verify(self, claims: List[str]) -> List[Dict]:
        """Verify multiple claims."""
        results = []
        for i, claim in enumerate(claims, 1):
            print(f"\n{'#'*70}")
            print(f"[{i}/{len(claims)}]")
            print(f"{'#'*70}")
            result = self.verify_claim_advanced(claim)
            results.append(result)
            self.display_results(result)
        return results

    def save_results(self, results: List[Dict], filename: str = "results.json"):
        """Save results."""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"[OK] Saved to '{filename}'")


def main():
    import argparse as _argparse
    import os

    API_KEY = os.getenv("GOOGLE_API_KEY").strip()
    SEARCH_ENGINE_ID = os.getenv("SEARCH_ENGINE_ID")

    parser = _argparse.ArgumentParser(description="NLI-based claim verification")
    parser.add_argument("--claims", nargs="+", type=str, default=None,
                        help="Claims to verify (space-separated, use quotes)")
    args = parser.parse_args()

    verifier = ClaimVerifier(API_KEY, SEARCH_ENGINE_ID, use_nli=True)

    if args.claims:
        claims = args.claims
    else:
        claims = [
            "Water boils at 100 degrees Celsius at sea level",
            "Humans use only 10 percent of their brains",
            "The Great Wall of China is visible from space with the naked eye"
        ]

    print("="*70)
    print("NLI-BASED CLAIM VERIFICATION SYSTEM (WITH FULL PAGE EXTRACTION)")
    print("="*70)

    results = verifier.batch_verify(claims)
    verifier.save_results(results)

    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    for r in results:
        emoji = "[TRUE]" if "TRUE" in r['verdict'] else "[FALSE]" if "FALSE" in r['verdict'] else "[WARN]"
        print(f"{emoji} {r['claim'][:50]}... -> {r['verdict']}")



if __name__ == "__main__":
    main()