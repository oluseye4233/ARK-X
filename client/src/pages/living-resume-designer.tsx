import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useSubscription } from "@/lib/useSubscription";
import { WizardShell, type WizardStep } from "@/components/living-resume-designer/WizardShell";
import { IdentityThemeStep } from "@/components/living-resume-designer/IdentityThemeStep";
import { ProjectCardRepeater } from "@/components/living-resume-designer/ProjectCardRepeater";
import { MethodologyTagPicker } from "@/components/living-resume-designer/MethodologyTagPicker";
import { HeadshotStep } from "@/components/living-resume-designer/HeadshotStep";
import { SpcPortfolioPanel } from "@/components/living-resume-designer/SpcPortfolioPanel";
import { AiAppShowcase } from "@/components/living-resume-designer/AiAppShowcase";
import { VideoIntroStep } from "@/components/living-resume-designer/VideoIntroStep";
import { ArkScoreBadge } from "@/components/living-resume-designer/ArkScoreBadge";
import { ExportPanel } from "@/components/living-resume-designer/ExportPanel";
import { LivePreviewPane } from "@/components/living-resume-designer/LivePreviewPane";
import { EMPTY_DRAFT, type LivingResumeDraft, type LivingResumePrefill } from "@/components/living-resume-designer/types";

const DRAFT_STORAGE_KEY = "living-resume-designer:draft:v1";

function loadDraftFromStorage(): LivingResumeDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return { ...EMPTY_DRAFT, ...JSON.parse(raw) } as LivingResumeDraft;
  } catch {
    return null;
  }
}

function prefillToDraft(prefill: LivingResumePrefill): LivingResumeDraft {
  return {
    ...EMPTY_DRAFT,
    identity: {
      ...EMPTY_DRAFT.identity,
      name: prefill.identity.candidateName ?? "",
      role: prefill.identity.currentRole ?? "",
      employer: prefill.identity.currentEmployer ?? "",
      email: prefill.identity.contactEmail ?? "",
      phone: prefill.identity.contactPhone ?? "",
      linkedin: prefill.identity.linkLinkedin ?? "",
      github: prefill.identity.linkGithub ?? "",
      portfolio: prefill.identity.linkPortfolio ?? "",
    },
    headshotDataUrl: prefill.headshotDataUrl,
  };
}

export default function LivingResumeDesignerPage() {
  const { canAccessReport } = useSubscription();
  const [activeStep, setActiveStep] = useState("identity");
  const [draft, setDraft] = useState<LivingResumeDraft>(EMPTY_DRAFT);
  const hydrated = useRef(false);

  const { data: prefill, isLoading } = useQuery<LivingResumePrefill>({
    queryKey: ["/api/living-resume/prefill"],
    queryFn: () => api.getLivingResumePrefill(),
    staleTime: 1000 * 60,
  });

  // Hydrate once: prefer a saved local draft, otherwise seed from the
  // server prefill (LRD-301 resume-import bridge). Client-side/localStorage
  // only, per PDD §1 Step 3 — no server round trip after this.
  useEffect(() => {
    if (hydrated.current || !prefill) return;
    hydrated.current = true;
    const saved = loadDraftFromStorage();
    setDraft(saved ?? prefillToDraft(prefill));
  }, [prefill]);

  useEffect(() => {
    if (!hydrated.current) return;
    const timeout = setTimeout(() => {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }, 400);
    return () => clearTimeout(timeout);
  }, [draft]);

  const patch = (p: Partial<LivingResumeDraft>) => setDraft((d) => ({ ...d, ...p }));

  const handleExported = () => {
    api.sendLivingResumeTelemetry({
      fieldsCompleted:
        Object.values(draft.identity).filter(Boolean).length +
        (draft.headshotDataUrl ? 1 : 0) +
        draft.projects.length,
      tagsSelected: draft.tags.length,
      cardsLinked: draft.projects.length + draft.aiApps.length,
    });
  };

  const steps: WizardStep[] = useMemo(
    () => [
      { key: "identity", label: "Identity & Theme", content: <IdentityThemeStep draft={draft} prefill={prefill ?? null} onChange={patch} /> },
      {
        key: "projects",
        label: "Projects",
        content: (
          <div className="space-y-6">
            <HeadshotStep
              headshotDataUrl={draft.headshotDataUrl}
              headshotAlt={draft.headshotAlt}
              onChange={(headshotDataUrl) => patch({ headshotDataUrl })}
              onAltChange={(headshotAlt) => patch({ headshotAlt })}
            />
            <ProjectCardRepeater projects={draft.projects} onChange={(projects) => patch({ projects })} />
          </div>
        ),
      },
      { key: "tags", label: "Methodology", content: <MethodologyTagPicker tags={draft.tags} onChange={(tags) => patch({ tags })} /> },
      {
        key: "showcase",
        label: "SPC & Apps",
        content: (
          <div className="space-y-8">
            <SpcPortfolioPanel
              listings={prefill?.spcListings ?? []}
              enabled={draft.showSpcPanel}
              onToggle={(showSpcPanel) => patch({ showSpcPanel })}
              hasAccess={canAccessReport}
            />
            <AiAppShowcase apps={draft.aiApps} onChange={(aiApps) => patch({ aiApps })} hasAccess={canAccessReport} spcListings={prefill?.spcListings ?? []} />
            <ArkScoreBadge
              arkScore={prefill?.arkScore ?? null}
              enabled={draft.showArkScoreBadge}
              onToggle={(showArkScoreBadge) => patch({ showArkScoreBadge })}
              hasAccess={canAccessReport}
            />
            <VideoIntroStep video={draft.video} onChange={(video) => patch({ video })} hasAccess={canAccessReport} />
          </div>
        ),
      },
      { key: "export", label: "Export", content: <ExportPanel draft={draft} prefill={prefill ?? null} onExported={handleExported} /> },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, prefill, canAccessReport],
  );

  if (isLoading) {
    return (
      <div className="w-full max-w-6xl mx-auto min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="font-mono text-sm text-muted-foreground uppercase">Loading Living Resume Designer...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8" data-testid="page-living-resume-designer">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="h-6 w-6 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Living Resume Designer</h1>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
            Build a shareable, self-contained resume artifact
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WizardShell steps={steps} active={activeStep} onChange={setActiveStep} />
        <LivePreviewPane draft={draft} prefill={prefill ?? null} />
      </div>
    </div>
  );
}
