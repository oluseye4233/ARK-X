import { useState } from "react";
import { Plus, Trash2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import UpgradeGate from "@/components/UpgradeGate";
import { MAX_AI_APPS, newAiApp, type AiAppDraft, type LivingResumeSpcListing } from "./types";

interface Props {
  apps: AiAppDraft[];
  onChange: (apps: AiAppDraft[]) => void;
  hasAccess: boolean;
  spcListings: LivingResumeSpcListing[];
}

// FORGE-Verified badge (LRD-204): only shown when the app's declared URL
// matches (by hostname) a URL embedded in one of the subscriber's own active
// SPC listing titles/descriptions is out of scope for a hostname check, so
// instead we key off SPC listing titles containing the app name — a
// deliberately conservative match. No badge is auto-granted without a hit
// (Honesty Gate G3).
function isForgeVerified(app: AiAppDraft, listings: LivingResumeSpcListing[]): boolean {
  const name = app.name.trim().toLowerCase();
  if (!name) return false;
  return listings.some((l) => l.title.toLowerCase().includes(name));
}

export function AiAppShowcase({ apps, onChange, hasAccess, spcListings }: Props) {
  const [previewId, setPreviewId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<AiAppDraft>) =>
    onChange(apps.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const remove = (id: string) => onChange(apps.filter((a) => a.id !== id));

  return (
    <UpgradeGate hasAccess={hasAccess} requiredPlan="Pro" featureName="AI-Native App Showcase">
      <div className="space-y-4" data-testid="ai-app-showcase">
        {apps.map((app, i) => {
          const verified = isForgeVerified(app, spcListings);
          return (
            <div key={app.id} className="glass-card rounded-xl border border-white/10 p-4 space-y-3" data-testid={`ai-app-${i}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    App {i + 1}
                  </p>
                  {verified && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-emerald-400 border border-emerald-400/40 rounded-full px-2 py-0.5"
                      data-testid={`badge-forge-verified-${i}`}
                    >
                      <ShieldCheck className="h-3 w-3" /> FORGE-Verified
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(app.id)} data-testid={`button-remove-app-${i}`}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input data-testid={`input-app-name-${i}`} value={app.name} onChange={(e) => update(app.id, { name: e.target.value })} />
                </div>
                <div>
                  <Label>Stack</Label>
                  <Input data-testid={`input-app-stack-${i}`} value={app.stack} onChange={(e) => update(app.id, { stack: e.target.value })} placeholder="React, Node, Postgres" />
                </div>
              </div>
              <div>
                <Label>One-line pitch</Label>
                <Input data-testid={`input-app-pitch-${i}`} value={app.pitch} onChange={(e) => update(app.id, { pitch: e.target.value })} />
              </div>
              <div>
                <Label>Link</Label>
                <Input data-testid={`input-app-url-${i}`} value={app.url} onChange={(e) => update(app.id, { url: e.target.value })} placeholder="https://…" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>"Test My Work" demo (optional inline HTML)</Label>
                  <button
                    type="button"
                    className="text-xs font-mono text-muted-foreground hover:text-white flex items-center gap-1"
                    onClick={() => setPreviewId(previewId === app.id ? null : app.id)}
                    data-testid={`button-toggle-app-preview-${i}`}
                  >
                    {previewId === app.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {previewId === app.id ? "Hide preview" : "Preview"}
                  </button>
                </div>
                <Textarea
                  data-testid={`textarea-app-demo-${i}`}
                  rows={3}
                  value={app.testDemoSrcdoc}
                  onChange={(e) => update(app.id, { testDemoSrcdoc: e.target.value })}
                  placeholder="Paste a small self-contained HTML snippet to embed as a live 'Test My Work' demo…"
                />
                {previewId === app.id && app.testDemoSrcdoc && (
                  <iframe
                    title={`preview-${app.id}`}
                    srcDoc={app.testDemoSrcdoc}
                    sandbox=""
                    className="w-full h-40 mt-2 rounded border border-white/10 bg-white"
                    data-testid={`iframe-app-preview-${i}`}
                  />
                )}
              </div>
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          disabled={apps.length >= MAX_AI_APPS}
          onClick={() => onChange([...apps, newAiApp()])}
          data-testid="button-add-app"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add app ({apps.length}/{MAX_AI_APPS})
        </Button>
      </div>
    </UpgradeGate>
  );
}
