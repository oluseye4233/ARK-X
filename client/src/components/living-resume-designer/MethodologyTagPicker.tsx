import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { METHODOLOGY_VOCABULARY } from "./types";

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function MethodologyTagPicker({ tags, onChange }: Props) {
  const [custom, setCustom] = useState("");

  const toggle = (tag: string) => {
    onChange(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  };

  const addCustom = () => {
    const v = custom.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setCustom("");
  };

  return (
    <div className="space-y-3" data-testid="methodology-tag-picker">
      <div className="flex flex-wrap gap-2">
        {METHODOLOGY_VOCABULARY.map((tag) => {
          const active = tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              data-testid={`chip-tag-${tag.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              onClick={() => toggle(tag)}
              className={`px-2.5 py-1 rounded-full text-xs font-mono border transition-all ${
                active
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-white/10 text-muted-foreground hover:border-white/25"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Input
          data-testid="input-custom-tag"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add a custom tag…"
        />
        <button
          type="button"
          data-testid="button-add-custom-tag"
          onClick={addCustom}
          className="px-3 rounded-lg border border-white/10 hover:border-white/25 flex items-center"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {tags.filter((t) => !METHODOLOGY_VOCABULARY.includes(t)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags
            .filter((t) => !METHODOLOGY_VOCABULARY.includes(t))
            .map((tag) => (
              <Badge key={tag} variant="secondary" className="flex items-center gap-1" data-testid={`badge-custom-tag-${tag}`}>
                {tag}
                <button type="button" onClick={() => toggle(tag)} aria-label={`Remove ${tag}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
        </div>
      )}
    </div>
  );
}
