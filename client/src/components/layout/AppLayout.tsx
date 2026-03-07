import { Link, useLocation } from "wouter";
import { 
  BarChart3, 
  Upload, 
  Activity, 
  Map, 
  Users,
  TerminalSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();

  const navigation = [
    { name: "Terminal", href: "/", icon: TerminalSquare },
    { name: "Upload CV", href: "/upload", icon: Upload },
    { name: "Intelligence Hub", href: "/dashboard", icon: BarChart3 },
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
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <a
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 group font-mono text-sm uppercase tracking-wide",
                    isActive
                      ? "bg-primary/10 text-primary neon-border"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "opacity-70 group-hover:opacity-100")} />
                  {item.name}
                </a>
              </Link>
            );
          })}
        </nav>
        
        {/* System Status Mock */}
        <div className="absolute bottom-0 w-full p-4 border-t border-primary/20 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span>SYS.STATUS</span>
            <span className="text-secondary flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              ONLINE
            </span>
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
      </main>
    </div>
  );
}