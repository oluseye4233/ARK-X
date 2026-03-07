import { useLocation } from "wouter";
import { ResumeUploader } from "@/components/upload/ResumeUploader";

export default function UploadPage() {
  const [, setLocation] = useLocation();

  const handleComplete = () => {
    setLocation("/dashboard");
  };

  return (
    <div className="w-full max-w-4xl mx-auto min-h-[80vh] flex flex-col justify-center">
      <div className="mb-12">
        <h2 className="text-3xl font-display font-bold text-white mb-2 uppercase tracking-wide">
          Intelligence Vector Input
        </h2>
        <p className="text-muted-foreground font-sans">
          Initialize the analysis pipeline by uploading a career profile. 
          Our 4J.BONSAI engine will extract structured data to compute your JST valuation.
        </p>
      </div>

      <ResumeUploader onComplete={handleComplete} />
    </div>
  );
}