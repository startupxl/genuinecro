import AppHeader from "@/components/AppHeader";
import { useNavigate } from "react-router-dom";

const TermsConditions = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Terms & Conditions</h1>
        <p className="text-xs text-muted-foreground">Last updated: March 22, 2026</p>

        <div className="space-y-4">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By accessing or using GenuineCRO, you agree to be bound by these Terms & Conditions. If you do not agree, please do not use our services.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Description of Service</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              GenuineCRO is an AI-powered conversion rate optimization tool that analyzes web pages to identify friction points, UX issues, and conversion barriers. Results are generated using AI models and industry benchmarks and should be used as guidance, not as definitive assessments.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. User Accounts</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate information and to update it as necessary. You must notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Usage Limits & Plans</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Free accounts are limited to a set number of analyses per month. Paid plans offer increased or unlimited usage. We reserve the right to modify plan features and pricing with reasonable notice.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Acceptable Use</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You agree not to use GenuineCRO for any unlawful purpose, to analyze pages you do not have authorization to evaluate, to attempt to reverse-engineer the service, or to overload our systems with automated requests beyond your plan limits.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Intellectual Property</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All content, features, and functionality of GenuineCRO are owned by us and are protected by intellectual property laws. Analysis results generated for you may be used freely in your own projects.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">7. Limitation of Liability</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              GenuineCRO is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the service, including but not limited to lost revenue, data loss, or business interruption.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">8. Governing Law</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              These terms shall be governed by and construed in accordance with applicable laws. Any disputes shall be resolved through binding arbitration or in the courts of the applicable jurisdiction.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default TermsConditions;
