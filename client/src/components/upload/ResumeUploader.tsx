import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, CheckCircle2, Activity, AlertTriangle, Search, Calculator, Shield, GitBranch, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { LiveJSTScore } from "@/components/LiveJSTScore";

interface ProcessingPhase {
  id: number;
  name: string;
  description: string;
  icon: React.ElementType;
  steps: string[];
}

const PHASES: ProcessingPhase[] = [
  {
    id: 1,
    name: "Discovery & Extraction",
    description: "Parsing resume structure and extracting career data",
    icon: Search,
    steps: ["Parsing Document Layout", "Extracting Experience Architecture", "Identifying Skill Taxonomy"],
  },
  {
    id: 2,
    name: "JST Calculation",
    description: "Computing Jobs, Skills & Talent composite index",
    icon: Calculator,
    steps: ["Quantifying Achievement Vectors", "Classifying NAICS Sector", "Synthesizing JST Index"],
  },
  {
    id: 3,
    name: "Vulnerability Assessment",
    description: "Analyzing automation exposure and risk factors",
    icon: Shield,
    steps: ["Mapping Task Automation Potential", "Computing Vulnerability Score", "Generating Risk Modifiers"],
  },
  {
    id: 4,
    name: "Transferability Analysis",
    description: "Evaluating cross-industry skill portability",
    icon: GitBranch,
    steps: ["Building Transferability Vectors", "Identifying Pivot Opportunities", "Scoring Role Alignment"],
  },
  {
    id: 5,
    name: "Recommendations",
    description: "Generating personalized career intelligence",
    icon: Lightbulb,
    steps: ["Generating Upskilling Pathways", "Compiling FORGE Recommendations"],
  },
];

interface ResumeUploaderProps {
  onComplete: () => void;
}

