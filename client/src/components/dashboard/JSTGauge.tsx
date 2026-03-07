import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface JSTGaugeProps {
  score: number; // 0 to 300
  jobsScore: number; // 0 to 100
  skillsScore: number; // 0 to 100
  talentScore: number; // 0 to 100
}

export function JSTGauge({ score, jobsScore, skillsScore, talentScore }: JSTGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  
  useEffect(() => {
    const duration = 1500; // 1.5s
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

  // Calculate SVG arc parameters
  const radius = 120;
  const stroke = 20;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  // Make it a semi-circle gauge (or 3/4 circle)
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength - (animatedScore / 300) * arcLength;

  return (
    <div className="glass-card p-6 rounded-xl flex flex-col items-center relative overflow-hidden" data-testid="jst-gauge-container">
      {/* Decorative background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary/10 blur-[50px] rounded-full pointer-events-none" />

      <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest mb-6 w-full text-left">
        JST Index Valuation
      </h3>

      <div className="relative w-64 h-64 flex items-center justify-center group">
        {/* SVG Gauge */}
        <svg
          height={radius * 2}
          width={radius * 2}
          className="-rotate-[135deg]"
        >
          {/* Background Arc */}
          <circle
            stroke="currentColor"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${arcLength} ${circumference}`}
            style={{ strokeDashoffset: 0 }}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="text-white/5"
            strokeLinecap="round"
          />
          {/* Foreground Arc */}
          <motion.circle
            stroke="currentColor"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${arcLength} ${circumference}`}
            initial={{ strokeDashoffset: arcLength }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="text-primary transition-all duration-300 group-hover:drop-shadow-[0_0_12px_hsl(var(--primary)_/_0.8)]"
            strokeLinecap="round"
            style={{ 
              filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.5))"
            }}
          />
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center mt-4 transition-transform duration-300 group-hover:scale-105">
          <span className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Composite</span>
          <span className="text-6xl font-display font-black text-white neon-text leading-none">
            {animatedScore}
          </span>
          <span className="text-xs text-primary/70 mt-1 font-mono">/ 300</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="w-full mt-6 grid grid-cols-3 gap-4">
        <div className="flex flex-col items-center p-2 rounded hover:bg-white/5 transition-colors">
          <span className="text-xs font-mono text-muted-foreground mb-1">JOBS</span>
          <span className="font-display font-bold text-lg text-white">{jobsScore}</span>
        </div>
        <div className="flex flex-col items-center border-x border-white/10 p-2 hover:bg-white/5 transition-colors">
          <span className="text-xs font-mono text-muted-foreground mb-1">SKILLS</span>
          <span className="font-display font-bold text-lg text-white">{skillsScore}</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded hover:bg-white/5 transition-colors">
          <span className="text-xs font-mono text-muted-foreground mb-1">TALENT</span>
          <span className="font-display font-bold text-lg text-white">{talentScore}</span>
        </div>
      </div>
    </div>
  );
}