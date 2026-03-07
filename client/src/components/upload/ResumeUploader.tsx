import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, CheckCircle2, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResumeUploaderProps {
  onComplete: () => void;
}

export function ResumeUploader({ onComplete }: ResumeUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "processing" | "complete">("idle");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processingSteps = [
    "Parsing Document Layout...",
    "Extracting Experience Architecture...",
    "Quantifying Achievement Vectors...",
    "Classifying NAICS Sector...",
    "Synthesizing JST Index...",
  ];

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
      simulateUpload();
    }
  };

  const simulateUpload = () => {
    setUploadState("uploading");
    let prog = 0;
    const interval = setInterval(() => {
      prog += 5;
      setProgress(prog);
      if (prog >= 100) {
        clearInterval(interval);
        simulateProcessing();
      }
    }, 50);
  };

  const simulateProcessing = () => {
    setUploadState("processing");
    let stepIndex = 0;
    
    const nextStep = () => {
      if (stepIndex < processingSteps.length) {
        setCurrentStep(processingSteps[stepIndex]);
        stepIndex++;
        setTimeout(nextStep, 1200);
      } else {
        setUploadState("complete");
        setTimeout(onComplete, 1500);
      }
    };
    
    nextStep();
  };

  return (
    <div className="w-full max-w-2xl mx-auto" data-testid="resume-uploader">
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
            <p className="font-sans text-muted-foreground mb-8">
              Drag and drop your PDF/DOCX resume for intelligence mining
            </p>
            
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              accept=".pdf,.docx" 
              onChange={simulateUpload}
            />
            
            <Button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-primary/10 text-primary border border-primary/50 hover:bg-primary/20 font-mono uppercase tracking-widest rounded-none"
            >
              Browse Files
            </Button>
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
            <FileText className="w-16 h-16 mx-auto mb-6 text-primary animate-pulse" />
            <h3 className="font-display font-bold text-xl text-white mb-6">Transmitting Data Securely</h3>
            
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
            className="glass-card rounded-xl p-12 text-center border-secondary/30"
          >
            <Activity className="w-16 h-16 mx-auto mb-6 text-secondary animate-spin" />
            <h3 className="font-display font-bold text-xl text-white mb-6 uppercase tracking-widest">
              Synthesizing Intelligence
            </h3>
            
            <div className="h-8 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="font-mono text-sm text-secondary"
                >
                  {currentStep}
                </motion.p>
              </AnimatePresence>
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
            <CheckCircle2 className="w-16 h-16 mx-auto mb-6 text-primary neon-text" />
            <h3 className="font-display font-bold text-2xl text-white mb-2">Analysis Complete</h3>
            <p className="font-mono text-sm text-primary uppercase tracking-widest">
              Routing to Intelligence Hub...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}