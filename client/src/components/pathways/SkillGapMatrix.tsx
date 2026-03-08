import { useMemo } from "react";

interface PivotRole {
  role: string;
  feasibility: number;
  gapCost: string;
  time: string;
}

interface TransferabilityVector {
  subject: string;
  score: number;
}

interface SkillGapMatrixProps {
  pivotOpportunities: PivotRole[];
  transferabilityVectors: TransferabilityVector[];
}

const ROLE_SKILL_REQUIREMENTS: Record<string, Record<string, number>> = {
  "AI Integration Manager": {
    "Tech Fluency": 90, "Innovation Trans.": 85, "Agility Index": 88,
    "Leadership Scal.": 75, "Data Literacy": 80, "Strategic Vision": 70,
    "Industry Mobility": 72, "Comm. Impact": 65, "Domain Breadth": 60,
    "Execution Speed": 75, "Geographic Port.": 55, "Creative Problem": 70,
  },
  "Data Strategy Lead": {
    "Data Literacy": 92, "Strategic Vision": 85, "Agility Index": 75,
    "Tech Fluency": 78, "Leadership Scal.": 70, "Innovation Trans.": 68,
    "Industry Mobility": 75, "Comm. Impact": 72, "Domain Breadth": 65,
    "Execution Speed": 70, "Geographic Port.": 50, "Creative Problem": 60,
  },
  "Product Operations Director": {
    "Leadership Scal.": 90, "Strategic Vision": 88, "Comm. Impact": 85,
    "Execution Speed": 82, "Industry Mobility": 78, "Innovation Trans.": 72,
    "Domain Breadth": 75, "Data Literacy": 65, "Tech Fluency": 60,
    "Agility Index": 68, "Geographic Port.": 60, "Creative Problem": 65,
  },
  "Client Success Strategist": {
    "Comm. Impact": 92, "Leadership Scal.": 78, "Strategic Vision": 75,
    "Industry Mobility": 80, "Domain Breadth": 70, "Execution Speed": 72,
    "Innovation Trans.": 60, "Data Literacy": 58, "Tech Fluency": 50,
    "Agility Index": 62, "Geographic Port.": 65, "Creative Problem": 68,
  },
  "Innovation Program Lead": {
    "Innovation Trans.": 92, "Creative Problem": 88, "Strategic Vision": 82,
    "Leadership Scal.": 78, "Agility Index": 80, "Tech Fluency": 72,
    "Comm. Impact": 70, "Data Literacy": 65, "Industry Mobility": 68,
    "Execution Speed": 72, "Domain Breadth": 55, "Geographic Port.": 50,
  },
  "Digital Transformation Analyst": {
    "Tech Fluency": 80, "Data Literacy": 82, "Agility Index": 78,
    "Innovation Trans.": 75, "Strategic Vision": 70, "Execution Speed": 75,
    "Leadership Scal.": 60, "Comm. Impact": 65, "Industry Mobility": 70,
    "Domain Breadth": 55, "Geographic Port.": 50, "Creative Problem": 65,
  },
};

function getDefaultRequirements(subjects: string[]): Record<string, number> {
  const defaults: Record<string, number> = {};
  subjects.forEach((s) => { defaults[s] = 70; });
  return defaults;
}

function getGapCategory(gap: number): { label: string; color: string; bg: string } {
  if (gap <= 5) return { label: "Minimal", color: "text-emerald-400", bg: "bg-emerald-500/30 border-emerald-500/40" };
  if (gap <= 15) return { label: "Small", color: "text-cyan-400", bg: "bg-cyan-500/25 border-cyan-500/40" };
  if (gap <= 25) return { label: "Medium", color: "text-yellow-400", bg: "bg-yellow-500/25 border-yellow-500/40" };
  if (gap <= 40) return { label: "Large", color: "text-orange-400", bg: "bg-orange-500/25 border-orange-500/40" };
  return { label: "Critical", color: "text-red-400", bg: "bg-red-500/25 border-red-500/40" };
}

export function SkillGapMatrix({ pivotOpportunities, transferabilityVectors }: SkillGapMatrixProps) {
  const topPivots = pivotOpportunities.slice(0, 3);
  const skills = transferabilityVectors;

  const matrixData = useMemo(() => {
    return skills.map((skill) => {
      const roleGaps = topPivots.map((pivot) => {
        const requirements = ROLE_SKILL_REQUIREMENTS[pivot.role] || getDefaultRequirements(skills.map((s) => s.subject));
        const required = requirements[skill.subject] ?? 70;
        const gap = Math.max(0, required - skill.score);
        return { role: pivot.role, required, current: skill.score, gap, ...getGapCategory(gap) };
      });
      return { skill: skill.subject, current: skill.score, roleGaps };
    });
  }, [skills, topPivots]);

  if (topPivots.length === 0 || skills.length === 0) {
    return null;
  }

  return (
    <div className="glass-card p-6 rounded-xl w-full" data-testid="skill-gap-matrix">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest">
          Skill Gap Matrix
        </h3>
        <span className="text-xs font-mono text-muted-foreground px-2 py-1 bg-white/5 rounded border border-white/10">
          VIZ-008 · Required vs Current
        </span>
      </div>
      <p className="text-xs font-mono text-muted-foreground mb-5">
        Gap analysis across top pivot roles. Cells indicate upskilling effort required.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono" data-testid="skill-gap-table">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-3 px-2 text-muted-foreground uppercase tracking-wider font-medium w-[160px]">
                Skill Vector
              </th>
              <th className="text-center py-3 px-2 text-muted-foreground uppercase tracking-wider font-medium w-[60px]">
                Current
              </th>
              {topPivots.map((pivot, i) => (
                <th key={i} className="text-center py-3 px-2 text-primary uppercase tracking-wider font-semibold min-w-[120px]" data-testid={`pivot-header-${i}`}>
                  {pivot.role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixData.map((row, ri) => (
              <tr key={ri} className="border-b border-white/5 hover:bg-white/5 transition-colors" data-testid={`skill-row-${ri}`}>
                <td className="py-2.5 px-2 text-white/80 font-medium">
                  {row.skill}
                </td>
                <td className="py-2.5 px-2 text-center">
                  <span className="text-white font-semibold">{row.current}</span>
                </td>
                {row.roleGaps.map((cell, ci) => (
                  <td key={ci} className="py-2.5 px-1 text-center" data-testid={`gap-cell-${ri}-${ci}`}>
                    <div className={`inline-flex flex-col items-center rounded-md px-2 py-1.5 border ${cell.bg} min-w-[90px]`}>
                      <span className={`font-bold text-sm leading-none ${cell.color}`}>
                        {cell.gap === 0 ? "✓" : `-${cell.gap}`}
                      </span>
                      <span className={`text-[9px] mt-0.5 uppercase tracking-wider ${cell.color} opacity-80`}>
                        {cell.label}
                      </span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 mt-5 pt-4 border-t border-white/10" data-testid="gap-legend">
        {[
          { label: "Minimal", color: "bg-emerald-500" },
          { label: "Small", color: "bg-cyan-500" },
          { label: "Medium", color: "bg-yellow-500" },
          { label: "Large", color: "bg-orange-500" },
          { label: "Critical", color: "bg-red-500" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${item.color}`} />
            <span className="text-[10px] font-mono text-muted-foreground uppercase">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
