import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const countAnalysesSinceMock = vi.fn();
const recordAnalysisMock = vi.fn();

vi.mock("@/lib/firebase/analyses", () => ({
  countAnalysesSince: (...args: unknown[]) => countAnalysesSinceMock(...args),
  recordAnalysis: (...args: unknown[]) => recordAnalysisMock(...args),
}));

const useAuthMock = vi.fn(() => ({ user: { uid: "uid-1" } }));
vi.mock("./useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

const useSubscriptionMock = vi.fn(() => ({ currentPlan: "Growth", subscription: null }));
vi.mock("./useSubscription", () => ({
  useSubscription: () => useSubscriptionMock(),
}));

import { useUsageTracking } from "./useUsageTracking";

describe("useUsageTracking", () => {
  beforeEach(() => {
    countAnalysesSinceMock.mockReset();
    recordAnalysisMock.mockReset();
    useAuthMock.mockReturnValue({ user: { uid: "uid-1" } });
    useSubscriptionMock.mockReturnValue({ currentPlan: "Growth", subscription: null });
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

  it("records categoryScores when provided", async () => {
    countAnalysesSinceMock.mockResolvedValue(0);
    recordAnalysisMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useUsageTracking());

    await waitFor(() => expect(result.current.usage).toBeDefined());
    await result.current.trackAnalysis("https://example.com", "homepage", "desktop", 72, { "content-hierarchy": 65 });

    expect(recordAnalysisMock).toHaveBeenCalledWith(
      expect.objectContaining({ categoryScores: { "content-hierarchy": 65 } })
    );
  });

  it("limits the free signed-in plan to 3 audits", async () => {
    useSubscriptionMock.mockReturnValue({ currentPlan: "Free", subscription: null });
    countAnalysesSinceMock.mockResolvedValue(0);
    const { result } = renderHook(() => useUsageTracking());

    await waitFor(() => {
      expect(countAnalysesSinceMock).toHaveBeenCalled();
    });
    expect(result.current.usage.limit).toBe(3);
  });

  it("limits anonymous visitors to 1 free scan before requiring auth", async () => {
    useAuthMock.mockReturnValue({ user: null });
    const { result } = renderHook(() => useUsageTracking());

    await waitFor(() => {
      expect(result.current.usage.limit).toBe(1);
      expect(result.current.usage.requiresAuth).toBe(false);
    });

    await result.current.trackAnalysis("https://example.com", "homepage", "desktop", 72);

    await waitFor(() => {
      expect(result.current.usage.used).toBe(1);
      expect(result.current.usage.requiresAuth).toBe(true);
    });
  });
});
