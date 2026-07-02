import AppShell from "@/components/AppShell";

const DeliveryPolicy = () => {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        <h1 className="text-xl font-semibold text-foreground font-display">Delivery Policy</h1>
        <p className="text-xs text-muted-foreground">Last updated: March 22, 2026</p>

        <div className="space-y-4">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Service Delivery</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              GenuineCRO is a digital service delivered entirely online. Upon submitting a URL for analysis, results are generated and delivered in real-time within the application. No physical goods are shipped.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Analysis Delivery Time</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Standard analyses are typically completed within 30–90 seconds depending on page complexity and server load. In rare cases, analyses may take up to 5 minutes during peak usage periods.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Account Activation</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Free accounts are activated immediately upon email verification. Paid plan features are activated instantly upon successful payment processing.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Export & Report Delivery</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              PDF reports and data exports (available on Pro and Team plans) are generated on-demand and delivered as downloadable files within the application. Reports are typically ready within seconds of request.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Service Availability</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We strive to maintain 99.9% uptime for our services. Scheduled maintenance windows will be communicated in advance via email and in-app notifications. Unscheduled downtime will be addressed as quickly as possible.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Failed Analyses</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If an analysis fails due to a system error, it will not count against your usage limit. You may retry the analysis at no additional cost. If issues persist, contact support for assistance.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
};

export default DeliveryPolicy;
