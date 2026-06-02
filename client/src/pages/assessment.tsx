import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, ChevronRight, Activity } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { LiveJSTScore } from "@/components/LiveJSTScore";

const QUESTIONS = [
  {
    id: 1,
    question: "When approaching a complex data synthesis task, your primary instinct is to:",
    options: [
      { text: "Design a systemic prompt architecture to handle it completely.", type: "Architect" },
      { text: "Delegate sub-tasks to specialized models and combine the output.", type: "Orchestrator" },
      { text: "Iteratively guide a single model through the problem step-by-step.", type: "Conductor" }
    ]
  },
  {
    id: 2,
    question: "How do you view AI's role in your daily workflow?",
    options: [
      { text: "As a foundational layer to build new operational frameworks upon.", type: "Architect" },
      { text: "As a team of specialists to manage and coordinate.", type: "Orchestrator" },
      { text: "As a powerful collaborative tool that enhances my execution speed.", type: "Conductor" }
    ]
  },
  {
    id: 3,
    question: "If an AI-generated output fails to meet standards, you immediately:",
    options: [
      { text: "Rewrite the underlying system instructions and constraints.", type: "Architect" },
      { text: "Switch to a different model or adjust the processing pipeline.", type: "Orchestrator" },
      { text: "Engage in a conversational feedback loop to correct the errors.", type: "Conductor" }
    ]
  },
  {
    id: 4,
    question: "When presented with a new technology, your first move is to:",
    options: [
      { text: "Map it into a system blueprint and identify integration points.", type: "Architect" },
      { text: "Evaluate how it fits into the existing tool ecosystem and workflows.", type: "Orchestrator" },
      { text: "Try it hands-on and build a prototype to test its limits.", type: "Conductor" }
    ]
  },
  {
    id: 5,
    question: "Your team faces a major strategic pivot. You contribute by:",
    options: [
      { text: "Designing the new architecture and long-term technical vision.", type: "Architect" },
      { text: "Coordinating the migration plan and aligning cross-functional teams.", type: "Orchestrator" },
      { text: "Leading the execution, shipping deliverables and keeping momentum.", type: "Conductor" }
    ]
  },
  {
    id: 6,
    question: "When documenting a complex process, you prioritize:",
    options: [
      { text: "Comprehensive system diagrams and constraint specifications.", type: "Architect" },
      { text: "Workflow maps showing dependencies between teams and tools.", type: "Orchestrator" },
      { text: "Step-by-step runbooks with examples and edge cases.", type: "Conductor" }
    ]
  },
  {
    id: 7,
    question: "In a high-pressure deadline scenario, your strength is:",
    options: [
      { text: "Quickly simplifying the system to reduce complexity and risk.", type: "Architect" },
      { text: "Reallocating resources and re-prioritizing across the pipeline.", type: "Orchestrator" },
      { text: "Rolling up your sleeves and grinding through the critical path.", type: "Conductor" }
    ]
  },
  {
    id: 8,
    question: "Your ideal career growth path involves:",
    options: [
      { text: "Becoming a technical visionary who shapes platform strategy.", type: "Architect" },
      { text: "Leading cross-functional programs at increasing scale.", type: "Orchestrator" },
      { text: "Mastering execution and becoming the go-to problem solver.", type: "Conductor" }
    ]
  },
];

