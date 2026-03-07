import { MOCK_USER_DATA } from "@/lib/mockData";
import { JSTGauge } from "@/components/dashboard/JSTGauge";
import { VulnerabilityMeter } from "@/components/dashboard/VulnerabilityMeter";
import { Cpu } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-white uppercase tracking-wider">
            Intelligence Hub
          </h2>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            SUBJECT: <span className="text-primary">{MOCK_USER_DATA.name}</span> | ROLE: {MOCK_USER_DATA.role}
          </p>
        </div>
        
        {/* Readiness Badge */}
        <div className="glass px-4 py-2 flex items-center gap-3 rounded-lg border-primary/30">
          <Cpu className="w-5 h-5 text-primary" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Readiness Profile</p>
            <p className="text-primary font-display font-bold uppercase tracking-wider">{MOCK_USER_DATA.readinessProfile}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* JST Score */}
        <JSTGauge 
          score={MOCK_USER_DATA.jstScore.total}
          jobsScore={MOCK_USER_DATA.jstScore.jobs}
          skillsScore={MOCK_USER_DATA.jstScore.skills}
          talentScore={MOCK_USER_DATA.jstScore.talent}
        />
        
        {/* Vulnerability Meter & Breakdown */}
        <div className="flex flex-col justify-between space-y-8">
          <VulnerabilityMeter level={MOCK_USER_DATA.vulnerabilityLevel} />
          
          <div className="glass-card p-6 rounded-xl border-orange-500/20">
             <h4 className="font-mono text-sm uppercase tracking-widest text-orange-500 mb-4">Risk Modifiers</h4>
             <ul className="space-y-3 font-sans text-sm">
               <li className="flex justify-between items-center">
                 <span className="text-muted-foreground">Routine Data Analysis</span>
                 <span className="text-destructive font-mono">85% Automatable</span>
               </li>
               <li className="flex justify-between items-center">
                 <span className="text-muted-foreground">System Configuration</span>
                 <span className="text-orange-500 font-mono">60% Automatable</span>
               </li>
               <li className="flex justify-between items-center">
                 <span className="text-muted-foreground">Stakeholder Communication</span>
                 <span className="text-secondary font-mono">15% Automatable</span>
               </li>
             </ul>
          </div>
        </div>
      </div>

    </div>
  );
}