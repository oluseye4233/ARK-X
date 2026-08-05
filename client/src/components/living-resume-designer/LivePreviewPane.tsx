import { useMemo } from "react";
import { buildLivingResumeHtml } from "@/lib/livingResumeExport";
import type { LivingResumeDraft, LivingResumePrefill } from "./types";

interface Props {
  draft: LivingResumeDraft;
  prefill: LivingResumePrefill | null;
}

// LRD-103: renders the wizard's in-progress state through the EXACT export
// template — what you see here is what downloads via ExportPanel.
export function LivePreviewPane({ draft, prefill }: Props) {
  const html = useMemo(() => buildLivingResumeHtml(draft, prefill), [draft, prefill]);

  return (
    <div className="glass-card rounded-xl border border-white/10 overflow-hidden h-full min-h-[480px]" data-testid="live-preview-pane">
      <iframe title="Live preview" srcDoc={html} sandbox="allow-scripts" className="w-full h-full min-h-[480px] bg-white" />
    </div>
  );
}
