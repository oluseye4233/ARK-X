import { Link, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

type Requirement = { cardId: string; cardName: string; minTier: string; userTier: string | null; status: string };
type Candidate = {
  candidateId: string; name: string; cxs: number; currentFit: number; projectedFit: number;
  radar: Record<string, number>; evidence: { cardId: string; tier: string }[];
  requirements: Requirement[]; gaps: { cardId: string; cardName: string; requiredTier: string; currentTier: string | null; gap: string }[];
  rationale: string[];
};
type Response = { opportunity: { id: string; title: string; organization: string }; algorithmVersion: string; candidates: Candidate[] };

export default function MatchmakingCandidatesPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const query = useQuery<Response>({ queryKey: [`/api/matchmaking/opportunities/${id}/candidates`] });
  const request = useMutation({
    mutationFn: async (candidateId: string) => (await apiRequest("POST", `/api/matchmaking/opportunities/${id}/introductions`, { candidateId })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matchmaking/introductions/owner"] });
      toast({ title: "Introduction requested", description: "The candidate controls whether to accept. No contact details are disclosed." });
    },
    onError: (e: any) => toast({ title: "Unable to request introduction", description: String(e.message ?? e), variant: "destructive" }),
  });
  if (query.isLoading) return <div className="flex justify-center py-24 text-muted-foreground"><Loader2 className="mr-2 animate-spin" />Loading verified candidates…</div>;
  if (query.isError) return <div className="mx-auto max-w-3xl space-y-4 p-8" data-testid="text-error"><Link href={`/matchmaking/${id}`} className="text-cyan-400 underline">Back to opportunity</Link><Card className="glass-card border-destructive/40"><CardContent className="space-y-4 py-12 text-center"><p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Verified candidates could not be loaded."}</p><Button onClick={() => query.refetch()} data-testid="button-retry">Retry candidate review</Button></CardContent></Card></div>;
  if (!query.data) return <div className="mx-auto max-w-3xl p-8"><Link href={`/matchmaking/${id}`} className="text-cyan-400 underline">Back to opportunity</Link><p className="mt-6 text-muted-foreground">Candidate review is available only to the owner of an open opportunity.</p></div>;
  const { opportunity, candidates, algorithmVersion } = query.data;
   return <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
    <Link href={`/matchmaking/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-cyan-400"><ArrowLeft className="h-4 w-4" />Opportunity</Link>
    <div><h1 className="text-2xl font-bold neon-text">Verified candidate review</h1><p className="text-muted-foreground">{opportunity.title} · {opportunity.organization}</p><p className="mt-2 text-xs text-muted-foreground">Consent-based discovery only. CXS uses verified card evidence, JST and archetype fit; contact details and private profile data are not shown. {algorithmVersion}</p></div>
     <div className="rounded-xl border-2 border-cyan-500/40 bg-cyan-500/5 p-5" data-testid="candidates-primary-action">
       <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">Current action</p>
       <p className="mt-1 text-sm text-muted-foreground">Choose one verified candidate to request a mutual introduction.</p>
     </div>
    {!candidates.length ? <Card className="glass-card"><CardContent className="py-16 text-center text-muted-foreground">No consented, adult-attested, available candidates currently meet the discovery eligibility for this opportunity.</CardContent></Card> :
      candidates.map(c => <Card key={c.candidateId} className="glass-card border-cyan-500/20">
        <CardHeader className="flex-row items-center justify-between gap-4"><div><CardTitle>{c.name}</CardTitle><p className="text-xs text-muted-foreground">ARK verified-evidence CXS · current {c.currentFit} · projected {c.projectedFit}</p></div><div className="text-3xl font-bold text-cyan-300">{c.cxs}</div></CardHeader>
        <CardContent className="space-y-4">
           <details className="group">
             <summary className="cursor-pointer list-none text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-cyan-300"><span className="group-open:text-cyan-300">Review evidence and fit detail</span></summary>
             <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">{Object.entries(c.radar).map(([label, value]) => <div key={label}><div className="flex justify-between text-xs"><span className="capitalize text-muted-foreground">{label.replace(/([A-Z])/g, " $1")}</span><span>{value}%</span></div><Progress value={value} className="mt-1 h-2" /></div>)}</div>
          <div className="flex flex-wrap gap-2">{c.evidence.map(e => <Badge key={`${e.cardId}-${e.tier}`} variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" />{e.cardId}: {e.tier}</Badge>)}</div>
          {c.gaps.length > 0 && <p className="text-xs text-amber-300">Gaps: {c.gaps.map(g => `${g.cardName} (${g.currentTier ?? "not verified"} → ${g.requiredTier})`).join("; ")}</p>}
          <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">{c.rationale.map(x => <li key={x}>{x}</li>)}</ul>
             </div>
           </details>
          <Button size="sm" onClick={() => request.mutate(c.candidateId)} disabled={request.isPending}><UserPlus className="mr-2 h-4 w-4" />Request mutual introduction</Button>
        </CardContent>
      </Card>)}
  </div>;
}