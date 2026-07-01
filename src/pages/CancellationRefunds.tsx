import AppHeader from "@/components/AppHeader";
import { useNavigate } from "react-router-dom";

const CancellationRefunds = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Cancellation & Refunds</h1>
        <p className="text-xs text-muted-foreground">Last updated: March 22, 2026</p>

        <div className="space-y-4">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Cancellation Policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You may cancel your subscription at any time from the Subscription page in your account. Upon cancellation, your plan will remain active until the end of the current billing period, after which it will revert to the free tier.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. How to Cancel</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To cancel your subscription, navigate to Account → Subscription and click "Cancel Plan." You will receive a confirmation email. Your access to paid features will continue until the end of your billing cycle.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Refund Policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We offer a full refund within the first 7 days of your initial subscription purchase if you are not satisfied with the service. Refund requests after 7 days will be reviewed on a case-by-case basis.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. How to Request a Refund</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To request a refund, contact us at experiments@genuinecro.com with your account email and reason for the refund. We aim to process all refund requests within 5–7 business days.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Non-Refundable Items</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Analyses already consumed during your billing period are non-refundable. Partial-month refunds are not provided for mid-cycle cancellations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Plan Changes</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you upgrade your plan, the new pricing takes effect immediately with a prorated charge. If you downgrade, the change takes effect at the start of your next billing cycle.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default CancellationRefunds;
