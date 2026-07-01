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
import BulkAnalysis from "./pages/BulkAnalysis.tsx";
import NotFound from "./pages/NotFound.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import DashboardLayout from "@/components/DashboardLayout";
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
            <Route path="/bulk" element={<BulkAnalysis />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/technical" element={<DashboardLayout><ComingSoon title="Technical" /></DashboardLayout>} />
            <Route path="/content" element={<DashboardLayout><ComingSoon title="Content" /></DashboardLayout>} />
            <Route path="/monitoring" element={<DashboardLayout><ComingSoon title="Monitoring" /></DashboardLayout>} />
            <Route path="/competitor-analysis" element={<DashboardLayout><ComingSoon title="Analysis" /></DashboardLayout>} />
            <Route path="/action-center" element={<DashboardLayout><ComingSoon title="Action Center" /></DashboardLayout>} />
            <Route path="/reports" element={<DashboardLayout><ComingSoon title="Reports" /></DashboardLayout>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
