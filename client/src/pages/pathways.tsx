import { useEffect, useState } from "react";
import { TransferabilityRadar } from "@/components/pathways/TransferabilityRadar";
import { UpskillingTimeline } from "@/components/pathways/UpskillingTimeline";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";

export default function PathwaysPage() {
  const { user } = useAuth();
  const [assessment, setAssessment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.getLatestAssessment(user.id)
      .then(setAssessment)
      .catch(() => setAssessment(null))
      .finally(() => setLoading(false));
  }, [user]);

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
                <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group">
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
              ))}
            </div>
          </div>
        </div>

        <div>
          <UpskillingTimeline items={assessment.upskillingPlans || []} />
        </div>

      </div>
    </div>
  );
}