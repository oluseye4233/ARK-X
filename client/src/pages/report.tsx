import { useEffect, useState } from "react";
import { FileText, Download, Cpu, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { useSubscription } from "@/lib/useSubscription";
import UpgradeGate from "@/components/UpgradeGate";

export default function ReportPage() {
  const { user } = useAuth();
  const { canAccessReport } = useSubscription();
  const [assessment, setAssessment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.getLatestAssessment(user.id)
      .then(setAssessment)
      .catch(() => setAssessment(null))
      .finally(() => setLoading(false));
  }, [user]);

  const handlePrint = () => {
    window.print();
  };

  if (!canAccessReport) {
    return (
      <UpgradeGate featureName="Executive Report" requiredPlan="Individual Pro" hasAccess={false}>
        <div />
      </UpgradeGate>
    );
  }

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="font-mono text-sm text-muted-foreground uppercase">Loading Report Data...</p>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="w-full max-w-4xl mx-auto min-h-[60vh] flex flex-col items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground uppercase">No assessment data found.</p>
      </div>
    );
  }

  const LEVELS: Record<number, { name: string; label: string }> = {
    0: { name: "Critical", label: "Critical Exposure" },
    1: { name: "At Risk", label: "Significant Exposure" },
    2: { name: "Transitional", label: "Mixed Exposure" },
    3: { name: "Resilient", label: "Low Exposure" },
    4: { name: "Flourishing", label: "AI-Augmented Growth" },
  };

  const vulnInfo = LEVELS[assessment.vulnerabilityLevel] || LEVELS[2];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      
      <div className="flex justify-between items-center pb-6 border-b border-white/10 print:hidden">
        <div>
          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wider">
            Executive Summary Report
          </h2>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            Print-optimized intelligence brief.
          </p>
        </div>
        <Button 
          onClick={handlePrint}
          className="bg-primary/20 text-primary border border-primary/50 hover:bg-primary hover:text-primary-foreground font-mono uppercase tracking-widest"
        >
          <Download className="w-4 h-4 mr-2" /> Export to PDF
        </Button>
      </div>

      <div className="bg-white text-black p-10 rounded-xl print:p-0 print:bg-transparent shadow-2xl">
        
        <div className="border-b-2 border-black/10 pb-6 mb-8 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2 text-primary font-display font-bold text-2xl tracking-widest mb-4">
              <FileText className="w-6 h-6" /> ARK INTELLIGENCE
            </div>
            <h1 className="text-4xl font-bold font-sans text-gray-900 leading-tight">Career Capital <br/>Assessment Brief</h1>
          </div>
          <div className="text-right font-mono text-xs text-gray-500 uppercase">
            <p>Generated: {new Date().toLocaleDateString()}</p>
            <p>Subject: {user?.name}</p>
            <p>Role: {user?.role}</p>
            <p>ID: {assessment.id?.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-12 mb-12">
          <div>
            <h3 className="text-lg font-bold font-display uppercase tracking-widest border-b border-black/10 pb-2 mb-4">JST Index Valuation</h3>
            <div className="flex items-center gap-6">
              <div className="text-6xl font-black font-display text-primary">{assessment.jstTotal}</div>
              <div className="space-y-1 font-mono text-sm">
                <div className="flex justify-between w-32"><span className="text-gray-500">JOBS</span> <span className="font-bold">{assessment.jstJobs}</span></div>
                <div className="flex justify-between w-32"><span className="text-gray-500">SKILLS</span> <span className="font-bold">{assessment.jstSkills}</span></div>
                <div className="flex justify-between w-32"><span className="text-gray-500">TALENT</span> <span className="font-bold">{assessment.jstTalent}</span></div>
              </div>
            </div>
          </div>

          <div>
             <h3 className="text-lg font-bold font-display uppercase tracking-widest border-b border-black/10 pb-2 mb-4">Readiness Profile</h3>
             <div className="bg-gray-100 p-4 rounded-lg flex items-center gap-4">
                <div className="bg-primary/20 p-3 rounded-full text-primary">
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-mono uppercase text-gray-500">Classification</div>
                  <div className="text-xl font-bold font-display">{assessment.readinessProfile}</div>
                </div>
             </div>
          </div>
        </div>

        <div className="mb-12">
          <h3 className="text-lg font-bold font-display uppercase tracking-widest border-b border-black/10 pb-2 mb-6">AI Vulnerability & Risk</h3>
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
             <div className="flex justify-between items-center mb-4">
               <span className="font-bold text-lg">Level {assessment.vulnerabilityLevel}: {vulnInfo.name}</span>
               <span className="text-orange-600 font-mono text-sm uppercase bg-orange-100 px-3 py-1 rounded-full">{vulnInfo.label}</span>
             </div>
             <p className="text-gray-600 mb-4">
               The subject's current skill profile demonstrates a {assessment.vulnerabilityLevel < 2 ? "moderate-to-high" : "low-to-moderate"} susceptibility to automation in the next 24 months. 
               Immediate action is recommended via dynamic upskilling to preserve career capital.
             </p>
             <div className="space-y-2 font-mono text-sm">
               {(assessment.riskModifiers || []).map((mod: any, i: number) => (
                 <div key={i} className="flex justify-between border-t border-gray-200 pt-2">
                   <span className="text-gray-500">{mod.task}</span>
                   <span className={`font-bold ${mod.automatable > 70 ? 'text-red-600' : mod.automatable > 40 ? 'text-orange-600' : 'text-green-600'}`}>
                     {mod.automatable}% Automatable
                   </span>
                 </div>
               ))}
             </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold font-display uppercase tracking-widest border-b border-black/10 pb-2 mb-6">Upskilling Recommendation</h3>
          <div className="space-y-4">
            {(assessment.upskillingPlans || []).map((plan: any, i: number) => (
              <div key={i} className="flex gap-4 p-4 border border-gray-200 rounded-lg">
                <div className="w-24 flex-shrink-0 text-xs font-mono text-gray-500 uppercase pt-1">{plan.phase}</div>
                <div>
                  <h4 className="font-bold text-gray-900">{plan.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                </div>
                <div className="w-20 text-right text-xs font-mono text-gray-500 pt-1">
                  {plan.hours} Hrs
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 pt-6 border-t-2 border-black/10 text-center font-mono text-xs text-gray-400">
          CONFIDENTIAL & PROPRIETARY — GENERATED BY ARK SYNTHESIZED INTELLIGENCE
        </div>
      </div>
    </div>
  );
}