import { Link, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Network,
  Briefcase,
  Users2,
  MapPin,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ArrowUpRight,
  Gamepad2,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface RequirementResult {
  cardId: string;
  cardName: string;
  minTier: string;
  weight: number;
  roleLabel: string | null;
  status: "met" | "partial" | "missing";
  userTier: string | null;
}

interface MatchBreakdown {
  matchScore: number;
  coveragePct: number;
  jstFactorPct: number;
  archetypeFitPct: number;
  evidenceCount: number;
  totalRequirements: number;
  projectedMatchScore: number;
  requirements: RequirementResult[];
}

interface SkillGapItem {
  cardId: string;
  cardName: string;
  minTier: string;
  currentTier: string | null;
  gap: "missing" | "upgrade";
}

interface TeamRoleAssignment {
  roleLabel: string;
  requirements: { cardId: string; minTier: string; weight: number }[];
  assigned: {
    userId: string;
    name: string;
    archetype: string | null;
    coveragePct: number;
    jstIndex: number;
  } | null;
}

interface TeamFormationResult {
  txs: number;
  skillCoveragePct: number;
  diversityPct: number;
  jstDepthPct: number;
  filledRoles: number;
  totalRoles: number;
  roles: TeamRoleAssignment[];
}

interface Opportunity {
  id: string;
  type: "JOB" | "PROJECT";
  title: string;
  organization: string;
  description: string;
  location: string | null;
  remote: boolean;
  archetypePreference: string | null;
  jstFloor: number;
  status: string;
}

interface DetailResponse {
  opportunity: Opportunity;
  requirements: RequirementResult[];
  match: MatchBreakdown;
  skillGap: SkillGapItem[];
  team: TeamFormationResult | null;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-cyan-400";
  if (score >= 25) return "text-amber-400";
  return "text-rose-400";
}

function StatusIcon({ status }: { status: RequirementResult["status"] }) {
  if (status === "met") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === "partial") return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  return <XCircle className="h-4 w-4 text-rose-400" />;
}

