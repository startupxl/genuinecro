import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { useSubscription } from "./useSubscription";
import { recordAnalysis, countAnalysesSince } from "@/lib/firebase/analyses";

const ANON_STORAGE_KEY = "genuinecro_anon_usage";
const ANON_RESET_KEY = "genuinecro_anon_reset";
const FREE_LIMIT_ANON = 3;

const PLAN_LIMITS: Record<string, number> = {
  free: 10,
  starter: 20,
  growth: 75,
  pro: 250,
  agency: 800,
};

interface UsageInfo {
  used: number;
  limit: number;
  canAnalyze: boolean;
  requiresAuth: boolean;
  requiresPaid: boolean;
  periodStart: string | null;
  periodEnd: string | null;
}

function getRolling30DayStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
}

export function useUsageTracking() {
  const { user } = useAuth();
  const { currentPlan, subscription } = useSubscription();
  const [usage, setUsage] = useState<UsageInfo>({
    used: 0,
    limit: FREE_LIMIT_ANON,
    canAnalyze: true,
    requiresAuth: false,
    requiresPaid: false,
    periodStart: null,
    periodEnd: null,
  });

  const getAnonUsage = useCallback((): number => {
    try {
      const resetAt = localStorage.getItem(ANON_RESET_KEY);
      if (resetAt && new Date(resetAt) <= new Date()) {
        localStorage.setItem(ANON_STORAGE_KEY, "0");
        const next = new Date();
        next.setDate(next.getDate() + 30);
        localStorage.setItem(ANON_RESET_KEY, next.toISOString());
        return 0;
      }
      if (!resetAt) {
        const next = new Date();
        next.setDate(next.getDate() + 30);
        localStorage.setItem(ANON_RESET_KEY, next.toISOString());
      }
      return parseInt(localStorage.getItem(ANON_STORAGE_KEY) || "0", 10);
    } catch {
      return 0;
    }
  }, []);

  const incrementAnonUsage = useCallback(() => {
    const current = getAnonUsage();
    localStorage.setItem(ANON_STORAGE_KEY, String(current + 1));
  }, [getAnonUsage]);

  const fetchUsage = useCallback(async () => {
    if (user) {
      const planKey = currentPlan.toLowerCase();
      const limit = PLAN_LIMITS[planKey] ?? PLAN_LIMITS.free;

      let periodStartDate: Date;
      let periodEnd: string | null = null;

      if (subscription?.current_period_start) {
        periodStartDate = new Date(subscription.current_period_start);
        periodEnd = subscription.current_period_end ?? null;
      } else {
        periodStartDate = getRolling30DayStart();
      }

      const used = await countAnalysesSince(user.uid, periodStartDate);
      setUsage({
        used,
        limit,
        canAnalyze: used < limit,
        requiresAuth: false,
        requiresPaid: used >= limit,
        periodStart: periodStartDate.toISOString(),
        periodEnd,
      });
    } else {
      const used = getAnonUsage();
      const limit = FREE_LIMIT_ANON;
      setUsage({
        used,
        limit,
        canAnalyze: used < limit,
        requiresAuth: used >= limit,
        requiresPaid: false,
        periodStart: null,
        periodEnd: null,
      });
    }
  }, [user, getAnonUsage, currentPlan, subscription]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const trackAnalysis = useCallback(async (url: string, analysisType: string, device: string, conversionScore: number) => {
    if (user) {
      await recordAnalysis({ userId: user.uid, url, analysisType, device, conversionScore });
    } else {
      incrementAnonUsage();
    }
    await fetchUsage();
  }, [user, incrementAnonUsage, fetchUsage]);

  return { usage, trackAnalysis, refreshUsage: fetchUsage };
}
