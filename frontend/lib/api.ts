// Thin client for the FastAPI backend. In production the site is served by the
// same server, so the base URL is empty; in development it points at :8000.
export const API = process.env.NEXT_PUBLIC_API ?? "";

export type Verdict = "NOT_NOVEL" | "OBVIOUS" | "INVENTIVE";

export interface ParsedClaim { num: number; parent: number | null; independent: boolean; text: string }

export interface Doc {
  title: string; abstract: string; summary: string; claims: string;
  source: string; priority_date: string; n_claims?: number;
  warnings?: string[]; claims_parsed?: ParsedClaim[];
}

export interface CpcSuggestion { code: string; prob: number; title?: string }

export interface Feature {
  text: string; component: string; function: string; params: string[];
  disclosed_in_closest: boolean; best_ref: string; best_prob: number;
  closest_ref_evidence: { prob: number; passage?: string; [k: string]: unknown };
}

export interface Outcome {
  predicted: string; examiner_outcome: string;
  probabilities: Record<string, number>;
  top_factors: { feature: string; value: number; contribution: number }[];
}

export interface ClaimResult {
  num: number; independent: boolean; parent: number | null; verdict: Verdict; reason: string;
  novelty_score: number; inventive_score: number; closest_ref: string | null;
  distinguishing: { feature: string; label: string; found_in: string[] }[];
  combination_refs: string[];
  linked_effects: { sentence: string; category: string; kind: string; feature: string }[];
  feature_chart: Feature[];
  predicted_examiner_outcome: Outcome | null;
}

export interface Result {
  patent: { patentable: boolean; patentability_score: number; novelty_score: number;
            counts: Record<Verdict, number>; amendment_candidates: number[]; summary: string };
  cpc: { suggested: unknown; used: string[]; filter_note: string } | null;
  claims: ClaimResult[];
  effects: { sentence: string; category: string; kind: string; prob: number }[];
  references: Record<string, { title: string; filing_date: string; publication_number: string }>;
  timing: Record<string, number>;
}

export interface Job {
  id: string; status: "queued" | "running" | "done" | "error"; stage: string; percent: number;
  elapsed_s?: number; result: Result | null; error: string | null;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API + path, init);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.detail ? String(body.detail) : `request failed (${r.status})`);
  return body as T;
}

const json = (data: unknown): RequestInit => ({
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
});

export const api = {
  health: () => call<{ status: string; error: string | null }>("/api/health"),
  upload: (file: File) => {
    const f = new FormData(); f.append("file", file);
    return call<Doc>("/api/documents", { method: "POST", body: f });
  },
  lookup: (number: string) => call<Doc>("/api/documents/lookup", json({ number })),
  suggest: (doc: Doc) => call<{ suggestions: CpcSuggestion[] }>("/api/cpc/suggest", json(pick(doc))),
  start: (doc: Doc, cpc_codes: string[], mode: string, before_date?: string) =>
    call<{ id: string }>("/api/analyses", json({ document: pick(doc), cpc_codes, mode,
                                                  ...(before_date ? { before_date } : {}) })),
  job: (id: string) => call<Job>(`/api/analyses/${id}`),
};

function pick(d: Doc) {
  const { title, abstract, summary, claims, source, priority_date } = d;
  return { title, abstract, summary, claims, source, priority_date };
}

export function fmtDate(d: string) {
  return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d;
}
