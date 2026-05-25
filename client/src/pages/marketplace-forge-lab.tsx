// M5 — Matrix Forge Lab.
// Upload a .docx prompt, stream a terminal-style log while the server parses
// it + runs the deterministic HIVE pre-check, then hand off to /marketplace/publish
// pre-filled. Non-subscribers get preview-only (no Send-to-Publish button).
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, FileUp, Loader2, Sparkles, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useSubscription } from "@/lib/useSubscription";
import { api } from "@/lib/api";
import { ALL_CARD_PILLARS, type HivePrecheck } from "@shared/schema";

interface ForgeRunResult {
  body: string;
  bodyLength: number;
  fileName: string;
  precheck: HivePrecheck;
}

type LogLevel = "info" | "ok" | "warn" | "err";
interface LogLine { id: number; level: LogLevel; text: string; t: number; }

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: "text-muted-foreground",
  ok:   "text-secondary",
  warn: "text-amber-400",
  err:  "text-destructive",
};

export function ForgeLabPage() {
  const { user } = useAuth();
  const { canAccessForgeCards } = useSubscription();
  const [, navigate] = useLocation();
  const [meta, setMeta] = useState({ title: "", description: "", pillar: "System" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ForgeRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const logRef = useRef<HTMLDivElement | null>(null);
  const lineIdRef = useRef(0);

  function push(level: LogLevel, text: string) {
    setLog((prev) => [...prev, { id: ++lineIdRef.current, level, text, t: Date.now() }]);
  }

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  async function run() {
    if (!file) { setError("Pick a .docx file first."); return; }
    if (!meta.title.trim() || !meta.description.trim()) {
      setError("Title and description are required."); return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    setLog([]);
    push("info", `> forge-lab: ingesting ${file.name} (${(file.size / 1024).toFixed(1)}KB)…`);
    await new Promise((r) => setTimeout(r, 200));
    push("info", "> screening for embedded macros / VBA…");
    await new Promise((r) => setTimeout(r, 200));
    push("info", "> calling /api/sphinx/forge-lab/run…");
    try {
      const out: ForgeRunResult = await api.runForgeLab(file, meta);
      push("ok", `> parsed ${out.bodyLength.toLocaleString()} characters from ${out.fileName}.`);
      push("info", `> running deterministic HIVE pre-check…`);
      const hv = out.precheck.hiveScore;
      const tone: LogLevel = out.precheck.passes ? "ok" : "warn";
      push(tone, `> HIVE = ${hv} / 100 · KCSE = ${out.precheck.kcseScore}`);
      for (const r of out.precheck.reasons) push("info", `  · ${r}`);
      for (const w of out.precheck.warnings) push("warn", `  ⚠ ${w}`);
      push(tone, out.precheck.passes
        ? `> pre-check PASSED — ready for /marketplace/publish.`
        : `> pre-check FAILED — improve and re-run.`);
      setResult(out);
    } catch (e: any) {
      push("err", `> ERROR: ${e?.message || "Forge Lab failed."}`);
      setError(e?.message || "Forge Lab failed.");
    } finally {
      setBusy(false);
    }
  }

  function sendToPublish() {
    if (!result) return;
    try {
      sessionStorage.setItem("forge-lab:prefill", JSON.stringify({
        title: meta.title,
        description: meta.description,
        pillar: meta.pillar,
        body: result.body,
      }));
    } catch {}
    navigate("/marketplace/publish");
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <p className="font-mono text-sm text-muted-foreground uppercase">Log in to use the Matrix Forge Lab.</p>
        <Link href="/login" className="text-primary hover:underline font-mono text-xs uppercase mt-4 inline-block">Go to login →</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="page-forge-lab">
      <Link href="/marketplace" className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary inline-flex items-center gap-2" data-testid="link-back-from-forge">
        <ArrowLeft className="h-4 w-4" /> Back to marketplace
      </Link>

      <div>
        <h1 className="text-3xl font-display font-bold text-primary tracking-widest uppercase" data-testid="text-forge-title">
          Matrix Forge Lab
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-2">
          UPLOAD A .DOCX PROMPT · STREAM HIVE PRE-CHECK · HAND OFF TO PUBLISH
        </p>
      </div>

      {!canAccessForgeCards && (
        <div className="glass-card p-4 rounded-lg border border-amber-400/30 bg-amber-400/5 flex items-start gap-3" data-testid="text-forge-preview-only">
          <ShieldAlert className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs font-mono text-amber-200/90 leading-relaxed">
            <span className="text-amber-400 uppercase tracking-widest">Preview mode.</span> Your plan can
            run the pre-check but cannot hand off to publish. Upgrade to a paid plan to send forged cards to
            the marketplace.
          </div>
        </div>
      )}

      <div className="glass-card p-6 rounded-xl space-y-5">
        <div>
          <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block mb-2">Title</label>
          <input
            data-testid="input-forge-title"
            value={meta.title}
            onChange={(e) => setMeta({ ...meta, title: e.target.value })}
            placeholder="e.g. Tier-1 Support Triage Architect"
            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary/50"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block mb-2">Description</label>
          <input
            data-testid="input-forge-description"
            value={meta.description}
            onChange={(e) => setMeta({ ...meta, description: e.target.value })}
            placeholder="Short summary buyers will see in the listings grid."
            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block mb-2">Pillar</label>
            <select
              data-testid="select-forge-pillar"
              value={meta.pillar}
              onChange={(e) => setMeta({ ...meta, pillar: e.target.value })}
              className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary/50"
            >
              {ALL_CARD_PILLARS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block mb-2">.docx file (max 5MB)</label>
            <label
              data-testid="button-pick-docx"
              className="w-full bg-black/40 border border-dashed border-primary/30 hover:border-primary/60 rounded-md px-3 py-2 text-primary font-mono text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 transition-colors"
            >
              <FileUp className="h-4 w-4" />
              {file ? file.name.slice(0, 32) : "Choose .docx"}
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > 5 * 1024 * 1024) {
                    setError(`File too large (${(f.size / 1024 / 1024).toFixed(2)}MB). Max 5MB.`);
                    e.target.value = "";
                    return;
                  }
                  setFile(f);
                  setError(null);
                  setResult(null);
                }}
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={run}
            disabled={busy || !file || !meta.title || !meta.description}
            data-testid="button-run-forge"
            className="px-5 py-3 rounded-lg font-mono text-xs uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/15 disabled:opacity-40 transition-all flex items-center gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Run Forge Lab
          </button>
          {result?.precheck.passes && canAccessForgeCards && (
            <button
              onClick={sendToPublish}
              data-testid="button-send-to-publish"
              className="px-5 py-3 rounded-lg font-mono text-xs uppercase tracking-wider bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" /> Send to Publish
            </button>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 font-mono text-sm text-destructive flex items-center gap-2" data-testid="text-forge-error">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        {/* Terminal log */}
        <div
          ref={logRef}
          data-testid="text-forge-log"
          className="bg-black/70 border border-white/10 rounded-md p-4 font-mono text-[11px] leading-relaxed h-72 overflow-y-auto"
        >
          {log.length === 0 ? (
            <div className="text-muted-foreground/50">// forge-lab idle. upload a .docx and hit Run.</div>
          ) : (
            log.map((l) => (
              <div key={l.id} className={LEVEL_COLOR[l.level]} data-testid={`log-line-${l.id}`}>{l.text}</div>
            ))
          )}
        </div>

        {result && (
          <div className="text-[11px] font-mono text-muted-foreground border-t border-white/5 pt-3" data-testid="text-forge-summary">
            Parsed <span className="text-white">{result.bodyLength.toLocaleString()}</span> chars from{" "}
            <span className="text-white">{result.fileName}</span>. HIVE{" "}
            <span className={result.precheck.passes ? "text-secondary" : "text-amber-400"}>
              {result.precheck.hiveScore}/100
            </span>{" "}— {result.precheck.passes ? "ready to publish." : "needs another pass."}
          </div>
        )}
      </div>
    </div>
  );
}

export default ForgeLabPage;
