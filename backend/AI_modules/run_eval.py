"""
=============================================================================
ALL-IN-ONE: Kaggle Dataset → Evaluation → ROC Curve + Confusion Matrix
=============================================================================

SETUP (one time):
─────────────────
1. pip install kaggle scikit-learn matplotlib seaborn pandas tqdm

2. Get your Kaggle API token:
   kaggle.com → profile icon → Settings → API → "Create New Token"
   → saves kaggle.json

3. Put kaggle.json at:
   Windows : C:\\Users\\YourName\\.kaggle\\kaggle.json
   Mac/Linux: ~/.kaggle/kaggle.json

DOWNLOAD ONE OF THESE DATASETS:
────────────────────────────────
Option A (recommended — actual AI-generated vs real):
   kaggle datasets download -d kanzeus/realai-video-dataset --unzip -p ./kaggle_data

Option B (backup):
   kaggle datasets download -d mohammadsarfrazalam/realfake-video-dataset --unzip -p ./kaggle_data

THEN RUN THIS SCRIPT:
─────────────────────
   python run_eval.py --kaggle_dir ./kaggle_data

That's it. Results saved to ./eval_results/
=============================================================================
"""

import os
import sys
import json
import shutil
import argparse
import warnings
import logging
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from tqdm import tqdm

warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TRANSFORMERS_VERBOSITY'] = 'error'
os.environ['HF_HUB_DISABLE_PROGRESS_BARS'] = '1'
logging.disable(logging.CRITICAL)

from sklearn.metrics import (
    roc_curve, auc,
    confusion_matrix,
    accuracy_score, precision_score,
    recall_score, f1_score,
    classification_report,
)

VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'}
MAX_VIDEOS_PER_CLASS = 25   # cap at 25+25 = 50 total for speed


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Auto-detect dataset folder structure
# ─────────────────────────────────────────────────────────────────────────────

# Keywords that mean "real / authentic"
REAL_KEYWORDS = {'real', 'authentic', 'original', 'genuine', 'human', 'natural', 'true'}
# Keywords that mean "AI / fake"
AI_KEYWORDS   = {'ai', 'fake', 'generated', 'synthetic', 'artificial', 'deepfake',
                 'fakeai', 'aigenerated', 'aigc', 'manipulated', 'altered'}


def _is_video(path: Path) -> bool:
    return path.suffix.lower() in VIDEO_EXTENSIONS


def _folder_label(name: str):
    """Return 0 (real), 1 (ai), or None if unrecognised."""
    n = name.lower().replace('-', '').replace('_', '').replace(' ', '')
    if n in REAL_KEYWORDS or any(k in n for k in REAL_KEYWORDS):
        return 0
    if n in AI_KEYWORDS or any(k in n for k in AI_KEYWORDS):
        return 1
    return None


