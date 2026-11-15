"""
Make the outcome model cautious about predicting "allowed".

Saying "allowed" when the examiner found prior art is the costly error, so the
model predicts INVENTIVE only when P(allowed) >= t; otherwise it picks the more
likely rejection (§102 or §103). t is chosen on VALIDATION ONLY, from
out-of-fold probabilities (same grouped folds and parameters as training):
the highest macro-F1 whose false-allow rate is at most --max-false-allow.

    python -m eval.tune_allow                    # tune on validation, save t to meta.json
    python -m eval.tune_allow --test             # apply the saved t to the test set once
"""

from __future__ import annotations

import argparse
import json

import numpy as np
from sklearn.metrics import f1_score
from sklearn.model_selection import GroupKFold

from eval.train_outcome import MODEL_DIR, TEST, VAL, dataset, lgbm

ALLOW = 2  # index of INVENTIVE in CLASSES


def decide(P: np.ndarray, t: float) -> np.ndarray:
    rej = P[:, :2].argmax(1)
    return np.where(P[:, ALLOW] >= t, ALLOW, rej)


def stats(y, pred) -> dict:
    rejected = y != ALLOW
    said_allow = pred == ALLOW
    return {"macro_f1": round(f1_score(y, pred, average="macro"), 3),
            "accuracy": round(float((y == pred).mean()), 3),
            "false_allow_rate": round(float((said_allow & rejected).sum() / rejected.sum()), 3),
            "prior_art_recall": round(float((~said_allow & rejected).sum() / rejected.sum()), 3),
            "allowed_recall": round(float((said_allow & ~rejected).sum() / (~rejected).sum()), 3),
            "allowed_precision": round(float((said_allow & ~rejected).sum() / max(said_allow.sum(), 1)), 3)}


def oof_probs(X, y, g, params) -> np.ndarray:
    P = np.zeros((len(y), 3))
    for tr, te in GroupKFold(n_splits=5).split(X, y, g):
        P[te] = lgbm(params).fit(X[tr], y[tr]).predict_proba(X[te])
    return P


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-false-allow", type=float, default=0.10)
    ap.add_argument("--test", action="store_true")
    args = ap.parse_args()
    meta_f = MODEL_DIR / "meta.json"
    meta = json.loads(meta_f.read_text())

    if args.test:
        import lightgbm as lgb
        _, _, X, y, _ = dataset(TEST)
        P = lgb.Booster(model_file=str(MODEL_DIR / "model.txt")).predict(X)
        t = meta["allow_threshold"]["t"]
        out = {"argmax": stats(y, P.argmax(1)), f"cautious_t={t}": stats(y, decide(P, t))}
        for k, v in out.items():
            print(f"test {k:18s} {v}")
        print("confusion (rows=true NN/OBV/ALLOW):\n", np.array(
            [[int(((y == a) & (decide(P, t) == b)).sum()) for b in range(3)] for a in range(3)]))
        (MODEL_DIR.parent.parent / "eval" / "results" / "allow_threshold_test.json").write_text(json.dumps(out, indent=2))
        return

    _, _, X, y, g = dataset(VAL)
    P = oof_probs(X, y, g, meta["params"])
    print("validation out-of-fold, argmax:", stats(y, P.argmax(1)))
    rows = [(t, stats(y, decide(P, t))) for t in np.round(np.arange(0.30, 0.86, 0.02), 2)]
    for t, s in rows:
        print(f"  t={t:.2f}  {s}")
    ok = [(t, s) for t, s in rows if s["false_allow_rate"] <= args.max_false_allow]
    t, s = max(ok, key=lambda r: r[1]["macro_f1"])
    print(f"chosen t={t} (max false-allow {args.max_false_allow}): {s}")
    meta["allow_threshold"] = {"t": float(t), "max_false_allow": args.max_false_allow,
                               "validation_oof": s, "chosen_on": "validation out-of-fold only"}
    meta_f.write_text(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
