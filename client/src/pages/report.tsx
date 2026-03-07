import { MOCK_USER_DATA } from "@/lib/mockData";
import { FileText, Download, Target, Zap, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JSTGauge } from "@/components/dashboard/JSTGauge";
import { VulnerabilityMeter } from "@/components/dashboard/VulnerabilityMeter";

export default function ReportPage() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      
      {/* Top Action Bar (Hidden when printing) */}
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

      {/* Report Content - Styled for both screen and print */}
      <div className="bg-white text-black p-10 rounded-xl print:p-0 print:bg-transparent shadow-2xl">
        
        {/* Report Header */}
        <div className="border-b-2 border-black/10 pb-6 mb-8 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2 text-primary font-display font-bold text-2xl tracking-widest mb-4">
              <FileText className="w-6 h-6" /> ARK INTELLIGENCE
            </div>
            <h1 className="text-4xl font-bold font-sans text-gray-900 leading-tight">Career Capital <br/>Assessment Brief</h1>
          </div>
          <div className="text-right font-mono text-xs text-gray-500 uppercase">
            <p>Generated: {new Date().toLocaleDateString()}</p>
            <p>Subject: {MOCK_USER_DATA.name}</p>
            <p>Role: {MOCK_USER_DATA.role}</p>
            <p>ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-12 mb-12">
          {/* We use a simplified rendering of JST for the printable report */}
          <div>
            <h3 className="text-lg font-bold font-display uppercase tracking-widest border-b border-black/10 pb-2 mb-4">JST Index Valuation</h3>
            <div className="flex items-center gap-6">
              <div className="text-6xl font-black font-display text-primary">{MOCK_USER_DATA.jstScore.total}</div>
              <div className="space-y-1 font-mono text-sm">
                <div className="flex justify-between w-32"><span className="text-gray-500">JOBS</span> <span className="font-bold">{MOCK_USER_DATA.jstScore.jobs}</span></div>
                <div className="flex justify-between w-32"><span className="text-gray-500">SKILLS</span> <span className="font-bold">{MOCK_USER_DATA.jstScore.skills}</span></div>
                <div className="flex justify-between w-32"><span className="text-gray-500">TALENT</span> <span className="font-bold">{MOCK_USER_DATA.jstScore.talent}</span></div>
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
                  <div className="text-xl font-bold font-display">{MOCK_USER_DATA.readinessProfile}</div>
                </div>
             </div>
          </div>
        </div>

        <div className="mb-12">
          <h3 className="text-lg font-bold font-display uppercase tracking-widest border-b border-black/10 pb-2 mb-6">AI Vulnerability & Risk</h3>
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
             <div className="flex justify-between items-center mb-4">
               <span className="font-bold text-lg">Level {MOCK_USER_DATA.vulnerabilityLevel}: At Risk</span>
               <span className="text-orange-600 font-mono text-sm uppercase bg-orange-100 px-3 py-1 rounded-full">Significant Exposure</span>
             </div>
             <p className="text-gray-600 mb-4">
               The subject's current skill profile demonstrates a moderate-to-high susceptibility to automation in the next 24 months. 
               Immediate action is recommended via dynamic upskilling to preserve career capital.
             </p>
             <div className="space-y-2 font-mono text-sm">
               <div className="flex justify-between border-t border-gray-200 pt-2"><span className="text-gray-500">Routine Data Analysis</span> <span className="text-red-600 font-bold">85% Automatable</span></div>
               <div className="flex justify-between border-t border-gray-200 pt-2"><span className="text-gray-500">System Configuration</span> <span className="text-orange-600 font-bold">60% Automatable</span></div>
               <div className="flex justify-between border-t border-gray-200 pt-2"><span className="text-gray-500">Stakeholder Communication</span> <span className="text-green-600 font-bold">15% Automatable</span></div>
             </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold font-display uppercase tracking-widest border-b border-black/10 pb-2 mb-6">Upskilling Recommendation</h3>
          <div className="space-y-4">
            {MOCK_USER_DATA.upskillingPlan.map((plan, i) => (
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