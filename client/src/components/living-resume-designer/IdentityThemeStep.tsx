import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { THEMES, type LivingResumeDraft, type ThemeKey, fieldSource } from "./types";
import type { LivingResumePrefill } from "./types";

interface Props {
  draft: LivingResumeDraft;
  prefill: LivingResumePrefill | null;
  onChange: (patch: Partial<LivingResumeDraft>) => void;
}

function ProvenanceDot({ source }: { source: "platform" | "user" }) {
  return (
    <span
      title={source === "platform" ? "From your ARK profile" : "You entered this"}
      className={`inline-block w-1.5 h-1.5 rounded-full ml-1.5 align-middle ${
        source === "platform" ? "bg-secondary" : "bg-muted-foreground/50"
      }`}
      data-testid={`provenance-dot-${source}`}
    />
  );
}

export function IdentityThemeStep({ draft, prefill, onChange }: Props) {
  const setIdentity = (key: keyof LivingResumeDraft["identity"], value: string) =>
    onChange({ identity: { ...draft.identity, [key]: value } });

  const pf = prefill?.identity;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          Theme
        </p>
        <div className="flex flex-wrap gap-2" data-testid="theme-picker">
          {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
            const t = THEMES[key];
            const active = draft.theme === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ theme: key })}
                data-testid={`button-theme-${key}`}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                  active ? "border-white/40 bg-white/10" : "border-white/10 hover:border-white/25"
                }`}
              >
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: t.accent }}
                />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="lrd-name">
            Full Name <ProvenanceDot source={fieldSource(draft.identity.name, pf?.candidateName)} />
          </Label>
          <Input
            id="lrd-name"
            data-testid="input-identity-name"
            value={draft.identity.name}
            onChange={(e) => setIdentity("name", e.target.value)}
            placeholder="Jordan Ade"
          />
        </div>
        <div>
          <Label htmlFor="lrd-role">
            Current Role <ProvenanceDot source={fieldSource(draft.identity.role, pf?.currentRole)} />
          </Label>
          <Input
            id="lrd-role"
            data-testid="input-identity-role"
            value={draft.identity.role}
            onChange={(e) => setIdentity("role", e.target.value)}
            placeholder="Product Engineer"
          />
        </div>
        <div>
          <Label htmlFor="lrd-employer">
            Current Employer{" "}
            <ProvenanceDot source={fieldSource(draft.identity.employer, pf?.currentEmployer)} />
          </Label>
          <Input
            id="lrd-employer"
            data-testid="input-identity-employer"
            value={draft.identity.employer}
            onChange={(e) => setIdentity("employer", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="lrd-email">
            Contact Email <ProvenanceDot source={fieldSource(draft.identity.email, pf?.contactEmail)} />
          </Label>
          <Input
            id="lrd-email"
            data-testid="input-identity-email"
            value={draft.identity.email}
            onChange={(e) => setIdentity("email", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="lrd-phone">
            Phone <ProvenanceDot source={fieldSource(draft.identity.phone, pf?.contactPhone)} />
          </Label>
          <Input
            id="lrd-phone"
            data-testid="input-identity-phone"
            value={draft.identity.phone}
            onChange={(e) => setIdentity("phone", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="lrd-linkedin">
            LinkedIn <ProvenanceDot source={fieldSource(draft.identity.linkedin, pf?.linkLinkedin)} />
          </Label>
          <Input
            id="lrd-linkedin"
            data-testid="input-identity-linkedin"
            value={draft.identity.linkedin}
            onChange={(e) => setIdentity("linkedin", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="lrd-github">
            GitHub <ProvenanceDot source={fieldSource(draft.identity.github, pf?.linkGithub)} />
          </Label>
          <Input
            id="lrd-github"
            data-testid="input-identity-github"
            value={draft.identity.github}
            onChange={(e) => setIdentity("github", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="lrd-portfolio">
            Portfolio{" "}
            <ProvenanceDot source={fieldSource(draft.identity.portfolio, pf?.linkPortfolio)} />
          </Label>
          <Input
            id="lrd-portfolio"
            data-testid="input-identity-portfolio"
            value={draft.identity.portfolio}
            onChange={(e) => setIdentity("portfolio", e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="lrd-bio">Bio</Label>
        <Textarea
          id="lrd-bio"
          data-testid="textarea-identity-bio"
          rows={4}
          value={draft.identity.bio}
          onChange={(e) => setIdentity("bio", e.target.value)}
          placeholder="A short professional summary…"
        />
      </div>
    </div>
  );
}
