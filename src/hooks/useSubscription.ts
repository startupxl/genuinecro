import { useState, useEffect, useCallback } from "react";
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

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState("Free");
  const [loading, setLoading] = useState(false);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setCurrentPlan("Free");
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
    } catch (err) {
      console.error("Failed to fetch subscription:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
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

  return { subscription, currentPlan, loading, subscribe, refresh: fetchSubscription };
}
