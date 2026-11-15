"use client";

import { useState } from "react";
import { ClaimResult, Doc, fmtDate, Result, Verdict } from "@/lib/api";

const VERDICT: Record<Verdict, { label: string; cls: string }> = {
  NOT_NOVEL: { label: "Not novel", cls: "bg-bad-bg text-bad" },
  OBVIOUS: { label: "Obvious", cls: "bg-warn-bg text-warn" },
  INVENTIVE: { label: "Inventive", cls: "bg-ok-bg text-ok" },
};
const OUTCOME: Record<string, string> = { NOT_NOVEL: "§102 rejection", OBVIOUS: "§103 rejection", INVENTIVE: "Allowance" };

// plain-language names for the outcome model's features (SHAP factors)
const FACTOR: Record<string, string> = {
  depth: "claim depth (dependency chain)", syn_mean: "wording overlap with prior art", dis_min: "weakest disclosed feature",
  dis_mean: "average disclosure score", n_features: "number of features", claim_words: "claim length",
  closest_mean_p: "match with closest reference", n_inherited: "features inherited from parent",
  anticipation: "single-reference anticipation", sem_mean: "semantic similarity", comp_found_frac: "components found in prior art",
};

type Refs = Result["references"];

// references are keyed by application number; show the clean publication number instead
const pubNo = (refs: Refs, id: string) => (refs[id]?.publication_number || id).replace(/-\d{8}$/, "");
const withPubNos = (refs: Refs, text: string) =>
  Object.keys(refs).reduce((t, id) => t.split(id).join(pubNo(refs, id)), text);

