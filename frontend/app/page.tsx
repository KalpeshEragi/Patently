"use client";

import { useEffect, useRef, useState } from "react";
import { api, CpcSuggestion, Doc, fmtDate, Job, Result } from "@/lib/api";
import Results from "@/components/Results";

type Step = "input" | "cpc" | "running" | "done";

const SECTIONS: Record<string, string> = {
  A: "Human necessities", B: "Operations & transport", C: "Chemistry & metallurgy", D: "Textiles & paper",
  E: "Fixed constructions", F: "Mechanical engineering", G: "Physics", H: "Electricity", Y: "Emerging technologies",
};

export default function Home() {
  const [step, setStep] = useState<Step>("input");
  const [doc, setDoc] = useState<Doc | null>(null);
  const [cpc, setCpc] = useState<CpcSuggestion[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [mode, setMode] = useState("fast");
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [server, setServer] = useState("checking");

  useEffect(() => {
    let alive = true;
    const tick = () => api.health().then(h => {
      if (!alive) return;
      setServer(h.status);
      if (h.status === "loading") setTimeout(tick, 3000);
    }).catch(() => alive && (setServer("offline"), setTimeout(tick, 5000)));
    tick();
    return () => { alive = false; };
  }, []);

  async function load(get: () => Promise<Doc>) {
    setError(""); setBusy(true);
    try {
      const d = await get();
      if (!d.claims_parsed?.length) throw new Error("No numbered claims were found in this document.");
      setDoc(d);
      const s = await api.suggest(d);
      setCpc(s.suggestions);
      setPicked(s.suggestions.slice(0, 3).map(x => x.code));
      setStep("cpc");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function start() {
    if (!doc) return;
    setError(""); setBusy(true);
    try {
      const { id } = await api.start(doc, picked, mode);
      setStep("running");
      poll(id);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  function poll(id: string) {
    api.job(id).then(j => {
      setJob(j);
      if (j.status === "done") setStep("done");
      else if (j.status === "error") { setError(j.error || "analysis failed"); setStep("cpc"); }
      else setTimeout(() => poll(id), 1000);
    }).catch(e => { setError((e as Error).message); setStep("cpc"); });
  }

  function reset() { setStep("input"); setDoc(null); setJob(null); setError(""); }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line py-6">
        <button onClick={reset} className="text-left">
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Patent Analyser</h1>
          <p className="text-sm text-muted">Prior-art search and claim-by-claim novelty review</p>
        </button>
        <ServerBadge status={server} />
      </header>

      <Stepper step={step} />

      {error && (
        <div role="alert" className="mt-6 rounded-md border border-bad/30 bg-bad-bg px-4 py-3 text-sm text-bad">{error}</div>
      )}

      {step === "input" && <InputStep busy={busy} ready={server === "ok"} onLoad={load} />}

      {step === "cpc" && doc && (
        <section className="mt-8 space-y-6">
          <DocSummary doc={doc} />
          <div className="rounded-lg border border-line bg-card p-5">
            <h2 className="font-serif text-lg font-semibold">Confirm technology areas</h2>
            <p className="mt-1 text-sm text-muted">
              The classifier predicted these CPC subclasses. Prior-art search is limited to the ones you keep.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {cpc.map(s => {
                const on = picked.includes(s.code);
                return (
                  <label key={s.code} className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${on ? "border-accent bg-accent/5" : "border-line hover:border-muted"}`}>
                    <input type="checkbox" checked={on} className="accent-[var(--accent)]"
                      onChange={() => setPicked(on ? picked.filter(c => c !== s.code) : [...picked, s.code])} />
                    <span className="font-mono text-sm font-semibold">{s.code}</span>
                    <span className="flex-1 truncate text-sm text-muted">{SECTIONS[s.code[0]] ?? ""}</span>
                    <span className="text-xs tabular-nums text-muted">{Math.round(s.prob * 100)}%</span>
                  </label>
                );
              })}
            </div>
            {picked.length === 0 && <p className="mt-3 text-sm text-warn">No area selected: the search will cover the whole index.</p>}

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="inline-flex rounded-md border border-line p-0.5 text-sm" role="radiogroup" aria-label="Analysis depth">
                {[["fast", "Fast · ~30 s"], ["full", "Thorough · ~2 min"]].map(([v, l]) => (
                  <button key={v} role="radio" aria-checked={mode === v} onClick={() => setMode(v)}
                    className={`rounded px-3 py-1.5 ${mode === v ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>{l}</button>
                ))}
              </div>
              <button onClick={start} disabled={busy}
                className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:text-[#10202f]">
                Run analysis
              </button>
              <button onClick={reset} className="text-sm text-muted hover:text-ink">Use another document</button>
            </div>
          </div>
        </section>
      )}

      {step === "running" && <Progress job={job} />}
      {step === "done" && job?.result && <Results result={job.result as Result} doc={doc!} elapsed={job.elapsed_s} onReset={reset} />}
    </main>
  );
}

function ServerBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    ok: ["Models ready", "bg-ok"], loading: ["Loading models…", "bg-warn"],
    checking: ["Connecting…", "bg-muted"], offline: ["Server offline", "bg-bad"], error: ["Model error", "bg-bad"],
  };
  const [label, dot] = map[status] ?? map.checking;
  return <span className="inline-flex items-center gap-2 text-xs text-muted"><span className={`h-2 w-2 rounded-full ${dot}`} />{label}</span>;
}

function Stepper({ step }: { step: Step }) {
  const steps = [["input", "Document"], ["cpc", "Technology"], ["running", "Search"], ["done", "Report"]];
  const at = steps.findIndex(s => s[0] === step);
  return (
    <ol className="mt-6 flex gap-2 text-xs sm:gap-6 sm:text-sm">
      {steps.map(([k, l], i) => (
        <li key={k} className={`flex items-center gap-2 ${i <= at ? "text-ink" : "text-muted"}`}>
          <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${i < at ? "bg-ink text-paper" : i === at ? "border border-ink" : "border border-line"}`}>{i + 1}</span>
          {l}
        </li>
      ))}
    </ol>
  );
}

function InputStep({ busy, ready, onLoad }: { busy: boolean; ready: boolean; onLoad: (f: () => Promise<Doc>) => void }) {
  const [num, setNum] = useState("");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const take = (f?: File) => f && onLoad(() => api.upload(f));
  const disabled = busy || !ready;

  return (
    <section className="mt-8 grid gap-6 md:grid-cols-[1.4fr_1fr]">
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); if (!disabled) take(e.dataTransfer.files[0]); }}
        className={`flex min-h-56 flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${drag ? "border-accent bg-accent/5" : "border-line bg-card"}`}>
        <p className="font-serif text-lg font-semibold">Upload a patent application</p>
        <p className="mt-1 text-sm text-muted">PDF, DOCX or TXT, up to 20 MB. It must contain numbered claims.</p>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" hidden onChange={e => take(e.target.files?.[0])} />
        <button disabled={disabled} onClick={() => fileRef.current?.click()}
          className="mt-5 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-40">
          Choose file
        </button>
      </div>

      <form onSubmit={e => { e.preventDefault(); if (num.trim()) onLoad(() => api.lookup(num.trim())); }}
        className="flex flex-col rounded-lg border border-line bg-card p-6">
        <p className="font-serif text-lg font-semibold">Or look up a patent</p>
        <p className="mt-1 text-sm text-muted">Fetched from Google Patents. Prior art is limited to before its priority date.</p>
        <label htmlFor="num" className="mt-5 text-xs font-medium text-muted">Publication number</label>
        <input id="num" value={num} onChange={e => setNum(e.target.value)} placeholder="US9968239B2"
          className="mt-1 rounded-md border border-line bg-paper px-3 py-2 font-mono text-sm outline-none focus:border-accent" />
        <button disabled={disabled || !num.trim()} className="mt-3 rounded-md border border-ink px-4 py-2 text-sm font-medium hover:bg-ink hover:text-paper disabled:opacity-40">
          {busy ? "Fetching…" : "Fetch patent"}
        </button>
        <button type="button" onClick={() => setNum("US9968239B2")} className="mt-3 self-start text-xs text-accent hover:underline">
          Try an example
        </button>
      </form>
      {!ready && <p className="text-sm text-muted md:col-span-2">Waiting for the models to finish loading on the server…</p>}
    </section>
  );
}

function DocSummary({ doc }: { doc: Doc }) {
  const parsed = doc.claims_parsed ?? [];
  const indep = parsed.filter(c => c.independent).length;
  return (
    <div className="rounded-lg border border-line bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted">{doc.source || "Uploaded document"}</p>
      <h2 className="mt-1 font-serif text-xl font-semibold">{doc.title || "Untitled application"}</h2>
      <p className="mt-2 line-clamp-3 text-sm text-muted">{doc.abstract}</p>
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div><dt className="text-xs text-muted">Claims</dt><dd className="font-medium">{parsed.length} ({indep} independent)</dd></div>
        {doc.priority_date && <div><dt className="text-xs text-muted">Priority date</dt><dd className="font-medium">{fmtDate(doc.priority_date)}</dd></div>}
      </dl>
      {doc.warnings?.map(w => <p key={w} className="mt-2 text-xs text-warn">{w}</p>)}
    </div>
  );
}

function Progress({ job }: { job: Job | null }) {
  const pct = job?.percent ?? 0;
  return (
    <section className="mx-auto mt-16 max-w-md text-center" aria-live="polite">
      <p className="font-serif text-xl font-semibold">Searching prior art</p>
      <p className="mt-2 text-sm text-muted">{job?.status === "queued" ? "Waiting in queue…" : job?.stage || "Starting…"}</p>
      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs tabular-nums text-muted">{pct}% · {job?.elapsed_s ?? 0}s</p>
    </section>
  );
}
