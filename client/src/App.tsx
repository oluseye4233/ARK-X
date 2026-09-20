import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AppLayout } from "@/components/layout/AppLayout";
import { FEATURES } from "@shared/featureFlags";
import { availableClientRoutes, type ClientRouteId } from "./routes";
import Home from "@/pages/home";
import UploadPage from "@/pages/upload";
import Dashboard from "@/pages/dashboard";
import PathwaysPage from "@/pages/pathways";
import EnterprisePage from "@/pages/enterprise";
import LoginPage from "@/pages/auth/login";
import AssessmentPage from "@/pages/assessment";
import ReportPage from "@/pages/report";
import ArkResumePage from "@/pages/ark-resume";
import ContextCraftPage from "@/pages/context-craft";
import SubscriptionPage from "@/pages/subscription";
import CheckoutPage from "@/pages/checkout";
import ProfilePage from "@/pages/profile";
import SchoolDashboard from "@/pages/school-dashboard";
import PlayPage from "@/pages/play";
import MarketplacePage from "@/pages/marketplace";
import GuinPublicPage from "@/pages/guin-public";
import ArkHistoryPage from "@/pages/ark-history";
import PrivacyPage from "@/pages/legal/privacy";
import TermsPage from "@/pages/legal/terms";
import DemoPage from "@/pages/demo";
import DemoTourPage from "@/pages/demo-tour";
import AdminCcgeImportPage from "@/pages/admin-ccge-import";
import BookCompanionPage from "@/pages/book-companion";
import WorkforcePage from "@/pages/workforce";
import SharedReportPage from "@/pages/shared-report";
import ConfirmInvitePage from "@/pages/confirm-invite";
import TrainingPage from "@/pages/training";
import TrainingProviderDetailPage from "@/pages/training-provider-detail";
import TrainingRegisterPage from "@/pages/training-register";
import F1000Page from "@/pages/f1000";
import MatchmakingPage from "@/pages/matchmaking";
import MatchmakingDetailPage from "@/pages/matchmaking-detail";
import MatchmakingCandidatesPage from "@/pages/matchmaking-candidates";
import MerlinPage from "@/pages/merlin";
import GuinMatchPage from "@/pages/guin-match";
import { SeoMetadata } from "@/components/SeoMetadata";

const routeComponents: Record<ClientRouteId, React.ComponentType<any>> = {
  home: Home, login: LoginPage, signup: LoginPage, upload: UploadPage,
  assessment: AssessmentPage, dashboard: Dashboard, pathways: PathwaysPage,
  subscription: SubscriptionPage, checkout: CheckoutPage, profile: ProfilePage,
  play: PlayPage, marketplacePublish: MarketplacePage, marketplaceBonsai: MarketplacePage,
  marketplaceDetail: MarketplacePage, marketplace: MarketplacePage, arkHistory: ArkHistoryPage,
  privacy: PrivacyPage, terms: TermsPage, merlin: MerlinPage, enterprise: EnterprisePage,
  report: ReportPage, arkResume: ArkResumePage, contextCraft: ContextCraftPage,
  school: SchoolDashboard, marketplaceSynergy: MarketplacePage,
  marketplaceRoundtable: MarketplacePage, marketplaceSynthesis: MarketplacePage,
  marketplaceCorporate: MarketplacePage, marketplaceForgeLab: MarketplacePage,
  guinPublic: GuinPublicPage, demo: DemoPage, demoTour: DemoTourPage,
  adminCcgeImport: AdminCcgeImportPage, book: BookCompanionPage, workforce: WorkforcePage,
  trainingRegister: TrainingRegisterPage, trainingProvider: TrainingProviderDetailPage,
  training: TrainingPage, f1000: F1000Page, matchmakingCandidates: MatchmakingCandidatesPage,
  matchmakingDetail: MatchmakingDetailPage, matchmaking: MatchmakingPage,
  guinMatch: GuinMatchPage, sharedReport: SharedReportPage, confirmInvite: ConfirmInvitePage,
};

const appRoutes = availableClientRoutes(FEATURES).filter((route) => !route.public);
const publicRoutes = availableClientRoutes(FEATURES).filter((route) => route.public);

function Router() {
  return (
    <AppLayout>
      <Switch>
        {appRoutes.map((route) => (
          <Route key={route.id} path={route.path} component={routeComponents[route.id]} />
        ))}

        {/* Fallback to 404 */}
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SeoMetadata />
          <Toaster />
          <Switch>
            {/* Public, no-login shared ARK Report — rendered OUTSIDE app chrome. */}
            {publicRoutes.map((route) => (
              <Route key={route.id} path={route.path} component={routeComponents[route.id]} />
            ))}
            <Route component={Router} />
          </Switch>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
