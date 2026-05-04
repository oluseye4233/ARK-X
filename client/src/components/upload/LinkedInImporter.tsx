import { useState } from "react";
import { motion } from "framer-motion";
import { Linkedin, Loader2, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

interface LinkedInImporterProps {
  onComplete: () => void;
}

// LinkedIn does not allow scraping or third-party profile reads without
// formal Talent Solutions partnership. Until that integration is in place,
// the user-driven path is: open their LinkedIn profile, copy the public
// content (About, Experience, Skills) and paste it here. We feed the result
// through the same /api/assessment/text pipeline as the self-assessment.
export function LinkedInImporter({ onComplete }: LinkedInImporterProps) {
  const { user } = useAuth();
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [profileText, setProfileText] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "complete" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const charCount = profileText.trim().length;
  const ready = charCount >= 50;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage("Please log in before importing a LinkedIn profile.");
      setState("error");
      return;
    }
    if (!ready) {
      setErrorMessage("Paste at least 50 characters from your LinkedIn profile.");
      setState("error");
      return;
    }
    setState("submitting");
    setErrorMessage("");
    try {
      // Prepend the URL as a header line so it's preserved in the synthetic
      // text (analyzer is keyword-based; the URL itself is harmless).
      const composed = linkedinUrl.trim()
        ? `LinkedIn Profile: ${linkedinUrl.trim()}\n\n${profileText.trim()}`
        : profileText.trim();
      await api.submitAssessmentText({ text: composed, source: "linkedin" });
      setState("complete");
      setTimeout(onComplete, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || "Import failed.");
      setState("error");
    }
  };

  if (state === "complete") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-xl p-12 text-center border-primary"
        data-testid="linkedin-import-complete"
      >
        <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4 neon-text" />
        <h3 className="font-display font-bold text-2xl text-white mb-2">LinkedIn Profile Imported</h3>
        <p className="font-mono text-sm text-primary uppercase tracking-widest">
          Routing to Intelligence Hub...
        </p>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-card rounded-xl p-8 space-y-5"
      data-testid="form-linkedin-import"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#0a66c2]/10 border border-[#0a66c2]/30 flex items-center justify-center flex-shrink-0">
          <Linkedin className="w-5 h-5 text-[#0a66c2]" />
        </div>
        <div>
          <h3 className="font-display font-bold text-xl text-white uppercase tracking-widest mb-1">
            Import from LinkedIn
          </h3>
          <p className="font-mono text-xs text-muted-foreground">
            Paste your LinkedIn About + Experience text. We pipe it through the same engine as a CV upload.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
        <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
          <span className="text-secondary uppercase tracking-widest">How to copy:</span>{" "}
          Open your LinkedIn profile → select your <em>About</em>, <em>Experience</em>, and{" "}
          <em>Skills</em> sections → copy and paste below. The more content, the sharper the assessment.
        </p>
      </div>

      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          LinkedIn Profile URL (optional)
        </label>
        <div className="relative">
          <input
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://www.linkedin.com/in/your-handle"
            className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 pr-10 text-sm text-white font-mono placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
            data-testid="input-linkedin-url"
          />
          {(() => {
            // Only expose the open-in-tab affordance for safe http(s) URLs —
            // blocks javascript:, data:, and other exotic schemes from being
            // rendered as a clickable href.
            const trimmed = linkedinUrl.trim();
            const safe = /^https?:\/\//i.test(trimmed);
            if (!safe) return null;
            return (
              <a
                href={trimmed}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#0a66c2] transition-colors"
                data-testid="link-open-linkedin"
                aria-label="Open LinkedIn profile in a new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            );
          })()}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Pasted Profile Content
          </label>
          <span
            className={`font-mono text-[10px] tabular-nums ${
              ready ? "text-primary" : "text-muted-foreground"
            }`}
            data-testid="text-char-count"
          >
            {charCount} chars {ready ? "✓" : `(need ${Math.max(0, 50 - charCount)} more)`}
          </span>
        </div>
        <textarea
          value={profileText}
          onChange={(e) => setProfileText(e.target.value)}
          rows={12}
          placeholder="Paste your LinkedIn About, Experience, and Skills sections here..."
          className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white font-mono placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none resize-y"
          data-testid="input-linkedin-text"
        />
      </div>

      {state === "error" && (
        <div
          className="flex items-start gap-2 text-xs font-mono text-destructive border border-destructive/20 bg-destructive/5 rounded p-3"
          data-testid="text-linkedin-error"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={state === "submitting" || !user || !ready}
        data-testid="button-import-linkedin"
        className="w-full bg-[#0a66c2]/10 text-[#0a66c2] border border-[#0a66c2]/50 hover:bg-[#0a66c2]/20 font-mono uppercase tracking-widest rounded-none disabled:opacity-50"
      >
        {state === "submitting" ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Importing & Analyzing...
          </>
        ) : (
          <>
            <Linkedin className="w-4 h-4 mr-2" />
            Run LinkedIn Assessment
          </>
        )}
      </Button>

      {!user && (
        <p className="text-xs font-mono text-destructive/80 border border-destructive/20 bg-destructive/5 rounded p-3">
          Log in first to save your assessment results.
        </p>
      )}
    </form>
  );
}
