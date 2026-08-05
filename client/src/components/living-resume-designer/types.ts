// Shared wizard state for the Living Resume Designer (JNGL-PDD-ARKH-LRD-2026-001).
// Per the PDD (LRD-101: "Client-side state only, no save-to-server yet") this
// entire draft lives in React state + localStorage — nothing here is persisted
// server-side. Server reads only feed the initial prefill (identity/bio, ARK
// Score, SPC listings) via GET /api/living-resume/prefill.

export const MAX_PROJECT_CARDS = 8;
export const MAX_AI_APPS = 4;

export const THEMES = {
  "navy-gold": { label: "Junglenomics Navy/Gold", accent: "#D4AF37", bg: "#0B1220", panel: "#111B2E", ink: "#F5F0E6", sub: "#9AA7BD" },
  "slate-teal": { label: "Slate / Teal", accent: "#2DD4BF", bg: "#0F172A", panel: "#1E293B", ink: "#F1F5F9", sub: "#94A3B8" },
  "ink-rose": { label: "Ink / Rose", accent: "#FB7185", bg: "#18181B", panel: "#27272A", ink: "#FAFAFA", sub: "#A1A1AA" },
} as const;
export type ThemeKey = keyof typeof THEMES;

export interface ProjectCardDraft {
  id: string;
  name: string;
  role: string;
  status: string;
  summary: string;
  detail: string;
  link: string;
}

export interface AiAppDraft {
  id: string;
  name: string;
  pitch: string;
  stack: string;
  url: string;
  testDemoSrcdoc: string;
}

export interface VideoIntroDraft {
  url: string;
  videoId: string;
  thumbnailDataUrl: string | null;
}

export interface IdentityDraft {
  name: string;
  role: string;
  employer: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  portfolio: string;
  bio: string;
}

export interface LivingResumeDraft {
  theme: ThemeKey;
  identity: IdentityDraft;
  headshotDataUrl: string | null;
  headshotAlt: string;
  projects: ProjectCardDraft[];
  tags: string[];
  aiApps: AiAppDraft[];
  video: VideoIntroDraft | null;
  showSpcPanel: boolean;
  showArkScoreBadge: boolean;
}

export const EMPTY_IDENTITY: IdentityDraft = {
  name: "",
  role: "",
  employer: "",
  email: "",
  phone: "",
  linkedin: "",
  github: "",
  portfolio: "",
  bio: "",
};

export const EMPTY_DRAFT: LivingResumeDraft = {
  theme: "navy-gold",
  identity: EMPTY_IDENTITY,
  headshotDataUrl: null,
  headshotAlt: "",
  projects: [],
  tags: [],
  aiApps: [],
  video: null,
  showSpcPanel: false,
  showArkScoreBadge: false,
};

export const METHODOLOGY_VOCABULARY = [
  "Atomic Prompt",
  "SPC",
  "PDD",
  "FORGE",
  "JCSE",
  "GRO",
  "ZPOS+5",
  "SAVANT",
  "Camelot",
  "SPARTAN",
  "VIBE DJ",
  "Honesty Gate",
  "ATLAS",
  "ADA ULTRA SI",
];

export interface LivingResumeSpcListing {
  id: string;
  title: string;
  pillar: string;
  priceCredits: number;
  kcseScore: number | null;
  hiveScore: number | null;
  salesCount: number;
}

export interface LivingResumePrefill {
  identity: {
    candidateName: string | null;
    currentRole: string | null;
    currentEmployer: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    linkLinkedin: string | null;
    linkGithub: string | null;
    linkPortfolio: string | null;
  };
  workHistory: unknown[];
  headshotDataUrl: string | null;
  arkScore: {
    total: number;
    jstIndex: number;
    ccmiTier: string | null;
    typology: string | null;
    arkIdString: string | null;
  };
  isProPlus: boolean;
  spcListings: LivingResumeSpcListing[];
}

export function newProjectCard(): ProjectCardDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    role: "",
    status: "In progress",
    summary: "",
    detail: "",
    link: "",
  };
}

export function newAiApp(): AiAppDraft {
  return { id: crypto.randomUUID(), name: "", pitch: "", stack: "", url: "", testDemoSrcdoc: "" };
}

// Field provenance (Honesty Gate, LRD-403): a field is "platform" sourced only
// if it still exactly matches what the prefill returned and is non-empty;
// any edit — or a field the platform never supplied — is "user" sourced.
export function fieldSource(current: string, prefillValue: string | null | undefined): "platform" | "user" {
  if (prefillValue && current === prefillValue) return "platform";
  return "user";
}