def collect_videos_from_folder(root: str) -> pd.DataFrame:
    """
    Walk the downloaded dataset directory and figure out which videos
    are real (label=0) and which are AI (label=1).

    Handles common structures:
      root/real/  + root/ai/
      root/Real/  + root/Fake/
      root/train/real/ + root/train/fake/
      root/0/     + root/1/          (numeric labels)
      flat root with a labels.csv / metadata.csv inside
    """
    root = Path(root)
    rows = []

    # ── Try CSV/metadata first ────────────────────────────────────────────────
    for csv_name in ['labels.csv', 'metadata.csv', 'dataset.csv',
                     'train.csv', 'test.csv', 'annotations.csv']:
        csv_path = root / csv_name
        if csv_path.exists():
            print(f"  Found CSV: {csv_path}")
            df = pd.read_csv(csv_path)
            # normalise column names
            df.columns = [c.strip().lower() for c in df.columns]

            path_col  = next((c for c in df.columns if 'file' in c or 'path' in c or 'name' in c), None)
            label_col = next((c for c in df.columns if 'label' in c or 'class' in c or 'fake' in c or 'ai' in c), None)

            if path_col and label_col:
                for _, row in df.iterrows():
                    fpath = root / str(row[path_col])
                    if not fpath.exists():
                        fpath = Path(str(row[path_col]))
                    raw_label = str(row[label_col]).strip().lower()
                    if raw_label in ('1', 'fake', 'ai', 'artificial', 'generated'):
                        label = 1
                    elif raw_label in ('0', 'real', 'authentic', 'original'):
                        label = 0
                    else:
                        continue
                    if fpath.exists() and _is_video(fpath):
                        rows.append({'filepath': str(fpath), 'label': label})
                if rows:
                    print(f"  Loaded {len(rows)} entries from {csv_name}")
                    return pd.DataFrame(rows)

    # ── Walk folders, match by name ───────────────────────────────────────────
    def scan_dir(directory: Path):
        found = []
        for item in sorted(directory.iterdir()):
            if item.is_dir():
                label = _folder_label(item.name)
                if label is not None:
                    vids = [f for f in item.rglob('*') if _is_video(f)]
                    for v in vids:
                        found.append({'filepath': str(v), 'label': label})
                    print(f"  '{item.name}/' → label={label}, {len(vids)} videos")
                else:
                    # go one level deeper (e.g. train/real, test/fake)
                    found.extend(scan_dir(item))
            # numeric folders: 0/ and 1/
            elif item.is_dir() and item.name in ('0', '1'):
                label = int(item.name)
                vids = [f for f in item.rglob('*') if _is_video(f)]
                for v in vids:
                    found.append({'filepath': str(v), 'label': label})
        return found

    rows = scan_dir(root)

    # ── Flat folder fallback — sort alphabetically, split 50/50 ──────────────
    if not rows:
        print("  No labelled subfolders found — trying flat structure...")
        all_vids = sorted([f for f in root.rglob('*') if _is_video(f)])
        if all_vids:
            mid = len(all_vids) // 2
            for i, v in enumerate(all_vids):
                rows.append({'filepath': str(v), 'label': 0 if i < mid else 1})
            print(f"  WARNING: Could not auto-detect labels. Split {mid} real / {len(all_vids)-mid} AI alphabetically.")
            print("  ⚠  Double-check this is correct before trusting results!")

    return pd.DataFrame(rows)


def balance_and_cap(df: pd.DataFrame, max_per_class: int = MAX_VIDEOS_PER_CLASS) -> pd.DataFrame:
    """Cap each class to max_per_class and balance."""
    real = df[df['label'] == 0].sample(min(max_per_class, (df['label']==0).sum()), random_state=42)
    ai   = df[df['label'] == 1].sample(min(max_per_class, (df['label']==1).sum()), random_state=42)
    out  = pd.concat([real, ai]).reset_index(drop=True)
    return out


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Run your detector
# ─────────────────────────────────────────────────────────────────────────────

def run_detector(df: pd.DataFrame) -> pd.DataFrame:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        from video import detect_ai_video
    except ImportError as e:
        print(f"\nERROR: Cannot import video.py — make sure it's in the same folder.\n{e}")
        sys.exit(1)

    results = []
    print(f"\nRunning detector on {len(df)} videos...\n")

    for _, row in tqdm(df.iterrows(), total=len(df), unit="video"):
        fpath     = row['filepath']
        true_label = int(row['label'])

        if not os.path.exists(fpath):
            print(f"  SKIP (missing): {fpath}")
            continue

        try:
            is_ai, confidence = detect_ai_video(fpath, detailed=False, verbose=False)
            results.append({
                'filename':   os.path.basename(fpath),
                'true_label': true_label,
                'pred_label': int(is_ai),
                'confidence': float(confidence),
            })
        except Exception as e:
            print(f"  ERROR {os.path.basename(fpath)}: {e}")
            results.append({
                'filename':   os.path.basename(fpath),
                'true_label': true_label,
                'pred_label': -1,
                'confidence': 0.5,
            })

    return pd.DataFrame(results)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Metrics
# ─────────────────────────────────────────────────────────────────────────────

