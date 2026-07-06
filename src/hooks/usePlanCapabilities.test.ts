import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

let mockPlan = "free";
vi.mock("./useSubscription", () => ({
  useSubscription: () => ({ currentPlan: mockPlan, subscription: null }),
}));

import { usePlanCapabilities, getUpgradeMessage } from "./usePlanCapabilities";

describe("usePlanCapabilities", () => {
  it("disables canGenerateVariants on free, starter, and growth plans", () => {
    for (const plan of ["free", "starter", "growth"]) {
      mockPlan = plan;
      const { result } = renderHook(() => usePlanCapabilities());
      expect(result.current.canGenerateVariants).toBe(false);
    }
  });

  it("enables canGenerateVariants on pro and agency plans", () => {
    for (const plan of ["pro", "agency"]) {
      mockPlan = plan;
      const { result } = renderHook(() => usePlanCapabilities());
      expect(result.current.canGenerateVariants).toBe(true);
    }
  });

  it("disables canExperimentWorkbench on free, starter, and growth plans", () => {
    for (const plan of ["free", "starter", "growth"]) {
      mockPlan = plan;
      const { result } = renderHook(() => usePlanCapabilities());
      expect(result.current.canExperimentWorkbench).toBe(false);
    }
  });

  it("enables canExperimentWorkbench on pro and agency plans", () => {
    for (const plan of ["pro", "agency"]) {
      mockPlan = plan;
      const { result } = renderHook(() => usePlanCapabilities());
      expect(result.current.canExperimentWorkbench).toBe(true);
    }
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
});
