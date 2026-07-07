import { Link } from "react-router-dom";
import AppShell from "@/components/AppShell";

const PrivacyPolicy = () => {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        <h1 className="text-xl font-semibold text-foreground font-display">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground">Last updated: March 22, 2026</p>

        <div className="prose prose-sm text-foreground space-y-4">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Information We Collect</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We collect information you provide directly, such as your name, email address, and profile details when you create an account. We also collect usage data including URLs analyzed, device type selections, and analysis preferences.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. How We Use Your Information</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use your information to provide and improve our CRO analysis services, personalize your experience, process transactions, send service-related communications, and maintain the security of our platform.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Data Storage & Security</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All data is transmitted over HTTPS and stored with row-level security. We do not permanently store the content of analyzed pages — only the URL and analysis metadata (page type, device, timestamp) are retained for your analysis history.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Cookies & Tracking</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use essential cookies for authentication and session management. We may use analytics cookies to understand usage patterns and improve our services. You can control cookie preferences through your browser settings.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Third-Party Services</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use third-party services for authentication, data storage, and AI-powered analysis. These services have their own privacy policies and we encourage you to review them.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Your Rights</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You have the right to access, correct, or delete your personal data. You may also request a copy of your data or ask us to restrict processing. <Link to="/contact" className="text-primary hover:underline">Contact us</Link> for any data-related requests.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">7. Changes to This Policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
};

export default PrivacyPolicy;