def compute_metrics(df: pd.DataFrame):
    valid  = df[df['pred_label'] >= 0]
    y_true = valid['true_label'].values
    y_pred = valid['pred_label'].values
    y_prob = valid['confidence'].values

    fpr, tpr, thresholds = roc_curve(y_true, y_prob)
    roc_auc = auc(fpr, tpr)

    metrics = {
        'total':     len(df),
        'valid':     len(valid),
        'errors':    len(df) - len(valid),
        'accuracy':  round(accuracy_score(y_true, y_pred),               4),
        'precision': round(precision_score(y_true, y_pred, zero_division=0), 4),
        'recall':    round(recall_score(y_true, y_pred, zero_division=0),    4),
        'f1':        round(f1_score(y_true, y_pred, zero_division=0),        4),
        'roc_auc':   round(roc_auc, 4),
    }
    return metrics, y_true, y_pred, y_prob, fpr, tpr


def print_metrics(metrics, y_true, y_pred):
    w = 52
    print("\n" + "═" * w)
    print("  EVALUATION RESULTS")
    print("═" * w)
    print(f"  Videos run   : {metrics['valid']} / {metrics['total']}")
    if metrics['errors']:
        print(f"  Errors       : {metrics['errors']}")
    print("─" * w)
    print(f"  Accuracy     : {metrics['accuracy']:.1%}")
    print(f"  Precision    : {metrics['precision']:.1%}")
    print(f"  Recall       : {metrics['recall']:.1%}")
    print(f"  F1 Score     : {metrics['f1']:.1%}")
    print(f"  ROC-AUC      : {metrics['roc_auc']:.4f}")
    print("═" * w)
    print("\nPer-class breakdown:")
    print(classification_report(y_true, y_pred,
                                 target_names=['Real', 'AI-Generated']))


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Plots
# ─────────────────────────────────────────────────────────────────────────────

BG    = "#0F0F1A"
CARD  = "#1A1A2E"
INDIGO = "#4F46E5"
PINK   = "#EC4899"
GREEN  = "#10B981"
RED    = "#EF4444"
TEXT   = "#F8FAFC"
MUTED  = "#94A3B8"

plt.rcParams.update({
    "figure.facecolor": BG,   "axes.facecolor":  CARD,
    "axes.edgecolor":   MUTED, "axes.labelcolor": TEXT,
    "xtick.color":      MUTED, "ytick.color":     MUTED,
    "text.color":       TEXT,  "grid.color":      "#2D2D44",
    "grid.linestyle":   "--",  "grid.alpha":      0.5,
    "font.family":      "sans-serif",
})


def save_roc(fpr, tpr, roc_auc, path):
    fig, ax = plt.subplots(figsize=(7, 6))
    ax.fill_between(fpr, tpr, alpha=0.12, color=INDIGO)
    ax.plot(fpr, tpr, color=INDIGO, lw=2.5, label=f"AUC = {roc_auc:.3f}")
    ax.plot([0,1],[0,1], color=MUTED, lw=1.2, ls="--", label="Random chance")

    best = np.argmin(np.sqrt(fpr**2 + (1-tpr)**2))
    ax.scatter(fpr[best], tpr[best], s=90, zorder=5, color=PINK,
               label=f"Best point  TPR={tpr[best]:.2f}  FPR={fpr[best]:.2f}")

    ax.set(xlim=[-0.02,1.02], ylim=[-0.02,1.05],
           xlabel="False Positive Rate", ylabel="True Positive Rate",
           title="ROC Curve — AI Video Detector")
    ax.title.set_fontsize(14); ax.title.set_fontweight("bold")

    leg = ax.legend(loc="lower right", framealpha=0.3,
                    facecolor=CARD, edgecolor="#2D2D44")
    for t in leg.get_texts(): t.set_color(TEXT)

    ax.grid(True)
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print(f"  ✓ {path}")


