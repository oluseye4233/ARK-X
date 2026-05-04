import { useState } from "react";
import { useLocation } from "wouter";
import { FileText, ClipboardList, Linkedin } from "lucide-react";
import { ResumeUploader } from "@/components/upload/ResumeUploader";
import { SelfAssessmentForm } from "@/components/upload/SelfAssessmentForm";
import { LinkedInImporter } from "@/components/upload/LinkedInImporter";

type IntakeMode = "resume" | "self" | "linkedin";

const MODES: Array<{ key: IntakeMode; label: string; sub: string; icon: React.ElementType }> = [
  { key: "resume", label: "Resume Upload", sub: "PDF / TXT", icon: FileText },
  { key: "self", label: "Self-Assessment", sub: "Questionnaire", icon: ClipboardList },
  { key: "linkedin", label: "LinkedIn", sub: "Paste Profile", icon: Linkedin },
];

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<IntakeMode>("resume");

  const handleComplete = () => {
    setLocation("/dashboard");
  };

  return (
    <div className="w-full max-w-4xl mx-auto min-h-[80vh] flex flex-col justify-center py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-display font-bold text-white mb-2 uppercase tracking-wide">
          Intelligence Vector Input
        </h2>
        <p className="text-muted-foreground font-sans">
          Initialize the analysis pipeline. Upload your resume, take a quick self-assessment, or import
          your LinkedIn profile — the 4J.BONSAI engine generates your full career intelligence profile
          either way.
        </p>
      </div>

      {/* Mode tabs — all three flows converge on the same JST/CCMI engine */}
      <div
        className="grid grid-cols-3 gap-2 mb-6"
        role="tablist"
        aria-label="Assessment intake mode"
        data-testid="tabs-intake-mode"
      >
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(m.key)}
              data-testid={`tab-mode-${m.key}`}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/30 hover:text-white"
              }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${active ? "text-primary" : ""}`} />
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold uppercase tracking-wider truncate">
                  {m.label}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-widest opacity-70 truncate">
                  {m.sub}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {mode === "resume" && <ResumeUploader onComplete={handleComplete} />}
      {mode === "self" && <SelfAssessmentForm onComplete={handleComplete} />}
      {mode === "linkedin" && <LinkedInImporter onComplete={handleComplete} />}
    </div>
  );
}
