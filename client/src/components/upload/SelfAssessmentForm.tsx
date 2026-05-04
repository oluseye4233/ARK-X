import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

interface SelfAssessmentFormProps {
  onComplete: () => void;
}

type Strength = 0 | 1 | 2 | 3;

const STRENGTH_LABELS: Record<Strength, string> = {
  0: "None",
  1: "Some",
  2: "Strong",
  3: "Expert",
};

// Skill categories mirror server/resumeAnalyzer.ts SKILL_CATEGORIES so the
// synthesized text we generate below produces the same scoring profile a
// real CV with these signals would. Keep keyword lists in rough parity.
const CATEGORIES: Array<{
  key: "technical" | "leadership" | "analytical" | "communication" | "innovation" | "ai_adjacent";
  label: string;
  description: string;
  strongPhrase: string;
  expertPhrase: string;
}> = [
  {
    key: "technical",
    label: "Technical / Engineering",
    description: "Coding, cloud, data, infrastructure, devops",
    strongPhrase: "Built and shipped production systems using Python, JavaScript, TypeScript, React, Node, SQL, AWS, Docker, Git, Linux, REST APIs, microservices, and CI/CD.",
    expertPhrase: "Deep expertise in cloud architecture (AWS, Azure, GCP), Kubernetes, Terraform, GraphQL, machine learning, deep learning, TensorFlow, PyTorch, data science, PostgreSQL, MongoDB, Redis, Kafka, and distributed systems at scale.",
  },
  {
    key: "leadership",
    label: "Leadership & People Management",
    description: "Leading teams, mentoring, strategy, executive influence",
    strongPhrase: "Led, managed, and mentored cross-functional teams; collaborated with stakeholders on roadmap and strategy; coached direct reports.",
    expertPhrase: "Spearheaded company-wide initiatives as Director / VP / Head of function; orchestrated executive strategy and vision; built teams from the ground up; drove C-suite stakeholder alignment.",
  },
  {
    key: "analytical",
    label: "Analytical & Research",
    description: "Data analysis, modeling, metrics, evaluation",
    strongPhrase: "Analyzed, evaluated, and measured business metrics, KPIs, and ROI using data-driven dashboards, reporting, and analytics to surface insights.",
    expertPhrase: "Modeled, forecasted, and optimized outcomes using statistical methods, regression, hypothesis testing, A/B testing, Bayesian inference; quantified trends and audited systems.",
  },
  {
    key: "communication",
    label: "Communication & Stakeholder",
    description: "Presenting, writing, facilitating, training",
    strongPhrase: "Presented, communicated, collaborated and facilitated workshops with stakeholders; authored documentation and proposals; client-facing engagements.",
    expertPhrase: "Negotiated complex deals, published thought leadership, trained and consulted across organizations; conference public speaking and stakeholder management at executive level.",
  },
  {
    key: "innovation",
    label: "Innovation & Creation",
    description: "Designing, prototyping, building from scratch",
    strongPhrase: "Designed, created, developed and prototyped new products and features; engineered automated solutions; modernized legacy systems.",
    expertPhrase: "Architected and pioneered first-of-its-kind, novel, patent-worthy solutions; founded and established R&D programs in an entrepreneurial startup environment; invented and disrupted established workflows.",
  },
  {
    key: "ai_adjacent",
    label: "AI / Automation Adjacent",
    description: "AI, ML, NLP, prompt engineering, automation",
    strongPhrase: "Worked with AI, machine learning, NLP, automation, predictive analytics and intelligent automation in production.",
    expertPhrase: "Deep work with LLMs, GPT, generative AI, prompt engineering, neural networks, transformers, computer vision, recommendation engines, and cognitive automation / RPA at scale.",
  },
];

