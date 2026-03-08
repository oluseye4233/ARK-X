import { useEffect, useState } from "react";
import { JSTGauge } from "@/components/dashboard/JSTGauge";
import { JSTRadar } from "@/components/dashboard/JSTRadar";
import { VulnerabilityMeter } from "@/components/dashboard/VulnerabilityMeter";
import { JnomicsCardList } from "@/components/dashboard/JnomicsCardList";
import { ArchetypeHandicap } from "@/components/dashboard/ArchetypeHandicap";
import { TaskHeatmap } from "@/components/dashboard/TaskHeatmap";
import { VulnerabilityTimeline } from "@/components/dashboard/VulnerabilityTimeline";
import { Cpu, FileText, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";

interface AssessmentData {
  id: string;
  userId: string;
  jstTotal: number;
  jstJobs: number;
  jstSkills: number;
  jstTalent: number;
  vulnerabilityLevel: number;
  readinessProfile: string;
  riskModifiers: Array<{ task: string; automatable: number }> | null;
  matchedCardIds: string[] | null;
  percentileRank?: number;
  previousScore?: number;
  industryAverage?: number;
  archetypeArchitect: number;
  archetypeOrchestrator: number;
  archetypeConductor: number;
  automationMilestones?: Array<{ year: number; event: string; automationPct: number; impact: string }> | null;
  upskillingPlans: any[];
  pivotOpportunities: any[];
  transferabilityVectors: any[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
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
        <p className="font-mono text-sm text-muted-foreground uppercase">Loading Intelligence Data...</p>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="w-full max-w-6xl mx-auto min-h-[60vh] flex flex-col items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground uppercase mb-4">No assessment data found.</p>
        <Link href="/upload" className="inline-flex items-center justify-center bg-primary text-primary-foreground font-mono uppercase tracking-widest px-6 py-3 text-sm font-medium">
          Start Assessment
        </Link>
      </div>
    );
  }

  const userName = user?.name || "Unknown";
  const userRole = user?.role || "Unknown";

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-white uppercase tracking-wider">
            Intelligence Hub
          </h2>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            SUBJECT: <span className="text-primary">{userName}</span> | ROLE: {userRole}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Link href="/report" className="inline-flex items-center justify-center border border-primary/50 text-primary hover:bg-primary/10 font-mono text-xs uppercase tracking-widest h-10 px-4">
            <FileText className="w-4 h-4 mr-2" /> Export Brief
          </Link>
          
          <div className="glass px-4 py-2 flex items-center gap-3 rounded-lg border-primary/30">
            <Cpu className="w-5 h-5 text-primary" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Primary Archetype</p>
              <p className="text-primary font-display font-bold uppercase tracking-wider">{assessment.readinessProfile}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <JSTGauge 
          score={assessment.jstTotal}
          jobsScore={assessment.jstJobs}
          skillsScore={assessment.jstSkills}
          talentScore={assessment.jstTalent}
          percentileRank={assessment.percentileRank ?? 72}
          previousScore={assessment.previousScore ?? Math.round(assessment.jstTotal * 0.95)}
          industryAverage={assessment.industryAverage ?? 195}
        />

        <JSTRadar
          jobsScore={assessment.jstJobs}
          skillsScore={assessment.jstSkills}
          talentScore={assessment.jstTalent}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <VulnerabilityMeter level={assessment.vulnerabilityLevel} />
          
        <TaskHeatmap riskModifiers={assessment.riskModifiers || []} />
      </div>

      <VulnerabilityTimeline
        vulnerabilityLevel={assessment.vulnerabilityLevel}
        milestones={assessment.automationMilestones}
      />

      <ArchetypeHandicap
        architect={assessment.archetypeArchitect}
        orchestrator={assessment.archetypeOrchestrator}
        conductor={assessment.archetypeConductor}
        profile={assessment.readinessProfile}
      />

      <JnomicsCardList matchedCardIds={assessment.matchedCardIds || []} />

    </div>
  );
}