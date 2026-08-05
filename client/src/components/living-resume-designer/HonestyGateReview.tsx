import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { LivingResumeDraft, LivingResumePrefill } from "./types";

// LRD-404: a lightweight pre-export check. Issues are surfaced to the user —
// never silently dropped, never silently fabricated — but do not block
// export; the subscriber decides whether to ship an incomplete card.
export function computeHonestyGateIssues(draft: LivingResumeDraft, prefill: LivingResumePrefill | null): string[] {
  const issues: string[] = [];

  draft.projects.forEach((p, i) => {
    if (!p.summary.trim()) issues.push(`Project ${i + 1} ("${p.name || "Untitled"}") is missing a summary.`);
    if (!p.link.trim()) issues.push(`Project ${i + 1} ("${p.name || "Untitled"}") has no link.`);
  });

  draft.aiApps.forEach((a, i) => {
    if (!a.pitch.trim()) issues.push(`App ${i + 1} ("${a.name || "Untitled"}") is missing a one-line pitch.`);
    if (!a.url.trim()) issues.push(`App ${i + 1} ("${a.name || "Untitled"}") has no link.`);
  });

  if (draft.headshotDataUrl && !draft.headshotAlt.trim()) {
    issues.push("Headshot is missing alt text.");
  }

  if (draft.video && !draft.video.thumbnailDataUrl) {
    issues.push("Video intro couldn't embed an offline thumbnail — it will show a generic play card.");
  }

  if (draft.showSpcPanel && (prefill?.spcListings.length ?? 0) === 0) {
    issues.push("SPC Portfolio Panel is enabled but no active listings were found on your account.");
  }

  if (draft.showArkScoreBadge && !prefill?.arkScore) {
    issues.push("ARK Score badge is enabled but no score record could be confirmed from your account.");
  }

  return issues;
}

export function HonestyGateReview({ draft, prefill }: { draft: LivingResumeDraft; prefill: LivingResumePrefill | null }) {
  const issues = computeHonestyGateIssues(draft, prefill);

  return (
    <div className="space-y-2" data-testid="honesty-gate-review">
      {issues.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-emerald-400" data-testid="honesty-gate-clean">
          <CheckCircle2 className="h-4 w-4" />
          Nothing flagged — ready to export.
        </div>
      ) : (
        <ul className="space-y-1.5" data-testid="honesty-gate-issues">
          {issues.map((issue, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-amber-400" data-testid={`honesty-gate-issue-${i}`}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {issue}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
