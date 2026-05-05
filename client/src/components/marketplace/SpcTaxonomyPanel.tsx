import { motion } from "framer-motion";
import {
  Crown,
  Shield,
  Compass,
  Layers,
  Target,
  Zap,
  Sparkles,
  CheckCircle2,
  Lock,
  Award,
} from "lucide-react";

export interface SpcTaxonomyInput {
  pillar: string;
  hiveScore: number;
  kcseScore: number;
  priceCredits: number;
  salesCount: number;
  bodyLength?: number;
  creatorCertLevel?: string | null;
}

const PILLAR_PROFILE: Record<
  string,
  {
    archetype: string;
    domain: string;
    skills: string[];
    benefits: string[];
    accent: string;
    icon: any;
  }
> = {
  System: {
    archetype: "The Architect",
    domain: "Foundational System Design",
    skills: ["Goal Framing", "Scope Bounding", "Persona Anchoring", "Context Scaffolding"],
    benefits: [
      "Stable, reproducible outputs across long conversations",
      "Eliminates drift on multi-turn agent workflows",
      "Establishes the operating frame your downstream prompts inherit",
    ],
    accent: "#4488FF",
    icon: Layers,
  },
  Role: {
    archetype: "The Persona Forger",
    domain: "Expertise & Voice Engineering",
    skills: ["Role Calibration", "Tone Discipline", "Domain Authority", "Audience Targeting"],
    benefits: [
      "Replaces generic LLM voice with credentialed, on-brand expertise",
      "Tightens domain accuracy without external retrieval",
      "Reusable across teams as a shared persona standard",
    ],
    accent: "#AA44FF",
    icon: Crown,
  },
  Instruction: {
    archetype: "The Director",
    domain: "Task Decomposition & Directive Precision",
    skills: ["Action Sequencing", "Verb Discipline", "Decomposition", "Success Criteria"],
    benefits: [
      "Cuts ambiguous outputs and rework loops",
      "Compresses complex workflows into a single executable directive",
      "Auditable step-by-step reasoning for compliance",
    ],
    accent: "#FFA500",
    icon: Compass,
  },
  Example: {
    archetype: "The Calibrator",
    domain: "Few-Shot Patterning & Anchoring",
    skills: ["Exemplar Selection", "Edge-Case Coverage", "Format Demonstration", "Bias Anchoring"],
    benefits: [
      "Locks output shape without verbose schema specs",
      "Trains the model on your house style in one prompt",
      "Demonstrably higher accuracy on novel inputs",
    ],
    accent: "#44AA44",
    icon: Target,
  },
  Constraint: {
    archetype: "The Sentinel",
    domain: "Guardrails & Safety Boundaries",
    skills: ["Risk Bounding", "Refusal Logic", "Compliance Anchoring", "Hallucination Brakes"],
    benefits: [
      "Production-grade safety without external moderation passes",
      "Encodes legal, brand, and ethical limits inline",
      "Reduces post-hoc filtering cost",
    ],
    accent: "#FF4444",
    icon: Shield,
  },
  Format: {
    archetype: "The Schema Wright",
    domain: "Structured Output Discipline",
    skills: ["Schema Design", "Field Discipline", "Parser Friendliness", "Render Targeting"],
    benefits: [
      "Drop-in JSON / Markdown / table outputs your code can consume",
      "No more regex post-processing on freeform text",
      "Frontend rendering becomes deterministic",
    ],
    accent: "#FFDD00",
    icon: Layers,
  },
  Data: {
    archetype: "The Source Curator",
    domain: "Input Grounding & Source Discipline",
    skills: ["Source Triage", "Citation Discipline", "Context Window Mgmt", "Recency Anchoring"],
    benefits: [
      "Forces the model to reason from supplied evidence, not memory",
      "Cuts hallucination on facts, names, and numbers",
      "Citations become traceable for audit",
    ],
    accent: "#22CCAA",
    icon: Compass,
  },
  SuperPrompt: {
    archetype: "The Sovereign",
    domain: "Multi-Pillar Composite Synthesis",
    skills: [
      "System + Role Fusion",
      "Constraint Weaving",
      "Format Lock",
      "Multi-Domain Orchestration",
      "End-to-End Workflow Capture",
    ],
    benefits: [
      "A single drop-in prompt that replaces an entire chained pipeline",
      "Carries its own role, rules, schema, and grounding",
      "Enterprise-grade reusability across teams and tools",
    ],
    accent: "#FFB800",
    icon: Crown,
  },
};

const FALLBACK_PROFILE = PILLAR_PROFILE.System;

