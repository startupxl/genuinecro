import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const countAnalysesSinceMock = vi.fn();
const recordAnalysisMock = vi.fn();

vi.mock("@/lib/firebase/analyses", () => ({
  countAnalysesSince: (...args: unknown[]) => countAnalysesSinceMock(...args),
  recordAnalysis: (...args: unknown[]) => recordAnalysisMock(...args),
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));

vi.mock("./useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Growth", subscription: null }),
}));

import { useUsageTracking } from "./useUsageTracking";

describe("useUsageTracking", () => {
  beforeEach(() => {
    countAnalysesSinceMock.mockReset();
    recordAnalysisMock.mockReset();
    localStorage.clear();
  });

  it("reports usage against the signed-in user's plan limit", async () => {
    countAnalysesSinceMock.mockResolvedValue(12);
    const { result } = renderHook(() => useUsageTracking());

    await waitFor(() => {
      expect(result.current.usage.used).toBe(12);
    });
    expect(result.current.usage.limit).toBe(75);
    expect(result.current.usage.requiresPaid).toBe(false);
  });

  it("records an analysis for a signed-in user via Firestore", async () => {
    countAnalysesSinceMock.mockResolvedValue(0);
    recordAnalysisMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useUsageTracking());

    await waitFor(() => expect(result.current.usage).toBeDefined());
    await result.current.trackAnalysis("https://example.com", "homepage", "desktop", 72);

    expect(recordAnalysisMock).toHaveBeenCalledWith({
      userId: "uid-1",
      url: "https://example.com",
      analysisType: "homepage",
      device: "desktop",
      conversionScore: 72,
    });
  });
});
