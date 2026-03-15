import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/useAuth";
import { useSubscription } from "@/lib/useSubscription";
import UpgradeGate from "@/components/UpgradeGate";
import { GraduationCap, Users, TrendingUp, BarChart3, Award, Target, ArrowUpRight } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, Radar, PieChart, Pie, Cell } from "recharts";

const MOCK_COHORT_DATA = [
  { name: "Cohort A", avgJST: 185, students: 32 },
  { name: "Cohort B", avgJST: 210, students: 28 },
  { name: "Cohort C", avgJST: 198, students: 35 },
  { name: "Cohort D", avgJST: 225, students: 22 },
  { name: "Cohort E", avgJST: 172, students: 40 },
];

const MOCK_ARCHETYPE_DIST = [
  { name: "Architect", value: 38, color: "#00B4D8" },
  { name: "Orchestrator", value: 35, color: "#44AA44" },
  { name: "Conductor", value: 27, color: "#AA44FF" },
];

const MOCK_SKILL_RADAR = [
  { subject: "Technical", score: 72, benchmark: 65 },
  { subject: "Leadership", score: 58, benchmark: 60 },
  { subject: "Analytical", score: 78, benchmark: 70 },
  { subject: "Communication", score: 65, benchmark: 68 },
  { subject: "Innovation", score: 70, benchmark: 55 },
  { subject: "AI Readiness", score: 82, benchmark: 50 },
];

const MOCK_VULNERABILITY_LEVELS = [
  { level: "Minimal", count: 42, color: "#44AA44" },
  { level: "Low", count: 55, color: "#4488FF" },
  { level: "Moderate", count: 38, color: "#FFDD00" },
  { level: "High", count: 15, color: "#FFA500" },
  { level: "Critical", count: 7, color: "#FF4444" },
];

export default function SchoolDashboard() {
  const { user } = useAuth();
  const { plan } = useSubscription();

  if (plan !== "SCHOOL_STUDENT") {
    return (
      <UpgradeGate featureName="Institution Dashboard" requiredPlan="School / Student" hasAccess={false}>
        <div />
      </UpgradeGate>
    );
  }

  const totalStudents = MOCK_COHORT_DATA.reduce((sum, c) => sum + c.students, 0);
  const avgJST = Math.round(MOCK_COHORT_DATA.reduce((sum, c) => sum + c.avgJST * c.students, 0) / totalStudents);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-primary tracking-widest uppercase" data-testid="text-school-dashboard-title">
          Institution Dashboard
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-2">
          {user?.institution || "Your Institution"} // COHORT INTELLIGENCE
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Students", value: totalStudents, icon: Users, color: "#00B4D8" },
          { label: "Avg JST Score", value: avgJST, icon: BarChart3, color: "#44AA44" },
          { label: "Active Cohorts", value: MOCK_COHORT_DATA.length, icon: GraduationCap, color: "#AA44FF" },
          { label: "Avg Readiness", value: "78%", icon: Target, color: "#FFDD00" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-5 rounded-xl"
            data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{stat.label}</span>
            </div>
            <span className="text-3xl font-display font-black text-white">{stat.value}</span>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-xl" data-testid="chart-cohort-scores">
          <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest mb-4">Cohort JST Scores</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={MOCK_COHORT_DATA}>
              <XAxis dataKey="name" tick={{ fill: "#888", fontSize: 11, fontFamily: "monospace" }} />
              <YAxis tick={{ fill: "#888", fontSize: 11 }} domain={[0, 300]} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1a1f35", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "monospace", fontSize: 12 }}
              />
              <Bar dataKey="avgJST" fill="#00B4D8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6 rounded-xl" data-testid="chart-skill-radar">
          <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest mb-4">Aggregate Skill Profile</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={MOCK_SKILL_RADAR}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "#888", fontSize: 10 }} />
              <Radar name="Students" dataKey="score" stroke="#00B4D8" fill="#00B4D8" fillOpacity={0.3} />
              <Radar name="Benchmark" dataKey="benchmark" stroke="#666" fill="#666" fillOpacity={0.1} strokeDasharray="4 4" />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-xl" data-testid="chart-archetype-dist">
          <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest mb-4">Archetype Distribution</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie data={MOCK_ARCHETYPE_DIST} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                  {MOCK_ARCHETYPE_DIST.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3 flex-1">
              {MOCK_ARCHETYPE_DIST.map((a) => (
                <div key={a.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: a.color }} />
                  <span className="text-sm text-white font-mono flex-1">{a.name}</span>
                  <span className="text-sm font-display font-bold" style={{ color: a.color }}>{a.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl" data-testid="chart-vulnerability-dist">
          <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest mb-4">Vulnerability Distribution</h3>
          <div className="space-y-3">
            {MOCK_VULNERABILITY_LEVELS.map((level) => {
              const pct = Math.round((level.count / totalStudents) * 100);
              return (
                <div key={level.level} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono text-muted-foreground">{level.level}</span>
                    <span className="text-xs font-mono" style={{ color: level.color }}>{level.count} students ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: level.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, delay: 0.2 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
