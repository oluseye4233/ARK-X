import { Link } from "wouter";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Briefcase, MapPin, Award, Users, TrendingUp, DollarSign, Building2 } from "lucide-react";
import { JSTGauge } from "@/components/dashboard/JSTGauge";
import { JSTRadar } from "@/components/dashboard/JSTRadar";
import { VulnerabilityMeter } from "@/components/dashboard/VulnerabilityMeter";
import { ArchetypeHandicap } from "@/components/dashboard/ArchetypeHandicap";
import { TransferabilityRadar } from "@/components/pathways/TransferabilityRadar";
import { UpskillingTimeline } from "@/components/pathways/UpskillingTimeline";

// ─── DEMO DATA ──────────────────────────────────────────────────────────────
// Hardcoded persona used in investor walkthroughs. No backend calls; no auth.
// Numbers are tuned to land in the "Resilient → Flourishing" zone so the
// dashboard renders in its most visually compelling state.

const DEMO_PERSONA = {
  name: "Sarah Chen",
  title: "Senior Product Manager",
  company: "Atlas Logistics, Series C",
  location: "Austin, TX · Remote-friendly",
  yearsExperience: 8,
  archetype: "Orchestrator",
};

const DEMO_JST = {
  total: 247, // /300 → 82% — Excellent zone
  jobs: 79,
  skills: 88,
  talent: 80,
  rawTotal: 235,
  contextCraftLevel: "CC_400",
  contextCraftMultiplier: 1.05,
  percentileRank: 91,
  previousScore: 218,
  industryAverage: 168,
};

const DEMO_VULN_LEVEL = 3; // Resilient

const DEMO_ARCHETYPE = { architect: 28, orchestrator: 52, conductor: 20 };

const DEMO_RISK_MODIFIERS = [
  { task: "Manual sprint reporting", automatable: 82, impact: "Reclaim ~6 hrs/week with AI standup synthesis" },
  { task: "Stakeholder status emails", automatable: 76, impact: "AI draft + human edit cuts time 70%" },
  { task: "Backlog grooming first-pass", automatable: 64, impact: "AI-assisted prioritization, human approval" },
];

const DEMO_TRANSFERABILITY = [
  { subject: "Tech Fluency", A: 78, fullMark: 100 },
  { subject: "Innovation Trans.", A: 85, fullMark: 100 },
  { subject: "Agility Index", A: 88, fullMark: 100 },
  { subject: "Leadership Scal.", A: 81, fullMark: 100 },
  { subject: "Data Literacy", A: 74, fullMark: 100 },
  { subject: "Strategic Vision", A: 90, fullMark: 100 },
  { subject: "Industry Mobility", A: 72, fullMark: 100 },
  { subject: "Comm. Impact", A: 86, fullMark: 100 },
  { subject: "Domain Breadth", A: 68, fullMark: 100 },
  { subject: "Execution Speed", A: 83, fullMark: 100 },
  { subject: "Geographic Port.", A: 65, fullMark: 100 },
  { subject: "Creative Problem", A: 79, fullMark: 100 },
];

const DEMO_PIVOTS = [
  { role: "AI Integration Manager", feasibility: 87, gapCost: "$2,400", time: "4 months", salary: "+18%" },
  { role: "Product Operations Director", feasibility: 82, gapCost: "$1,800", time: "6 months", salary: "+24%" },
  { role: "Data Strategy Lead", feasibility: 74, gapCost: "$3,200", time: "8 months", salary: "+31%" },
];

