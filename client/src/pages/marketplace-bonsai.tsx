// M5 — Bonsai Seller Onboarding.
// 18-stage walkthrough rendered as a react-flow DAG on top + a detail panel
// below. Persisted progress via /api/sphinx/bonsai/progress.
// NO ARK/HIVE side-effects. Seller-only page (never on landing or /demo-tour).
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, Circle, Lock, Loader2, Leaf } from "lucide-react";
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BONSAI_STAGES, TOTAL_BONSAI_STAGES, type BonsaiStage } from "@shared/bonsaiStages";
import type { BonsaiProgress } from "@shared/schema";

const PHASE_COLOR: Record<BonsaiStage["phase"], { ring: string; bg: string; label: string }> = {
  Roots:    { ring: "ring-amber-400/60",   bg: "bg-amber-400/10",   label: "text-amber-300" },
  Trunk:    { ring: "ring-orange-400/60",  bg: "bg-orange-400/10",  label: "text-orange-300" },
  Branches: { ring: "ring-emerald-400/60", bg: "bg-emerald-400/10", label: "text-emerald-300" },
  Canopy:   { ring: "ring-primary/60",     bg: "bg-primary/10",     label: "text-primary" },
};

const PHASE_ORDER: BonsaiStage["phase"][] = ["Roots", "Trunk", "Branches", "Canopy"];

interface NodeData {
  stage: BonsaiStage;
  state: "completed" | "current" | "locked" | "available";
  onJump: (id: number) => void;
}

