import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface Subscription {
  paypal_subscription_id: string | null;
  plan_name: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
}

interface AuthorizedUser {
  getIdToken: () => Promise<string>;
}

async function authorizedFetch(path: string, options: RequestInit, user: AuthorizedUser) {
  const token = await user.getIdToken();
  return fetch(path, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

export type PlanStatus = "loading" | "ready" | "error";

// Mutable so tests can shrink the delay instead of faking timers.
export const SUBSCRIPTION_RETRY = { delayMs: 3000, maxAutoRetries: 2 };

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState("Free");
  const [planStatus, setPlanStatus] = useState<PlanStatus>("loading");
  const [loading, setLoading] = useState(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptsRef = useRef(0);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setCurrentPlan("Free");
      setPlanStatus("ready");
      return;
    }

    try {
      const res = await authorizedFetch("/api/paypal/subscription-status", { method: "GET" }, user);
      if (!res.ok) throw new Error("Failed to fetch subscription status");
      const data = await res.json();
      setSubscription(data.subscription);
      setCurrentPlan(
        data.plan && data.plan !== "free"
          ? data.plan.charAt(0).toUpperCase() + data.plan.slice(1)
          : "Free"
      );
      retryAttemptsRef.current = 0;
      setPlanStatus("ready");
    } catch (err) {
      // Deliberately does NOT reset currentPlan: a transient failure must not
      // downgrade a known paying plan to "Free" (which also locks features).
      console.error("Failed to fetch subscription:", err);
      setPlanStatus("error");
      if (retryAttemptsRef.current < SUBSCRIPTION_RETRY.maxAutoRetries) {
        retryAttemptsRef.current += 1;
        retryTimerRef.current = setTimeout(fetchSubscription, SUBSCRIPTION_RETRY.delayMs);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [fetchSubscription]);

  const subscribe = useCallback(
    async (paypalPlanId: string, planName: string) => {
      if (!user) {
        toast.error("Please sign in to subscribe");
        return;
      }

      setLoading(true);
      try {
        const res = await authorizedFetch(
          "/api/paypal/create-subscription",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              plan_id: paypalPlanId,
              plan_name: planName,
              return_url: `${window.location.origin}/subscription?success=true`,
              cancel_url: `${window.location.origin}/subscription?canceled=true`,
            }),
          },
          user
        );

        if (!res.ok) throw new Error("Failed to create subscription");
        const data = await res.json();

        if (data.approve_url) {
          window.location.href = data.approve_url;
        } else {
          throw new Error("No approval URL returned from PayPal");
        }
      } catch (err: any) {
        console.error("Subscribe error:", err);
        toast.error(err.message || "Failed to create subscription");
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  return { subscription, currentPlan, planStatus, loading, subscribe, refresh: fetchSubscription };
}
