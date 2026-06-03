import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Check, Copy, ArrowRight, LogIn, UserPlus, Compass, Crown, GraduationCap } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { F1000QrCard } from "@/components/f1000/F1000QrCard";

interface F1000Invite {
  id: string;
  seq: number;
  code: string;
  userId: string;
  promoApplied: boolean;
  createdAt: string;
}
interface F1000Stats {
  claimed: number;
  limit: number;
  remaining: number;
}
interface F1000Me {
  member: boolean;
  invite: F1000Invite | null;
  stats: F1000Stats;
}

export default function F1000Page() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const claimUrl = typeof window !== "undefined" ? `${window.location.origin}/f1000` : "/f1000";

  const statsQuery = useQuery<F1000Stats>({
    queryKey: ["/api/f1000/stats"],
    queryFn: () => api.getF1000Stats(),
    refetchOnWindowFocus: false,
  });

  const meQuery = useQuery<F1000Me>({
    queryKey: ["/api/f1000/me"],
    queryFn: () => api.getF1000Me(),
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const claim = useMutation({
    mutationFn: () => api.claimF1000(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/f1000/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/f1000/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const stats = meQuery.data?.stats ?? statsQuery.data;
  const remaining = stats?.remaining ?? F1000_LIMIT_FALLBACK;
  const limit = stats?.limit ?? F1000_LIMIT_FALLBACK;
  const claimedSeats = stats?.claimed ?? 0;
  const soldOut = remaining <= 0;
  const invite = meQuery.data?.invite ?? null;

  // Requirement: a seat is reserved the moment a signed-in user lands on the
  // QR target. Auto-claim once per mount when authenticated, no invite yet, and
  // seats remain. The server allocation is idempotent, so this is safe to fire.
  const autoClaimed = useRef(false);
  useEffect(() => {
    if (
      !autoClaimed.current &&
      user &&
      meQuery.isSuccess &&
      !invite &&
      !soldOut &&
      !claim.isPending
    ) {
      autoClaimed.current = true;
      claim.mutate();
    }
  }, [user, meQuery.isSuccess, invite, soldOut, claim]);

  const copyCode = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 py-4">
      <div className="text-center space-y-4">
        <div
          className="inline-flex items-center gap-2 rounded-full border border-secondary/50 bg-secondary/10 px-4 py-1.5 text-xs font-mono uppercase tracking-widest text-secondary"
          data-testid="badge-f1000-scarcity"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {soldOut ? (
            <span data-testid="text-f1000-remaining">All {limit} F1000 seats claimed</span>
          ) : (
            <>
              The First <span className="font-bold text-white">1000</span> ·{" "}
              <span className="font-bold text-white" data-testid="text-f1000-remaining">{remaining}</span>/{limit} seats left
            </>
          )}
        </div>
        <h1 className="text-4xl font-display font-black text-white tracking-tight" data-testid="text-f1000-title">
          F1000 <span className="text-primary neon-text">Free</span> with this QR code
        </h1>
        <p className="max-w-2xl mx-auto text-muted-foreground leading-relaxed">
          The first 1,000 readers get an <span className="text-primary font-semibold">Individual Explorer</span> account —
          free, forever — with Training Providers unlocked. Each QR scan reserves one of 1,000 single-use codes, bound to
          your account the moment you sign in.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* QR — shared on landing + printed in the book */}
        <div className="glass-card rounded-2xl p-8 flex flex-col items-center gap-5" data-testid="card-f1000-qr">
          <F1000QrCard url={claimUrl} size={200} showDownload caption="Scan to claim · or share the code" />
          <div className="text-center text-xs font-mono text-muted-foreground">
            {claimedSeats.toLocaleString()} of {limit.toLocaleString()} claimed
          </div>
        </div>

        {/* Claim / status panel */}
        <div className="glass-card rounded-2xl p-8 space-y-5" data-testid="card-f1000-claim">
          {!isLoading && !user && (
            <div className="space-y-4">
              <h2 className="font-display font-bold text-xl text-white">Sign in to reserve your seat</h2>
              <p className="text-sm text-muted-foreground">
                Your F1000 code is bound to one account. Log in or create a free account, then claim your code here.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/login"
                  data-testid="link-f1000-login"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border-2 border-emerald-400/60 bg-background/60 px-5 py-3 font-mono text-sm uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                >
                  <LogIn className="h-4 w-4" /> Log In
                </Link>
                <Link
                  href="/signup"
                  data-testid="link-f1000-signup"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border-2 border-primary/60 bg-primary/10 px-5 py-3 font-mono text-sm uppercase tracking-wider text-primary hover:bg-primary/20 transition-colors"
                >
                  <UserPlus className="h-4 w-4" /> Sign Up Free
                </Link>
              </div>
            </div>
          )}

          {user && invite && (
            <div className="space-y-4" data-testid="block-f1000-code">
              <div className="inline-flex items-center gap-2 text-secondary font-mono text-xs uppercase tracking-widest">
                <Check className="h-4 w-4" /> You're member #{invite.seq} of {limit}
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Your single-use code</div>
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 rounded-lg border border-primary/40 bg-black/50 px-4 py-3 font-mono text-base text-primary tracking-wide break-all"
                    data-testid="text-f1000-code"
                  >
                    {invite.code}
                  </code>
                  <button
                    onClick={copyCode}
                    data-testid="button-copy-f1000-code"
                    className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-primary hover:bg-primary/20 transition-colors"
                    aria-label="Copy code"
                  >
                    {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Compass className="h-4 w-4 text-secondary" /> Individual Explorer unlocked
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Free forever, Training Providers included. When you're ready for more, F1000 pricing caps Pro at
                  <span className="text-primary font-semibold"> $10/mo</span> and Student at
                  <span className="text-primary font-semibold"> $9/mo</span>.
                </p>
              </div>
              <Link
                href="/subscription"
                data-testid="link-f1000-upgrade"
                className="inline-flex items-center gap-2 text-primary font-mono text-sm uppercase tracking-wider hover:text-primary/80 transition-colors"
              >
                See F1000 pricing <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {user && !invite && (
            <div className="space-y-4">
              <h2 className="font-display font-bold text-xl text-white">Claim your F1000 seat</h2>
              <p className="text-sm text-muted-foreground">
                Lock in a free Individual Explorer account with Training Providers unlocked, plus capped F1000 upgrade
                pricing for life.
              </p>
              {soldOut ? (
                <div
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 font-mono text-sm text-destructive"
                  data-testid="text-f1000-soldout"
                >
                  All 1,000 F1000 seats have been claimed.
                </div>
              ) : (
                <button
                  onClick={() => claim.mutate()}
                  disabled={claim.isPending}
                  data-testid="button-claim-f1000"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-4 font-mono text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[0_0_30px_hsl(var(--primary)/0.5)] hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {claim.isPending ? "Reserving…" : "Claim my F1000 code"} <ArrowRight className="h-5 w-5" />
                </button>
              )}
              {claim.isError && (
                <p className="text-xs font-mono text-destructive" data-testid="text-f1000-error">
                  {(claim.error as Error)?.message || "Could not claim — please try again."}
                </p>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-white/10 flex flex-wrap gap-4 text-xs font-mono uppercase tracking-wider">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Crown className="h-3.5 w-3.5 text-primary" /> Pro $10/mo
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5 text-purple-400" /> Student $9/mo
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const F1000_LIMIT_FALLBACK = 1000;
