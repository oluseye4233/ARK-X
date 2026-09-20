import { FEATURES, type FeatureKey } from "@shared/featureFlags";

export type ClientFeatures = Readonly<Record<FeatureKey, boolean>>;

export type ClientRouteId =
  | "home" | "login" | "signup" | "upload" | "assessment" | "dashboard"
  | "pathways" | "subscription" | "checkout" | "profile" | "play"
  | "marketplacePublish" | "marketplaceBonsai" | "marketplaceDetail" | "marketplace"
  | "arkHistory" | "privacy" | "terms" | "merlin" | "enterprise" | "report"
  | "arkResume" | "contextCraft" | "school" | "marketplaceSynergy"
  | "marketplaceRoundtable" | "marketplaceSynthesis" | "marketplaceCorporate"
  | "marketplaceForgeLab" | "guinPublic" | "demo" | "demoTour" | "adminCcgeImport"
  | "book" | "workforce" | "trainingRegister" | "trainingProvider" | "training"
  | "f1000" | "matchmakingCandidates" | "matchmakingDetail" | "matchmaking"
  | "guinMatch" | "sharedReport" | "confirmInvite";

export type ClientRouteDefinition = {
  id: ClientRouteId;
  path: string;
  feature?: FeatureKey | readonly FeatureKey[];
  public?: boolean;
};

export const CLIENT_ROUTES: readonly ClientRouteDefinition[] = [
  { id: "home", path: "/" },
  { id: "login", path: "/login" },
  { id: "signup", path: "/signup" },
  { id: "upload", path: "/upload" },
  { id: "assessment", path: "/assessment" },
  { id: "dashboard", path: "/dashboard" },
  { id: "pathways", path: "/pathways" },
  { id: "subscription", path: "/subscription" },
  { id: "checkout", path: "/checkout/:id" },
  { id: "profile", path: "/profile" },
  { id: "play", path: "/play" },
  { id: "marketplacePublish", path: "/marketplace/publish" },
  { id: "marketplaceBonsai", path: "/marketplace/bonsai" },
  { id: "marketplaceDetail", path: "/marketplace/:id" },
  { id: "marketplace", path: "/marketplace" },
  { id: "arkHistory", path: "/ark/history" },
  { id: "privacy", path: "/privacy" },
  { id: "terms", path: "/terms" },
  { id: "merlin", path: "/merlin" },
  { id: "enterprise", path: "/enterprise", feature: "enterpriseDashboard" },
  { id: "report", path: "/report", feature: "executiveReport" },
  { id: "arkResume", path: "/ark-resume", feature: "arkResume" },
  { id: "contextCraft", path: "/context-craft", feature: "contextCraftPage" },
  { id: "school", path: "/school", feature: "cohorts" },
  { id: "marketplaceSynergy", path: "/marketplace/synergy", feature: "sphinxAdvanced" },
  { id: "marketplaceRoundtable", path: "/marketplace/roundtable", feature: "sphinxAdvanced" },
  { id: "marketplaceSynthesis", path: "/marketplace/synthesis", feature: "sphinxAdvanced" },
  { id: "marketplaceCorporate", path: "/marketplace/corporate", feature: "corporateMarketplace" },
  { id: "marketplaceForgeLab", path: "/marketplace/forge-lab", feature: "forgeLabDocx" },
  { id: "guinPublic", path: "/u/:username", feature: "guinPublic" },
  { id: "demo", path: "/demo", feature: "investorDemo" },
  { id: "demoTour", path: "/demo-tour", feature: "investorDemo" },
  { id: "adminCcgeImport", path: "/admin/ccge-import", feature: "adminCcgeImport" },
  { id: "book", path: "/book", feature: "bookCompanion" },
  { id: "workforce", path: "/workforce", feature: "institutionWorkforce" },
  { id: "trainingRegister", path: "/training/register", feature: "trainingProviders" },
  { id: "trainingProvider", path: "/training/p/:slug", feature: "trainingProviders" },
  { id: "training", path: "/training", feature: "trainingProviders" },
  { id: "f1000", path: "/f1000", feature: "f1000Promo" },
  { id: "matchmakingCandidates", path: "/matchmaking/:id/candidates", feature: ["matchmaking", "guinMax"] },
  { id: "matchmakingDetail", path: "/matchmaking/:id", feature: "matchmaking" },
  { id: "matchmaking", path: "/matchmaking", feature: "matchmaking" },
  { id: "guinMatch", path: "/guin-match", feature: "guinMax" },
  { id: "sharedReport", path: "/r/:token", public: true },
  { id: "confirmInvite", path: "/confirm/:token", public: true },
] as const;

function routeEnabled(route: ClientRouteDefinition, features: ClientFeatures): boolean {
  const gates: readonly FeatureKey[] = !route.feature
    ? []
    : typeof route.feature === "string"
      ? [route.feature]
      : route.feature;
  return gates.every((gate) => features[gate]);
}

export function availableClientRoutes(features: ClientFeatures = FEATURES): readonly ClientRouteDefinition[] {
  return CLIENT_ROUTES.filter((route) => routeEnabled(route, features));
}

export function routePathMatches(path: string, pattern: string): boolean {
  const pathParts = path.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  return pathParts.length === patternParts.length
    && patternParts.every((part, index) => part.startsWith(":") || part === pathParts[index]);
}

export function hasAvailableClientRoute(path: string, features: ClientFeatures = FEATURES): boolean {
  return availableClientRoutes(features).some((route) => routePathMatches(path, route.path));
}