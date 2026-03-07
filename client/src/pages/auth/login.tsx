import { useState } from "react";
import { useLocation } from "wouter";
import { Activity, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("analyst@enterprise.com");
  const [password, setPassword] = useState("arkplatform");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const user = await api.login(username, password);
      login(user);
      setLocation("/");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 p-8">
        <div className="flex flex-col items-center mb-10">
          <Activity className="h-12 w-12 text-primary animate-pulse mb-4" />
          <h1 className="text-4xl font-display font-black text-white tracking-widest leading-none text-center">ARK</h1>
          <p className="text-xs uppercase tracking-widest text-primary font-mono mt-2 neon-text">Synthesized Intelligence Platform</p>
        </div>

        <form onSubmit={handleLogin} className="glass-card p-8 rounded-xl border-white/10 space-y-6">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 rounded font-mono">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1 block">Enterprise Identification</label>
              <input
                data-testid="input-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-md px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-primary/50 transition-colors"
                required
              />
            </div>
            
            <div>
              <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1 block">Security Clearance Key</label>
              <div className="relative">
                <input
                  data-testid="input-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-md px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-primary/50 transition-colors"
                  required
                />
                <Lock className="w-4 h-4 text-muted-foreground absolute right-4 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          <Button
            data-testid="button-login"
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-wider rounded-none neon-border h-12 transition-all hover:scale-[1.02]"
          >
            {isLoading ? "Authenticating..." : "Establish Connection"}
            {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>

          <p className="text-center text-[10px] font-mono text-muted-foreground uppercase mt-4">
            Protected by Junglenomics Royal DNA Governance
          </p>
        </form>
      </div>
    </div>
  );
}