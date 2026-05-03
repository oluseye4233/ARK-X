import { useState } from "react";
import { Link, useLocation } from "wouter";
import atandaLogo from "@assets/WEB_LEARNING_SYSTEMS_(1920_x_1280_px)_1772920111812.png";
import { 
  BarChart3, 
  Upload, 
  Activity, 
  Map, 
  Users,
  TerminalSquare,
  Plug,
  Loader2,
  Check,
  ShieldCheck,
  CreditCard,
  User,
  GraduationCap,
  Gamepad2,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [matrixStatus, setMatrixStatus] = useState<"idle" | "connecting" | "connected">("idle");
  const handleConnect = (
    target: "matrix",
    setStatus: (s: "idle" | "connecting" | "connected") => void
  ) => {
    setStatus("connecting");
    setTimeout(() => setStatus("connected"), 2200);
  };

  if (location === '/login') {
    return <main className="min-h-screen bg-background text-foreground font-sans">{children}</main>;
  }

  const navigation = [
    { name: "Terminal", href: "/", icon: TerminalSquare },
    { name: "Upload CV", href: "/upload", icon: Upload },
    { name: "Intelligence Hub", href: "/dashboard", icon: BarChart3 },
    { name: "CCGE Arena", href: "/play", icon: Gamepad2 },
    { name: "SPHINX Market", href: "/marketplace", icon: ShoppingBag },
    { name: "Career Mobility", href: "/pathways", icon: Map },
    { name: "Workforce", href: "/enterprise", icon: Users },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <aside className="w-full md:w-64 glass border-r border-primary/20 flex-shrink-0 z-10">
        <div className="p-6 flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary animate-pulse" />
          <div>
            <h1 className="text-xl font-display font-bold text-primary tracking-widest leading-none">ARK</h1>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Synthesized Intel</p>
          </div>
        </div>

        <nav className="px-4 py-6 space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href + "/"));
            return (
              <Link
                key={item.name}
                href={item.href}
                data-testid={`link-nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 group font-mono text-sm uppercase tracking-wide",
                  isActive
                    ? "bg-primary/10 text-primary neon-border shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground hover:pl-6"
                )}
              >
                <item.icon className={cn("h-5 w-5 transition-colors", isActive ? "text-primary" : "opacity-70 group-hover:opacity-100 group-hover:text-primary/70")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        <div className="px-4 mt-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono px-4 mb-2">Integrations</p>

          <button
            data-testid="button-connect-matrix-market"
            onClick={() => handleConnect("matrix", setMatrixStatus)}
            disabled={matrixStatus !== "idle"}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 font-mono text-xs uppercase tracking-wide group",
              matrixStatus === "connected"
                ? "bg-secondary/10 text-secondary border border-secondary/30"
                : matrixStatus === "connecting"
                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/30 animate-pulse"
                  : "text-muted-foreground hover:bg-purple-500/10 hover:text-purple-400 border border-transparent hover:border-purple-500/30"
            )}
          >
            {matrixStatus === "connecting" ? (
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
            ) : matrixStatus === "connected" ? (
              <Check className="h-4 w-4 flex-shrink-0" />
            ) : (
              <Plug className="h-4 w-4 flex-shrink-0 opacity-70 group-hover:opacity-100" />
            )}
            <div className="flex flex-col items-start">
              <span className="leading-none">Matrix Market</span>
              <span className={cn(
                "text-[9px] mt-0.5 tracking-wider",
                matrixStatus === "connected" ? "text-secondary/70" : matrixStatus === "connecting" ? "text-amber-500/70" : "text-muted-foreground/50"
              )}>
                {matrixStatus === "connected" ? "SYNCED" : matrixStatus === "connecting" ? "ESTABLISHING..." : "CONNECT"}
              </span>
            </div>
          </button>

          <Link
            href="/context-craft"
            data-testid="link-context-craft-certs"
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 font-mono text-xs uppercase tracking-wide group",
              location === "/context-craft"
                ? "bg-primary/10 text-primary border border-primary/30"
                : "text-muted-foreground hover:bg-cyan-500/10 hover:text-cyan-400 border border-transparent hover:border-cyan-500/30"
            )}
          >
            <ShieldCheck className={cn("h-4 w-4 flex-shrink-0", location === "/context-craft" ? "text-primary" : "opacity-70 group-hover:opacity-100")} />
            <div className="flex flex-col items-start">
              <span className="leading-none">Context Craft Certs</span>
              <span className={cn(
                "text-[9px] mt-0.5 tracking-wider",
                location === "/context-craft" ? "text-primary/70" : "text-muted-foreground/50"
              )}>
                CERTIFICATIONS
              </span>
            </div>
          </Link>

          <Link
            href="/profile"
            data-testid="link-profile"
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 font-mono text-xs uppercase tracking-wide group",
              location === "/profile"
                ? "bg-primary/10 text-primary border border-primary/30"
                : "text-muted-foreground hover:bg-cyan-500/10 hover:text-cyan-400 border border-transparent hover:border-cyan-500/30"
            )}
          >
            <User className={cn("h-4 w-4 flex-shrink-0", location === "/profile" ? "text-primary" : "opacity-70 group-hover:opacity-100")} />
            <div className="flex flex-col items-start">
              <span className="leading-none">Profile</span>
              <span className={cn(
                "text-[9px] mt-0.5 tracking-wider",
                location === "/profile" ? "text-primary/70" : "text-muted-foreground/50"
              )}>
                ACCOUNT
              </span>
            </div>
          </Link>

          <Link
            href="/school"
            data-testid="link-school-dashboard"
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 font-mono text-xs uppercase tracking-wide group",
              location === "/school"
                ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                : "text-muted-foreground hover:bg-purple-500/10 hover:text-purple-400 border border-transparent hover:border-purple-500/30"
            )}
          >
            <GraduationCap className={cn("h-4 w-4 flex-shrink-0", location === "/school" ? "text-purple-400" : "opacity-70 group-hover:opacity-100")} />
            <div className="flex flex-col items-start">
              <span className="leading-none">Institution</span>
              <span className={cn(
                "text-[9px] mt-0.5 tracking-wider",
                location === "/school" ? "text-purple-400/70" : "text-muted-foreground/50"
              )}>
                SCHOOL DASHBOARD
              </span>
            </div>
          </Link>

          <Link
            href="/subscription"
            data-testid="link-subscription"
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 font-mono text-xs uppercase tracking-wide group",
              location === "/subscription"
                ? "bg-primary/10 text-primary border border-primary/30"
                : "text-muted-foreground hover:bg-cyan-500/10 hover:text-cyan-400 border border-transparent hover:border-cyan-500/30"
            )}
          >
            <CreditCard className={cn("h-4 w-4 flex-shrink-0", location === "/subscription" ? "text-primary" : "opacity-70 group-hover:opacity-100")} />
            <div className="flex flex-col items-start">
              <span className="leading-none">Subscription</span>
              <span className={cn(
                "text-[9px] mt-0.5 tracking-wider",
                location === "/subscription" ? "text-primary/70" : "text-muted-foreground/50"
              )}>
                PLANS & BILLING
              </span>
            </div>
          </Link>
        </div>

        <div className="absolute bottom-0 w-full p-4 border-t border-primary/20 bg-background/80 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span>SYS.STATUS</span>
            <span className="text-secondary flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              ONLINE
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 pt-2 border-t border-white/5">
            <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50 font-mono">Powered By</span>
            <img src={atandaLogo} alt="Atanda" className="h-10 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity" data-testid="img-powered-by-atanda" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-x-hidden">
        {/* Subtle decorative elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-destructive/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/3 pointer-events-none" />
        
        <div className="relative z-10 p-6 md:p-10 h-full">
          {children}
        </div>
        <footer className="relative z-10 border-t border-primary/10 px-6 md:px-10 py-4 mt-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
            <span>© 2026 ARK Platform</span>
            <div className="flex items-center gap-4">
              <Link href="/privacy" data-testid="link-privacy" className="hover:text-primary transition-colors">Privacy</Link>
              <Link href="/terms" data-testid="link-terms" className="hover:text-primary transition-colors">Terms</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}