function classifyTier(jcse: number): {
  label: string;
  color: string;
  rank: "Bronze" | "Silver" | "Gold" | "Platinum";
} {
  if (jcse >= 45) return { label: "Platinum Elite", color: "#E5E4E2", rank: "Platinum" };
  if (jcse >= 38) return { label: "Gold Tier", color: "#FFB800", rank: "Gold" };
  if (jcse >= 28) return { label: "Silver Tier", color: "#C0C0C0", rank: "Silver" };
  return { label: "Bronze Tier", color: "#CD7F32", rank: "Bronze" };
}

function deriveSkillMix(
  pillar: string,
  jcse: number,
  baseSkills: string[],
): { name: string; weight: number }[] {
  // Distribute a 100-point skill mix across the pillar's skills, weighted by
  // overall quality. Higher JCSE → more even, deep coverage. Lower JCSE →
  // top-heavy (the prompt only really nails the headline skill).
  const tilt = Math.max(0.55, Math.min(0.95, jcse / 50));
  const raw = baseSkills.map((_, i) => Math.pow(tilt, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return baseSkills.map((name, i) => ({
    name,
    weight: Math.round((raw[i] / sum) * 100),
  }));
}

export function SpcTaxonomyPanel({ data, locked = true }: { data: SpcTaxonomyInput; locked?: boolean }) {
  const profile = PILLAR_PROFILE[data.pillar] ?? FALLBACK_PROFILE;
  const Icon = profile.icon;

  // JCSE-style composite (0-50) — averages HIVE (0-100) scaled and KCSE (0-50).
  // Mirrors the Junglenomics scoring convention used across the platform.
  const jcse = Math.round((data.hiveScore / 2 + data.kcseScore) / 2);
  const tier = classifyTier(jcse);
  const skillMix = deriveSkillMix(data.pillar, jcse, profile.skills);

  // Prompt density estimate — derived from body length, never reveals content.
  // 80 chars ≈ one structural directive; capped at 50 for display.
  const density = data.bodyLength ? Math.min(50, Math.max(1, Math.round(data.bodyLength / 80))) : null;

  return (
    <div className="space-y-5" data-testid="panel-taxonomy">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-primary">
            {locked ? "Benefits & Skills Mix · Prompt Sealed" : "Card Taxonomy"}
          </span>
        </div>
        <span
          className="px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest border"
          style={{ color: tier.color, borderColor: `${tier.color}50`, backgroundColor: `${tier.color}10` }}
          data-testid="badge-tier"
        >
          {tier.label}
        </span>
      </div>

      {/* Archetype + Domain header — taxonomy-style identity card */}
      <div
        className="glass-card p-5 rounded-xl border flex items-start gap-4"
        style={{ borderColor: `${profile.accent}40` }}
      >
        <div
          className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${profile.accent}15`, border: `1px solid ${profile.accent}40` }}
        >
          <Icon className="h-6 w-6" style={{ color: profile.accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground">
            Archetype
          </div>
          <div className="font-display font-bold text-lg text-white" data-testid="text-archetype">
            {profile.archetype}
          </div>
          <div className="text-[10px] uppercase font-mono tracking-wider mt-1" style={{ color: profile.accent }}>
            {profile.domain}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground">
            JCSE
          </div>
          <div className="font-mono text-2xl font-bold" style={{ color: tier.color }} data-testid="text-jcse">
            {jcse}
            <span className="text-sm text-muted-foreground">/50</span>
          </div>
        </div>
      </div>

      {/* Benefits — what the buyer actually gets */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-amber-400">
            Buyer Benefits
          </span>
        </div>
        <ul className="space-y-2" data-testid="list-benefits">
          {profile.benefits.map((b, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-2 text-sm text-white/85 font-sans leading-snug"
              data-testid={`text-benefit-${i}`}
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{b}</span>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Skills mix — visual weight bars, never the prompt itself */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-primary">
            Skills Mix
          </span>
        </div>
        <div className="space-y-2" data-testid="list-skills">
          {skillMix.map((s, i) => (
            <div key={s.name} data-testid={`row-skill-${i}`}>
              <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                <span className="text-white/80">{s.name}</span>
                <span className="text-muted-foreground">{s.weight}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${s.weight}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: profile.accent }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card vitals — taxonomy-style metadata strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Vital label="Pillar" value={data.pillar} />
        <Vital label="Tier" value={tier.rank} accent={tier.color} />
        {density !== null && <Vital label="Prompt Density" value={`${density} dir.`} />}
        <Vital label="Verified Sales" value={String(data.salesCount)} />
      </div>

      {locked && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5 text-[11px] font-mono text-muted-foreground">
          <Award className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>
            The full prompt is sealed until purchase. Buyers receive the executable card and a permanent
            license recorded on the SPHINX ledger.
          </span>
        </div>
      )}
    </div>
  );
}

function Vital({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="glass-card p-2.5 rounded-lg border border-white/5">
      <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className="font-mono text-sm font-bold"
        style={{ color: accent ?? "#FFFFFF" }}
        data-testid={`vital-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {value}
      </div>
    </div>
  );
}
