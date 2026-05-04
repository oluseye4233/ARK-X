import { useEffect, useState } from "react";
import { TransferabilityRadar } from "@/components/pathways/TransferabilityRadar";
import { UpskillingTimeline } from "@/components/pathways/UpskillingTimeline";
import { SkillGapMatrix } from "@/components/pathways/SkillGapMatrix";
import { ArrowUpRight, Loader2, Compass, Clock, Target } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { useSubscription } from "@/lib/useSubscription";
import UpgradeGate from "@/components/UpgradeGate";
import { FlippableCard } from "@/components/ui/flippable-card";

function feasibilityNarrative(score: number): string {
  if (score >= 80) return "Strong fit — most core skills already transfer.";
  if (score >= 60) return "Workable pivot — moderate upskilling required.";
  if (score >= 40) return "Stretch move — meaningful gaps to close before transition.";
  return "Long-haul pivot — treat as a 12+ month roadmap.";
}

export default function PathwaysPage() {
  const { user } = useAuth();
  const { canAccessPathways } = useSubscription();
  const [assessment, setAssessment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.getLatestAssessment(user.id)
      .then(setAssessment)
      .catch(() => setAssessment(null))
      .finally(() => setLoading(false));
  }, [user]);

  if (!canAccessPathways) {
    return (
      <UpgradeGate featureName="Career Pathways" requiredPlan="Individual Pro" hasAccess={false}>
        <div />
      </UpgradeGate>
    );
  }

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="font-mono text-sm text-muted-foreground uppercase">Loading Pathway Data...</p>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="w-full max-w-6xl mx-auto min-h-[60vh] flex flex-col items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground uppercase">No assessment data found. Upload a resume first.</p>
      </div>
    );
  }

  const radarData = (assessment.transferabilityVectors || []).map((v: any) => ({
    subject: v.subject,
    A: v.score,
    fullMark: 100,
  }));

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="border-b border-white/10 pb-6">
        <h2 className="text-3xl font-display font-bold text-white uppercase tracking-wider">
          Career Mobility & Pathways
        </h2>
        <p className="text-muted-foreground font-mono text-sm mt-1">
          Predictive modeling for career pivots and dynamic upskilling.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        <div className="space-y-8">
          <TransferabilityRadar data={radarData} />
          
          <div className="glass-card p-6 rounded-xl">
            <h3 className="font-display font-bold text-lg text-white uppercase tracking-widest mb-4">
              Top Pivot Opportunities
            </h3>
            <div className="space-y-4">
              {(assessment.pivotOpportunities || []).map((pivot: any, i: number) => (
                <FlippableCard
                  key={i}
                  testId={`pivot-${i}`}
                  minHeight="160px"
                  flipLabel={`Reveal pivot detail for ${pivot.role}`}
                  unflipLabel={`Hide pivot detail for ${pivot.role}`}
                  faceClassName="rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
                  backFaceClassName="rounded-lg bg-primary/5 border border-primary/30"
                  front={
                    <div className="flex items-center justify-between p-4 h-full pr-12 cursor-pointer">
                      <div>
                        <h4 className="font-display font-semibold text-primary group-hover:neon-text">{pivot.role}</h4>
                        <p className="text-xs font-mono text-muted-foreground mt-1">
                          GAP COST: {pivot.gapCost} | EST: {pivot.time}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-mono text-white block leading-none">{pivot.feasibility}%</span>
                        <span className="text-[10px] text-muted-foreground uppercase">Feasibility</span>
                      </div>
                      <ArrowUpRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100 -ml-4" />
                    </div>
                  }
                  back={
                    <div className="p-4 h-full flex flex-col gap-2 pr-12" data-testid={`pivot-${i}-back`}>
                      <div className="flex items-center gap-2">
                        <Compass className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[10px] font-mono uppercase tracking-widest text-primary">Pivot detail</span>
                      </div>
                      <h4 className="font-display font-semibold text-white text-sm leading-tight">{pivot.role}</h4>
                      <p className="text-xs font-sans text-white/80 leading-relaxed flex-1">
                        {feasibilityNarrative(Number(pivot.feasibility) || 0)}
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                        <div>
                          <div className="text-muted-foreground uppercase tracking-widest">Feasibility</div>
                          <div className="text-white text-sm font-bold">{pivot.feasibility}%</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3 text-amber-400" />
                          <div>
                            <div className="text-muted-foreground uppercase tracking-widest">Gap</div>
                            <div className="text-amber-400">{pivot.gapCost}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-secondary" />
                          <div>
                            <div className="text-muted-foreground uppercase tracking-widest">Time</div>
                            <div className="text-secondary">{pivot.time}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <UpskillingTimeline items={assessment.upskillingPlans || []} />
        </div>

      </div>

      <SkillGapMatrix
        pivotOpportunities={assessment.pivotOpportunities || []}
        transferabilityVectors={(assessment.transferabilityVectors || []).map((v: any) => ({
          subject: v.subject,
          score: v.score,
        }))}
      />
    </div>
  );
}