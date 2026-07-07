import { useEffect } from "react";
import { Check, X, Gift, Crown, Building2, Globe2, Loader2, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { useSubscription } from "@/hooks/useSubscription";
import AppShell from "@/components/AppShell";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const PAYPAL_PLAN_IDS: Record<string, string> = {
  pro: "PAYPAL_PRO_PLAN_ID",
  agency: "PAYPAL_AGENCY_PLAN_ID",
};

interface PlanFeature {
  text: string;
  included: boolean;
}

interface PlanDef {
  key: string;
  name: string;
  price: string;
  period: string;
  bestFor: string;
  description: string;
  audits: string;
  includes: PlanFeature[];
  extras: PlanFeature[];
  highlighted: boolean;
  badge: string | null;
  cta: "subscribe" | "contact" | "default";
}

const plans: PlanDef[] = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "/mo",
    bestFor: "Trying GenuineCRO before committing",
    description: "Core conversion audit, no card required",
    audits: "3 page audits total",
    includes: [
      { text: "Web conversion friction analysis", included: true },
      { text: "Trust signal analysis", included: true },
      { text: "CTA clarity scoring", included: true },
    ],
    extras: [
      { text: "Report exports", included: false },
    ],
    highlighted: false,
    badge: null,
    cta: "default",
  },
  {
    key: "pro",
    name: "Pro",
    price: "$199",
    period: "/mo",
    bestFor: "Individual CRO practitioners running structured programs",
    description: "The full analysis suite for a single user",
    audits: "250 page audits / month",
    includes: [
      { text: "Web + Mobile + Comparison analysis", included: true },
      { text: "CRO recommendations & experiment ideas", included: true },
      { text: "Test Copy Variant Generator", included: true },
      { text: "Experiment Workbench", included: true },
    ],
    extras: [
      { text: "Exportable reports", included: true },
    ],
    highlighted: true,
    badge: "Most Popular",
    cta: "subscribe",
  },
  {
    key: "agency",
    name: "Agency",
    price: "$399",
    period: "/mo",
    bestFor: "Agencies managing multiple clients",
    description: "Scales with how many clients you manage",
    audits: "800 page audits / month",
    includes: [
      { text: "Everything in Pro", included: true },
      { text: "10 client sites included", included: true },
      { text: "Shared 800-audit pool across all your sites", included: true },
    ],
    extras: [
      { text: "$29/mo per additional site beyond 10", included: true },
    ],
    highlighted: false,
    badge: null,
    cta: "subscribe",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    bestFor: "Large agencies and platforms managing many client accounts",
    description: "Volume pricing that scales down per account",
    audits: "Custom audit volume",
    includes: [
      { text: "Everything in Agency", included: true },
      { text: "Volume discounts at 10 / 100 / 1,000+ accounts", included: true },
      { text: "Dedicated onboarding & support", included: true },
    ],
    extras: [],
    highlighted: false,
    badge: null,
    cta: "contact",
  },
];

const planIcons: Record<string, React.ReactNode> = {
  Free: <Gift className="h-4 w-4 text-primary" />,
  Pro: <Crown className="h-4 w-4 text-amber-500" />,
  Agency: <Building2 className="h-4 w-4 text-primary" />,
  Enterprise: <Globe2 className="h-4 w-4 text-primary" />,
};