const DEMO_UPSKILLING: Array<{
  id: string;
  phase: "30-Day" | "90-Day" | "12-Month";
  title: string;
  description: string;
  type: "new-skilling" | "up-skilling" | "ready-skilling";
  hours: number;
}> = [
  { id: "u1", phase: "30-Day", title: "Prompt Engineering Foundations", description: "Master CCMI Pillars 1-3: structured prompting, role-conditioning, and output formatting", type: "ready-skilling", hours: 12 },
  { id: "u2", phase: "30-Day", title: "AI-Assisted Product Discovery", description: "Use Claude/GPT for user-interview synthesis and persona validation", type: "up-skilling", hours: 8 },
  { id: "u3", phase: "90-Day", title: "SQL + Looker for PMs", description: "Self-serve product analytics without blocking on data team", type: "up-skilling", hours: 40 },
  { id: "u4", phase: "90-Day", title: "AI Workflow Orchestration", description: "Design multi-agent pipelines using LangGraph or n8n", type: "new-skilling", hours: 30 },
  { id: "u5", phase: "12-Month", title: "Machine Learning Product Strategy", description: "Stanford XCS229i or equivalent — model selection, evaluation, MLOps fluency", type: "new-skilling", hours: 120 },
  { id: "u6", phase: "12-Month", title: "Enterprise AI Procurement", description: "Vendor evaluation, contract negotiation, security review for B2B AI tools", type: "new-skilling", hours: 60 },
];

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function DemoPage() {
  return (
    <div className="min-h-screen pb-24" data-testid="demo-page">
      {/* Investor banner */}
      <div className="bg-gradient-to-r from-primary/20 via-secondary/10 to-primary/20 border-b border-primary/30">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-primary">Investor Demo</span>
            <span className="text-muted-foreground">· Live Sample Data · No Login Required</span>
          </div>
          <Link
            href="/login"
            data-testid="link-investor-login"
            className="text-xs font-mono uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
          >
            Try with your resume <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-6 pt-8 space-y-10">
        {/* Persona card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-6 border border-primary/20"
          data-testid="demo-persona"
        >
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-display text-3xl text-white neon-text">{DEMO_PERSONA.name}</h1>
                <span className="text-xs font-mono uppercase tracking-widest px-2 py-1 rounded border border-secondary/40 bg-secondary/10 text-secondary">
                  {DEMO_PERSONA.archetype}
                </span>
              </div>
              <div className="flex items-center gap-5 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> {DEMO_PERSONA.title}</span>
                <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {DEMO_PERSONA.company}</span>
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {DEMO_PERSONA.location}</span>
                <span className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5" /> {DEMO_PERSONA.yearsExperience} years</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">ARK Score</div>
              <div className="font-display text-5xl text-primary neon-text leading-none">487<span className="text-xl text-muted-foreground">/600</span></div>
              <div className="text-xs font-mono text-secondary mt-1">+29 vs. 90 days ago</div>
            </div>
          </div>
        </motion.div>

        {/* Section: JST Identity */}
        <section data-testid="demo-section-jst">
          <SectionHeading
            number="01"
            title="JST Index — Jobs · Skills · Talent"
            blurb={`The single number that predicts marketability in an AI-augmented economy. ${DEMO_PERSONA.name.split(" ")[0]} scores 247/300 (91st percentile), up +29 in the last 90 days.`}
          />
          <div className="grid md:grid-cols-2 gap-6">
            <JSTGauge
              score={DEMO_JST.total}
              jobsScore={DEMO_JST.jobs}
              skillsScore={DEMO_JST.skills}
              talentScore={DEMO_JST.talent}
              percentileRank={DEMO_JST.percentileRank}
              previousScore={DEMO_JST.previousScore}
              industryAverage={DEMO_JST.industryAverage}
              contextCraftLevel={DEMO_JST.contextCraftLevel}
              contextCraftMultiplier={DEMO_JST.contextCraftMultiplier}
              rawTotal={DEMO_JST.rawTotal}
            />
            <JSTRadar
              jobsScore={DEMO_JST.jobs}
              skillsScore={DEMO_JST.skills}
              talentScore={DEMO_JST.talent}
            />
          </div>
        </section>

        {/* Section: Vulnerability + Archetype */}
        <section data-testid="demo-section-vuln">
          <SectionHeading
            number="02"
            title="AI Vulnerability + Archetype Profile"
            blurb="How exposed are this person's day-to-day tasks to AI automation, and which cognitive archetype defines their work style?"
          />
          <div className="grid md:grid-cols-2 gap-6">
            <VulnerabilityMeter level={DEMO_VULN_LEVEL} />
            <ArchetypeHandicap
              architect={DEMO_ARCHETYPE.architect}
              orchestrator={DEMO_ARCHETYPE.orchestrator}
              conductor={DEMO_ARCHETYPE.conductor}
              profile="Orchestrator-dominant: thrives connecting people, systems, and decisions across functions."
            />
          </div>

          {/* Risk-modifier callouts — the actionable insight investors care about */}
          <div className="glass-card rounded-xl p-6 mt-6 border border-primary/20" data-testid="demo-risk-modifiers">
            <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest mb-4">Top 3 Risk Modifiers</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {DEMO_RISK_MODIFIERS.map((rm, idx) => (
                <div key={idx} className="rounded-lg border border-white/10 bg-white/5 p-4" data-testid={`risk-modifier-${idx}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Task</span>
                    <span className="font-display text-2xl text-destructive">{rm.automatable}<span className="text-xs text-muted-foreground">%</span></span>
                  </div>
                  <p className="text-sm text-white font-medium mb-2">{rm.task}</p>
                  <p className="text-xs text-secondary leading-snug">{rm.impact}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section: Transferability + Pivots */}
        <section data-testid="demo-section-pivots">
          <SectionHeading
            number="03"
            title="12-Vector Transferability + Pivot Opportunities"
            blurb="Where this person can credibly move next, and what the gap costs to get there."
          />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TransferabilityRadar data={DEMO_TRANSFERABILITY} />
            </div>
            <div className="space-y-4">
              {DEMO_PIVOTS.map((p, idx) => (
                <div key={idx} className="glass-card rounded-xl p-5 border border-white/10 hover:border-primary/40 transition-colors" data-testid={`pivot-${idx}`}>
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-display text-white text-base leading-tight">{p.role}</h4>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/40 shrink-0 ml-2">{p.feasibility}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <PivotStat icon={<TrendingUp className="w-3 h-3" />} label="Time" value={p.time} />
                    <PivotStat icon={<DollarSign className="w-3 h-3" />} label="Gap" value={p.gapCost} />
                    <PivotStat icon={<Users className="w-3 h-3" />} label="Salary" value={p.salary} accent />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section: Upskilling */}
        <section data-testid="demo-section-upskilling">
          <SectionHeading
            number="04"
            title="Dynamic Upskilling Navigator"
            blurb="A 30 / 90 / 365-day investment plan, prioritized by ROI against this person's specific vulnerability profile."
          />
          <UpskillingTimeline items={DEMO_UPSKILLING} />
        </section>

        {/* CTA footer */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card rounded-xl p-8 border border-primary/30 text-center"
          data-testid="demo-cta"
        >
          <h2 className="font-display text-2xl text-white neon-text mb-2">Want your own ARK score?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Upload your resume and get a personalized JST analysis, vulnerability profile, and 12-month upskilling plan in under 60 seconds.
            Enterprise dashboards, cohort grading, and prompt-craft certification unlock on the paid tiers.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link href="/login" data-testid="link-demo-signup">
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-mono uppercase tracking-widest text-sm hover:bg-primary/90 transition-colors">
                Get Started <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
            <Link href="/" data-testid="link-demo-home">
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/20 text-white font-mono uppercase tracking-widest text-sm hover:border-primary/40 transition-colors">
                Back to Home
              </span>
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

function SectionHeading({ number, title, blurb }: { number: string; title: string; blurb: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="font-mono text-xs text-primary/60 tracking-widest">{number}</span>
        <h2 className="font-display text-xl text-white uppercase tracking-wider">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground max-w-3xl">{blurb}</p>
    </div>
  );
}

function PivotStat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
        {icon} {label}
      </div>
      <div className={`text-xs font-mono ${accent ? "text-secondary" : "text-white"}`}>{value}</div>
    </div>
  );
}