export default function Results({ result, doc, elapsed, onReset }:
  { result: Result; doc: Doc; elapsed?: number; onReset: () => void }) {
  const { patent, claims, references } = result;
  const [filter, setFilter] = useState<"all" | "independent">("independent");
  const shown = filter === "all" ? claims : claims.filter(c => c.independent);
  const total = claims.length;

  return (
    <section className="mt-8 space-y-8">
      <div className={`rounded-lg border p-6 ${patent.patentable ? "border-ok/30 bg-ok-bg" : "border-bad/30 bg-bad-bg"}`}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${patent.patentable ? "text-ok" : "text-bad"}`}>
          {patent.patentable ? "Likely patentable" : "At risk"}
        </p>
        <h2 className="mt-1 font-serif text-xl font-semibold leading-snug sm:text-2xl">{doc.title}</h2>
        <p className="mt-2 max-w-3xl text-sm">{patent.summary}</p>

        <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-card" aria-hidden>
          {(["INVENTIVE", "OBVIOUS", "NOT_NOVEL"] as Verdict[]).map(v => (
            <div key={v} style={{ width: `${(patent.counts[v] / total) * 100}%` }}
              className={v === "INVENTIVE" ? "bg-ok" : v === "OBVIOUS" ? "bg-warn" : "bg-bad"} />
          ))}
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {(["INVENTIVE", "OBVIOUS", "NOT_NOVEL"] as Verdict[]).map(v => (
            <div key={v} className="flex gap-1.5"><dd className="font-semibold tabular-nums">{patent.counts[v]}</dd><dt className="text-muted">{VERDICT[v].label.toLowerCase()}</dt></div>
          ))}
          <div className="flex gap-1.5"><dd className="font-semibold tabular-nums">{Object.keys(references).length}</dd><dt className="text-muted">references reviewed</dt></div>
          {elapsed != null && <div className="text-muted">{elapsed}s</div>}
        </dl>
        {result.cpc?.filter_note && <p className="mt-3 text-xs text-muted">{result.cpc.filter_note}</p>}
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="font-serif text-lg font-semibold">Claims</h3>
          <div className="inline-flex rounded-md border border-line p-0.5 text-sm">
            {(["independent", "all"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
                className={`rounded px-3 py-1 ${filter === f ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>
                {f === "all" ? `All ${total}` : "Independent"}
              </button>
            ))}
          </div>
        </div>
        <ul className="mt-4 space-y-3">
          {shown.map(c => <ClaimCard key={c.num} c={c} refs={references} />)}
        </ul>
      </div>

      <div>
        <h3 className="font-serif text-lg font-semibold">Prior art reviewed</h3>
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-card">
          {Object.entries(references).map(([id, r]) => (
            <li key={id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 text-sm">
              <a href={`https://patents.google.com/patent/${pubNo(references, id)}`} target="_blank" rel="noreferrer"
                className="font-mono text-accent hover:underline">{pubNo(references, id)}</a>
              <span className="min-w-0 flex-1">{r.title}</span>
              {r.filing_date && <span className="text-xs text-muted">filed {fmtDate(r.filing_date)}</span>}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs leading-relaxed text-muted">
        Automated research aid, not legal advice. Verdicts follow the EPO problem-solution approach over the references
        found; the examiner prediction is a separate statistical model (on held-out USPTO decisions it flags 87% of claims the examiner rejected).
      </p>
      <button onClick={onReset} className="rounded-md border border-ink px-4 py-2 text-sm font-medium hover:bg-ink hover:text-paper">
        Analyse another document
      </button>
    </section>
  );
}

function ClaimCard({ c, refs }: { c: ClaimResult; refs: Refs }) {
  const [open, setOpen] = useState(false);
  const v = VERDICT[c.verdict];
  const pred = c.predicted_examiner_outcome;
  return (
    <li className="rounded-lg border border-line bg-card">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">Claim {c.num}</span>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${v.cls}`}>{v.label}</span>
            <span className="text-xs text-muted">{c.independent ? "independent" : `depends on ${c.parent}`}</span>
            {pred && <span className="text-xs text-muted">· examiner model: {OUTCOME[pred.predicted]} ({Math.round(pred.probabilities[pred.predicted] * 100)}%)</span>}
          </span>
          <span className="mt-1.5 block text-sm">{withPubNos(refs, c.reason)}</span>
        </span>
        <span className={`mt-1 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>⌄</span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-line p-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <Score label="Novelty" value={c.novelty_score} />
            <Score label="Inventive step" value={c.inventive_score} />
          </div>

          {c.closest_ref && (
            <p><span className="text-muted">Closest reference: </span>
              <span className="font-mono">{pubNo(refs, c.closest_ref)}</span> {refs[c.closest_ref]?.title && <span className="text-muted">— {refs[c.closest_ref].title}</span>}</p>
          )}

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Feature chart</h4>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr><th className="py-1.5 pr-3 font-medium">Feature</th><th className="py-1.5 pr-3 font-medium">In closest ref</th><th className="py-1.5 font-medium">Best match</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {c.feature_chart.map((f, i) => (
                    <tr key={i} className="align-top">
                      <td className="py-2 pr-3">{f.text}
                        {f.closest_ref_evidence?.passage && (
                          <details className="mt-1 text-xs text-muted"><summary className="cursor-pointer">evidence</summary>
                            <p className="mt-1 italic">“{String(f.closest_ref_evidence.passage).slice(0, 400)}”</p></details>
                        )}
                      </td>
                      <td className="py-2 pr-3"><Prob p={f.closest_ref_evidence?.prob ?? 0} yes={f.disclosed_in_closest} /></td>
                      <td className="py-2 font-mono text-xs">{pubNo(refs, f.best_ref)}<span className="ml-1 text-muted">{Math.round(f.best_prob * 100)}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {c.distinguishing.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Distinguishing features</h4>
              <ul className="mt-2 space-y-2">
                {c.distinguishing.map((d, i) => (
                  <li key={i} className="rounded-md bg-paper p-3">
                    <p>{d.feature}</p>
                    <p className="mt-1 text-xs text-muted">{d.label} · {d.found_in.length ? `also found in ${d.found_in.map(r => pubNo(refs, r)).join(", ")}` : "not found in any reviewed reference"}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {c.linked_effects.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Technical advancement</h4>
              {c.linked_effects.map((e, i) => <p key={i} className="mt-2">“{e.sentence}” <span className="text-xs text-muted">({e.kind}, {e.category})</span></p>)}
            </div>
          )}

          {pred && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Examiner outcome prediction</h4>
              <div className="mt-2 space-y-1.5">
                {Object.entries(pred.probabilities).map(([k, p]) => (
                  <div key={k} className="flex items-center gap-3 text-xs">
                    <span className="w-28 shrink-0">{OUTCOME[k]}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ width: `${p * 100}%` }} /></div>
                    <span className="w-9 text-right tabular-nums">{Math.round(p * 100)}%</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">Main factors: {pred.top_factors.map(f => `${FACTOR[f.feature] ?? f.feature} (${f.contribution > 0 ? "+" : ""}${f.contribution})`).join(", ")}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs"><span className="text-muted">{label}</span><span className="tabular-nums">{Math.round(value * 100)}</span></div>
      <div className="mt-1 h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-ink" style={{ width: `${value * 100}%` }} /></div>
    </div>
  );
}

function Prob({ p, yes }: { p: number; yes: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 text-xs ${yes ? "text-bad" : "text-ok"}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${yes ? "bg-bad" : "bg-ok"}`} />{yes ? "disclosed" : "missing"} <span className="text-muted">({Math.round(p * 100)}% match)</span>
  </span>;
}
