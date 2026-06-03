import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Database, Link as LinkIcon, Loader2, Layers, Award, Globe2, Eye, EyeOff, ShieldCheck, ShieldQuestion, X, Sparkles, CheckCircle2, Paperclip, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { FEATURES } from "@shared/featureFlags";
import { FlippableCard } from "@/components/ui/flippable-card";

// ── Primitive Card Verification (Task #55) ──────────────────────────
interface VerificationRow {
  cardId: string;
  score: number;
  tier: string | null;
  status: string;
  attempts: number;
}

interface VerificationChallenge {
  id: string;
  standard: string;
  standardKey: string;
  label: string;
  skills: string[];
  instruction: string;
}

interface VerificationQuest {
  cardId: string;
  cardName: string;
  emoji: string;
  category: string;
  persona: string;
  challenges: VerificationChallenge[];
}

interface VerificationDoc {
  id: string;
  cardId: string;
  kind: "DOCUMENT" | "CERTIFICATION";
  fileName: string;
  mimeType: string;
  label: string | null;
  dataUrl: string;
}

const MAX_DOC_BYTES = 650_000; // keep base64 payload under the 1MB body limit
const ACCEPTED_DOC_TYPES = "application/pdf,image/png,image/jpeg,image/webp";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

// Tier → badge styling. Mirrors the cyberpunk palette; Platinum reads as the
// primary cyan accent so a fully-verified primitive pops.
const TIER_TONE: Record<string, string> = {
  Bronze: "bg-amber-700/20 text-amber-400 border-amber-600/40",
  Silver: "bg-slate-400/20 text-slate-200 border-slate-300/40",
  Gold: "bg-yellow-500/20 text-yellow-300 border-yellow-400/50",
  Platinum: "bg-primary/20 text-primary border-primary/50",
};

// Map CODEC categories to a short narrative shown on the back face. Keeps
// the dashboard card grounded in the JUNGLENOMICS CODEC taxonomy without
// requiring the back-end to ship extra metadata.
const CATEGORY_BLURB: Record<string, string> = {
  Animal: "Cognate Tribe primitive — defines the enterprise mindset DNA.",
  Relational: "Corporate Values primitive — anchors belief, vision and culture.",
  People: "Business Ecosystem primitive — defines tribe, allies and customers.",
  Give: "Business Systems primitive — what the enterprise produces and how.",
  Get: "Marketplace primitive — how value returns from the market.",
  Innovation: "Multiplier primitive — activates when paired with two or more identical cards.",
};

interface SkillMappings {
  onet: string[];
  sfia: string[];
  wef: string[];
}

interface JnomicsCard {
  id: string;
  name: string;
  tier: string;          // CODEC category (Animal / Relational / People / ...)
  type: string;          // Persona label
  emoji: string;
  description: string;
  basePts: number;
  // Enriched server-side from shared/codec-primitives.ts
  persona?: string;
  category?: string;
  multiplier?: string;
  insight?: string;
  mappings?: SkillMappings;
}

interface JnomicsCardListProps {
  matchedCardIds: string[];
}

