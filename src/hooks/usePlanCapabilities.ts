import { useMemo } from "react";
import { useSubscription } from "./useSubscription";

export interface PlanCapabilities {
  planKey: string;
  canExport: boolean;
  canMobileAnalysis: boolean;
  canComparisonAnalysis: boolean;
  canGenerateVariants: boolean;
  canExperimentWorkbench: boolean;
  canFunnelAnalysis: boolean;
  auditLimit: number;
}

const PLAN_CAPABILITIES: Record<string, PlanCapabilities> = {
  free: {
    planKey: "free",
    canExport: false,
    canMobileAnalysis: false,
    canComparisonAnalysis: false,
    canGenerateVariants: false,
    canExperimentWorkbench: false,
    canFunnelAnalysis: false,
    auditLimit: 3,
  },
  pro: {
    planKey: "pro",
    canExport: true,
    canMobileAnalysis: true,
    canComparisonAnalysis: true,
    canGenerateVariants: true,
    canExperimentWorkbench: true,
    canFunnelAnalysis: true,
    auditLimit: 250,
  },
  agency: {
    planKey: "agency",
    canExport: true,
    canMobileAnalysis: true,
    canComparisonAnalysis: true,
    canGenerateVariants: true,
    canExperimentWorkbench: true,
    canFunnelAnalysis: true,
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
      title: "Mobile analysis requires Pro plan",
      description: "Upgrade to Pro ($199/mo) to unlock mobile + responsive previews and comparison analysis.",
      requiredPlan: "Pro",
    },
    comparison: {
      title: "Comparison mode requires Pro plan",
      description: "Upgrade to Pro ($199/mo) to compare pages side-by-side and run competitor analysis.",
      requiredPlan: "Pro",
    },
    export: {
      title: "Report exports require Pro plan",
      description: "Upgrade to Pro ($199/mo) to export reports and download assets.",
      requiredPlan: "Pro",
    },
    variants: {
      title: "Variant copy generation requires Pro plan",
      description: "Upgrade to Pro ($199/mo) to generate ready-to-test copy variants for any friction point.",
      requiredPlan: "Pro",
    },
    workbench: {
      title: "Experiment Workbench requires Pro plan",
      description: "Upgrade to Pro ($199/mo) to expand hypotheses into multivariate test ideas and generate ready-to-share test briefs.",
      requiredPlan: "Pro",
    },
    funnels: {
      title: "Funnel diagnostics requires Pro plan",
      description: "Upgrade to Pro ($199/mo) to audit multi-step funnels end-to-end and find where the sequence loses buyers.",
      requiredPlan: "Pro",
    },
  };
  return messages[feature] ?? messages.export;
}
