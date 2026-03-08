import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { CONTEXT_CRAFT_LEVELS, type ContextCraftLevel } from "@shared/schema";
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert,
  Award,
  TrendingUp,
  Lock,
  Unlock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Zap,
  BookOpen
} from "lucide-react";

const CERT_DETAILS: Record<string, { description: string; skills: string[]; icon: typeof Shield }> = {
  NONE: {
    description: "No Context Craft certification detected. Your JST Score is subject to a 50% handicap penalty. Context Engineering is the foundational skill that separates AI-augmented professionals from those at risk of displacement.",
    skills: [],
    icon: ShieldAlert,
  },
  CC_100: {
    description: "Foundational understanding of context engineering principles. You understand prompt structure, context windows, and basic LLM interaction patterns. JST penalty removed.",
    skills: ["Prompt Fundamentals", "Context Window Awareness", "Basic LLM Interaction", "Output Formatting"],
    icon: Shield,
  },
  CC_200: {
    description: "Practitioner-level context engineering. You can design multi-turn conversations, implement retrieval-augmented generation patterns, and optimize token efficiency.",
    skills: ["Multi-Turn Design", "RAG Patterns", "Token Optimization", "Chain-of-Thought", "Few-Shot Engineering"],
    icon: Shield,
  },
  CC_300: {
    description: "Specialist certification in advanced context engineering. You architect complex AI workflows, implement guardrails, and design context-aware systems.",
    skills: ["System Prompt Architecture", "Guardrail Design", "Context Chaining", "Agent Orchestration", "Evaluation Frameworks", "Fine-Tuning Strategy"],
    icon: ShieldCheck,
  },
  CC_400: {
    description: "Expert-level mastery of context engineering. You lead AI integration initiatives, design enterprise prompt libraries, and implement production-grade AI systems.",
    skills: ["Enterprise AI Strategy", "Production Prompt Libraries", "Multi-Agent Systems", "Context Compression", "Semantic Routing", "AI Safety & Alignment", "Performance Benchmarking"],
    icon: ShieldCheck,
  },
  CC_500: {
    description: "Master Architect of Context Engineering. You define organizational AI strategy, architect novel context frameworks, and push the boundaries of human-AI collaboration.",
    skills: ["Novel Framework Design", "Organizational AI Transformation", "Research Contribution", "Cross-Model Architecture", "Autonomous Agent Design", "Context Theory", "AI Governance Leadership", "Innovation Publication"],
    icon: Award,
  },
};