export function JnomicsCardList({ matchedCardIds }: JnomicsCardListProps) {
  const [cards, setCards] = useState<JnomicsCard[]>([]);
  const [isSyncing, setIsSyncing] = useState(true);
  // "Flip all / Unflip all" — single switch lets users compare every card's
  // skill-standard mapping side-by-side without clicking each one.
  const [flipAllVersion, setFlipAllVersion] = useState(0);
  const [allFlipped, setAllFlipped] = useState(false);

  // Verification (Task #55) — only wired when the flag is on. Map of cardId →
  // banked verification, plus the card whose quest modal is open.
  const verificationEnabled = FEATURES.cardVerification;
  const [verifications, setVerifications] = useState<Record<string, VerificationRow>>({});
  const [questCardId, setQuestCardId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCards = async () => {
      setIsSyncing(true);
      try {
        const data = await api.getJnomicsCardsByIds(matchedCardIds);
        setCards(data);
      } catch {
        setCards([]);
      } finally {
        setIsSyncing(false);
      }
    };

    if (matchedCardIds.length > 0) {
      fetchCards();
    } else {
      setIsSyncing(false);
    }
  }, [matchedCardIds]);

  useEffect(() => {
    if (!verificationEnabled) return;
    api
      .getVerificationStatus()
      .then((rows: VerificationRow[]) => {
        const map: Record<string, VerificationRow> = {};
        for (const r of rows) map[r.cardId] = r;
        setVerifications(map);
      })
      .catch(() => {});
  }, [verificationEnabled]);

  const handleFlipAll = () => {
    setAllFlipped(prev => !prev);
    setFlipAllVersion(v => v + 1);
  };

  const handleVerified = (row: VerificationRow) => {
    setVerifications(prev => ({ ...prev, [row.cardId]: row }));
  };

  const questCard = cards.find(c => c.id === questCardId) ?? null;

  return (
    <div className="glass-card p-6 rounded-xl border-secondary/20" data-testid="jnomics-card-list">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h3 className="font-display font-bold text-lg text-secondary uppercase tracking-widest flex items-center gap-2">
            <Database className="w-5 h-5" />
            Junglenomics CODEC Primitives
          </h3>
          <p className="text-[11px] font-mono text-muted-foreground mt-1">
            Skills mapped to global standards · O*NET · SFIA v8 · WEF Future of Jobs
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isSyncing && cards.length > 0 && (
            <button
              type="button"
              onClick={handleFlipAll}
              data-testid="button-flip-all-cards"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-secondary/40 text-secondary hover:bg-secondary/10 text-[11px] font-mono uppercase tracking-widest transition-colors"
            >
              {allFlipped ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {allFlipped ? "Hide mappings" : "Show mappings"}
            </button>
          )}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-mono uppercase tracking-widest",
            isSyncing
              ? "border-amber-500/50 bg-amber-500/10 text-amber-500"
              : "border-secondary/50 bg-secondary/10 text-secondary"
          )}>
            {isSyncing ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Syncing…</>
            ) : (
              <><LinkIcon className="w-3 h-3" /> {cards.length} matched</>
            )}
          </div>
        </div>
      </div>

      {isSyncing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 rounded-lg border border-white/5 bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card, index) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
            >
              <FlippableCard
                key={`${card.id}-${flipAllVersion}`}
                testId={`jnomics-${card.id}`}
                minHeight="240px"
                defaultFlipped={allFlipped}
                flipLabel={`Reveal skill standard mapping for ${card.name}`}
                unflipLabel={`Hide skill standard mapping for ${card.name}`}
                faceClassName="p-4 rounded-lg border border-secondary/30 bg-background/50 hover:bg-white/5 transition-all hover:border-secondary/70 group"
                backFaceClassName="p-4 rounded-lg border border-secondary/50 bg-secondary/5"
                drm={{ contentId: card.id, contentType: "jnomics-card" }}
                front={
                  <div className="flex flex-col gap-2 h-full">
                    <div className="flex justify-between items-start mb-2 pr-9">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl" role="img" aria-label={card.type}>{card.emoji}</span>
                        <div>
                          <h4 className="font-display font-bold text-white text-sm group-hover:text-secondary transition-colors" data-testid={`text-primitive-name-${card.id}`}>{card.name}</h4>
                          <span className="text-[11px] font-mono uppercase text-muted-foreground tracking-widest">
                            {card.tier} · CODEC
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-display font-bold text-secondary">{card.basePts}</span>
                        <span className="text-[10px] font-mono text-muted-foreground block -mt-1">BASE PTS</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono uppercase text-secondary/80 tracking-widest">
                      {card.persona ?? card.type}
                    </div>
                    <div className="mt-1 text-xs font-sans text-white/85 border-t border-white/10 pt-2 flex-1">
                      {card.description}
                    </div>

                    {/* Skill-standard pills — visible without flipping */}
                    {card.mappings && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
                        {card.mappings.onet.length > 0 && (
                          <StandardPill label="O*NET" tone="bg-blue-500/15 text-blue-300 border-blue-500/30" count={card.mappings.onet.length} />
                        )}
                        {card.mappings.sfia.length > 0 && (
                          <StandardPill label="SFIA" tone="bg-emerald-500/15 text-emerald-300 border-emerald-500/30" count={card.mappings.sfia.length} />
                        )}
                        {card.mappings.wef.length > 0 && (
                          <StandardPill label="WEF" tone="bg-amber-500/15 text-amber-300 border-amber-500/30" count={card.mappings.wef.length} />
                        )}
                        {card.multiplier && (
                          <span className="ml-auto text-[10px] font-mono text-secondary/70 self-center">
                            ×{card.multiplier.replace(/^x/i, '')}
                          </span>
                        )}
                      </div>
                    )}

                    {verificationEnabled && (
                      <VerifyFooter
                        verification={verifications[card.id]}
                        onOpen={() => setQuestCardId(card.id)}
                        cardId={card.id}
                      />
                    )}
                  </div>
                }
                back={
                  <div className="flex flex-col gap-2 h-full pr-9 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <Globe2 className="h-3.5 w-3.5 text-secondary" />
                      <div className="text-[11px] font-mono uppercase tracking-widest text-secondary">
                        Global Skill Standard Mapping
                      </div>
                    </div>
                    <div className="font-display font-bold text-white text-sm leading-tight">{card.name}</div>
                    <div className="text-[11px] font-mono uppercase text-muted-foreground tracking-widest">
                      {card.tier} · {card.persona ?? card.type}
                    </div>

                    {card.mappings ? (
                      <div className="flex flex-col gap-1.5 mt-1 text-[12px] font-sans flex-1 min-h-0 overflow-y-auto">
                        <MappingRow label="O*NET" tone="text-blue-300" items={card.mappings.onet} testId={`mapping-onet-${card.id}`} />
                        <MappingRow label="SFIA" tone="text-emerald-300" items={card.mappings.sfia} testId={`mapping-sfia-${card.id}`} />
                        <MappingRow label="WEF" tone="text-amber-300" items={card.mappings.wef} testId={`mapping-wef-${card.id}`} />
                      </div>
                    ) : (
                      <p className="text-xs font-sans text-white/85 leading-relaxed flex-1">
                        {CATEGORY_BLURB[card.tier] ?? "CODEC primitive."}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-secondary/20">
                      <span className="flex items-center gap-1 text-secondary">
                        <Award className="h-3 w-3" /> {card.basePts} pts
                      </span>
                      <span className="text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        <Layers className="h-3 w-3" /> {card.id.replace(/^codec-/, "").slice(0, 14)}
                      </span>
                    </div>
                  </div>
                }
              />
            </motion.div>
          ))}
        </div>
      )}

      {verificationEnabled && questCard && (
        <VerificationModal
          cardId={questCard.id}
          cardName={questCard.name}
          emoji={questCard.emoji}
          existing={verifications[questCard.id]}
          onClose={() => setQuestCardId(null)}
          onVerified={handleVerified}
        />
      )}
    </div>
  );
}