const Subscription = () => {
  const { user } = useAuth();
  const { usage } = useUsageTracking();
  const { currentPlan, loading, subscribe, refresh } = useSubscription();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const usagePercent = usage.limit > 0 ? Math.round((usage.used / usage.limit) * 100) : 0;

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    if (success === "true") {
      toast.success("Subscription activated! Welcome aboard 🎉");
      refresh();
      window.history.replaceState({}, "", "/subscription");
    } else if (canceled === "true") {
      toast.info("Subscription was canceled. No charges were made.");
      window.history.replaceState({}, "", "/subscription");
    }
  }, [searchParams, refresh]);

  const handleSubscribe = (planKey: string, planName: string) => {
    const paypalPlanId = PAYPAL_PLAN_IDS[planKey];
    if (!paypalPlanId || paypalPlanId.startsWith("PAYPAL_")) {
      toast.error("PayPal Plan ID not configured yet. Please set up your PayPal plans.");
      return;
    }
    subscribe(paypalPlanId, planName.toLowerCase());
  };

  const getButtonLabel = (planName: string) => {
    if (currentPlan.toLowerCase() === planName.toLowerCase()) return "Current Plan";
    return `Get ${planName}`;
  };

  const isCurrentPlan = (planName: string) =>
    currentPlan.toLowerCase() === planName.toLowerCase();

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto w-full px-4 py-8 space-y-8">
        {/* Usage overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Usage</CardTitle>
            <CardDescription>
              {user ? `Signed in as ${user.email}` : "Sign in to unlock more audits"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Audits used</span>
              <span className="font-medium text-foreground">
                {usage.used} / {usage.limit}
              </span>
            </div>
            <Progress value={usagePercent} className="h-2" />
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">{currentPlan} Plan</Badge>
              {usage.canAnalyze ? (
                <span className="text-xs text-muted-foreground">
                  {usage.limit - usage.used} audits remaining
                </span>
              ) : (
                <span className="text-xs text-destructive">
                  Limit reached — upgrade to continue
                </span>
              )}
            </div>
            {usage.periodStart && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>
                  Billing period: {format(new Date(usage.periodStart), "MMM d, yyyy")}
                  {usage.periodEnd
                    ? ` — ${format(new Date(usage.periodEnd), "MMM d, yyyy")}`
                    : ` — ${format(new Date(new Date(usage.periodStart).getTime() + 30 * 86400000), "MMM d, yyyy")}`}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing header */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground font-display">
            Start free. Scale up as your team and clients grow.
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Only pay for how much you use — and how you share it. Payments processed securely via PayPal.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card
              key={plan.key}
              className={
                plan.highlighted
                  ? "border-primary ring-1 ring-primary/20 relative"
                  : "relative"
              }
            >
              {plan.badge && (
                <Badge className="absolute -top-2.5 left-4 text-[10px]">
                  {plan.badge}
                </Badge>
              )}
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {planIcons[plan.name]}
                  {plan.name}
                </CardTitle>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <CardDescription className="text-xs">{plan.description}</CardDescription>
                <p className="text-[11px] text-muted-foreground italic">
                  Best for: {plan.bestFor}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Badge variant="secondary" className="text-xs font-medium">
                  {plan.audits}
                </Badge>

                {/* Includes */}
                <ul className="space-y-1.5">
                  {plan.includes.map((f) => (
                    <li key={f.text} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      {f.text}
                    </li>
                  ))}
                </ul>

                {/* Extras / Limitations */}
                {plan.extras.length > 0 && (
                  <div className="pt-1 border-t border-border/40">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                      {plan.extras.some(e => e.included) ? "Extras" : "Limitations"}
                    </p>
                    <ul className="space-y-1">
                      {plan.extras.map((f) => (
                        <li
                          key={f.text}
                          className={`flex items-start gap-2 text-xs ${
                            f.included ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {f.included ? (
                            <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                          ) : (
                            <X className="h-3 w-3 text-muted-foreground/50 mt-0.5 shrink-0" />
                          )}
                          <span className={f.included ? "" : "line-through"}>{f.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {plan.cta === "contact" ? (
                  <Button className="w-full" variant="outline" onClick={() => navigate("/contact")}>
                    Contact Sales
                  </Button>
                ) : plan.cta === "default" ? (
                  <Button className="w-full" variant="outline" disabled>
                    {isCurrentPlan(plan.name) ? "Current Plan" : "Default Plan"}
                  </Button>
                ) : (
                  <>
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? "default" : "outline"}
                      disabled={isCurrentPlan(plan.name) || loading || !user}
                      onClick={() => handleSubscribe(plan.key, plan.name)}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        getButtonLabel(plan.name)
                      )}
                    </Button>
                    {!user && (
                      <p className="text-[11px] text-muted-foreground text-center">
                        Sign in to subscribe
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
};

export default Subscription;