export function SelfAssessmentForm({ onComplete }: SelfAssessmentFormProps) {
  const { user } = useAuth();
  const [role, setRole] = useState("");
  const [years, setYears] = useState(5);
  const [achievements, setAchievements] = useState("");
  // Default everything to None — forces the user to make explicit, honest
  // self-ratings rather than inheriting a baseline that inflates JST.
  const [scores, setScores] = useState<Record<string, Strength>>(() =>
    Object.fromEntries(CATEGORIES.map((c) => [c.key, 0])) as Record<string, Strength>,
  );
  const [state, setState] = useState<"idle" | "submitting" | "complete" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Translate the form into a synthetic resume-style document. The server's
  // analyzer is keyword-based, so dropping the canonical phrases for each
  // category at the chosen intensity gives the same vector a real resume with
  // those signals would produce. We also include role + years + achievements
  // verbatim so years-of-experience extraction and free-text scoring still fire.
  const buildSyntheticResume = (): string => {
    const lines: string[] = [];
    const titleRole = role.trim() || "Professional";
    lines.push(`Self-Assessment Profile`);
    lines.push(`Role: ${titleRole}`);
    lines.push(`${years} years of experience`);
    lines.push(``);
    lines.push(`Summary:`);
    lines.push(
      `${titleRole} with ${years} years of experience across multiple domains. ` +
        `Self-reported skills profile compiled via ARK Platform self-assessment.`,
    );
    lines.push(``);
    lines.push(`Skills & Capabilities:`);
    for (const cat of CATEGORIES) {
      const strength = scores[cat.key] ?? 0;
      if (strength === 0) continue;
      // Single phrase per level keeps Some / Strong / Expert clearly separated
      // in JST output instead of saturating analyzer keyword counts at Strong.
      lines.push(`• ${cat.label} (${STRENGTH_LABELS[strength]}):`);
      if (strength === 1) lines.push(`  ${cat.strongPhrase}`);
      if (strength === 2) lines.push(`  ${cat.strongPhrase}`);
      if (strength === 3) lines.push(`  ${cat.strongPhrase}\n  ${cat.expertPhrase}`);
      lines.push(``);
    }
    if (achievements.trim()) {
      lines.push(`Key Achievements & Experience:`);
      lines.push(achievements.trim());
    }
    return lines.join("\n");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage("Please log in before submitting an assessment.");
      setState("error");
      return;
    }
    setState("submitting");
    setErrorMessage("");
    try {
      const text = buildSyntheticResume();
      await api.submitAssessmentText({ text, source: "self" });
      setState("complete");
      setTimeout(onComplete, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || "Submission failed.");
      setState("error");
    }
  };

  if (state === "complete") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-xl p-12 text-center border-primary"
        data-testid="self-assessment-complete"
      >
        <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4 neon-text" />
        <h3 className="font-display font-bold text-2xl text-white mb-2">Assessment Captured</h3>
        <p className="font-mono text-sm text-primary uppercase tracking-widest">
          Routing to Intelligence Hub...
        </p>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-card rounded-xl p-8 space-y-6"
      data-testid="form-self-assessment"
    >
      <div>
        <h3 className="font-display font-bold text-xl text-white uppercase tracking-widest mb-1">
          Self-Assessment Questionnaire
        </h3>
        <p className="font-mono text-xs text-muted-foreground">
          Answer honestly — your responses feed the same JST/CCMI engine as a CV upload.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            Current / Target Role
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Senior Product Manager"
            className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white font-mono placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
            data-testid="input-role"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            Years of Experience: <span className="text-secondary">{years}</span>
          </label>
          <input
            type="range"
            min={0}
            max={30}
            value={years}
            onChange={(e) => setYears(parseInt(e.target.value, 10))}
            className="w-full accent-secondary"
            data-testid="input-years"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Skill Strength by Category
        </label>
        {CATEGORIES.map((cat) => (
          <div
            key={cat.key}
            className="border border-white/5 bg-white/[0.02] rounded-lg p-3"
            data-testid={`row-category-${cat.key}`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-display text-sm text-white font-semibold">{cat.label}</p>
                <p className="text-[11px] font-mono text-muted-foreground">{cat.description}</p>
              </div>
              <span
                className="font-mono text-[10px] uppercase tracking-widest text-secondary"
                data-testid={`label-strength-${cat.key}`}
              >
                {STRENGTH_LABELS[scores[cat.key] as Strength]}
              </span>
            </div>
            <div className="flex gap-1">
              {([0, 1, 2, 3] as Strength[]).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setScores({ ...scores, [cat.key]: s })}
                  data-testid={`button-${cat.key}-${s}`}
                  className={`flex-1 px-2 py-1.5 text-[11px] font-mono uppercase tracking-wider rounded border transition-colors ${
                    scores[cat.key] === s
                      ? "bg-secondary/20 border-secondary text-secondary"
                      : "bg-white/[0.02] border-white/10 text-muted-foreground hover:border-white/30"
                  }`}
                >
                  {STRENGTH_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          Key Achievements (optional)
        </label>
        <textarea
          value={achievements}
          onChange={(e) => setAchievements(e.target.value)}
          rows={4}
          placeholder="Briefly list 2-4 standout achievements, projects, or responsibilities..."
          className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white font-mono placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none resize-none"
          data-testid="input-achievements"
        />
      </div>

      {state === "error" && (
        <div
          className="flex items-start gap-2 text-xs font-mono text-destructive border border-destructive/20 bg-destructive/5 rounded p-3"
          data-testid="text-self-assessment-error"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={state === "submitting" || !user}
        data-testid="button-submit-self-assessment"
        className="w-full bg-primary/10 text-primary border border-primary/50 hover:bg-primary/20 font-mono uppercase tracking-widest rounded-none disabled:opacity-50"
      >
        {state === "submitting" ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Synthesizing Intelligence...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Assessment
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