function FactorBar({ label, value }: { label: string; value: number }) {
  return (
    <div data-testid={`factor-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}%</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}

export default function MatchmakingDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();

  const { data, isLoading } = useQuery<DetailResponse>({
    queryKey: [`/api/matchmaking/opportunities/${id}`],
  });

  const apply = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/matchmaking/opportunities/${id}/apply`, {});
      return res.json();
    },
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/matchmaking/my-applications"] });
      toast({ title: "Interest registered", description: `Match ${r?.match?.matchScore ?? ""} snapshotted.` });
    },
    onError: (e: any) => toast({ title: "Could not apply", description: String(e.message ?? e), variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading opportunity…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center text-muted-foreground" data-testid="text-not-found">
        Opportunity not found.{" "}
        <Link href="/matchmaking" className="text-cyan-400 underline">Back to exchange</Link>
      </div>
    );
  }

  const { opportunity: o, match, skillGap, team } = data;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <Link href="/matchmaking" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-cyan-400" data-testid="link-back">
        <ArrowLeft className="h-4 w-4" /> Talent Exchange
      </Link>

      {/* Header */}
      <Card className="glass-card border-cyan-500/30">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                {o.type === "PROJECT" ? <Users2 className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                {o.type}
              </Badge>
              {o.archetypePreference && <Badge variant="outline">{o.archetypePreference}</Badge>}
            </div>
            <h1 className="mt-2 text-2xl font-bold neon-text" data-testid="text-detail-title">{o.title}</h1>
            <p className="text-muted-foreground">{o.organization}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {o.remote ? "Remote" : o.location || "On-site"}</span>
              {o.jstFloor > 0 && <span>JST floor {o.jstFloor}</span>}
            </div>
          </div>
          <div className="text-center">
            <div className={`text-5xl font-bold ${scoreColor(match.matchScore)}`} data-testid="text-match-score">{match.matchScore}</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">your match</div>
            {match.projectedMatchScore > match.matchScore && (
              <div className="mt-1 flex items-center justify-center gap-1 text-xs text-emerald-400">
                <ArrowUpRight className="h-3 w-3" /> up to {match.projectedMatchScore}
              </div>
            )}
            <Button className="mt-3" onClick={() => apply.mutate()} disabled={apply.isPending} data-testid="button-apply">
              {apply.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
              I'm interested
            </Button>
          </div>
        </CardContent>
      </Card>

      {o.description && (
        <Card className="glass-card">
          <CardContent className="p-6 text-sm leading-relaxed text-muted-foreground" data-testid="text-description">{o.description}</CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Match breakdown */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-cyan-400" /> Match Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FactorBar label="Verified coverage" value={match.coveragePct} />
            <FactorBar label="JST evidence" value={match.jstFactorPct} />
            <FactorBar label="Archetype fit" value={match.archetypeFitPct} />
            <p className="pt-1 text-xs text-muted-foreground">
              {match.evidenceCount} of {match.totalRequirements} requirements fully verified. Coverage is weighted 70%,
              JST 20%, archetype 10%.
            </p>
          </CardContent>
        </Card>

        {/* Requirements */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-cyan-400" /> Requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {match.requirements.map((r) => (
              <div key={`${r.cardId}-${r.roleLabel ?? ""}`} className="flex items-center justify-between gap-2 rounded-md border border-white/10 px-3 py-2" data-testid={`req-${r.cardId}`}>
                <div className="flex items-center gap-2">
                  <StatusIcon status={r.status} />
                  <div>
                    <div className="text-sm font-medium">{r.cardName}</div>
                    {r.roleLabel && <div className="text-[10px] uppercase text-muted-foreground">{r.roleLabel}</div>}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="text-muted-foreground">needs {r.minTier}</div>
                  <div className={r.userTier ? "text-cyan-300" : "text-rose-400"}>
                    {r.userTier ? `you: ${r.userTier}` : "not verified"}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Skill gap → verify CTA */}
      {skillGap.length > 0 && (
        <Card className="glass-card border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-400" /> What to verify next
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {skillGap.map((g) => (
              <div key={g.cardId} className="flex items-center justify-between gap-2 rounded-md border border-white/10 px-3 py-2" data-testid={`gap-${g.cardId}`}>
                <div className="text-sm">
                  <span className="font-medium">{g.cardName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {g.gap === "upgrade" ? `upgrade ${g.currentTier} → ${g.minTier}` : `verify at ${g.minTier}+`}
                  </span>
                </div>
                <Badge variant="outline" className={g.gap === "upgrade" ? "text-amber-300" : "text-rose-300"}>{g.gap}</Badge>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Link href="/play">
                <Button size="sm" variant="outline" data-testid="button-go-play">
                  <Gamepad2 className="mr-2 h-4 w-4" /> Earn evidence in CCGE
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="sm" variant="outline" data-testid="button-go-verify">
                  <ShieldCheck className="mr-2 h-4 w-4" /> Verify primitives
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team formation (PROJECT only) */}
      {team && (
        <Card className="glass-card border-emerald-500/30">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Users2 className="h-4 w-4 text-emerald-400" /> Team Formation
              </span>
              <span className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${scoreColor(team.txs)}`} data-testid="text-txs">{team.txs}</span>
                <span className="text-xs text-muted-foreground">TXS</span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div data-testid="txs-coverage">
                <div className="text-lg font-semibold text-cyan-300">{team.skillCoveragePct}%</div>
                <div className="text-[10px] uppercase text-muted-foreground">skill coverage</div>
              </div>
              <div data-testid="txs-diversity">
                <div className="text-lg font-semibold text-cyan-300">{team.diversityPct}%</div>
                <div className="text-[10px] uppercase text-muted-foreground">diversity</div>
              </div>
              <div data-testid="txs-jst">
                <div className="text-lg font-semibold text-cyan-300">{team.jstDepthPct}%</div>
                <div className="text-[10px] uppercase text-muted-foreground">JST depth</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {team.filledRoles} of {team.totalRoles} roles filled from the verified candidate pool.
            </p>
            <div className="space-y-2">
              {team.roles.map((role) => (
                <div key={role.roleLabel} className="rounded-md border border-white/10 p-3" data-testid={`role-${role.roleLabel}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{role.roleLabel}</span>
                    {role.assigned ? (
                      <Badge variant="outline" className="text-emerald-300">{role.assigned.coveragePct}% fit</Badge>
                    ) : (
                      <Badge variant="outline" className="text-rose-300">unfilled</Badge>
                    )}
                  </div>
                  {role.assigned ? (
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <UserCheck className="h-3 w-3 text-emerald-400" />
                      <span className="text-foreground">{role.assigned.name}</span>
                      {role.assigned.archetype && <span>· {role.assigned.archetype}</span>}
                      <span>· JST {role.assigned.jstIndex}</span>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-rose-400/80">No verified candidate covers this role yet.</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
