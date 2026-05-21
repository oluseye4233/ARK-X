import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { Loader2, Upload, Sparkles, AlertTriangle } from "lucide-react";

type ImportResponse = {
  dryRun: boolean;
  upserted?: number;
  stats: { totalBlocks: number; parsed: number; byPillar: Record<string, number>; byType: Record<string, number> };
  skipped: Array<{ id: string | null; reason: string; snippet: string }>;
  preview?: Array<{ id: string; name: string; pillar: string; type: string; baseKcse: number; tokenCost: number; description: string }>;
};

export default function AdminCcgeImportPage() {
  const { user, isLoading } = useAuth();
  const [markdown, setMarkdown] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return <div className="p-8 font-mono text-sm text-muted-foreground">Loading…</div>;
  }
  if (!user || !(user as any).isAdmin) {
    return (
      <div className="p-8" data-testid="text-admin-import-forbidden">
        <p className="font-mono text-sm text-destructive">Admin only.</p>
      </div>
    );
  }

  async function run(dryRun: boolean) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = (await api.importCcgeCompendium(markdown, dryRun)) as ImportResponse;
      setResult(res);
    } catch (e: any) {
      setError(e?.message || "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) {
      setError(`File too large (${Math.round(file.size / 1024)}KB). Max 500KB.`);
      e.target.value = "";
      return;
    }
    try {
      const text = await file.text();
      setMarkdown(text);
      setResult(null);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to read file.");
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-display font-bold text-white">CCGE Compendium Import</h1>
        <p className="text-sm font-mono text-muted-foreground mt-1">
          Paste or upload a compendium-format Markdown (cards under <code className="text-primary">### [ID] Name</code>).
          Parser infers pillar from ID prefix, type from KCSE band, and upserts into <code className="text-primary">ccge_cards</code>.
        </p>
      </header>

      <div className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest">
            Compendium Markdown
          </label>
          <label
            data-testid="button-import-compendium-file"
            className="text-[10px] uppercase font-mono tracking-widest text-primary/80 hover:text-primary cursor-pointer border border-primary/30 hover:border-primary/60 rounded px-2 py-1 transition-colors"
          >
            Upload .md / .txt
            <input
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              className="hidden"
              onChange={handleFile}
            />
          </label>
        </div>
        <textarea
          data-testid="input-compendium-markdown"
          value={markdown}
          onChange={(e) => { setMarkdown(e.target.value); setResult(null); }}
          placeholder="### [SYS-F001] Expert AI Assistant&#10;&#10;**Content:** &quot;You are an expert AI assistant…&quot;&#10;&#10;**Priority:** HIGH | **Tokens:** 12 | **KCSE Total:** 90/100&#10;…"
          rows={14}
          className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-primary/50 leading-relaxed"
        />
        <p className="text-[10px] font-mono text-muted-foreground">
          {markdown.length.toLocaleString()} chars
        </p>

        <div className="flex gap-3">
          <button
            data-testid="button-compendium-dryrun"
            onClick={() => run(true)}
            disabled={busy || markdown.length < 50}
            className="px-5 py-3 rounded-lg font-mono text-xs uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/15 disabled:opacity-40 transition-all flex items-center gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Dry-Run Parse
          </button>
          <button
            data-testid="button-compendium-import"
            onClick={() => run(false)}
            disabled={busy || markdown.length < 50}
            className="px-5 py-3 rounded-lg font-mono text-xs uppercase tracking-wider bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 disabled:opacity-40 transition-all flex items-center gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import & Upsert
          </button>
        </div>

        {error && (
          <div className="text-xs font-mono text-destructive flex items-center gap-2" data-testid="text-compendium-error">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}
      </div>

      {result && (
        <div className="glass-card rounded-xl p-5 space-y-4" data-testid="text-compendium-result">
          <h2 className="text-lg font-display text-white">
            {result.dryRun ? "Dry-Run Results" : `Imported ${result.upserted ?? 0} cards`}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <Stat label="Blocks Found" value={result.stats.totalBlocks} />
            <Stat label="Parsed" value={result.stats.parsed} />
            <Stat label="Skipped" value={result.skipped.length} />
            <Stat label="Pillars" value={Object.keys(result.stats.byPillar).length} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Breakdown title="By Pillar" data={result.stats.byPillar} />
            <Breakdown title="By Type" data={result.stats.byType} />
          </div>

          {result.preview && result.preview.length > 0 && (
            <div>
              <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-2">Preview (first 5)</p>
              <div className="space-y-1">
                {result.preview.map((c) => (
                  <div key={c.id} className="text-xs font-mono text-white/80 flex flex-wrap gap-2" data-testid={`preview-card-${c.id}`}>
                    <span className="text-primary">{c.id}</span>
                    <span>{c.name}</span>
                    <span className="text-muted-foreground">[{c.pillar} · {c.type} · kcse {c.baseKcse} · {c.tokenCost}t]</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.skipped.length > 0 && (
            <div>
              <p className="text-[10px] uppercase font-mono text-amber-400/80 tracking-widest mb-2">
                Skipped ({result.skipped.length})
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.skipped.map((s, i) => (
                  <div key={i} className="text-[11px] font-mono text-amber-400/70 border-l-2 border-amber-400/30 pl-2" data-testid={`skipped-card-${i}`}>
                    <div><span className="text-amber-400">{s.id || "?"}</span> — {s.reason}</div>
                    <div className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{s.snippet}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-black/40 border border-white/10 rounded-md px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-lg text-white font-bold">{value}</div>
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-2">{title}</p>
      <div className="space-y-1">
        {entries.length === 0 && <div className="text-xs text-muted-foreground font-mono">—</div>}
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs font-mono">
            <span className="text-white/80">{k}</span>
            <span className="text-primary">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
