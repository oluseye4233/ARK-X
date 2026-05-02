import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import {
  ShieldCheck,
  Crown,
  ScrollText,
  Sparkles,
  ShoppingBag,
  Award,
  CheckCircle2,
  Send,
  AlertTriangle,
  Trophy,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { CONTEXT_CRAFT_LEVELS, CERT_LEVEL_RANK, ENDORSEMENT_MAX_LEN, type ContextCraftLevel } from "@shared/schema";

type GuinProfile = {
  user: {
    id: string;
    username: string;
    name: string;
    role: string | null;
    department: string | null;
    seniority: string | null;
    location: string | null;
    contextCraftCertLevel: string | null;
    institution: string | null;
  };
  knight: {
    current: { key: string; label: string; min: number; color: string; icon: string };
    next: { key: string; label: string; min: number; color: string; icon: string } | null;
    progress: number;
    totalKcseEarned: number;
  };
  stats: {
    totalKcseEarned: number;
    sessionsFinished: number;
    sessionsWon: number;
    ownedCardsCount: number;
    publishedSpcsCount: number;
    endorsementsCount: number;
  };
  kcseRadar: { axis: string; value: number }[];
  ownedCards: {
    id: string;
    name: string;
    pillar: string;
    type: string;
    emoji: string;
    baseKcse: number;
    description: string;
  }[];
  publishedSpcs: {
    id: string;
    title: string;
    pillar: string;
    priceCredits: number;
    kcseScore: number;
    hiveScore: number;
    salesCount: number;
  }[];
  endorsements: {
    id: string;
    message: string;
    createdAt: string;
    sessionId: string;
    endorser: { id: string; name: string; username: string; contextCraftCertLevel: string | null } | null;
  }[];
  recentSessions: {
    id: string;
    scenarioId: string;
    kcseScore: number | null;
    certTierEarned: string | null;
    finishedAt: string | null;
  }[];
};

export function GuinProfileView({ profile, viewerCanEndorse, onEndorse }: {
  profile: GuinProfile;
  viewerCanEndorse: boolean;
  onEndorse?: () => void;
}) {
  const cert = CONTEXT_CRAFT_LEVELS[(profile.user.contextCraftCertLevel || "NONE") as ContextCraftLevel];
  const k = profile.knight;

  return (
    <div className="space-y-6">
      <div
        className="glass-card p-6 rounded-2xl border-2 relative overflow-hidden"
        style={{ borderColor: `${k.current.color}55` }}
        data-testid="card-guin-identity"
      >
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: `radial-gradient(circle at top right, ${k.current.color}, transparent 60%)` }}
        />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl border"
              style={{ backgroundColor: `${k.current.color}15`, borderColor: `${k.current.color}55` }}
            >
              {k.current.icon}
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">GUIN+ Identity</p>
              <h1 className="font-display font-bold text-2xl text-white" data-testid="text-guin-name">{profile.user.name}</h1>
              <p className="text-xs text-muted-foreground font-mono mt-0.5" data-testid="text-guin-username">@{profile.user.username}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">Knight Rank</div>
            <div className="font-display font-bold text-xl" style={{ color: k.current.color }} data-testid="text-knight-rank">
              {k.current.label}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground mt-1" data-testid="text-knight-kcse">
              {profile.stats.totalKcseEarned} KCSE earned
            </div>
          </div>
        </div>

        <div className="relative mt-5">
          {k.next ? (
            <>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                <span>{k.current.label}</span>
                <span>{Math.round(k.progress * 100)}% to {k.next.label}</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${k.progress * 100}%`, backgroundColor: k.current.color }}
                  data-testid="bar-knight-progress"
                />
              </div>
            </>
          ) : (
            <div className="text-[10px] font-mono uppercase tracking-widest text-yellow-400" data-testid="text-knight-max">
              ⚡ Max rank achieved
            </div>
          )}
        </div>

        <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link href={`/u/${profile.user.username}`} className="text-left">
            <div className="glass-card p-3 rounded-lg border border-white/5">
              <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground">Cert</div>
              <div className="font-display font-bold text-sm" style={{ color: cert.color }} data-testid="text-guin-cert">
                {cert.label}
              </div>
            </div>
          </Link>
          <div className="glass-card p-3 rounded-lg border border-white/5">
            <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground">Sessions Won</div>
            <div className="font-display font-bold text-sm text-secondary" data-testid="text-guin-wins">
              {profile.stats.sessionsWon} / {profile.stats.sessionsFinished}
            </div>
          </div>
          <div className="glass-card p-3 rounded-lg border border-white/5">
            <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground">Owned Cards</div>
            <div className="font-display font-bold text-sm text-amber-400" data-testid="text-guin-cards">
              {profile.stats.ownedCardsCount}
            </div>
          </div>
          <div className="glass-card p-3 rounded-lg border border-white/5">
            <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground">Endorsements</div>
            <div className="font-display font-bold text-sm text-purple-300" data-testid="text-guin-endorsements">
              {profile.stats.endorsementsCount}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-xl" data-testid="card-kcse-radar">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-base text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> KCSE Radar
            </h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Last 30d avg</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={profile.kcseRadar} outerRadius="75%">
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: "#A0A0A0", fontSize: 11, fontFamily: "monospace" }} />
                <PolarRadiusAxis angle={90} domain={[0, 50]} tick={{ fill: "#666", fontSize: 9 }} stroke="rgba(255,255,255,0.05)" />
                <Radar
                  dataKey="value"
                  stroke={k.current.color}
                  fill={k.current.color}
                  fillOpacity={0.35}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          {profile.stats.sessionsFinished === 0 && (
            <p className="text-center text-xs text-muted-foreground font-mono mt-2" data-testid="text-radar-empty">
              No KCSE-scored sessions yet.
            </p>
          )}
        </div>

        <div className="glass-card p-6 rounded-xl" data-testid="card-owned-cards">
          <h2 className="font-display font-bold text-base text-white uppercase tracking-wider flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-amber-400" /> Owned Cards
          </h2>
          {profile.ownedCards.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono" data-testid="text-owned-empty">
              No cards owned yet — win a CCGE Arena session to claim cards.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {profile.ownedCards.map((c) => (
                <div
                  key={c.id}
                  className="glass-card p-2.5 rounded-lg border border-white/5 hover:border-amber-400/30 transition-colors"
                  data-testid={`card-owned-${c.id}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{c.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-white truncate">{c.name}</div>
                      <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground">
                        {c.pillar} · {c.baseKcse} KCSE
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass-card p-6 rounded-xl" data-testid="card-published-spcs">
        <h2 className="font-display font-bold text-base text-white uppercase tracking-wider flex items-center gap-2 mb-3">
          <ShoppingBag className="h-4 w-4 text-primary" /> Published SPCs
        </h2>
        {profile.publishedSpcs.length === 0 ? (
          <p className="text-xs text-muted-foreground font-mono" data-testid="text-spcs-empty">
            No active SPC listings.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {profile.publishedSpcs.map((s) => (
              <Link
                key={s.id}
                href={`/marketplace/${s.id}`}
                className="block glass-card p-3 rounded-lg border border-white/5 hover:border-primary/30 transition-colors"
                data-testid={`link-published-spc-${s.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-sm text-white truncate">{s.title}</div>
                    <div className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mt-1">
                      {s.pillar} · {s.salesCount} sales
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <div className="font-display font-bold text-base text-amber-400">{s.priceCredits}</div>
                    <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground">credits</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                  <span>HIVE {Math.round(s.hiveScore)}</span>
                  <span>·</span>
                  <span>KCSE {s.kcseScore.toFixed(1)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <EndorsementsBlock
        profile={profile}
        viewerCanEndorse={viewerCanEndorse}
        onEndorse={onEndorse}
      />
    </div>
  );
}

function EndorsementsBlock({
  profile,
  viewerCanEndorse,
  onEndorse,
}: {
  profile: GuinProfile;
  viewerCanEndorse: boolean;
  onEndorse?: () => void;
}) {
  const { user: viewer } = useAuth();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open && viewer) {
      api
        .getCcgeUserSessions(viewer.id)
        .then((rows) => setSessions(rows.filter((s: any) => s.status === "finished" && s.kcseScore != null)))
        .catch(() => setSessions([]));
    }
  }, [open, viewer]);

  const submit = async () => {
    if (!viewer) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createEndorsement({
        endorserId: viewer.id,
        recipientId: profile.user.id,
        sessionId,
        message,
      });
      setSuccess(true);
      setOpen(false);
      setMessage("");
      setSessionId("");
      onEndorse?.();
      setTimeout(() => setSuccess(false), 2500);
    } catch (e: any) {
      setError(e?.message || "Failed to post endorsement.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-card p-6 rounded-xl" data-testid="card-endorsements">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <h2 className="font-display font-bold text-base text-white uppercase tracking-wider flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-purple-300" /> Endorsements
        </h2>
        {viewerCanEndorse && !open && (
          <button
            onClick={() => setOpen(true)}
            data-testid="button-open-endorse"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-[11px] uppercase tracking-wider border border-purple-300/30 bg-purple-300/10 text-purple-200 hover:bg-purple-300/20 transition-colors"
          >
            <Send className="h-3 w-3" /> Endorse
          </button>
        )}
      </div>

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 p-3 rounded-lg border border-secondary/30 bg-secondary/5 flex items-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4 text-secondary" />
          <span className="font-mono text-xs text-secondary">Endorsement posted.</span>
        </motion.div>
      )}

      {open && viewer && (
        <div className="mb-4 p-4 rounded-lg border border-purple-300/20 bg-purple-300/5 space-y-3" data-testid="form-endorse">
          <div>
            <label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground block mb-1">
              Evidence — pick a finished CCGE session of yours
            </label>
            <select
              data-testid="select-endorse-session"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-purple-300/50"
            >
              <option value="">— select session —</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.scenarioId} · KCSE {s.kcseScore?.toFixed(1)} {s.certTierEarned ? `(${s.certTierEarned})` : ""}
                </option>
              ))}
            </select>
            {sessions.length === 0 && (
              <p className="text-[10px] text-muted-foreground font-mono mt-1">
                You have no finished KCSE-scored sessions to use as evidence.
              </p>
            )}
          </div>
          <div>
            <label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground block mb-1">
              Message ({message.length}/{ENDORSEMENT_MAX_LEN})
            </label>
            <textarea
              data-testid="input-endorse-message"
              value={message}
              maxLength={ENDORSEMENT_MAX_LEN}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-purple-300/50"
              placeholder="Why do you endorse them?"
            />
          </div>
          {error && (
            <div className="p-2 rounded border border-destructive/30 bg-destructive/5 flex items-center gap-2" data-testid="text-endorse-error">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <span className="font-mono text-xs text-destructive">{error}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={submitting || !sessionId || message.length < 8}
              data-testid="button-submit-endorse"
              className="px-3 py-1.5 rounded-lg font-mono text-[11px] uppercase tracking-wider border border-purple-300/30 bg-purple-300/15 text-purple-200 hover:bg-purple-300/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Posting…" : "Post Endorsement"}
            </button>
            <button
              onClick={() => { setOpen(false); setError(null); }}
              data-testid="button-cancel-endorse"
              className="px-3 py-1.5 rounded-lg font-mono text-[11px] uppercase tracking-wider border border-white/10 text-muted-foreground hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {profile.endorsements.length === 0 ? (
        <p className="text-xs text-muted-foreground font-mono" data-testid="text-endorsements-empty">
          No endorsements yet.
        </p>
      ) : (
        <div className="space-y-3">
          {profile.endorsements.map((e) => {
            const eCert = e.endorser?.contextCraftCertLevel
              ? CONTEXT_CRAFT_LEVELS[e.endorser.contextCraftCertLevel as ContextCraftLevel]
              : null;
            return (
              <div
                key={e.id}
                className="glass-card p-3 rounded-lg border border-white/5"
                data-testid={`card-endorsement-${e.id}`}
              >
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <Link
                    href={e.endorser ? `/u/${e.endorser.username}` : "#"}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Award className="h-3.5 w-3.5 text-purple-300" />
                    <span className="font-mono text-xs text-white">{e.endorser?.name || "Unknown"}</span>
                    {eCert && (
                      <span
                        className="px-1.5 py-0.5 text-[9px] font-mono rounded"
                        style={{ color: eCert.color, border: `1px solid ${eCert.color}40`, background: `${eCert.color}10` }}
                      >
                        {eCert.label}
                      </span>
                    )}
                  </Link>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {new Date(e.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-white/85 font-mono leading-relaxed">{e.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function GuinPublicPage() {
  const [, params] = useRoute<{ username: string }>("/u/:username");
  const username = params?.username || "";
  const { user: viewer } = useAuth();
  const [profile, setProfile] = useState<GuinProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!username) return;
    setError(null);
    api
      .getGuinByUsername(username)
      .then(setProfile)
      .catch((e) => setError(e?.message || "Profile not found."));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto min-h-[50vh] flex flex-col items-center justify-center text-center">
        <ShieldCheck className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="font-mono text-sm text-muted-foreground uppercase" data-testid="text-guin-error">{error}</p>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center font-mono text-xs text-muted-foreground uppercase">
        Loading GUIN+ identity…
      </div>
    );
  }

  const viewerCert = CERT_LEVEL_RANK[(viewer?.contextCraftCertLevel || "NONE") as ContextCraftLevel];
  const targetCert = CERT_LEVEL_RANK[(profile.user.contextCraftCertLevel || "NONE") as ContextCraftLevel];
  const viewerCanEndorse =
    !!viewer &&
    viewer.id !== profile.user.id &&
    viewerCert >= targetCert;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary tracking-widest uppercase" data-testid="text-page-title">
            Public Profile
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-2">
            GUIN+ IDENTITY // {profile.user.username}
          </p>
        </div>
        {viewer?.id === profile.user.id && (
          <Link href="/profile">
            <a className="px-3 py-1.5 rounded-lg font-mono text-[11px] uppercase tracking-wider border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20" data-testid="link-edit-profile">
              Edit Profile
            </a>
          </Link>
        )}
      </div>

      <GuinProfileView profile={profile} viewerCanEndorse={viewerCanEndorse} onEndorse={load} />
    </div>
  );
}