def save_confusion(y_true, y_pred, path):
    cm = confusion_matrix(y_true, y_pred)
    fig, ax = plt.subplots(figsize=(5, 4.5))

    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
                xticklabels=["Real","AI"], yticklabels=["Real","AI"],
                linewidths=0.5, linecolor="#2D2D44", cbar=False,
                annot_kws={"size":18,"weight":"bold","color":TEXT}, ax=ax)

    ax.set(xlabel="Predicted", ylabel="True", title="Confusion Matrix")
    ax.title.set_fontsize(14); ax.title.set_fontweight("bold")
    for lbl in ax.get_xticklabels() + ax.get_yticklabels():
        lbl.set_color(TEXT)

    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print(f"  ✓ {path}")


def save_score_dist(results_df, path):
    valid = results_df[results_df['pred_label'] >= 0]
    fig, ax = plt.subplots(figsize=(7, 4))

    ax.hist(valid[valid['true_label']==0]['confidence'], bins=15,
            alpha=0.7, color=GREEN, label="Real", edgecolor=BG)
    ax.hist(valid[valid['true_label']==1]['confidence'], bins=15,
            alpha=0.7, color=PINK, label="AI-Generated", edgecolor=BG)
    ax.axvline(0.5, color=MUTED, ls="--", lw=1.5, label="Threshold 0.50")

    ax.set(xlabel="Confidence Score", ylabel="Count",
           title="Score Distribution: Real vs AI-Generated")
    ax.title.set_fontsize(14); ax.title.set_fontweight("bold")

    leg = ax.legend(framealpha=0.3, facecolor=CARD, edgecolor="#2D2D44")
    for t in leg.get_texts(): t.set_color(TEXT)

    ax.grid(True)
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print(f"  ✓ {path}")


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Auto-organise Kaggle dataset + evaluate AI video detector"
    )
    parser.add_argument("--kaggle_dir", required=True,
                        help="Folder where you unzipped the Kaggle dataset")
    parser.add_argument("--out_dir", default="./eval_results",
                        help="Where to save plots & results (default: ./eval_results)")
    parser.add_argument("--max", type=int, default=25,
                        help="Max videos per class (default: 25)")
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)

    # ── 1. Scan dataset ───────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("STEP 1 — Scanning dataset folder...")
    print("="*60)
    df = collect_videos_from_folder(args.kaggle_dir)

    if df.empty:
        print("\nERROR: No videos found in", args.kaggle_dir)
        print("Check the path and make sure the dataset was unzipped correctly.")
        sys.exit(1)

    n_real = (df['label']==0).sum()
    n_ai   = (df['label']==1).sum()
    print(f"\n  Found: {n_real} real videos, {n_ai} AI videos")

    # ── 2. Balance & cap ──────────────────────────────────────────────────────
    df = balance_and_cap(df, max_per_class=args.max)
    print(f"  Using: {(df['label']==0).sum()} real + {(df['label']==1).sum()} AI  (capped at {args.max} each)\n")

    # ── 3. Run detector ───────────────────────────────────────────────────────
    print("="*60)
    print("STEP 2 — Running detector on each video...")
    print("="*60)
    results_df = run_detector(df)

    csv_path = os.path.join(args.out_dir, "per_video_results.csv")
    results_df.to_csv(csv_path, index=False)
    print(f"\n  ✓ Per-video results → {csv_path}")

    # ── 4. Metrics ────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("STEP 3 — Computing metrics...")
    print("="*60)
    try:
        metrics, y_true, y_pred, y_prob, fpr, tpr = compute_metrics(results_df)
    except Exception as e:
        print(f"ERROR computing metrics: {e}")
        sys.exit(1)

    print_metrics(metrics, y_true, y_pred)

    json_path = os.path.join(args.out_dir, "metrics.json")
    with open(json_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"  ✓ Metrics JSON → {json_path}")

    # ── 5. Plots ──────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("STEP 4 — Generating plots...")
    print("="*60)
    save_roc(fpr, tpr, metrics['roc_auc'],
             os.path.join(args.out_dir, "roc_curve.png"))
    save_confusion(y_true, y_pred,
                   os.path.join(args.out_dir, "confusion_matrix.png"))
    save_score_dist(results_df,
                    os.path.join(args.out_dir, "score_dist.png"))

    print(f"\n{'='*60}")
    print(f"✅  ALL DONE!  Results in: {os.path.abspath(args.out_dir)}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()