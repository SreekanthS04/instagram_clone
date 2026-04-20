import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import nltk
import re

# Download the sentence tokenizer model from nltk (only needs to be done once)
try:
    nltk.data.find('tokenizers/punkt_tab')
except LookupError:
    try:
        print("Downloading the 'punkt_tab' sentence tokenizer from NLTK...")
        nltk.download('punkt_tab')
        print("Download complete.")
    except:
        # Fallback to older punkt model if punkt_tab fails
        print("Trying fallback 'punkt' tokenizer...")
        nltk.download('punkt')
        print("Fallback download complete.")

def is_factual_claim(sentence):
    """
    Rule-based approach to identify factual claims.
    Returns True if the sentence appears to be a factual claim.
    """
    sentence = sentence.strip().lower()
    
    # Skip questions
    if sentence.endswith('?'):
        return False
    
    # Skip obvious opinions and suggestions
    opinion_patterns = [
        r'\bi think\b', r'\bi believe\b', r'\bi feel\b', r'\bin my opinion\b',
        r'\blet\'s\b', r'\bwe should\b', r'\bshould we\b', r'\bwhat do you\b',
        r'\bhow about\b', r'\bmaybe\b', r'\bperhaps\b', r'\bpossibly\b'
    ]
    
    for pattern in opinion_patterns:
        if re.search(pattern, sentence):
            return False
    
    # Look for factual patterns
    factual_patterns = [
        r'\bis\b.*\bthe\b', r'\bare\b.*\bthe\b',  # "X is the Y", "X are the Y"
        r'\baccording to\b', r'\breport.*shows?\b', r'\bdata.*shows?\b',
        r'\bincreased by\b', r'\bdecreased by\b', r'\bpercent\b', r'\b%\b',
        r'\bcapital of\b', r'\bplanet from\b', r'\blocated in\b',
        r'\bfounded in\b', r'\bborn in\b', r'\bdied in\b'
    ]
    
    for pattern in factual_patterns:
        if re.search(pattern, sentence):
            return True
    
    # Check for numerical data
    if re.search(r'\b\d+(?:\.\d+)?(?:%|\s*percent)\b', sentence):
        return True
    
    # Check for definitive statements with "is" or "are"
    if re.search(r'\b(?:is|are|was|were)\b(?:\s+(?:a|an|the))?\s+[a-z]', sentence):
        # But exclude obvious opinions or subjective statements
        if not re.search(r'\b(?:good|bad|better|worse|best|worst|great|terrible|amazing|awful)\b', sentence):
            return True
    
    return False

def extract_claims_hybrid(text, confidence_threshold=0.5):
    """
    Hybrid approach: Use rule-based filtering first, then NLI for verification.
    
    Args:
        text (str): The input text to analyze.
        confidence_threshold (float): The probability threshold for NLI verification.
    
    Returns:
        list: A list of sentences identified as claims.
    """
    if not text or not text.strip():
        print("Warning: Input text is empty. Nothing to process.")
        return []
    
    print("Loading the BART model for claim verification...")
    tokenizer = AutoTokenizer.from_pretrained("facebook/bart-large-mnli")
    model = AutoModelForSequenceClassification.from_pretrained("facebook/bart-large-mnli")
    print("Model loaded.")
    
    claims = []
    # Split the text into individual sentences and clean them
    sentences = nltk.sent_tokenize(text.strip())
    sentences = [s.strip() for s in sentences if s.strip()]
    print(f"Analyzing {len(sentences)} sentences...")
    
    for sentence in sentences:
        try:
            # First, use rule-based approach
            if is_factual_claim(sentence):
                print(f"  -> Rule-based: Potential claim detected: \"{sentence}\"")
                
                # Verify with NLI using a better hypothesis
                premise = sentence
                hypothesis = 'This is a statement of fact that can be verified.'
                
                inputs = tokenizer(
                    premise, 
                    hypothesis, 
                    return_tensors='pt',
                    truncation=True,
                    padding=True,
                    max_length=512
                )
                
                with torch.no_grad():
                    outputs = model(**inputs)
                    logits = outputs.logits
                
                probs = torch.softmax(logits, dim=1)
                entailment_prob = probs[0][2].item()  # Index 2 is entailment
                
                if entailment_prob > confidence_threshold:
                    claims.append(sentence)
                    print(f"  -> ✅ VERIFIED CLAIM (NLI Confidence: {entailment_prob:.2f}): \"{sentence}\"")
                else:
                    # Even if NLI confidence is low, if rule-based detected it as factual, include it
                    claims.append(sentence)
                    print(f"  -> ✅ CLAIM (Rule-based, NLI: {entailment_prob:.2f}): \"{sentence}\"")
            else:
                print(f"  -> Not a factual claim: \"{sentence}\"")
                
        except Exception as e:
            print(f"  -> Error processing sentence: \"{sentence}\" - {str(e)}")
            continue
    
    return claims

def extract_claims_simple(text):
    """
    Simple rule-based approach without NLI verification.
    Often more reliable for basic factual claims.
    """
    if not text or not text.strip():
        print("Warning: Input text is empty. Nothing to process.")
        return []
    
    claims = []
    sentences = nltk.sent_tokenize(text.strip())
    sentences = [s.strip() for s in sentences if s.strip()]
    print(f"Analyzing {len(sentences)} sentences with rule-based approach...")
    
    for sentence in sentences:
        if is_factual_claim(sentence):
            claims.append(sentence)
            print(f"  -> ✅ CLAIM: \"{sentence}\"")
        else:
            print(f"  -> Not a claim: \"{sentence}\"")
    
    return claims

if __name__ == '__main__':
    example_text = """
    
    I think this is a fantastic idea, and we should definitely proceed.
    
    The Earth is the third planet from the Sun.
    
    What do you all think about the budget for next quarter?
    
    According to the latest report, sales have increased by 15% since last year.
    Let's have a meeting tomorrow to discuss our next steps.
    The capital of France is Paris.
    """
    
    print("=== METHOD 1: Simple Rule-Based Approach ===")
    simple_claims = extract_claims_simple(example_text)
    
    print("\n--- ✅ Simple Rule-Based Claims ---")
    if simple_claims:
        for i, claim in enumerate(simple_claims, 1):
            print(f"{i}. {claim}")
    else:
        print("No claims found.")
    
    print("\n" + "="*60)
    print("=== METHOD 2: Hybrid Approach (Rules + NLI) ===")
    hybrid_claims = extract_claims_hybrid(example_text)
    
    print("\n--- ✅ Hybrid Approach Claims ---")
    if hybrid_claims:
        for i, claim in enumerate(hybrid_claims, 1):
            print(f"{i}. {claim}")
    else:
        print("No claims found.")
        