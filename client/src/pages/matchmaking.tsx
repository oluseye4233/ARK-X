import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Network,
  Briefcase,
  Users2,
  MapPin,
  Loader2,
  PlusCircle,
  ArrowUpRight,
  ShieldCheck,
  X,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CODEC_PRIMITIVES } from "@shared/codec-primitives";
import { useToast } from "@/hooks/use-toast";

const TIERS = ["Bronze", "Silver", "Gold", "Platinum"] as const;
const ARCHETYPES = ["ARCHITECT", "ORCHESTRATOR", "CONDUCTOR"] as const;

interface MatchBreakdown {
  matchScore: number;
  coveragePct: number;
  jstFactorPct: number;
  archetypeFitPct: number;
  evidenceCount: number;
  totalRequirements: number;
  projectedMatchScore: number;
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

interface OpportunityRow {
  opportunity: Opportunity;
  requirementCount: number;
  match: MatchBreakdown;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-cyan-400";
  if (score >= 25) return "text-amber-400";
  return "text-rose-400";
}

function MatchRing({ score }: { score: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;
  return (
    <div className="relative h-16 w-16 shrink-0" data-testid={`ring-match-${score}`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-white/10" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className={scoreColor(score)}
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${scoreColor(score)}`}>
        {score}
      </div>
    </div>
  );
}

interface ReqDraft {
  cardId: string;
  minTier: string;
  weight: number;
  roleLabel: string;
}

function PostModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [type, setType] = useState<"JOB" | "PROJECT">("JOB");
  const [title, setTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [remote, setRemote] = useState(true);
  const [archetypePreference, setArchetypePreference] = useState<string>("none");
  const [jstFloor, setJstFloor] = useState(0);
  const [reqs, setReqs] = useState<ReqDraft[]>([
    { cardId: CODEC_PRIMITIVES[0].id, minTier: "Bronze", weight: 3, roleLabel: "" },
  ]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        type,
        title,
        organization,
        description,
        location: location || null,
        remote,
        archetypePreference: archetypePreference === "none" ? null : archetypePreference,
        jstFloor,
        requirements: reqs.map((r) => ({
          cardId: r.cardId,
          minTier: r.minTier,
          weight: r.weight,
          roleLabel: r.roleLabel.trim() || null,
        })),
      };
      const res = await apiRequest("POST", "/api/matchmaking/opportunities", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matchmaking/opportunities"] });
      toast({ title: "Opportunity posted", description: "It's now live in the exchange." });
      onClose();
    },
    onError: (e: any) => toast({ title: "Could not post", description: String(e.message ?? e), variant: "destructive" }),
  });

  const addReq = () =>
    setReqs((rs) => [...rs, { cardId: CODEC_PRIMITIVES[0].id, minTier: "Bronze", weight: 1, roleLabel: "" }]);
  const removeReq = (i: number) => setReqs((rs) => rs.filter((_, idx) => idx !== i));
  const updateReq = (i: number, patch: Partial<ReqDraft>) =>
    setReqs((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const canSubmit = title.trim().length >= 3 && organization.trim().length >= 2 && reqs.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <Card className="glass-card my-8 w-full max-w-2xl border-cyan-500/30" data-testid="modal-post-opportunity">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <PlusCircle className="h-5 w-5 text-cyan-400" /> Post an Opportunity
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-modal">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "JOB" | "PROJECT")}>
                <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="JOB">Job</SelectItem>
                  <SelectItem value="PROJECT">Project (team formation)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Archetype preference</Label>
              <Select value={archetypePreference} onValueChange={setArchetypePreference}>
                <SelectTrigger data-testid="select-archetype"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preference</SelectItem>
                  {ARCHETYPES.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Platform Engineer" data-testid="input-title" />
          </div>
          <div>
            <Label>Organization</Label>
            <Input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Helix Systems" data-testid="input-organization" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} data-testid="input-description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Remote (Global)" data-testid="input-location" />
            </div>
            <div>
              <Label>JST floor (0-300)</Label>
              <Input
                type="number"
                min={0}
                max={300}
                value={jstFloor}
                onChange={(e) => setJstFloor(Math.max(0, Math.min(300, Number(e.target.value) || 0)))}
                data-testid="input-jstfloor"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Verified-card requirements</Label>
              <Button variant="outline" size="sm" onClick={addReq} data-testid="button-add-requirement">
                <PlusCircle className="mr-1 h-3 w-3" /> Add
              </Button>
            </div>
            {reqs.map((r, i) => (
              <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-md border border-white/10 p-2" data-testid={`row-requirement-${i}`}>
                <div className="col-span-4">
                  <Label className="text-xs">Primitive</Label>
                  <Select value={r.cardId} onValueChange={(v) => updateReq(i, { cardId: v })}>
                    <SelectTrigger data-testid={`select-card-${i}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CODEC_PRIMITIVES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Tier</Label>
                  <Select value={r.minTier} onValueChange={(v) => updateReq(i, { minTier: v })}>
                    <SelectTrigger data-testid={`select-tier-${i}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIERS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Weight</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={r.weight}
                    onChange={(e) => updateReq(i, { weight: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })}
                    data-testid={`input-weight-${i}`}
                  />
                </div>
                <div className="col-span-3">
                  <Label className="text-xs">Role {type === "PROJECT" ? "" : "(opt)"}</Label>
                  <Input value={r.roleLabel} onChange={(e) => updateReq(i, { roleLabel: e.target.value })} placeholder="Lead" data-testid={`input-role-${i}`} />
                </div>
                <div className="col-span-1">
                  <Button variant="ghost" size="icon" onClick={() => removeReq(i)} disabled={reqs.length === 1} data-testid={`button-remove-req-${i}`}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {type === "PROJECT" && (
              <p className="text-xs text-muted-foreground">
                Group requirements by role label to form a team — the engine assembles one verified person per role.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} data-testid="button-cancel">Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending} data-testid="button-submit-opportunity">
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Post
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MatchmakingPage() {
  const [typeFilter, setTypeFilter] = useState<"ALL" | "JOB" | "PROJECT">("ALL");
  const [showPost, setShowPost] = useState(false);

  const { data, isLoading } = useQuery<OpportunityRow[]>({
    queryKey: ["/api/matchmaking/opportunities"],
  });

  const rows = useMemo(() => {
    const list = data ?? [];
    const filtered = typeFilter === "ALL" ? list : list.filter((r) => r.opportunity.type === typeFilter);
    return [...filtered].sort((a, b) => b.match.matchScore - a.match.matchScore);
  }, [data, typeFilter]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold neon-text" data-testid="text-page-title">
            <Network className="h-6 w-6 text-cyan-400" /> Talent Exchange
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cognitive Talent Exchange — matched purely on <span className="text-cyan-300">verified primitive cards</span>,
            JST evidence, and archetype fit. No keywords, no self-claims.
          </p>
        </div>
        <Button onClick={() => setShowPost(true)} data-testid="button-post-opportunity">
          <PlusCircle className="mr-2 h-4 w-4" /> Post Opportunity
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {(["ALL", "JOB", "PROJECT"] as const).map((t) => (
          <Button
            key={t}
            variant={typeFilter === t ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter(t)}
            data-testid={`button-filter-${t.toLowerCase()}`}
          >
            {t === "ALL" ? "All" : t === "JOB" ? "Jobs" : "Projects"}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading the exchange…
        </div>
      ) : rows.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-16 text-center text-muted-foreground" data-testid="text-empty">
            No opportunities yet. Be the first to post one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map(({ opportunity: o, requirementCount, match }) => (
            <Link key={o.id} href={`/matchmaking/${o.id}`}>
              <Card className="glass-card cursor-pointer border-white/10 transition hover:border-cyan-500/40" data-testid={`card-opportunity-${o.id}`}>
                <CardContent className="flex gap-4 p-5">
                  <MatchRing score={match.matchScore} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        {o.type === "PROJECT" ? <Users2 className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                        {o.type}
                      </Badge>
                      {o.archetypePreference && (
                        <Badge variant="outline" className="text-[10px]">{o.archetypePreference}</Badge>
                      )}
                    </div>
                    <h3 className="mt-1 truncate font-semibold" data-testid={`text-title-${o.id}`}>{o.title}</h3>
                    <p className="truncate text-sm text-muted-foreground">{o.organization}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {o.remote ? "Remote" : o.location || "On-site"}
                      </span>
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> {match.evidenceCount}/{requirementCount} verified
                      </span>
                      {o.jstFloor > 0 && <span>JST floor {o.jstFloor}</span>}
                    </div>
                    {match.projectedMatchScore > match.matchScore && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
                        <ArrowUpRight className="h-3 w-3" />
                        Up to {match.projectedMatchScore} if you verify the gaps
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {showPost && <PostModal onClose={() => setShowPost(false)} />}
    </div>
  );
}