export function ResumeUploader({ onComplete }: ResumeUploaderProps) {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "processing" | "complete" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [activePhase, setActivePhase] = useState(0);
  const [phaseStepIndex, setPhaseStepIndex] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [liveJobs, setLiveJobs] = useState(0);
  const [liveSkills, setLiveSkills] = useState(0);
  const [liveTalent, setLiveTalent] = useState(0);
  const [finalResult, setFinalResult] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalsRef = useRef<NodeJS.Timeout[]>([]);

  const clearAllIntervals = useCallback(() => {
    intervalsRef.current.forEach(clearInterval);
    intervalsRef.current = [];
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (!user) {
      setErrorMessage("Please log in before uploading a resume.");
      setUploadState("error");
      return;
    }

    clearAllIntervals();
    setFileName(file.name);
    setUploadState("uploading");
    setErrorMessage("");
    setProgress(0);

    let prog = 0;
    const uploadInterval = setInterval(() => {
      prog += 3;
      if (prog <= 40) {
        setProgress(prog);
      }
    }, 80);
    intervalsRef.current.push(uploadInterval);

    try {
      const apiPromise = api.uploadResume(file, user.id);

      await new Promise(resolve => setTimeout(resolve, 1200));

      clearInterval(uploadInterval);
      setProgress(100);
      setUploadState("processing");
      setActivePhase(0);
      setPhaseStepIndex(0);
      setCompletedPhases([]);
      setLiveJobs(0);
      setLiveSkills(0);
      setLiveTalent(0);
      setFinalResult(null);

      let currentPhaseIdx = 0;
      let currentStepIdx = 0;

      setCurrentStep(PHASES[0].steps[0]);

      const phaseScoreTargets = [
        { j: 18, s: 14, t: 16 },
        { j: 48, s: 42, t: 45 },
        { j: 62, s: 58, t: 60 },
        { j: 70, s: 66, t: 68 },
        { j: 75, s: 72, t: 74 },
      ];

      const stepInterval = setInterval(() => {
        const phase = PHASES[currentPhaseIdx];
        if (!phase) return;

        currentStepIdx++;
        if (currentStepIdx < phase.steps.length) {
          setPhaseStepIndex(currentStepIdx);
          setCurrentStep(phase.steps[currentStepIdx]);
        } else {
          setCompletedPhases(prev => [...prev, currentPhaseIdx]);
          const target = phaseScoreTargets[currentPhaseIdx];
          if (target) {
            setLiveJobs(target.j);
            setLiveSkills(target.s);
            setLiveTalent(target.t);
          }
          currentPhaseIdx++;
          currentStepIdx = 0;

          if (currentPhaseIdx < PHASES.length) {
            setActivePhase(currentPhaseIdx);
            setPhaseStepIndex(0);
            setCurrentStep(PHASES[currentPhaseIdx].steps[0]);
          }
        }
      }, 600);
      intervalsRef.current.push(stepInterval);

      const result = await apiPromise;
      setFinalResult(result);

      clearAllIntervals();

      if (result?.assessment) {
        setLiveJobs(result.assessment.jstJobs || 0);
        setLiveSkills(result.assessment.jstSkills || 0);
        setLiveTalent(result.assessment.jstTalent || 0);
      }

      setUploadState("complete");
      setTimeout(onComplete, 2000);
    } catch (err: any) {
      clearAllIntervals();
      setErrorMessage(err.message || "Upload failed. Please try again.");
      setUploadState("error");
    }
  };

  const handleRetry = () => {
    clearAllIntervals();
    setUploadState("idle");
    setProgress(0);
    setErrorMessage("");
    setFileName("");
    setActivePhase(0);
    setPhaseStepIndex(0);
    setCompletedPhases([]);
    setCurrentStep("");
    setLiveJobs(0);
    setLiveSkills(0);
    setLiveTalent(0);
    setFinalResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="w-full max-w-3xl mx-auto" data-testid="resume-uploader">
      <AnimatePresence mode="wait">
        {uploadState === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors duration-300 ${
              isDragging ? "border-primary bg-primary/5" : "border-white/20 bg-black/20"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <UploadCloud className={`w-16 h-16 mx-auto mb-6 ${isDragging ? "text-primary neon-text" : "text-muted-foreground"}`} />
            <h3 className="font-display font-bold text-2xl text-white mb-2">Upload Profile Vector</h3>
            <p className="font-sans text-muted-foreground mb-2">
              Drag and drop your resume for real-time intelligence mining
            </p>
            <p className="font-mono text-xs text-muted-foreground mb-8">
              Accepted: PDF, TXT | Max 10MB
            </p>

            <input
              data-testid="input-file-upload"
              type="file"
              className="hidden"
              ref={fileInputRef}
              accept=".pdf,.txt"
              onChange={handleFileInput}
            />

            <Button
              data-testid="button-browse-files"
              onClick={() => fileInputRef.current?.click()}
              className="bg-primary/10 text-primary border border-primary/50 hover:bg-primary/20 font-mono uppercase tracking-widest rounded-none"
            >
              Browse Files
            </Button>

            {!user && (
              <p className="mt-6 text-xs font-mono text-destructive/80 border border-destructive/20 bg-destructive/5 rounded p-3">
                Log in first to save your assessment results.
              </p>
            )}
          </motion.div>
        )}

        {uploadState === "uploading" && (
          <motion.div
            key="uploading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card rounded-xl p-12 text-center"
          >
            <FileText className="w-16 h-16 mx-auto mb-4 text-primary animate-pulse" />
            <h3 className="font-display font-bold text-xl text-white mb-2">Transmitting Data Securely</h3>
            <p className="font-mono text-xs text-muted-foreground mb-6">{fileName}</p>

            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
              />
            </div>
            <p className="font-mono text-xs text-primary">{progress}% Complete</p>
          </motion.div>
        )}

        {uploadState === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card rounded-xl p-8 border-secondary/30"
            data-testid="processing-pipeline"
          >
            <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1">
            <div className="text-center mb-6">
              <Activity className="w-10 h-10 mx-auto mb-3 text-secondary animate-spin" />
              <h3 className="font-display font-bold text-xl text-white uppercase tracking-widest">
                Synthesizing Intelligence
              </h3>
              <p className="font-mono text-xs text-muted-foreground mt-1">{fileName}</p>
            </div>

            <div className="space-y-3">
              {PHASES.map((phase, idx) => {
                const isCompleted = completedPhases.includes(idx);
                const isActive = activePhase === idx;
                const isPending = !isCompleted && !isActive;
                const PhaseIcon = phase.icon;

                return (
                  <motion.div
                    key={phase.id}
                    data-testid={`phase-${phase.id}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`flex items-center gap-4 p-3 rounded-lg border transition-all duration-300 ${
                      isActive
                        ? "border-secondary/50 bg-secondary/5"
                        : isCompleted
                        ? "border-primary/30 bg-primary/5"
                        : "border-white/5 bg-white/[0.02]"
                    }`}
                  >
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? "bg-primary/20 text-primary"
                        : isActive
                        ? "bg-secondary/20 text-secondary"
                        : "bg-white/5 text-muted-foreground"
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <PhaseIcon className={`w-5 h-5 ${isActive ? "animate-pulse" : ""}`} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-[10px] uppercase tracking-widest ${
                          isCompleted ? "text-primary" : isActive ? "text-secondary" : "text-muted-foreground/50"
                        }`}>
                          Phase {phase.id}
                        </span>
                        {isActive && (
                          <span className="font-mono text-[10px] text-secondary/70">
                            Step {phaseStepIndex + 1}/{phase.steps.length}
                          </span>
                        )}
                        {isCompleted && (
                          <span className="font-mono text-[10px] text-primary/70">Complete</span>
                        )}
                      </div>
                      <p className={`font-display text-sm font-semibold ${
                        isPending ? "text-muted-foreground/40" : "text-white"
                      }`}>
                        {phase.name}
                      </p>
                      {isActive && (
                        <div className="mt-1.5">
                          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-secondary"
                              initial={{ width: "0%" }}
                              animate={{ width: `${((phaseStepIndex + 1) / phase.steps.length) * 100}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                          <AnimatePresence mode="wait">
                            <motion.p
                              key={currentStep}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="font-mono text-[11px] text-secondary/70 mt-1"
                            >
                              {currentStep}...
                            </motion.p>
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="hidden md:flex flex-col items-center glass p-4 rounded-xl border border-white/10 min-w-[180px]"
            >
              <LiveJSTScore
                jobsScore={liveJobs}
                skillsScore={liveSkills}
                talentScore={liveTalent}
                compact
                label="Live JST Score"
              />
            </motion.div>
            </div>
          </motion.div>
        )}

        {uploadState === "complete" && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-xl p-12 text-center border-primary shadow-[0_0_30px_rgba(var(--primary),0.2)]"
          >
            <div className="flex flex-col items-center gap-6">
              <CheckCircle2 className="w-16 h-16 text-primary neon-text" />
              <div>
                <h3 className="font-display font-bold text-2xl text-white mb-2">Analysis Complete</h3>
                <p className="font-mono text-sm text-primary uppercase tracking-widest">
                  Routing to Intelligence Hub...
                </p>
              </div>
              <LiveJSTScore
                jobsScore={liveJobs}
                skillsScore={liveSkills}
                talentScore={liveTalent}
                label="Final JST Score"
              />
            </div>
          </motion.div>
        )}

        {uploadState === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-xl p-12 text-center border-destructive/30"
          >
            <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-destructive" />
            <h3 className="font-display font-bold text-xl text-white mb-4">Analysis Failed</h3>
            <p className="font-mono text-sm text-destructive mb-8">{errorMessage}</p>
            <Button
              data-testid="button-retry-upload"
              onClick={handleRetry}
              className="bg-destructive/10 text-destructive border border-destructive/50 hover:bg-destructive/20 font-mono uppercase tracking-widest rounded-none"
            >
              Retry Upload
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}