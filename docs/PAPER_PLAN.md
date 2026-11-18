# Research paper plan

Goal: turn Patently into a workshop paper plus an arXiv preprint.

**Working title:** *Explainable Patent Novelty Assessment: A Patent-Trained Disclosure Model
and an Examiner-Grounded Evaluation*

**Status:** planning. Nothing below has been submitted.

---

## 1. Contributions (what the paper claims)

1. **Patent-trained disclosure model.**
   - A PatentSBERTa cross-encoder trained on PANORAMA PI4PC.
   - It picks the examiner-cited paragraph out of 5 candidates **53.7%** of the time,
     against 44.8% for a general NLI model and 20% for random.
2. **End-to-end, explainable pipeline evaluated on real examiner decisions.**
   - A CPC classifier, hybrid search (BM25 + dense vectors with RRF) and live claim matching.
   - EPO problem-solution reasoning on top, checked against USPTO §102 / §103 / allowed
     outcomes (PANORAMA NOC4PC).
3. **A leakage finding.**
   - SHAP showed that the number of examiner-cited references leaked the label.
   - The paper reports results with and without that feature.
4. **Cost-sensitive outcome prediction.**
   - A cautious "allowed" cutoff, tuned on validation only.
   - It cuts the false-allow rate from 20.6% to 12.8%, at a cost of 0.011 macro-F1.

## 2. Results we already have

| Result | Number | Where |
|---|---|---|
| CPC classifier, correct class in top 3 / top 5 | 92.7% / 95.2% | `docs/PROJECT.md` §4 |
| Disclosure top-1 (PI4PC validation) | 53.7% (NLI 44.8%, random 20%) | §9 |
| Outcome macro-F1, test (2,878 claims) | 0.494 (rules 0.379, random 0.309) | §9 |
| Prior-art recall / false-allow rate, test | 87.2% / 12.8% | §9 |
| Claim matching time | ~60 s → 17–19 s (RTX 2050) | §6 |

## 3. Experiments still needed

| # | Experiment | Why reviewers will ask | Effort |
|---|---|---|---|
| E1 | **PANORAMA paper baselines** on the same splits and metrics (including their LLM results) | Without them, the numbers can't be placed. Do this first, because it decides the framing | 0.5 day |
| E2 | Retrieval ablation: BM25 only / dense only / RRF; with and without the CPC filter | Shows each layer earns its place | 1–2 days |
| E3 | Disclosure ablation: cross-encoder vs bi-encoder vs NLI; blend weights on vs off | Isolates the main contribution | 1 day |
| E4 | Error bars: 3–5 seeds for the cross-encoder, bootstrap 95% CIs for test metrics | Single numbers aren't enough | 1 day |
| E5 | Outcome-model ablation: rules only / GBM / GBM + cautious cutoff; full cost curve (cutoff vs false-allow vs macro-F1) | Supports contribution 4 | 0.5 day |
| E6 | Qualitative examples: 2–3 claims with the feature chart, evidence and verdict | Shows the explainability | 0.5 day |

**Rules for all new experiments:**
- tune on validation only;
- the test set is touched once per final configuration;
- every number is reported next to its baseline.

## 4. Limitations to state openly

- **The test set was evaluated twice.** The second time came after the `n_refs` leak fix and
  the disclosure-model change. Nothing was tuned on test either time.
- **Index coverage:** only 1.6% of examiner-cited references are in the 100k index. The legal
  verdicts are therefore judged against the prior art the system finds, not the examiner's.
- **Label noise:** experts agree on these decisions about 75% of the time, which caps any
  model's attainable score.
- **Scope:** US patents only (HUPD 2004–2018), and English only.
- **Licence:** PANORAMA is CC BY-NC 4.0, so the trained disclosure model is non-commercial.

## 5. Paper outline (8 pages, ACL format)

1. **Introduction:** the examiner bottleneck, why explainability matters, the 4 contributions.
2. **Related work:**
   - patent retrieval and prior-art search;
   - CPC classification (PatentSBERTa and others);
   - legal NLP and the NLI approach to claim checking;
   - PANORAMA.
3. **Data:** HUPD (corpus and CPC training), PANORAMA NOC4PC / PI4PC, splits by application.
4. **System:**
   - Layers 1–3;
   - the disclosure model;
   - the EPO problem-solution engine;
   - the outcome model.
5. **Experiments:** E1–E5 with tables, using the setup in §3.
6. **Analysis:**
   - error analysis (about 65% of errors come from disclosure scoring);
   - SHAP factors;
   - the leak finding;
   - qualitative examples (E6).
7. **Limitations and ethics:** §4 above; the system is a research aid, not legal advice.
8. **Conclusion.**

**Appendix:** hyperparameters, compute (Kaggle 2× T4, RTX 2050), and a link to the code.

## 6. Where to submit

| Venue | Fit | Notes |
|---|---|---|
| **arXiv** (cs.CL / cs.IR) | First, always | Public and citable right away |
| **NLLP workshop** (Natural Legal Language Processing, with EMNLP) | Best fit | Legal NLP audience |
| **PatentSemTech workshop** (with SIGIR) | Strong fit | Patent text mining audience |
| JURIX (legal knowledge systems) | Possible | More legal-reasoning focus |

Check each venue's current deadline before starting the write-up.

## 7. Timeline (about 2 weeks)

| Days | Work |
|---|---|
| 1 | E1: collect PANORAMA baselines and decide the framing |
| 2–5 | E2–E5: ablations, seeds, confidence intervals |
| 6 | E6 and the figures (reuse `docs/assets/`) |
| 7–11 | Write sections 1–8 (reuse `docs/PROJECT.md`) |
| 12–13 | Internal review: check every number against the logs |
| 14 | arXiv upload, then submit to the chosen workshop |

## 8. Reproducibility

- Code: this repository.
- Model weights: to be published on the Hugging Face Hub (deployment, module M5).
- Every table in the paper must map to a script in `eval/` and a results file.
