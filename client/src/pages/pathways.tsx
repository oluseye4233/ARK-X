import { MOCK_USER_DATA } from "@/lib/mockData";
import { TransferabilityRadar } from "@/components/pathways/TransferabilityRadar";
import { UpskillingTimeline } from "@/components/pathways/UpskillingTimeline";
import { ArrowUpRight } from "lucide-react";

export default function PathwaysPage() {
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
        
        {/* Left Column: Radar & Pivots */}
        <div className="space-y-8">
          <TransferabilityRadar data={MOCK_USER_DATA.transferability} />
          
          <div className="glass-card p-6 rounded-xl">
            <h3 className="font-display font-bold text-lg text-white uppercase tracking-widest mb-4">
              Top Pivot Opportunities
            </h3>
            <div className="space-y-4">
              {MOCK_USER_DATA.pivotOpportunities.map((pivot, i) => (
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

        {/* Right Column: Upskilling Timeline */}
        <div>
          <UpskillingTimeline items={MOCK_USER_DATA.upskillingPlan as any} />
        </div>

      </div>
    </div>
  );
}