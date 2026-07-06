import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Subscription from "./pages/Subscription.tsx";
import Account from "./pages/Account.tsx";
import HelpCenter from "./pages/HelpCenter.tsx";
import Settings from "./pages/Settings.tsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.tsx";
import TermsConditions from "./pages/TermsConditions.tsx";
import CancellationRefunds from "./pages/CancellationRefunds.tsx";
import DeliveryPolicy from "./pages/DeliveryPolicy.tsx";
import ContactUs from "./pages/ContactUs.tsx";
import NotFound from "./pages/NotFound.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Audits from "./pages/Audits.tsx";
import ScanDetail from "./pages/ScanDetail.tsx";
import SiteDetail from "./pages/SiteDetail.tsx";
import ActionCenter from "./pages/ActionCenter.tsx";
import Technical from "./pages/Technical.tsx";
import MessageMatchChecker from "./pages/MessageMatchChecker.tsx";
import CompetitorComparison from "./pages/CompetitorComparison.tsx";
import FreeTools from "./pages/tools/FreeTools.tsx";
import SampleSizeCalculator from "./pages/tools/SampleSizeCalculator.tsx";
import SignificanceCalculator from "./pages/tools/SignificanceCalculator.tsx";
import AATestChecker from "./pages/tools/AATestChecker.tsx";
import Workbench from "./pages/workbench/Workbench.tsx";
import MultivariateIdeaExpander from "./pages/workbench/MultivariateIdeaExpander.tsx";
import TestBriefWriter from "./pages/workbench/TestBriefWriter.tsx";
import AppShell from "@/components/AppShell";
import ComingSoon from "@/components/ComingSoon";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/account" element={<Account />} />
            <Route path="/help" element={<HelpCenter />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsConditions />} />
            <Route path="/cancellation" element={<CancellationRefunds />} />
            <Route path="/delivery" element={<DeliveryPolicy />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/audits" element={<Audits />} />
            <Route path="/audits/:id" element={<ScanDetail />} />
            <Route path="/sites/:domain" element={<SiteDetail />} />
            <Route path="/technical" element={<Technical />} />
            <Route path="/message-match" element={<MessageMatchChecker />} />
            <Route path="/content" element={<AppShell><ComingSoon title="Content" /></AppShell>} />
            <Route path="/monitoring" element={<AppShell><ComingSoon title="Monitoring" /></AppShell>} />
            <Route path="/competitor-analysis" element={<CompetitorComparison />} />
            <Route path="/free-cro-tools" element={<FreeTools />} />
            <Route path="/free-cro-tools/sample-size-calculator" element={<SampleSizeCalculator />} />
            <Route path="/free-cro-tools/significance-calculator" element={<SignificanceCalculator />} />
            <Route path="/free-cro-tools/aa-test-checker" element={<AATestChecker />} />
            <Route path="/workbench" element={<Workbench />} />
            <Route path="/workbench/multivariate-idea-expander" element={<MultivariateIdeaExpander />} />
            <Route path="/workbench/test-brief-writer" element={<TestBriefWriter />} />
            <Route path="/action-center" element={<ActionCenter />} />
            <Route path="/reports" element={<AppShell><ComingSoon title="Reports" /></AppShell>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
