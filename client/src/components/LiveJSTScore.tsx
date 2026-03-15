import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

interface LiveJSTScoreProps {
  jobsScore: number;
  skillsScore: number;
  talentScore: number;
  compact?: boolean;
  label?: string;
}

const COLOR_ZONES = [
  { min: 0, max: 40, color: "#FF4444", label: "Needs Dev" },
  { min: 40, max: 60, color: "#FFA500", label: "Fair" },
  { min: 60, max: 75, color: "#FFDD00", label: "Good" },
  { min: 75, max: 90, color: "#4488FF", label: "Excellent" },
  { min: 90, max: 100, color: "#44AA44", label: "Exceptional" },
];

function getZone(pct: number) {
  for (const z of COLOR_ZONES) if (pct <= z.max) return z;
  return COLOR_ZONES[COLOR_ZONES.length - 1];
}

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v));
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    return display.on("change", (v) => {
      if (ref.current) ref.current.textContent = String(v);
    });
  }, [display]);

  return <span ref={ref}>0</span>;
}

export function LiveJSTScore({
  jobsScore,
  skillsScore,
  talentScore,
  compact = false,
  label,
}: LiveJSTScoreProps) {
  const total = jobsScore + skillsScore + talentScore;
  const maxScore = 300;
  const pct = Math.round((total / maxScore) * 100);
  const zone = getZone(pct);

  const radius = compact ? 52 : 72;
  const stroke = compact ? 8 : 12;
  const innerR = radius - stroke * 2;
  const circ = innerR * 2 * Math.PI;
  const arc = circ * 0.75;
  const offset = arc - (total / maxScore) * arc;

  const subs = [
    { key: "J", val: jobsScore, max: 100 },
    { key: "S", val: skillsScore, max: 100 },
    { key: "T", val: talentScore, max: 100 },
  ];

  return (
    <div
      className="flex flex-col items-center gap-2"
      data-testid="live-jst-score"
    >
      {label && (
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          {label}
        </span>
      )}

      <div className="relative flex items-center justify-center" style={{ width: radius * 2, height: radius * 2 }}>
        <svg width={radius * 2} height={radius * 2} className="-rotate-[135deg]">
          <circle
            stroke="rgba(255,255,255,0.06)"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${arc} ${circ}`}
            r={innerR}
            cx={radius}
            cy={radius}
          />
          <motion.circle
            stroke={zone.color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${arc} ${circ}`}
            animate={{ strokeDashoffset: offset }}
            transition={{ type: "spring", stiffness: 60, damping: 18 }}
            r={innerR}
            cx={radius}
            cy={radius}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${zone.color}60)` }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-display font-black leading-none ${compact ? "text-2xl" : "text-4xl"}`}
            style={{ color: zone.color }}
            data-testid="live-jst-total"
          >
            <AnimatedNumber value={total} />
          </span>
          <span className={`font-mono text-muted-foreground mt-0.5 ${compact ? "text-[8px]" : "text-[10px]"}`}>
            / {maxScore}
          </span>
        </div>
      </div>

      <motion.span
        className="text-[9px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
        style={{
          color: zone.color,
          backgroundColor: `${zone.color}15`,
          border: `1px solid ${zone.color}30`,
        }}
        layout
        data-testid="live-jst-zone"
      >
        {zone.label}
      </motion.span>

      <div className={`flex gap-3 ${compact ? "mt-0" : "mt-1"}`}>
        {subs.map((s) => {
          const subPct = (s.val / s.max) * 100;
          const subZone = getZone(subPct);
          return (
            <div key={s.key} className="flex flex-col items-center">
              <span className="text-[9px] font-mono text-muted-foreground">{s.key}</span>
              <span
                className={`font-display font-bold ${compact ? "text-xs" : "text-sm"}`}
                style={{ color: subZone.color }}
                data-testid={`live-jst-sub-${s.key.toLowerCase()}`}
              >
                <AnimatedNumber value={s.val} />
              </span>
              <div className="w-8 h-0.5 rounded-full overflow-hidden bg-white/10 mt-0.5">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: subZone.color }}
                  animate={{ width: `${subPct}%` }}
                  transition={{ type: "spring", stiffness: 60, damping: 18 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
