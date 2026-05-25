import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AppLayout } from "@/components/layout/AppLayout";
import Home from "@/pages/home";
import UploadPage from "@/pages/upload";
import Dashboard from "@/pages/dashboard";
import PathwaysPage from "@/pages/pathways";
import EnterprisePage from "@/pages/enterprise";
import LoginPage from "@/pages/auth/login";
import AssessmentPage from "@/pages/assessment";
import ReportPage from "@/pages/report";
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

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={LoginPage} />
        <Route path="/upload" component={UploadPage} />
        <Route path="/assessment" component={AssessmentPage} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/pathways" component={PathwaysPage} />
        <Route path="/enterprise" component={EnterprisePage} />
        <Route path="/report" component={ReportPage} />
        <Route path="/context-craft" component={ContextCraftPage} />
        <Route path="/subscription" component={SubscriptionPage} />
        <Route path="/checkout/:id" component={CheckoutPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/school" component={SchoolDashboard} />
        <Route path="/play" component={PlayPage} />
        <Route path="/marketplace/publish" component={MarketplacePage} />
        <Route path="/marketplace/:id" component={MarketplacePage} />
        <Route path="/marketplace" component={MarketplacePage} />
        <Route path="/ark/history" component={ArkHistoryPage} />
        <Route path="/u/:username" component={GuinPublicPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/demo" component={DemoPage} />
        <Route path="/demo-tour" component={DemoTourPage} />
        <Route path="/admin/ccge-import" component={AdminCcgeImportPage} />
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
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;