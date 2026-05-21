import { Link, useLocation } from "wouter";
import { useState } from "react";
import atandaLogo from "@assets/WEB_LEARNING_SYSTEMS_(1920_x_1280_px)_1772920111812.png";
import {
  BarChart3,
  Upload,
  Activity,
  Map,
  Users,
  Home as HomeIcon,
  CreditCard,
  User,
  GraduationCap,
  Gamepad2,
  ShoppingBag,
  HelpCircle,
  Menu,
  X,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OnboardingTour } from "@/components/OnboardingTour";
import { useOnboarding } from "@/lib/useOnboarding";
import { useAuth } from "@/lib/useAuth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const ADMIN_LINKS: NavItem[] = [
  { name: "CCGE Importer", href: "/admin/ccge-import", icon: Shield, hint: "Bulk-import compendium cards" },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Grouped navigation — three intent buckets reduce the wall-of-links
// problem and let new users find Upload CV / Intelligence Hub quickly.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Analyze",
    items: [
      { name: "Home", href: "/", icon: HomeIcon, hint: "Landing & overview" },
      { name: "Upload CV", href: "/upload", icon: Upload, hint: "Run a new assessment" },
      { name: "Intelligence Hub", href: "/dashboard", icon: BarChart3, hint: "Your scores & insights" },
    ],
  },
  {
    label: "Explore",
    items: [
      { name: "Skill Games", href: "/play", icon: Gamepad2, hint: "CCGE Arena — earn points" },
      { name: "Marketplace", href: "/marketplace", icon: ShoppingBag, hint: "SPHINX listings" },
      { name: "Career Mobility", href: "/pathways", icon: Map, hint: "Pivot opportunities" },
    ],
  },
  {
    label: "Manage",
    items: [
      { name: "Workforce", href: "/enterprise", icon: Users, hint: "Org-wide view" },
    ],
  },
];

const SECONDARY_LINKS: NavItem[] = [
  { name: "Profile", href: "/profile", icon: User, hint: "Account" },
  { name: "Institution", href: "/school", icon: GraduationCap, hint: "School dashboard" },
  { name: "Subscription", href: "/subscription", icon: CreditCard, hint: "Plans & billing" },
];

function isActiveHref(location: string, href: string): boolean {
  return location === href || (href !== "/" && location.startsWith(href + "/"));
}

function SidebarBody({ location, openTour, onNavigate }: {
  location: string;
  openTour: () => void;
  onNavigate?: () => void;
}) {
  const { user } = useAuth();
  const isAdmin = !!(user as any)?.isAdmin;
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 flex items-center gap-3">
        <Activity className="h-8 w-8 text-primary animate-pulse" />
        <div>
          <h1 className="text-xl font-display font-bold text-primary tracking-widest leading-none">ARK</h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Synthesized Intel</p>
        </div>
      </div>

      <nav className="px-4 py-4 flex-1 overflow-y-auto" aria-label="Primary">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-2 mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/70">
              {group.label}
            </p>
            <ul className="space-y-1.5">
              {group.items.map((item) => {
                const isActive = isActiveHref(location, item.href);
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      data-testid={`link-nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                      title={item.hint}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group font-mono text-sm uppercase tracking-wide",
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/30 shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
                      )}
                    >
                      <item.icon className={cn(
                        "h-4 w-4 flex-shrink-0 transition-colors",
                        isActive ? "text-primary" : "opacity-70 group-hover:opacity-100 group-hover:text-primary/70"
                      )} />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {isAdmin && (
          <div className="mb-5 border-t border-white/5 pt-4">
            <p className="px-2 mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400/70">
              Admin
            </p>
            <ul className="space-y-1.5">
              {ADMIN_LINKS.map((item) => {
                const isActive = isActiveHref(location, item.href);
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      data-testid={`link-admin-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                      title={item.hint}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 font-mono text-xs uppercase tracking-wide group border",
                        isActive
                          ? "bg-amber-400/10 text-amber-300 border-amber-400/30"
                          : "text-muted-foreground hover:bg-white/5 hover:text-amber-300 border-transparent"
                      )}
                    >
                      <item.icon className={cn(
                        "h-4 w-4 flex-shrink-0",
                        isActive ? "text-amber-300" : "opacity-70 group-hover:opacity-100"
                      )} />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mb-5 border-t border-white/5 pt-4">
          <p className="px-2 mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/70">
            Account
          </p>
          <ul className="space-y-1.5">
            {SECONDARY_LINKS.map((item) => {
              const isActive = isActiveHref(location, item.href);
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    data-testid={`link-${item.name.toLowerCase()}`}
                    title={item.hint}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 font-mono text-xs uppercase tracking-wide group border",
                      isActive
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground border-transparent"
                    )}
                  >
                    <item.icon className={cn(
                      "h-4 w-4 flex-shrink-0",
                      isActive ? "text-primary" : "opacity-70 group-hover:opacity-100"
                    )} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="p-4 border-t border-primary/20 bg-background/80 backdrop-blur-sm space-y-3">
        <button
          type="button"
          onClick={() => { openTour(); onNavigate?.(); }}
          data-testid="button-launch-onboarding"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/30 transition-all duration-300 group"
        >
          <HelpCircle className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100" />
          <span>Take the tour</span>
        </button>
        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
          <span>SYS.STATUS</span>
          <span className="text-secondary flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            ONLINE
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 pt-2 border-t border-white/5">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 font-mono">Powered By</span>
          <img src={atandaLogo} alt="Atanda" className="h-9 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity" data-testid="img-powered-by-atanda" />
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { isOpen, open, close } = useOnboarding();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (location === '/login') {
    return <main className="min-h-screen bg-background text-foreground font-sans">{children}</main>;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Mobile top bar (< md): hamburger drawer */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-primary/20 bg-background/90 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary animate-pulse" />
          <span className="font-display font-bold text-primary tracking-widest text-sm">ARK</span>
        </div>
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              data-testid="button-open-mobile-nav"
              aria-label="Open navigation"
              className="p-2 rounded-md border border-primary/30 text-primary"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[280px] glass border-primary/20">
            <SidebarBody location={location} openTour={open} onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop sidebar (>= md) */}
      <aside className="hidden md:flex md:w-64 lg:w-72 glass border-r border-primary/20 flex-shrink-0 z-10 sticky top-0 h-screen">
        <SidebarBody location={location} openTour={open} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-x-hidden">
        {/* Subtle decorative elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-destructive/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/3 pointer-events-none" />

        <div className="relative z-10 p-4 sm:p-6 md:p-10 h-full">
          {children}
        </div>
        <footer className="relative z-10 border-t border-primary/10 px-4 sm:px-6 md:px-10 py-4 mt-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">
            <span>© 2026 ARK Platform</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={open}
                data-testid="button-footer-tour"
                className="hover:text-primary transition-colors"
              >
                Tour
              </button>
              <Link href="/privacy" data-testid="link-privacy" className="hover:text-primary transition-colors">Privacy</Link>
              <Link href="/terms" data-testid="link-terms" className="hover:text-primary transition-colors">Terms</Link>
            </div>
          </div>
        </footer>
      </main>

      <OnboardingTour open={isOpen} onClose={close} />
    </div>
  );
}
