import { useEffect, useState } from "react";
import { JSTGauge } from "@/components/dashboard/JSTGauge";
import { JSTRadar } from "@/components/dashboard/JSTRadar";
import { VulnerabilityMeter } from "@/components/dashboard/VulnerabilityMeter";
import { JnomicsCardList } from "@/components/dashboard/JnomicsCardList";
import { ArchetypeHandicap } from "@/components/dashboard/ArchetypeHandicap";
import { TaskHeatmap } from "@/components/dashboard/TaskHeatmap";
import { VulnerabilityTimeline } from "@/components/dashboard/VulnerabilityTimeline";
import { Cpu, FileText, Loader2, TrendingUp, Mail, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { motion, AnimatePresence } from "framer-motion";

interface AssessmentData {
  id: string;
  userId: string;
  jstTotal: number;
  jstJobs: number;
  jstSkills: number;
  jstTalent: number;
  vulnerabilityLevel: number;
  readinessProfile: string;
  riskModifiers: Array<{ task: string; automatable: number }> | null;
  matchedCardIds: string[] | null;
  percentileRank?: number;
  previousScore?: number;
  industryAverage?: number;
  archetypeArchitect: number;
  archetypeOrchestrator: number;
  archetypeConductor: number;
  automationMilestones?: Array<{ year: number; event: string; automationPct: number; impact: string }> | null;
  contextCraftLevel?: string | null;
  contextCraftMultiplier?: number | null;
  jstRawTotal?: number | null;
  jstRawJobs?: number | null;
  jstRawSkills?: number | null;
  jstRawTalent?: number | null;
  upskillingPlans: any[];
  pivotOpportunities: any[];
  transferabilityVectors: any[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [allAssessments, setAllAssessments] = useState<AssessmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.getLatestAssessment(user.id).catch(() => null),
      api.getAllAssessments(user.id).catch(() => []),
    ]).then(([latest, all]) => {
      setAssessment(latest);
      setAllAssessments(Array.isArray(all) ? all : []);
    }).finally(() => setLoading(false));
  }, [user]);

  const handleSendEmail = async () => {
    if (!user) return;
    setSendingEmail(true);
    try {
      await api.requestEmailNotification(user.id, user.username);
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 4000);
    } catch (err) {
      console.error("Email notification failed:", err);
      setEmailError(true);
      setTimeout(() => setEmailError(false), 4000);
    } finally {
      setSendingEmail(false);
    }
  };

  const historyData = allAssessments
    .sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
    .map((a: any, i: number) => ({
      label: `#${i + 1}`,
      date: a.createdAt ? new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : `Assessment ${i + 1}`,
      total: a.jstTotal,
      jobs: a.jstJobs,
      skills: a.jstSkills,
      talent: a.jstTalent,
    }));

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="font-mono text-sm text-muted-foreground uppercase">Loading Intelligence Data...</p>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="w-full max-w-6xl mx-auto min-h-[60vh] flex flex-col items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground uppercase mb-4">No assessment data found.</p>
        <Link href="/upload" className="inline-flex items-center justify-center bg-primary text-primary-foreground font-mono uppercase tracking-widest px-6 py-3 text-sm font-medium">
          Start Assessment
        </Link>
      </div>
    );
  }

  const userName = user?.name || "Unknown";
  const userRole = user?.role || "Unknown";

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-white uppercase tracking-wider">
            Intelligence Hub
          </h2>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            SUBJECT: <span className="text-primary">{userName}</span> | ROLE: {userRole}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Link href="/report" className="inline-flex items-center justify-center border border-primary/50 text-primary hover:bg-primary/10 font-mono text-xs uppercase tracking-widest h-10 px-4">
            <FileText className="w-4 h-4 mr-2" /> Export Brief
          </Link>
          
          <div className="glass px-4 py-2 flex items-center gap-3 rounded-lg border-primary/30">
            <Cpu className="w-5 h-5 text-primary" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Primary Archetype</p>
              <p className="text-primary font-display font-bold uppercase tracking-wider">{assessment.readinessProfile}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <JSTGauge 
          score={assessment.jstTotal}
          jobsScore={assessment.jstJobs}
          skillsScore={assessment.jstSkills}
          talentScore={assessment.jstTalent}
          percentileRank={assessment.percentileRank ?? 72}
          previousScore={assessment.previousScore ?? Math.round(assessment.jstTotal * 0.95)}
          industryAverage={assessment.industryAverage ?? 195}
          contextCraftLevel={assessment.contextCraftLevel || undefined}
          contextCraftMultiplier={assessment.contextCraftMultiplier || undefined}
          rawTotal={assessment.jstRawTotal || undefined}
        />

        <JSTRadar
          jobsScore={assessment.jstJobs}
          skillsScore={assessment.jstSkills}
          talentScore={assessment.jstTalent}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <VulnerabilityMeter level={assessment.vulnerabilityLevel} />
          
        <TaskHeatmap riskModifiers={assessment.riskModifiers || []} />
      </div>

      <VulnerabilityTimeline
        vulnerabilityLevel={assessment.vulnerabilityLevel}
        milestones={assessment.automationMilestones}
      />

      <ArchetypeHandicap
        architect={assessment.archetypeArchitect}
        orchestrator={assessment.archetypeOrchestrator}
        conductor={assessment.archetypeConductor}
        profile={assessment.readinessProfile}
      />

      <JnomicsCardList matchedCardIds={assessment.matchedCardIds || []} />

      {historyData.length > 1 && (
        <div className="glass-card p-6 rounded-xl" data-testid="card-assessment-history">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest">Assessment History</h3>
            </div>
            <span className="text-xs font-mono text-muted-foreground">{historyData.length} assessments</span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11, fontFamily: "monospace" }} />
              <YAxis tick={{ fill: "#888", fontSize: 11 }} domain={[0, 300]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1f35",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontFamily: "monospace",
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="total" stroke="#00B4D8" strokeWidth={2} dot={{ fill: "#00B4D8", r: 4 }} name="Total JST" />
              <Line type="monotone" dataKey="jobs" stroke="#44AA44" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Jobs" />
              <Line type="monotone" dataKey="skills" stroke="#AA44FF" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Skills" />
              <Line type="monotone" dataKey="talent" stroke="#FFDD00" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Talent" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="glass-card p-6 rounded-xl" data-testid="card-email-summary">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-display font-bold text-sm text-white uppercase tracking-widest">Email Summary</h3>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">Send your latest assessment results to your inbox</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {emailSent && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-secondary text-xs font-mono flex items-center gap-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Queued
                </motion.span>
              )}
              {emailError && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-destructive text-xs font-mono"
                >
                  Failed to send
                </motion.span>
              )}
            </AnimatePresence>
            <button
              onClick={handleSendEmail}
              disabled={sendingEmail || emailSent}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider text-primary bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-all disabled:opacity-40"
              data-testid="button-send-email-summary"
            >
              {sendingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              {sendingEmail ? "Sending..." : "Send Report"}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}