// Front-face footer: a VERIFY action plus the banked tier badge once earned.
function VerifyFooter({
  verification,
  onOpen,
  cardId,
}: {
  verification?: VerificationRow;
  onOpen: () => void;
  cardId: string;
}) {
  const tier = verification?.tier ?? null;
  return (
    <div className="flex items-center justify-between gap-2 pt-2 mt-auto border-t border-white/5">
      {tier ? (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-widest border",
            TIER_TONE[tier] ?? "bg-white/10 text-white/80 border-white/20",
          )}
          data-testid={`badge-verified-${cardId}`}
        >
          <ShieldCheck className="h-3 w-3" /> {tier} · {verification?.score}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <ShieldQuestion className="h-3 w-3" /> Unverified
        </span>
      )}
      <button
        type="button"
        onClick={onOpen}
        data-testid={`button-verify-${cardId}`}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-primary/40 text-primary hover:bg-primary/10 text-[10px] font-mono uppercase tracking-widest transition-colors"
      >
        <ShieldCheck className="h-3 w-3" /> {tier ? "Re-verify" : "Verify"}
      </button>
    </div>
  );
}

// The Verification Quest modal: loads the quest for a primitive, collects one
// authored Context-Craft prompt per skill standard, submits, and surfaces the
// resulting tier + ARK gain.
function VerificationModal({
  cardId,
  cardName,
  emoji,
  existing,
  onClose,
  onVerified,
}: {
  cardId: string;
  cardName: string;
  emoji: string;
  existing?: VerificationRow;
  onClose: () => void;
  onVerified: (row: VerificationRow) => void;
}) {
  const [quest, setQuest] = useState<VerificationQuest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; tier: string | null; jstBoost: number; improved: boolean } | null>(null);
  const [documents, setDocuments] = useState<VerificationDoc[]>([]);
  const [docKind, setDocKind] = useState<"DOCUMENT" | "CERTIFICATION">("CERTIFICATION");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getVerificationQuest(cardId)
      .then((data: { quest: VerificationQuest; documents?: VerificationDoc[] }) => {
        if (cancelled) return;
        setQuest(data.quest);
        setDocuments(data.documents ?? []);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message ?? "Could not load this verification quest.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const handleUploadDoc = async (file: File | undefined) => {
    if (!file || uploadingDoc) return;
    setDocError(null);
    if (file.size > MAX_DOC_BYTES) {
      setDocError("File too large — please use one under ~650KB.");
      return;
    }
    setUploadingDoc(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const created = await api.addVerificationDocument(cardId, {
        kind: docKind,
        fileName: file.name,
        dataUrl,
      });
      setDocuments(docs => [created, ...docs]);
    } catch (e: any) {
      setDocError(e?.message ?? "Upload failed.");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      await api.deleteVerificationDocument(id);
      setDocuments(docs => docs.filter(d => d.id !== id));
    } catch (e: any) {
      setDocError(e?.message ?? "Could not remove document.");
    }
  };

  const challenges = quest?.challenges ?? [];
  const allAnswered =
    challenges.length > 0 && challenges.every(c => (prompts[c.id]?.trim().length ?? 0) >= 10);
  const dataPillarSatisfied = documents.length > 0;

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const submissions = challenges.map(c => ({ challengeId: c.id, prompt: prompts[c.id].trim() }));
      const res = await api.submitVerification(cardId, submissions);
      setResult({ score: res.score, tier: res.tier, jstBoost: res.jstBoost, improved: res.improved });
      onVerified({
        cardId,
        score: res.verification.score,
        tier: res.verification.tier,
        status: res.verification.status,
        attempts: res.verification.attempts,
      });
    } catch (e: any) {
      setError(e?.message ?? "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
        data-testid="modal-verification"
      >
        <motion.div
          initial={{ scale: 0.96, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 12 }}
          onClick={e => e.stopPropagation()}
          className="glass-card relative w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-xl border border-primary/30 p-6"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close verification quest"
            data-testid="button-close-verification"
            className="absolute top-3 right-3 rounded p-1 border border-white/20 bg-black/30 text-white/80 hover:bg-black/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 mb-1 pr-9">
            <span className="text-3xl" role="img" aria-label={cardName}>{emoji}</span>
            <div>
              <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> Verification Quest
              </h3>
              <p className="text-xs font-mono text-muted-foreground">{cardName}</p>
            </div>
          </div>

          {existing?.tier && !result && (
            <p className="text-[11px] font-mono text-muted-foreground mb-3">
              Current: <span className="text-primary">{existing.tier} · {existing.score}</span> · re-verify to improve your tier.
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error && !quest ? (
            <p className="text-sm text-destructive py-8" data-testid="text-verification-error">{error}</p>
          ) : result ? (
            <div className="py-6 text-center" data-testid="verification-result">
              <CheckCircle2 className="h-12 w-12 mx-auto text-secondary mb-3" />
              <div className="text-4xl font-display font-bold text-white">{result.score}<span className="text-lg text-muted-foreground">/100</span></div>
              {result.tier && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-3 py-1 mt-2 rounded-full text-xs font-mono uppercase tracking-widest border",
                    TIER_TONE[result.tier] ?? "bg-white/10 text-white/80 border-white/20",
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> {result.tier}
                </span>
              )}
              <p className="text-sm font-mono mt-4 text-muted-foreground">
                {result.improved && result.jstBoost > 0 ? (
                  <span className="text-secondary flex items-center justify-center gap-1">
                    <Sparkles className="h-4 w-4" /> +{result.jstBoost} JST · ARK rising
                  </span>
                ) : (
                  "No tier improvement — your banked tier stands."
                )}
              </p>
              <button
                type="button"
                onClick={onClose}
                data-testid="button-done-verification"
                className="mt-6 px-4 py-2 rounded-md border border-primary/40 text-primary hover:bg-primary/10 text-xs font-mono uppercase tracking-widest transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-5 mt-4">
              <p className="text-xs font-sans text-white/80 leading-relaxed">
                Author one complete Context-Craft prompt per skill standard. Each prompt should
                express all seven pillars — System, Role, Instruction, Example, Constraint, Format
                and Data — to prove you can apply this primitive in production.
              </p>

              <div className="flex flex-col gap-3 rounded-md border border-secondary/30 bg-secondary/5 p-3" data-testid="section-verification-documents">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-3.5 w-3.5 text-secondary" />
                  <span className="text-[11px] font-mono uppercase tracking-widest text-secondary">DATA-pillar evidence</span>
                </div>
                <p className="text-[11px] font-sans text-white/70 leading-relaxed">
                  Attach supporting documents or certifications (PDF / PNG / JPEG / WebP, under ~650KB).
                  Uploading at least one piece of evidence satisfies the <strong className="text-white/90">Data</strong> pillar
                  for this primitive — grounding your prompts in real artifacts and lifting your verification score.
                </p>

                {documents.length > 0 && (
                  <ul className="flex flex-col gap-1.5" data-testid="list-verification-documents">
                    {documents.map(doc => (
                      <li key={doc.id} className="flex items-center justify-between gap-2 rounded bg-background/50 border border-white/10 px-2.5 py-1.5" data-testid={`doc-${doc.id}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/30 shrink-0">
                            {doc.kind === "CERTIFICATION" ? "CERT" : "DOC"}
                          </span>
                          <a
                            href={doc.dataUrl}
                            download={doc.fileName}
                            className="text-[11px] font-mono text-white/80 hover:text-primary truncate"
                            data-testid={`link-doc-${doc.id}`}
                          >
                            {doc.fileName}
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteDoc(doc.id)}
                          data-testid={`button-delete-doc-${doc.id}`}
                          className="text-white/40 hover:text-destructive transition-colors shrink-0"
                          aria-label="Remove document"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={docKind}
                    onChange={e => setDocKind(e.target.value as "DOCUMENT" | "CERTIFICATION")}
                    data-testid="select-doc-kind"
                    className="rounded bg-background/60 border border-white/10 focus:border-primary/50 focus:outline-none px-2 py-1.5 text-[11px] font-mono text-white/90"
                  >
                    <option value="CERTIFICATION">Certification</option>
                    <option value="DOCUMENT">Document</option>
                  </select>
                  <label
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-secondary/50 text-secondary text-[11px] font-mono uppercase tracking-widest transition-colors ${uploadingDoc ? "opacity-40 cursor-not-allowed" : "hover:bg-secondary/15 cursor-pointer"}`}
                    data-testid="button-upload-doc"
                  >
                    {uploadingDoc ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</> : <><Upload className="h-3.5 w-3.5" /> Upload evidence</>}
                    <input
                      type="file"
                      accept={ACCEPTED_DOC_TYPES}
                      disabled={uploadingDoc}
                      onChange={e => { handleUploadDoc(e.target.files?.[0]); e.currentTarget.value = ""; }}
                      className="hidden"
                      data-testid="input-doc-file"
                    />
                  </label>
                  {dataPillarSatisfied && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-secondary" data-testid="status-data-pillar">
                      <ShieldCheck className="h-3 w-3" /> Data pillar satisfied
                    </span>
                  )}
                </div>
                {docError && <p className="text-[11px] text-destructive" data-testid="text-doc-error">{docError}</p>}
              </div>

              {challenges.map(ch => (
                <div key={ch.id} className="flex flex-col gap-2" data-testid={`challenge-${ch.id}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-widest text-primary">{ch.standard}</span>
                    <span className="text-[11px] font-mono text-muted-foreground">{ch.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ch.skills.map(s => (
                      <span key={s} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/70 border border-white/10">{s}</span>
                    ))}
                  </div>
                  <textarea
                    value={prompts[ch.id] ?? ""}
                    onChange={e => setPrompts(p => ({ ...p, [ch.id]: e.target.value }))}
                    rows={5}
                    maxLength={4000}
                    placeholder="Write your Context-Craft prompt here…"
                    data-testid={`input-prompt-${ch.id}`}
                    className="w-full rounded-md bg-background/60 border border-white/10 focus:border-primary/50 focus:outline-none p-3 text-sm font-mono text-white/90 resize-y"
                  />
                </div>
              ))}

              {error && <p className="text-xs text-destructive" data-testid="text-verification-error">{error}</p>}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!allAnswered || submitting}
                data-testid="button-submit-verification"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary/15 border border-primary/50 text-primary hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-mono uppercase tracking-widest transition-colors"
              >
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Scoring…</> : <><ShieldCheck className="h-4 w-4" /> Submit for verification</>}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function StandardPill({ label, tone, count }: { label: string; tone: string; count: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border",
        tone
      )}
      data-testid={`pill-${label.toLowerCase().replace(/\W+/g, '')}`}
    >
      {label}
      <span className="opacity-70">·{count}</span>
    </span>
  );
}

function MappingRow({ label, tone, items, testId }: { label: string; tone: string; items: string[]; testId: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex items-start gap-2" data-testid={testId}>
      <span className={cn("font-mono text-[11px] uppercase tracking-widest pt-0.5 shrink-0 w-12", tone)}>{label}</span>
      <span className="text-white/90 leading-snug">{items.join(" · ")}</span>
    </div>
  );
}