function StageNode({ data }: NodeProps<NodeData>) {
  const { stage, state, onJump } = data;
  const phase = PHASE_COLOR[stage.phase];
  const isCompleted = state === "completed";
  const isCurrent = state === "current";
  const isLocked = state === "locked";
  return (
    <div
      onClick={() => onJump(stage.id)}
      data-testid={`bonsai-node-${stage.id}`}
      className={`
        cursor-pointer rounded-lg border px-3 py-2 w-44 transition-all
        ${isCurrent ? `${phase.bg} ${phase.ring} ring-2 border-transparent shadow-[0_0_20px_rgba(34,211,238,0.35)]` : ""}
        ${isCompleted ? "bg-black/50 border-secondary/30 opacity-60" : ""}
        ${isLocked ? "bg-black/40 border-white/5 opacity-40" : ""}
        ${state === "available" ? `${phase.bg} border-white/10 hover:border-white/30` : ""}
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-white/20 !border-0 !w-2 !h-2" />
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[9px] font-mono uppercase tracking-widest ${phase.label}`}>
          {stage.phase}
        </span>
        {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-secondary" />}
        {isCurrent    && <Circle className="h-3.5 w-3.5 text-primary animate-pulse" />}
        {isLocked     && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className="font-display text-xs text-white mt-1 leading-tight">
        <span className="text-muted-foreground mr-1">#{stage.id}</span>
        {stage.title}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-white/20 !border-0 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { stage: StageNode };

function buildGraph(
  progress: BonsaiProgress | null,
  onJump: (id: number) => void,
): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const completed = new Set(progress?.completedStages ?? []);
  const currentId = progress?.currentStage ?? 1;

  // Lay out by phase column, stagger Y within column.
  const xByPhase: Record<BonsaiStage["phase"], number> = {
    Roots: 0, Trunk: 220, Branches: 440, Canopy: 660,
  };
  const phaseIdx: Record<BonsaiStage["phase"], number> = { Roots: 0, Trunk: 0, Branches: 0, Canopy: 0 };

  const nodes: Node<NodeData>[] = BONSAI_STAGES.map((s) => {
    const y = phaseIdx[s.phase]++ * 90;
    let state: NodeData["state"] = "available";
    if (completed.has(s.id))         state = "completed";
    else if (s.id === currentId)     state = "current";
    else if (s.dependencies.some((d) => !completed.has(d))) state = "locked";
    return {
      id: String(s.id),
      type: "stage",
      position: { x: xByPhase[s.phase], y },
      data: { stage: s, state, onJump },
    };
  });

  const edges: Edge[] = BONSAI_STAGES.flatMap((s) =>
    s.dependencies.map((dep) => ({
      id: `e-${dep}-${s.id}`,
      source: String(dep),
      target: String(s.id),
      animated: currentId === s.id,
      style: {
        stroke: completed.has(s.id) ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.15)",
        strokeWidth: 1.5,
      },
    })),
  );

  return { nodes, edges };
}

export function BonsaiPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [focusId, setFocusId] = useState<number | null>(null);

  const { data: progress, isLoading } = useQuery<BonsaiProgress>({
    queryKey: ["/api/sphinx/bonsai/progress"],
    queryFn: () => api.getBonsaiProgress(),
    enabled: !!user,
  });

  const completeMut = useMutation({
    mutationFn: (stageId: number) => api.completeBonsaiStage(stageId),
    onSuccess: (data) => qc.setQueryData(["/api/sphinx/bonsai/progress"], data),
  });

  const focusStage: BonsaiStage = useMemo(() => {
    const id = focusId ?? progress?.currentStage ?? 1;
    return BONSAI_STAGES.find((s) => s.id === id) ?? BONSAI_STAGES[0];
  }, [focusId, progress?.currentStage]);

  const { nodes, edges } = useMemo(
    () => buildGraph(progress ?? null, (id) => setFocusId(id)),
    [progress],
  );

  const completedCount = progress?.completedStages.length ?? 0;
  const pctComplete = Math.round((completedCount / TOTAL_BONSAI_STAGES) * 100);

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <p className="font-mono text-sm text-muted-foreground uppercase">Log in to start the Bonsai walkthrough.</p>
        <Link href="/login" className="text-primary hover:underline font-mono text-xs uppercase mt-4 inline-block">Go to login →</Link>
      </div>
    );
  }

  const focusState: NodeData["state"] = (() => {
    if (!progress) return "available";
    if (progress.completedStages.includes(focusStage.id)) return "completed";
    if (focusStage.id === progress.currentStage) return "current";
    if (focusStage.dependencies.some((d) => !progress.completedStages.includes(d))) return "locked";
    return "available";
  })();

  const canComplete = focusState === "current" || focusState === "available";

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="page-bonsai">
      <Link href="/marketplace" className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary inline-flex items-center gap-2" data-testid="link-back-from-bonsai">
        <ArrowLeft className="h-4 w-4" /> Back to marketplace
      </Link>

      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary tracking-widest uppercase flex items-center gap-3" data-testid="text-bonsai-title">
            <Leaf className="h-7 w-7 text-secondary" /> Bonsai Onboarding
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-2">
            18 STAGES · GROW A PUBLISH-READY SUPER PROMPT CARD FROM SEED TO CANOPY
          </p>
        </div>
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground" data-testid="text-bonsai-progress">
          Progress: <span className="text-white font-bold">{completedCount}/{TOTAL_BONSAI_STAGES}</span>
          {" · "}<span className="text-secondary">{pctComplete}%</span>
        </div>
      </div>

      {/* Phase legend */}
      <div className="flex flex-wrap gap-3">
        {PHASE_ORDER.map((p) => (
          <span
            key={p}
            data-testid={`phase-legend-${p.toLowerCase()}`}
            className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded border border-white/10 ${PHASE_COLOR[p].bg} ${PHASE_COLOR[p].label}`}
          >
            {p}
          </span>
        ))}
      </div>

      {/* DAG */}
      <div className="glass-card rounded-xl border border-white/10" style={{ height: 460 }}>
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
          >
            <Background gap={24} color="rgba(255,255,255,0.05)" />
            <Controls showInteractive={false} className="!bg-black/60 !border-white/10" />
          </ReactFlow>
        )}
      </div>

      {/* Stage detail panel */}
      <div className="glass-card p-6 rounded-xl border border-white/10 space-y-4" data-testid={`bonsai-detail-${focusStage.id}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className={`text-[10px] font-mono uppercase tracking-widest ${PHASE_COLOR[focusStage.phase].label}`}>
              Stage {focusStage.id} of {TOTAL_BONSAI_STAGES} · {focusStage.phase}
            </span>
            <h2 className="text-2xl font-display font-bold text-white mt-1" data-testid="text-bonsai-stage-title">
              {focusStage.title}
            </h2>
          </div>
          <div>
            {focusState === "completed" && (
              <span className="font-mono text-[11px] uppercase tracking-widest text-secondary flex items-center gap-1" data-testid="text-bonsai-stage-status">
                <CheckCircle2 className="h-4 w-4" /> Completed
              </span>
            )}
            {focusState === "current" && (
              <span className="font-mono text-[11px] uppercase tracking-widest text-primary flex items-center gap-1" data-testid="text-bonsai-stage-status">
                <Circle className="h-4 w-4 animate-pulse" /> Current
              </span>
            )}
            {focusState === "locked" && (
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1" data-testid="text-bonsai-stage-status">
                <Lock className="h-4 w-4" /> Locked
              </span>
            )}
          </div>
        </div>

        <p className="font-mono text-sm text-muted-foreground leading-relaxed">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 block mb-1">Goal</span>
          {focusStage.goal}
        </p>

        <div>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 block mb-2 font-mono">Actions</span>
          <ul className="space-y-1.5">
            {focusStage.actions.map((a, i) => (
              <li key={i} className="font-mono text-xs text-white/85 flex gap-2" data-testid={`bonsai-action-${focusStage.id}-${i}`}>
                <span className="text-secondary">▸</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>

        {focusStage.dependencies.length > 0 && (
          <div className="text-[11px] font-mono text-muted-foreground">
            Requires: {focusStage.dependencies.map((d) => `#${d}`).join(", ")}
          </div>
        )}

        {completeMut.isError && (
          <div className="text-xs font-mono text-destructive" data-testid="text-bonsai-error">
            {(completeMut.error as Error)?.message}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2 border-t border-white/5">
          <button
            disabled={!canComplete || completeMut.isPending}
            onClick={() => completeMut.mutate(focusStage.id)}
            data-testid="button-complete-stage"
            className="px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider bg-secondary/10 text-secondary border border-secondary/30 hover:bg-secondary/15 disabled:opacity-30 transition-all flex items-center gap-2"
          >
            {completeMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {focusState === "completed" ? "Already completed" : "Mark stage complete"}
          </button>
          {focusStage.id < TOTAL_BONSAI_STAGES && (
            <button
              onClick={() => setFocusId(focusStage.id + 1)}
              data-testid="button-next-stage"
              className="px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary border border-white/10 hover:border-primary/30 transition-all"
            >
              Next stage →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BonsaiPage;