export default function ContextCraftPage() {
  const { user, updateUser } = useAuth();
  const [currentLevel, setCurrentLevel] = useState<ContextCraftLevel>("NONE");
  const [selectedLevel, setSelectedLevel] = useState<ContextCraftLevel | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (user?.contextCraftCertLevel) {
      setCurrentLevel(user.contextCraftCertLevel as ContextCraftLevel);
    }
  }, [user]);

  const handleCertUpdate = async (level: ContextCraftLevel) => {
    if (!user) return;
    setIsUpdating(true);
    try {
      await api.updateContextCraftCert(user.id, level);
      setCurrentLevel(level);
      updateUser({ contextCraftCertLevel: level });
      setShowSuccess(true);
      setSelectedLevel(null);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update certification:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const levels = Object.entries(CONTEXT_CRAFT_LEVELS) as [ContextCraftLevel, typeof CONTEXT_CRAFT_LEVELS[ContextCraftLevel]][];
  const currentLevelData = CONTEXT_CRAFT_LEVELS[currentLevel];
  const currentDetails = CERT_DETAILS[currentLevel];

  const exampleRaw = 240;
  const currentMultiplied = Math.round(exampleRaw * currentLevelData.multiplier);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-primary tracking-widest uppercase" data-testid="text-page-title">
          Context Craft Certifications
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-2">
          INTEGRATION // Context Engineering Proficiency Verification
        </p>
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card p-4 rounded-xl border border-secondary/30 bg-secondary/5 flex items-center gap-3"
            data-testid="alert-cert-updated"
          >
            <CheckCircle2 className="h-5 w-5 text-secondary flex-shrink-0" />
            <span className="font-mono text-sm text-secondary">
              Context Craft certification updated successfully. Re-upload your resume to recalculate JST scores with the new multiplier.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-card p-6 rounded-xl" data-testid="card-current-status">
        <div className="flex items-start gap-6">
          <div
            className="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${currentLevelData.color}15`, border: `2px solid ${currentLevelData.color}40` }}
          >
            {(() => {
              const Icon = currentDetails.icon;
              return <Icon className="h-10 w-10" style={{ color: currentLevelData.color }} />;
            })()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="font-display font-bold text-xl text-white" data-testid="text-current-cert-level">
                {currentLevelData.label}
              </h2>
              <span
                className="px-2 py-0.5 rounded text-xs font-mono font-bold uppercase"
                style={{ color: currentLevelData.color, backgroundColor: `${currentLevelData.color}15`, border: `1px solid ${currentLevelData.color}30` }}
                data-testid="badge-multiplier"
              >
                {currentLevelData.multiplier < 1 ? "" : "+"}{Math.round((currentLevelData.multiplier - 1) * 100)}% JST
              </span>
            </div>
            <p className="text-muted-foreground text-sm mb-4">{currentDetails.description}</p>
            {currentLevel === "NONE" && (
              <div className="flex items-center gap-2 px-3 py-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-sm font-mono" data-testid="alert-no-cert-penalty">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                50% JST SCORE PENALTY ACTIVE — Obtain certification to remove
              </div>
            )}
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">JST Impact Preview</div>
            <div className="flex items-baseline gap-2">
              <span className="text-muted-foreground font-mono text-sm line-through">{exampleRaw}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="font-display font-bold text-2xl" style={{ color: currentLevelData.color }} data-testid="text-jst-preview">
                {currentMultiplied}
              </span>
              <span className="text-xs text-muted-foreground font-mono">/300</span>
            </div>
            <div className="text-[10px] font-mono text-muted-foreground mt-1">
              Multiplier: {currentLevelData.multiplier}x
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest">
          Certification Tiers
        </h3>
        <div className="grid gap-4">
          {levels.map(([key, levelData], index) => {
            const details = CERT_DETAILS[key];
            const isCurrent = key === currentLevel;
            const isHigher = levelData.multiplier > currentLevelData.multiplier;
            const Icon = details.icon;
            const jstPreview = Math.round(exampleRaw * levelData.multiplier);

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                className={`glass-card p-5 rounded-xl transition-all duration-300 cursor-pointer group ${
                  isCurrent
                    ? "ring-2"
                    : selectedLevel === key
                      ? "ring-1 ring-primary/50 bg-primary/5"
                      : "hover:bg-white/5"
                }`}
                style={isCurrent ? { borderColor: `${levelData.color}40`, boxShadow: `0 0 20px ${levelData.color}10` } : {}}
                onClick={() => !isCurrent && setSelectedLevel(selectedLevel === key ? null : key)}
                data-testid={`card-cert-${key.toLowerCase()}`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `${levelData.color}15`, border: `1px solid ${levelData.color}30` }}
                  >
                    <Icon className="h-6 w-6" style={{ color: levelData.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h4 className="font-display font-bold text-white text-sm uppercase tracking-wide">
                        {levelData.label}
                      </h4>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-primary/10 text-primary border border-primary/20">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs mt-1 line-clamp-1">{details.description}</p>
                  </div>

                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="text-center">
                      <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Multiplier</div>
                      <div className="font-display font-bold text-lg" style={{ color: levelData.color }}>
                        {levelData.multiplier}x
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">JST Preview</div>
                      <div className="font-display font-bold text-lg text-white">
                        {jstPreview}<span className="text-xs text-muted-foreground">/300</span>
                      </div>
                    </div>
                    <div className="w-8 flex justify-center">
                      {isCurrent ? (
                        <Unlock className="h-4 w-4 text-secondary" />
                      ) : isHigher ? (
                        <TrendingUp className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      ) : (
                        <Lock className="h-4 w-4 text-muted-foreground/30" />
                      )}
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {selectedLevel === key && !isCurrent && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-muted-foreground text-sm mb-3">{details.description}</p>
                        {details.skills.length > 0 && (
                          <div className="mb-4">
                            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Required Competencies</div>
                            <div className="flex flex-wrap gap-2">
                              {details.skills.map((skill) => (
                                <span
                                  key={skill}
                                  className="px-2 py-1 rounded text-xs font-mono"
                                  style={{ color: levelData.color, backgroundColor: `${levelData.color}10`, border: `1px solid ${levelData.color}20` }}
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCertUpdate(key);
                          }}
                          disabled={isUpdating}
                          className="px-4 py-2 rounded-lg font-mono text-sm uppercase tracking-wide transition-all duration-300 flex items-center gap-2"
                          style={{
                            color: levelData.color,
                            backgroundColor: `${levelData.color}15`,
                            border: `1px solid ${levelData.color}30`,
                          }}
                          data-testid={`button-set-cert-${key.toLowerCase()}`}
                        >
                          {isUpdating ? (
                            <Zap className="h-4 w-4 animate-spin" />
                          ) : (
                            <BookOpen className="h-4 w-4" />
                          )}
                          {isUpdating ? "Updating..." : `Link ${levelData.label}`}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="glass-card p-6 rounded-xl" data-testid="card-scoring-breakdown">
        <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest mb-4">
          Context Craft Handicap System
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-mono text-sm text-white mb-3 uppercase tracking-wide">How It Works</h4>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Context Craft certification acts as a <span className="text-primary font-bold">multiplicative handicap</span> on your JST Score.
                Without certification, your raw JST score is penalized by 50%, reflecting the critical gap in context engineering competency.
              </p>
              <p>
                As you progress through certification tiers, your multiplier increases — moving from a 50% penalty (no cert) through baseline (CC-100) to a 50% bonus (CC-500 Master Architect).
              </p>
              <p>
                The multiplier is applied to each JST sub-dimension (Jobs, Skills, Talent) independently before the final composite is calculated.
              </p>
            </div>
          </div>
          <div>
            <h4 className="font-mono text-sm text-white mb-3 uppercase tracking-wide">Multiplier Table</h4>
            <div className="space-y-2">
              {levels.map(([key, levelData]) => {
                const pctChange = Math.round((levelData.multiplier - 1) * 100);
                const barWidth = (levelData.multiplier / 1.5) * 100;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-muted-foreground w-24 flex-shrink-0 truncate">{levelData.label.split(" ").slice(0, 2).join(" ")}</span>
                    <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden relative">
                      <motion.div
                        className="h-full rounded"
                        style={{ backgroundColor: `${levelData.color}60` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                      />
                      <span
                        className="absolute inset-y-0 right-2 flex items-center text-[10px] font-mono font-bold"
                        style={{ color: levelData.color }}
                      >
                        {levelData.multiplier}x ({pctChange > 0 ? "+" : ""}{pctChange}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
