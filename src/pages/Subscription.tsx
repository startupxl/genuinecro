import { useEffect } from "react";
import { Check, X, Zap, Crown, Rocket, Building2, Loader2, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { useSubscription } from "@/hooks/useSubscription";
import AppHeader from "@/components/AppHeader";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const PAYPAL_PLAN_IDS: Record<string, string> = {
  starter: "PAYPAL_STARTER_PLAN_ID",
  growth: "PAYPAL_GROWTH_PLAN_ID",
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
}

const plans: PlanDef[] = [
  {
    key: "starter",
    name: "Starter",
    price: "$29",
    period: "/mo",
    bestFor: "Individuals getting started with CRO",
    description: "Full analysis engine, web-only",
    audits: "20 page audits / month",
    includes: [
      { text: "Web analysis only", included: true },
      { text: "Conversion friction analysis", included: true },
      { text: "Trust signal analysis", included: true },
      { text: "CTA clarity scoring", included: true },
    ],
    extras: [
      { text: "Report exports", included: false },
    ],
    highlighted: false,
    badge: null,
  },
  {
    key: "growth",
    name: "Growth",
    price: "$79",
    period: "/mo",
    bestFor: "Marketers and small teams scaling experimentation",
    description: "Unlock mobile, comparison & funnel tools",
    audits: "75 page audits / month",
    includes: [
      { text: "Web + Mobile analysis", included: true },
      { text: "Comparison analysis (page vs page)", included: true },
      { text: "Funnel analysis", included: true },
      { text: "Issue prioritization", included: true },
    ],
    extras: [
      { text: "Report exports", included: false },
    ],
    highlighted: true,
    badge: "Most Popular",
  },
  {
    key: "pro",
    name: "Pro",
    price: "$199",
    period: "/mo",
    bestFor: "Advanced teams running structured CRO programs",
    description: "Full export & team collaboration",
    audits: "250 page audits / month",
    includes: [
      { text: "Web + Mobile + Comparison analysis", included: true },
      { text: "Multi-page funnel diagnostics", included: true },
      { text: "CRO recommendations & experiment ideas", included: true },
      { text: "Team collaboration", included: true },
      { text: "API access", included: true },
    ],
    extras: [
      { text: "Exportable reports", included: true },
    ],
    highlighted: false,
    badge: null,
  },
  {
    key: "agency",
    name: "Agency",
    price: "$399",
    period: "/mo",
    bestFor: "Agencies managing multiple clients",
    description: "White-label & client-ready output",
    audits: "800 page audits / month",
    includes: [
      { text: "Web + Mobile + Comparison analysis", included: true },
      { text: "Multi-page funnel diagnostics", included: true },
      { text: "CRO recommendations", included: true },
      { text: "Client reporting dashboard", included: true },
      { text: "3 team accounts", included: true },
    ],
    extras: [
      { text: "Exportable reports", included: true },
      { text: "White-label reports", included: true },
    ],
    highlighted: false,
    badge: null,
  },
];

const planIcons: Record<string, React.ReactNode> = {
  Starter: <Zap className="h-4 w-4 text-primary" />,
  Growth: <Rocket className="h-4 w-4 text-primary" />,
  Pro: <Crown className="h-4 w-4 text-amber-500" />,
  Agency: <Building2 className="h-4 w-4 text-primary" />,
};

const Subscription = () => {
  const { user } = useAuth();
  const { usage } = useUsageTracking();
  const { currentPlan, loading, subscribe, refresh } = useSubscription();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 space-y-8">
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
          <h2 className="text-2xl font-bold text-foreground">
            All features included. No hidden limitations.
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
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Subscription;
