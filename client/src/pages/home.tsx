import { Link } from "wouter";
import { ArrowRight, ShieldAlert, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto flex flex-col justify-center min-h-[80vh] space-y-12">
      <div className="space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          System Initialization Complete
        </div>
        
        <h1 className="text-5xl md:text-7xl font-display font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/50 tracking-tight">
          KNOW YOUR <span className="text-primary neon-text">WORTH.</span><br />
          KNOW YOUR <span className="text-destructive">RISK.</span><br />
          KNOW YOUR <span className="text-secondary">NEXT MOVE.</span>
        </h1>
        
        <p className="text-xl text-muted-foreground font-sans max-w-2xl leading-relaxed">
          ARK is the world's most sophisticated AI-powered career intelligence platform. 
          Transform career uncertainty into strategic clarity at machine speed.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 pt-8">
          <Link href="/upload">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-wider rounded-none neon-border h-14 px-8">
              Initialize Analysis <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Button variant="outline" size="lg" className="font-mono uppercase tracking-wider rounded-none border-primary/50 text-primary hover:bg-primary/10 h-14 px-8">
            View Enterprise Demo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t border-white/10">
        <div className="glass-card p-6 rounded-lg space-y-4">
          <Zap className="h-8 w-8 text-primary" />
          <h3 className="font-display font-bold text-lg">JST Index Valuation</h3>
          <p className="text-sm text-muted-foreground font-sans">
            Computes a tri-dimensional career capital score calibrated against live labor market data.
          </p>
        </div>
        
        <div className="glass-card p-6 rounded-lg space-y-4">
          <ShieldAlert className="h-8 w-8 text-destructive" />
          <h3 className="font-display font-bold text-lg">AI Vulnerability</h3>
          <p className="text-sm text-muted-foreground font-sans">
            5-level vulnerability classification with task-level automation risk scoring.
          </p>
        </div>
        
        <div className="glass-card p-6 rounded-lg space-y-4">
          <Target className="h-8 w-8 text-secondary" />
          <h3 className="font-display font-bold text-lg">12-Vector Mobility</h3>
          <p className="text-sm text-muted-foreground font-sans">
            Maps career mobility across 12 orthogonal dimensions to generate optimal pivot pathways.
          </p>
        </div>
      </div>
    </div>
  );
}