export default function AssessmentPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [answerTexts, setAnswerTexts] = useState<string[]>([]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const liveScores = useMemo(() => {
    const base = { j: 18, s: 15, t: 16 };
    const boosts: Record<string, { j: number; s: number; t: number }> = {
      Architect: { j: 8, s: 10, t: 6 },
      Orchestrator: { j: 9, s: 7, t: 8 },
      Conductor: { j: 7, s: 8, t: 10 },
    };
    let j = base.j, s = base.s, t = base.t;
    answers.forEach((a) => {
      const b = boosts[a];
      if (b) { j += b.j; s += b.s; t += b.t; }
    });
    return {
      jobs: Math.min(j, 100),
      skills: Math.min(s, 100),
      talent: Math.min(t, 100),
    };
  }, [answers]);

  const handleAnswer = (type: string, optionText: string) => {
    const newAnswers = [...answers, type];
    const newTexts = [...answerTexts, optionText];
    setAnswers(newAnswers);
    setAnswerTexts(newTexts);

    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      finalizeAssessment(newAnswers, newTexts);
    }
  };

  // Build a synthetic, keyword-rich document from the quiz answers so the
  // server analyzer derives the archetype naturally. This contributes as the
  // "quiz" source of the user's cumulative ARK profile — it refines the SAME
  // report rather than replacing whatever the resume / self / LinkedIn sources
  // produced.
  const buildQuizText = (finalAnswers: string[], texts: string[], dominant: string): string => {
    const counts: Record<string, number> = {};
    finalAnswers.forEach((a) => { counts[a] = (counts[a] || 0) + 1; });
    const lines: string[] = [];
    lines.push(`Context Craft Archetype Assessment`);
    lines.push(`Dominant working archetype: ${dominant}`);
    lines.push(
      `Archetype distribution — Architect: ${counts.Architect ?? 0}, ` +
        `Orchestrator: ${counts.Orchestrator ?? 0}, Conductor: ${counts.Conductor ?? 0}.`,
    );
    lines.push(``);
    lines.push(`Self-described working approach:`);
    texts.forEach((t) => lines.push(`• ${t}`));
    return lines.join("\n");
  };

  const finalizeAssessment = async (finalAnswers: string[], texts: string[]) => {
    setIsSynthesizing(true);

    const counts: Record<string, number> = {};
    finalAnswers.forEach(a => { counts[a] = (counts[a] || 0) + 1; });
    const readinessProfile = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

    if (user) {
      try {
        const text = buildQuizText(finalAnswers, texts, readinessProfile);
        await api.submitAssessmentText({ text, source: "quiz" });
      } catch (err) {
        console.error("Failed to save assessment:", err);
      }
    }

    setTimeout(() => {
      setLocation("/dashboard");
    }, 2500);
  };

  if (isSynthesizing) {
    return (
      <div className="w-full max-w-2xl mx-auto min-h-[60vh] flex flex-col items-center justify-center">
        <Activity className="w-16 h-16 text-primary animate-pulse mb-8" />
        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-widest mb-4">
          Synthesizing Readiness Profile
        </h2>
        <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.5 }}
          />
        </div>
        <p className="font-mono text-xs text-muted-foreground mt-4 uppercase">
          Mapping to Context Craft 7-Pillar Framework...
        </p>
      </div>
    );
  }

  const question = QUESTIONS[currentStep];

  return (
    <div className="w-full max-w-5xl mx-auto min-h-[70vh] flex flex-col justify-center py-12">
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <BrainCircuit className="w-6 h-6 text-secondary" />
          <h2 className="text-xl font-mono text-secondary uppercase tracking-widest">
            Context Craft Assessment
          </h2>
        </div>
        <div className="flex gap-2 mb-8">
          {QUESTIONS.map((q, idx) => (
            <div 
              key={q.id} 
              className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                idx <= currentStep ? "bg-secondary" : "bg-white/10"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="glass-card p-8 md:p-12 rounded-xl border-secondary/20"
            >
              <h3 className="text-2xl md:text-3xl font-display font-bold text-white mb-8 leading-snug">
                {question.question}
              </h3>

              <div className="space-y-4">
                {question.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(option.type, option.text)}
                    data-testid={`button-answer-${currentStep}-${idx}`}
                    className="w-full text-left p-6 rounded-lg border border-white/10 bg-white/5 hover:bg-secondary/10 hover:border-secondary/50 transition-all group flex items-center justify-between"
                  >
                    <span className="font-sans text-lg text-white/90 group-hover:text-white transition-colors">
                      {option.text}
                    </span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-secondary opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0" />
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="hidden md:flex flex-col items-center glass-card p-5 rounded-xl border border-white/10 min-w-[190px] sticky top-8"
        >
          <LiveJSTScore
            jobsScore={liveScores.jobs}
            skillsScore={liveScores.skills}
            talentScore={liveScores.talent}
            compact
            label="Projected JST"
          />
          <p className="text-[9px] font-mono text-muted-foreground/60 text-center mt-3 leading-relaxed">
            Score updates with<br />each response
          </p>
        </motion.div>
      </div>
    </div>
  );
}