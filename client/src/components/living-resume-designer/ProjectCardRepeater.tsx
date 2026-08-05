import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MAX_PROJECT_CARDS, newProjectCard, type ProjectCardDraft } from "./types";

interface Props {
  projects: ProjectCardDraft[];
  onChange: (projects: ProjectCardDraft[]) => void;
}

export function ProjectCardRepeater({ projects, onChange }: Props) {
  const update = (id: string, patch: Partial<ProjectCardDraft>) =>
    onChange(projects.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const remove = (id: string) => onChange(projects.filter((p) => p.id !== id));

  const move = (index: number, dir: -1 | 1) => {
    const next = [...projects];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-4" data-testid="project-card-repeater">
      {projects.map((p, i) => (
        <div key={p.id} className="glass-card rounded-xl border border-white/10 p-4 space-y-3" data-testid={`project-card-${i}`}>
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Project {i + 1}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" data-testid={`button-project-up-${i}`} disabled={i === 0} onClick={() => move(i, -1)}>
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" data-testid={`button-project-down-${i}`} disabled={i === projects.length - 1} onClick={() => move(i, 1)}>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" data-testid={`button-project-remove-${i}`} onClick={() => remove(p.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <Label>Name</Label>
              <Input data-testid={`input-project-name-${i}`} value={p.name} onChange={(e) => update(p.id, { name: e.target.value })} />
            </div>
            <div className="sm:col-span-1">
              <Label>Role</Label>
              <Input data-testid={`input-project-role-${i}`} value={p.role} onChange={(e) => update(p.id, { role: e.target.value })} />
            </div>
            <div className="sm:col-span-1">
              <Label>Status</Label>
              <Input data-testid={`input-project-status-${i}`} value={p.status} onChange={(e) => update(p.id, { status: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Summary</Label>
            <Input data-testid={`input-project-summary-${i}`} value={p.summary} onChange={(e) => update(p.id, { summary: e.target.value })} placeholder="One-line pitch" />
          </div>
          <div>
            <Label>Detail</Label>
            <Textarea data-testid={`textarea-project-detail-${i}`} rows={3} value={p.detail} onChange={(e) => update(p.id, { detail: e.target.value })} />
          </div>
          <div>
            <Label>Link (optional)</Label>
            <Input data-testid={`input-project-link-${i}`} value={p.link} onChange={(e) => update(p.id, { link: e.target.value })} placeholder="https://…" />
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        data-testid="button-add-project"
        disabled={projects.length >= MAX_PROJECT_CARDS}
        onClick={() => onChange([...projects, newProjectCard()])}
      >
        <Plus className="h-4 w-4 mr-1.5" />
        Add project ({projects.length}/{MAX_PROJECT_CARDS})
      </Button>
    </div>
  );
}
