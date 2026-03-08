import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, ShieldAlert, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

interface JSTGaugeProps {
  score: number;
  jobsScore: number;
  skillsScore: number;
  talentScore: number;
  percentileRank?: number;
  previousScore?: number;
  industryAverage?: number;
  contextCraftLevel?: string;
  contextCraftMultiplier?: number;
  rawTotal?: number;
}

const COLOR_ZONES = [
  { min: 0, max: 40, color: "#FF4444", label: "Needs Development" },
  { min: 40, max: 60, color: "#FFA500", label: "Fair" },
  { min: 60, max: 75, color: "#FFDD00", label: "Good" },
  { min: 75, max: 90, color: "#4488FF", label: "Excellent" },
  { min: 90, max: 100, color: "#44AA44", label: "Exceptional" },
];

function getClassification(normalizedScore: number) {
  for (const zone of COLOR_ZONES) {
    if (normalizedScore <= zone.max) return zone;
  }
  return COLOR_ZONES[COLOR_ZONES.length - 1];
}

export function JSTGauge({
  score,
  jobsScore,
  skillsScore,
  talentScore,
  percentileRank,
  previousScore,
  industryAverage,
  contextCraftLevel,
  contextCraftMultiplier,
  rawTotal,
}: JSTGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const maxScore = 300;
  const normalizedScore = Math.round((score / maxScore) * 100);
  const normalizedIndustryAvg = industryAverage !== undefined ? Math.round((industryAverage / maxScore) * 100) : undefined;
  const scoreChange = previousScore !== undefined ? score - previousScore : undefined;

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const stepTime = duration / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      setAnimatedScore(Math.min(Math.round((score / steps) * currentStep), score));
      if (currentStep >= steps) clearInterval(timer);
    }, stepTime);

    return () => clearInterval(timer);
  }, [score]);

  const classification = getClassification(normalizedScore);

  const radius = 120;
  const stroke = 18;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const arcLength = circumference * 0.75;

  const zoneArcs = COLOR_ZONES.map((zone) => {
    const zoneStart = (zone.min / 100) * arcLength;
    const zoneEnd = (zone.max / 100) * arcLength;
    const zoneLength = zoneEnd - zoneStart;
    return { ...zone, zoneStart, zoneLength };
  });

  const scoreOffset = arcLength - (animatedScore / maxScore) * arcLength;

  const industryAvgAngle = normalizedIndustryAvg !== undefined
    ? (normalizedIndustryAvg / 100) * 270 - 135
    : undefined;

  return (
    <div className="glass-card p-6 rounded-xl flex flex-col items-center relative overflow-hidden" data-testid="jst-gauge-container">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary/10 blur-[50px] rounded-full pointer-events-none" />

      <div className="flex items-center justify-between w-full mb-6">
        <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest">
          JST Index Valuation
        </h3>
        {scoreChange !== undefined && scoreChange !== 0 && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono ${
              scoreChange > 0
                ? "bg-green-500/10 text-green-400"
                : "bg-red-500/10 text-red-400"
            }`}
            data-testid="score-trend-arrow"
          >
            {scoreChange > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {scoreChange > 0 ? "+" : ""}
            {scoreChange}
          </div>
        )}
        {scoreChange !== undefined && scoreChange === 0 && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono bg-white/5 text-muted-foreground"
            data-testid="score-trend-arrow"
          >
            <Minus className="w-3 h-3" />
            0
          </div>
        )}
      </div>

      <div className="relative w-64 h-64 flex items-center justify-center group">
        <svg
          height={radius * 2}
          width={radius * 2}
          className="-rotate-[135deg]"
        >
          {zoneArcs.map((zone, i) => (
            <circle
              key={i}
              stroke={zone.color}
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={`${zone.zoneLength} ${circumference}`}
              strokeDashoffset={-zone.zoneStart}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              opacity={0.2}
              strokeLinecap="butt"
            />
          ))}

          <motion.circle
            stroke={classification.color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${arcLength} ${circumference}`}
            initial={{ strokeDashoffset: arcLength }}
            animate={{ strokeDashoffset: scoreOffset }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 6px ${classification.color}80)`,
            }}
          />
        </svg>

        {industryAvgAngle !== undefined && (
          <svg
            height={radius * 2}
            width={radius * 2}
            className="absolute inset-0"
            style={{ margin: "auto" }}
          >
            <line
              x1={radius}
              y1={radius}
              x2={
                radius +
                (normalizedRadius + stroke) *
                  Math.cos((industryAvgAngle * Math.PI) / 180)
              }
              y2={
                radius +
                (normalizedRadius + stroke) *
                  Math.sin((industryAvgAngle * Math.PI) / 180)
              }
              stroke="#999999"
              strokeWidth={2}
              strokeDasharray="4,3"
              opacity={0.6}
            />
            <circle
              cx={
                radius +
                (normalizedRadius) *
                  Math.cos((industryAvgAngle * Math.PI) / 180)
              }
              cy={
                radius +
                (normalizedRadius) *
                  Math.sin((industryAvgAngle * Math.PI) / 180)
              }
              r={4}
              fill="#999999"
            />
          </svg>
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center mt-2 transition-transform duration-300 group-hover:scale-105">
          <span className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Composite</span>
          <span
            className="text-6xl font-display font-black leading-none"
            style={{ color: classification.color }}
            data-testid="jst-score-value"
          >
            {animatedScore}
          </span>
          <span className="text-xs text-primary/70 mt-1 font-mono">/ {maxScore}</span>
          <span
            className="text-xs font-mono font-bold uppercase tracking-wider mt-2 px-3 py-0.5 rounded-full"
            style={{
              color: classification.color,
              backgroundColor: `${classification.color}15`,
              border: `1px solid ${classification.color}30`,
            }}
            data-testid="score-classification"
          >
            {classification.label}
          </span>
        </div>
      </div>

      <div className="w-full flex justify-between items-center mt-2 mb-4 px-2">
        {percentileRank !== undefined && (
          <div className="flex flex-col items-center" data-testid="percentile-rank">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Percentile</span>
            <span className="text-lg font-display font-bold text-white">{percentileRank}<span className="text-xs text-muted-foreground">th</span></span>
          </div>
        )}
        {normalizedIndustryAvg !== undefined && (
          <div className="flex flex-col items-center" data-testid="industry-average">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Industry Avg</span>
            <span className="text-lg font-display font-bold text-muted-foreground">
              {industryAverage}
              <span className="text-xs text-muted-foreground"> / {maxScore}</span>
            </span>
          </div>
        )}
        {normalizedIndustryAvg !== undefined && (
          <div className="flex flex-col items-center" data-testid="variance-from-average">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">vs. Average</span>
            <span className={`text-lg font-display font-bold ${score > (industryAverage || 0) ? 'text-green-400' : 'text-red-400'}`}>
              {score > (industryAverage || 0) ? '+' : ''}{score - (industryAverage || 0)}
            </span>
          </div>
        )}
      </div>

      <div className="w-full flex justify-center gap-1 mb-4">
        {COLOR_ZONES.map((zone, i) => (
          <div key={i} className="flex flex-col items-center">
            <div
              className="h-2 rounded-full"
              style={{
                width: `${(zone.max - zone.min) * 0.6}px`,
                backgroundColor: zone.color,
                opacity: normalizedScore >= zone.min && normalizedScore <= zone.max ? 1 : 0.3,
              }}
            />
            <span className="text-[8px] font-mono text-muted-foreground mt-0.5 whitespace-nowrap">
              {zone.label}
            </span>
          </div>
        ))}
      </div>

      <div className="w-full grid grid-cols-3 gap-4">
        <div className="flex flex-col items-center p-2 rounded hover:bg-white/5 transition-colors" data-testid="jst-jobs-score">
          <span className="text-xs font-mono text-muted-foreground mb-1">JOBS</span>
          <span className="font-display font-bold text-lg text-white">{jobsScore}</span>
        </div>
        <div className="flex flex-col items-center border-x border-white/10 p-2 hover:bg-white/5 transition-colors" data-testid="jst-skills-score">
          <span className="text-xs font-mono text-muted-foreground mb-1">SKILLS</span>
          <span className="font-display font-bold text-lg text-white">{skillsScore}</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded hover:bg-white/5 transition-colors" data-testid="jst-talent-score">
          <span className="text-xs font-mono text-muted-foreground mb-1">TALENT</span>
          <span className="font-display font-bold text-lg text-white">{talentScore}</span>
        </div>
      </div>

      {contextCraftLevel !== undefined && (
        <Link href="/context-craft" className="w-full block mt-4" data-testid="link-cc-status">
          <div
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
              contextCraftLevel === "NONE"
                ? "bg-destructive/10 border border-destructive/20"
                : "bg-secondary/10 border border-secondary/20"
            }`}
          >
            {contextCraftLevel === "NONE" ? (
              <ShieldAlert className="h-4 w-4 text-destructive flex-shrink-0" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-secondary flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <span className={`text-[10px] font-mono uppercase tracking-widest ${contextCraftLevel === "NONE" ? "text-destructive" : "text-secondary"}`}>
                Context Craft {contextCraftLevel === "NONE" ? "NOT VERIFIED" : contextCraftLevel?.replace("_", "-")}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {contextCraftMultiplier !== undefined && rawTotal !== undefined && contextCraftMultiplier !== 1 && (
                <span className="text-[10px] font-mono text-muted-foreground">
                  Raw: {rawTotal}
                </span>
              )}
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  contextCraftLevel === "NONE"
                    ? "text-destructive bg-destructive/10"
                    : contextCraftMultiplier && contextCraftMultiplier > 1
                      ? "text-secondary bg-secondary/10"
                      : "text-muted-foreground bg-white/5"
                }`}
              >
                {contextCraftMultiplier !== undefined ? `${contextCraftMultiplier}x` : "—"}
              </span>
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}
