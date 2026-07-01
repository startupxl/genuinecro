import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface Subscription {
  id: string;
  user_id: string;
  paypal_subscription_id: string | null;
  plan_name: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
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
      const { data, error } = await supabase.functions.invoke(
        "paypal-subscription-status"
      );
      if (error) throw error;
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
        const { data, error } = await supabase.functions.invoke(
          "paypal-create-subscription",
          {
            body: {
              plan_id: paypalPlanId,
              plan_name: planName,
              return_url: `${window.location.origin}/subscription?success=true`,
              cancel_url: `${window.location.origin}/subscription?canceled=true`,
            },
          }
        );

        if (error) throw error;

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
