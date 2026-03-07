import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, CheckCircle2, Activity, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

interface ResumeUploaderProps {
  onComplete: () => void;
}

export function ResumeUploader({ onComplete }: ResumeUploaderProps) {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "processing" | "complete" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [fileName, setFileName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalsRef = useRef<NodeJS.Timeout[]>([]);

  const processingSteps = [
    "Parsing Document Layout...",
    "Extracting Experience Architecture...",
    "Quantifying Achievement Vectors...",
    "Classifying NAICS Sector...",
    "Synthesizing JST Index...",
  ];

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

      let stepIndex = 0;
      const stepInterval = setInterval(() => {
        if (stepIndex < processingSteps.length) {
          setCurrentStep(processingSteps[stepIndex]);
          stepIndex++;
        }
      }, 700);
      intervalsRef.current.push(stepInterval);

      await apiPromise;

      clearAllIntervals();
      setUploadState("complete");
      setTimeout(onComplete, 1500);
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
    if (fileInputRef.current) fileInputRef.current.value = "";
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
            className="glass-card rounded-xl p-12 text-center border-secondary/30"
          >
            <Activity className="w-16 h-16 mx-auto mb-6 text-secondary animate-spin" />
            <h3 className="font-display font-bold text-xl text-white mb-2 uppercase tracking-widest">
              Synthesizing Intelligence
            </h3>
            <p className="font-mono text-xs text-muted-foreground mb-6">{fileName}</p>

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