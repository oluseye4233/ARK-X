import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import UpgradeGate from "@/components/UpgradeGate";
import { useSubscription } from "@/lib/useSubscription";
import { api } from "@/lib/api";

interface GauntletRun {
  id: string;
  appName: string;
  hiveVector: Record<string, number>;
  hiveScore: number;
  verdict: "VIABLE" | "NEEDS_WORK" | "INCOMPLETE";
  reasons: string[];
  creditsCharged: number;
  createdAt: string;
  guidance?: string[];
  newBalance?: number;
}

const VERDICT_META: Record<string, { label: string; className: string; Icon: typeof ShieldCheck }> = {
  VIABLE: { label: "Viable", className: "text-emerald-400 border-emerald-400/40", Icon: ShieldCheck },
  NEEDS_WORK: { label: "Needs Work", className: "text-amber-400 border-amber-400/40", Icon: AlertTriangle },
  INCOMPLETE: { label: "Incomplete", className: "text-rose-400 border-rose-400/40", Icon: XCircle },
};

function VerdictBadge({ verdict }: { verdict: string }) {
  const m = VERDICT_META[verdict] ?? VERDICT_META.INCOMPLETE;
  const Icon = m.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-mono text-xs uppercase tracking-widest ${m.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {m.label}
    </span>
  );
}

function HiveVectorGrid({ vector }: { vector: Record<string, number> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {Object.entries(vector).map(([dim, score]) => (
        <div key={dim} className="bg-white/5 rounded px-2 py-1.5" data-testid={`hive-dim-${dim}`}>
          <p className="font-mono text-[10px] text-muted-foreground uppercase truncate">{dim}</p>
          <p className="font-mono text-sm text-white">{score}</p>
        </div>
      ))}
    </div>
  );
}

export default function GauntletPage() {
  const { canAccessReport } = useSubscription();
  const [name, setName] = useState("");
  const [pitch, setPitch] = useState("");
  const [stack, setStack] = useState("");
  const [url, setUrl] = useState("");
  const [testDemoSrcdoc, setTestDemoSrcdoc] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<GauntletRun | null>(null);

  const { data: runs, refetch } = useQuery<GauntletRun[]>({
    queryKey: ["/api/gauntlet/runs"],
    queryFn: () => api.getGauntletRuns(),
    enabled: canAccessReport,
  });

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await api.runGauntlet({ name, pitch, stack, url, testDemoSrcdoc: testDemoSrcdoc || undefined });
      setLastResult(result);
      refetch();
    } catch (e: any) {
      setError(e.message ?? "Run failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8" data-testid="page-gauntlet">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-white">Atomic Gauntlet</h1>
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          AI-judged quality review for your AI-native apps
        </p>
        <p className="text-xs text-muted-foreground mt-2 max-w-2xl">
          This is an AI-judged review of your submission's description and demo — not sandboxed code
          execution or a live functional test. Each run costs 10 credits.
        </p>
      </div>

      <UpgradeGate hasAccess={canAccessReport} requiredPlan="Pro" featureName="Atomic Gauntlet">
        <div className="space-y-6">
          <div className="glass-card rounded-xl border border-white/10 p-5 space-y-4">
            <div>
              <Label htmlFor="gl-name">App name</Label>
              <Input id="gl-name" data-testid="input-gauntlet-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="gl-pitch">One-line pitch</Label>
              <Input id="gl-pitch" data-testid="input-gauntlet-pitch" value={pitch} onChange={(e) => setPitch(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="gl-stack">Stack</Label>
              <Input id="gl-stack" data-testid="input-gauntlet-stack" value={stack} onChange={(e) => setStack(e.target.value)} placeholder="React, Node, Postgres" />
            </div>
            <div>
              <Label htmlFor="gl-url">Hosted URL (optional)</Label>
              <Input id="gl-url" data-testid="input-gauntlet-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <Label htmlFor="gl-demo">Test My Work demo (optional inline HTML)</Label>
              <Textarea
                id="gl-demo"
                data-testid="textarea-gauntlet-demo"
                rows={3}
                value={testDemoSrcdoc}
                onChange={(e) => setTestDemoSrcdoc(e.target.value)}
              />
            </div>
            <Button onClick={handleRun} disabled={running || !name.trim()} data-testid="button-run-gauntlet">
              {running ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Run Gauntlet (10 credits)
            </Button>
            {error && <p className="text-xs text-destructive" data-testid="text-gauntlet-error">{error}</p>}
          </div>

          {lastResult && (
            <div className="glass-card rounded-xl border border-white/10 p-5 space-y-4" data-testid="gauntlet-result">
              <div className="flex items-center justify-between">
                <VerdictBadge verdict={lastResult.verdict} />
                <span className="font-mono text-sm text-muted-foreground">HIVE {lastResult.hiveScore}/100</span>
              </div>
              <HiveVectorGrid vector={lastResult.hiveVector} />
              {(lastResult.guidance ?? []).length > 0 && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                    FIX guidance
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    {(lastResult.guidance ?? []).map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
              {typeof lastResult.newBalance === "number" && (
                <p className="font-mono text-[10px] text-muted-foreground">
                  Remaining credits: {lastResult.newBalance}
                </p>
              )}
            </div>
          )}

          {runs && runs.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Run history
              </p>
              <div className="space-y-2">
                {runs.map((r) => (
                  <div key={r.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2" data-testid={`gauntlet-run-${r.id}`}>
                    <span className="font-mono text-sm text-white truncate">{r.appName}</span>
                    <VerdictBadge verdict={r.verdict} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </UpgradeGate>
    </div>
  );
}
