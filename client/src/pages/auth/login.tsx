import { useState } from "react";
import { useLocation } from "wouter";
import { Activity, Lock, ArrowRight, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

export default function LoginPage() {
  const [location, setLocation] = useLocation();
  const { login } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(location === "/signup" ? "signup" : "login");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState(location === "/signup" ? "" : "analyst@enterprise.com");
  const [password, setPassword] = useState(location === "/signup" ? "" : "arkplatform");

  const isSignup = mode === "signup";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const user = isSignup
        ? await api.register({ name, username, password })
        : await api.login(username, password);
      login(user);
      setLocation("/");
    } catch (err: any) {
      setError(err.message || (isSignup ? "Registration failed" : "Authentication failed"));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setError("");
    if (isSignup) {
      setMode("login");
      setName("");
      setUsername("analyst@enterprise.com");
      setPassword("arkplatform");
      setLocation("/login");
    } else {
      setMode("signup");
      setName("");
      setUsername("");
      setPassword("");
      setLocation("/signup");
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

        <form onSubmit={handleSubmit} className="glass-card p-8 rounded-xl border-white/10 space-y-6">
          <div className="text-center">
            <h2 className="font-display font-bold text-lg text-white uppercase tracking-wide" data-testid="text-auth-title">
              {isSignup ? "Create Account" : "Sign In"}
            </h2>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 rounded font-mono" data-testid="text-auth-error">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {isSignup && (
              <div>
                <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1 block">Full Name</label>
                <div className="relative">
                  <input
                    data-testid="input-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-md px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-primary/50 transition-colors"
                    required
                  />
                  <UserIcon className="w-4 h-4 text-muted-foreground absolute right-4 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1 block">
                {isSignup ? "Email Address" : "Enterprise Identification"}
              </label>
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
            data-testid={isSignup ? "button-register" : "button-login"}
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-wider rounded-none neon-border h-12 transition-all hover:scale-[1.02]"
          >
            {isLoading
              ? (isSignup ? "Creating..." : "Authenticating...")
              : (isSignup ? "Create Account" : "Establish Connection")}
            {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>

          <button
            type="button"
            onClick={toggleMode}
            data-testid="link-toggle-auth-mode"
            className="w-full text-center text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
          >
            {isSignup ? "Already have an account? Sign In" : "Need an account? Sign Up"}
          </button>

          <p className="text-center text-[10px] font-mono text-muted-foreground uppercase mt-4">
            Protected by Junglenomics Royal DNA Governance
          </p>
        </form>
      </div>
    </div>
  );
}
