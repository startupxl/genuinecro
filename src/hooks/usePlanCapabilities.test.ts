import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

let mockPlan = "free";
vi.mock("./useSubscription", () => ({
  useSubscription: () => ({ currentPlan: mockPlan, subscription: null }),
}));

import { usePlanCapabilities, getUpgradeMessage } from "./usePlanCapabilities";

describe("usePlanCapabilities", () => {
  it("gives the free plan a 3-audit limit and no gated features", () => {
    mockPlan = "free";
    const { result } = renderHook(() => usePlanCapabilities());
    expect(result.current.auditLimit).toBe(3);
    expect(result.current.canMobileAnalysis).toBe(false);
    expect(result.current.canComparisonAnalysis).toBe(false);
    expect(result.current.canExport).toBe(false);
    expect(result.current.canGenerateVariants).toBe(false);
    expect(result.current.canExperimentWorkbench).toBe(false);
    expect(result.current.canFunnelAnalysis).toBe(false);
  });

  it("enables mobile, comparison, export, variants, workbench, and funnels on pro and agency plans", () => {
    for (const plan of ["pro", "agency"]) {
      mockPlan = plan;
      const { result } = renderHook(() => usePlanCapabilities());
      expect(result.current.canMobileAnalysis).toBe(true);
      expect(result.current.canComparisonAnalysis).toBe(true);
      expect(result.current.canExport).toBe(true);
      expect(result.current.canGenerateVariants).toBe(true);
      expect(result.current.canExperimentWorkbench).toBe(true);
      expect(result.current.canFunnelAnalysis).toBe(true);
    }
  });

  it("gives pro a 250 audit limit and agency an 800 audit limit", () => {
    mockPlan = "pro";
    expect(renderHook(() => usePlanCapabilities()).result.current.auditLimit).toBe(250);

    mockPlan = "agency";
    expect(renderHook(() => usePlanCapabilities()).result.current.auditLimit).toBe(800);
  });

  it("falls back to free capabilities for an unrecognized or enterprise plan (custom-provisioned, not self-serve)", () => {
    mockPlan = "enterprise";
    const { result } = renderHook(() => usePlanCapabilities());
    expect(result.current.planKey).toBe("free");
  });
});

describe("getUpgradeMessage", () => {
  it("returns a dedicated message for the 'variants' feature", () => {
    const msg = getUpgradeMessage("variants");
    expect(msg.requiredPlan).toBe("Pro");
    expect(msg.title.toLowerCase()).toContain("variant");
  });

  it("returns a dedicated message for the 'workbench' feature", () => {
    const msg = getUpgradeMessage("workbench");
    expect(msg.requiredPlan).toBe("Pro");
    expect(msg.title.toLowerCase()).toContain("workbench");
  });

  it("points mobile and comparison upgrades at Pro, not the removed Growth plan", () => {
    expect(getUpgradeMessage("mobile").requiredPlan).toBe("Pro");
    expect(getUpgradeMessage("comparison").requiredPlan).toBe("Pro");
  });

  it("returns a dedicated message for the 'funnels' feature", () => {
    const msg = getUpgradeMessage("funnels");
    expect(msg.requiredPlan).toBe("Pro");
    expect(msg.title.toLowerCase()).toContain("funnel");
  });
});
