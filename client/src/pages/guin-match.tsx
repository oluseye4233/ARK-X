import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/useAuth";

const TIERS = ["Bronze", "Silver", "Gold", "Platinum"];
export default function GuinMatchPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [needs, setNeeds] = useState("");
  const [region, setRegion] = useState("");
  const [language, setLanguage] = useState("");
  const profile = useQuery({ queryKey: ["guin-max-profile"], queryFn: api.getGuinMaxProfile });
  const inbox = useQuery({ queryKey: ["guin-max-requests"], queryFn: api.getGuinMaxRequests });
  const save = useMutation({ mutationFn: api.updateGuinMaxProfile, onSuccess: () => qc.invalidateQueries({ queryKey: ["guin-max-profile"] }) });
  const discover = useMutation({ mutationFn: api.discoverGuinMax });
  const p = profile.data;
  const search = { needs: needs.split(",").map(cardId => cardId.trim()).filter(Boolean).map(cardId => ({ cardId, minTier: "Bronze" })), region: region || null, language: language || null };
  if (profile.isLoading) return <p className="font-mono">Loading GUIN MAX…</p>;
  return <div className="max-w-5xl mx-auto space-y-6">
    <header><p className="font-mono text-primary text-xs tracking-widest">ARK-NATIVE · EVIDENCE ONLY</p><h1 className="text-3xl font-display font-bold">GUIN MAX Mentor Discovery</h1><p className="text-muted-foreground mt-2">No contact details are shown. Matches use verified cards, current CCMI, JST, and A/O/C complement.</p></header>
    <Card><CardHeader><CardTitle>Discovery consent</CardTitle></CardHeader><CardContent className="space-y-4">
      <label className="flex gap-2 items-center"><Checkbox checked={!!p?.discoveryOptIn} onCheckedChange={v => save.mutate({ ...p, discoveryOptIn: v === true })} /> I opt in to mentor discovery</label>
      <label className="flex gap-2 items-center"><Checkbox checked={!!p?.adultAttested} onCheckedChange={v => save.mutate({ ...p, adultAttested: v === true })} /> I attest that I am an adult</label>
      <label className="flex gap-2 items-center"><Checkbox checked={!!p?.available} onCheckedChange={v => save.mutate({ ...p, available: v === true })} /> I am currently available</label>
      <div className="flex flex-wrap gap-2">{TIERS.map(t => <Button key={t} variant={p?.selectedTier === t ? "default" : "outline"} size="sm" onClick={() => save.mutate({ ...p, selectedTier: t })}>{t}</Button>)}</div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Find mentors</CardTitle></CardHeader><CardContent className="space-y-3">
      <Input value={needs} onChange={e => setNeeds(e.target.value)} placeholder="Verified card IDs needed, comma-separated" aria-label="Verified card needs" />
      <div className="grid sm:grid-cols-2 gap-3"><Input value={region} onChange={e => setRegion(e.target.value)} placeholder="Optional region" /><Input value={language} onChange={e => setLanguage(e.target.value)} placeholder="Optional language" /></div>
      <Button onClick={() => discover.mutate(search)} disabled={discover.isPending}>Discover evidence-based mentors</Button>
      {discover.data?.reason && <p className="text-muted-foreground">{discover.data.reason}</p>}
      <div className="grid md:grid-cols-2 gap-3">{discover.data?.matches?.map((m: any) => <Card key={m.userId}><CardContent className="pt-5 space-y-2"><div className="flex justify-between font-semibold"><span>{m.name}</span><span>{m.cxs} CXS</span></div><p className="text-sm">{m.rationale?.join(" ")}</p><p className="text-xs text-muted-foreground">Radar: needs {m.radar.needCoverage} · CCMI {m.radar.ccmiAffinity} · JST {m.radar.jstReadiness} · A/O/C {m.radar.archetypeComplement}</p><p className="text-xs">Verified evidence: {m.evidence.map((e: any) => `${e.cardId} (${e.tier})`).join(", ") || "None"}</p><Button size="sm" onClick={() => api.createGuinMaxRequest({ candidateId: m.userId, search }).then(() => qc.invalidateQueries({ queryKey: ["guin-max-requests"] }))}>Send request</Button></CardContent></Card>)}</div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Requests</CardTitle></CardHeader><CardContent className="space-y-2">{inbox.data?.map((r: any) => <div key={r.id} className="flex flex-wrap gap-2 items-center justify-between border-b py-2"><span className="font-mono text-xs">{r.status} · {r.cxs} CXS</span>{r.status === "PENDING" && <span className="flex gap-2">{r.candidateId === user?.id && <><Button size="sm" variant="outline" onClick={() => api.actOnGuinMaxRequest(r.id, "accept").then(() => qc.invalidateQueries({ queryKey: ["guin-max-requests"] }))}>Accept</Button><Button size="sm" variant="outline" onClick={() => api.actOnGuinMaxRequest(r.id, "decline").then(() => qc.invalidateQueries({ queryKey: ["guin-max-requests"] }))}>Decline</Button></>}{r.requesterId === user?.id && <Button size="sm" variant="outline" onClick={() => api.actOnGuinMaxRequest(r.id, "cancel").then(() => qc.invalidateQueries({ queryKey: ["guin-max-requests"] }))}>Cancel</Button>}</span>}</div>)}</CardContent></Card>
  </div>;
}