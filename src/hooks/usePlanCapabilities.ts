import { useMemo } from "react";
import { useSubscription } from "./useSubscription";

export interface PlanCapabilities {
  planKey: string;
  canExport: boolean;
  canMobileAnalysis: boolean;
  canComparisonAnalysis: boolean;
  canFunnelAnalysis: boolean;
  canTeamSharing: boolean;
  canApiAccess: boolean;
  canWhiteLabel: boolean;
  canGenerateVariants: boolean;
  auditLimit: number;
}

const PLAN_CAPABILITIES: Record<string, PlanCapabilities> = {
  free: {
    planKey: "free",
    canExport: false,
    canMobileAnalysis: false,
    canComparisonAnalysis: false,
    canFunnelAnalysis: false,
    canTeamSharing: false,
    canApiAccess: false,
    canWhiteLabel: false,
    canGenerateVariants: false,
    auditLimit: 10,
  },
  starter: {
    planKey: "starter",
    canExport: false,
    canMobileAnalysis: false,
    canComparisonAnalysis: false,
    canFunnelAnalysis: false,
    canTeamSharing: false,
    canApiAccess: false,
    canWhiteLabel: false,
    canGenerateVariants: false,
    auditLimit: 20,
  },
  growth: {
    planKey: "growth",
    canExport: false,
    canMobileAnalysis: true,
    canComparisonAnalysis: true,
    canFunnelAnalysis: true,
    canTeamSharing: false,
    canApiAccess: false,
    canWhiteLabel: false,
    canGenerateVariants: false,
    auditLimit: 75,
  },
  pro: {
    planKey: "pro",
    canExport: true,
    canMobileAnalysis: true,
    canComparisonAnalysis: true,
    canFunnelAnalysis: true,
    canTeamSharing: true,
    canApiAccess: true,
    canWhiteLabel: false,
    canGenerateVariants: true,
    auditLimit: 250,
  },
  agency: {
    planKey: "agency",
    canExport: true,
    canMobileAnalysis: true,
    canComparisonAnalysis: true,
    canFunnelAnalysis: true,
    canTeamSharing: true,
    canApiAccess: true,
    canWhiteLabel: true,
    canGenerateVariants: true,
    auditLimit: 800,
  },
};

export function usePlanCapabilities(): PlanCapabilities {
  const { currentPlan } = useSubscription();

  return useMemo(() => {
    const key = currentPlan.toLowerCase();
    return PLAN_CAPABILITIES[key] ?? PLAN_CAPABILITIES.free;
  }, [currentPlan]);
}

export function getUpgradeMessage(feature: string): { title: string; description: string; requiredPlan: string } {
  const messages: Record<string, { title: string; description: string; requiredPlan: string }> = {
    mobile: {
      title: "Mobile analysis requires Growth plan",
      description: "Upgrade to Growth ($79/mo) to unlock mobile + responsive previews and comparison analysis.",
      requiredPlan: "Growth",
    },
    comparison: {
      title: "Comparison mode requires Growth plan",
      description: "Upgrade to Growth ($79/mo) to compare pages side-by-side and run competitor analysis.",
      requiredPlan: "Growth",
    },
    export: {
      title: "Report exports require Pro plan",
      description: "Upgrade to Pro ($199/mo) to export reports, download assets, and get developer tokens.",
      requiredPlan: "Pro",
    },
    variants: {
      title: "Variant copy generation requires Pro plan",
      description: "Upgrade to Pro ($199/mo) to generate ready-to-test copy variants for any friction point.",
      requiredPlan: "Pro",
    },
    whitelabel: {
      title: "White-label requires Agency plan",
      description: "Upgrade to Agency ($399/mo) for white-label reports and client-ready dashboards.",
      requiredPlan: "Agency",
    },
  };
  return messages[feature] ?? messages.export;
}
