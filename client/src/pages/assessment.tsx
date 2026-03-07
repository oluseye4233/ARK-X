import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, ChevronRight, Activity } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";

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
  }
];

export default function AssessmentPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const handleAnswer = (type: string) => {
    const newAnswers = [...answers, type];
    setAnswers(newAnswers);

    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      finalizeAssessment(newAnswers);
    }
  };

  const finalizeAssessment = async (finalAnswers: string[]) => {
    setIsSynthesizing(true);
    
    const counts: Record<string, number> = {};
    finalAnswers.forEach(a => { counts[a] = (counts[a] || 0) + 1; });
    const readinessProfile = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

    if (user) {
      try {
        await api.createAssessment({
          assessment: {
            userId: user.id,
            jstTotal: 242,
            jstJobs: 82,
            jstSkills: 78,
            jstTalent: 82,
            vulnerabilityLevel: 1,
            readinessProfile,
            riskModifiers: [
              { task: "Routine Data Analysis", automatable: 85 },
              { task: "System Configuration", automatable: 60 },
              { task: "Stakeholder Communication", automatable: 15 },
            ],
            matchedCardIds: ["card-001", "card-002", "card-004", "card-005"],
          },
          upskillingPlans: [
            { phase: "30-Day", type: "ready-skilling", title: "Prompt Engineering Foundations", description: "Master LLM interaction protocols for system analysis tasks.", hours: 15 },
            { phase: "90-Day", type: "up-skilling", title: "Cloud Architecture Synthesis", description: "Deepen expertise in multi-cloud environments.", hours: 45 },
            { phase: "12-Month", type: "new-skilling", title: "AI Orchestration Leadership", description: "Transition to AI Integration Manager role.", hours: 120 },
          ],
          pivotOpportunities: [
            { role: "AI Integration Manager", feasibility: 82, gapCost: "$2,400", time: "6 Months" },
            { role: "Data Strategy Lead", feasibility: 75, gapCost: "$4,100", time: "9 Months" },
            { role: "Product Operations Dir.", feasibility: 68, gapCost: "$5,500", time: "12 Months" },
          ],
          transferabilityVectors: [
            { subject: "Industry Mobility", score: 85 },
            { subject: "Geographic Port.", score: 60 },
            { subject: "Innovation Trans.", score: 75 },
            { subject: "Leadership Scal.", score: 55 },
            { subject: "Tech Fluency", score: 90 },
            { subject: "Data Literacy", score: 80 },
            { subject: "Creative Problem", score: 70 },
            { subject: "Comm. Impact", score: 65 },
            { subject: "Agility Index", score: 88 },
            { subject: "Domain Breadth", score: 50 },
            { subject: "Execution Speed", score: 75 },
            { subject: "Strategic Vision", score: 60 },
          ],
        });
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
    <div className="w-full max-w-3xl mx-auto min-h-[70vh] flex flex-col justify-center py-12">
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
                onClick={() => handleAnswer(option.type)}
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
  );
}