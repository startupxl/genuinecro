import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const getIdTokenMock = vi.fn().mockResolvedValue("id-token-abc");
const fetchMock = vi.fn();
global.fetch = fetchMock;

vi.mock("./useAuth", () => ({
  useAuth: () => ({ user: { getIdToken: getIdTokenMock } }),
}));

import { useSubscription, SUBSCRIPTION_RETRY } from "./useSubscription";

function okResponse(plan: string) {
  return {
    ok: true,
    json: async () => ({ subscription: { plan_name: plan, status: "active" }, plan }),
  };
}

describe("useSubscription", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    getIdTokenMock.mockClear();
    SUBSCRIPTION_RETRY.delayMs = 10;
  });

  afterEach(() => {
    SUBSCRIPTION_RETRY.delayMs = 3000;
  });

  it("fetches subscription status with a bearer token and reports planStatus ready", async () => {
    fetchMock.mockResolvedValue(okResponse("growth"));

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.currentPlan).toBe("Growth"));
    expect(result.current.planStatus).toBe("ready");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/paypal/subscription-status",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer id-token-abc" }) })
    );
  });

  it("reports planStatus error instead of silently pretending the plan is Free when the fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.planStatus).toBe("error"));
  });

  it("retries automatically after a failure and recovers the real plan", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down")).mockResolvedValue(okResponse("agency"));

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.currentPlan).toBe("Agency"));
    expect(result.current.planStatus).toBe("ready");
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps the last known plan when a later refresh fails, rather than downgrading to Free", async () => {
    fetchMock.mockResolvedValueOnce(okResponse("agency"));

    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.currentPlan).toBe("Agency"));

    fetchMock.mockRejectedValue(new Error("network down"));
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.currentPlan).toBe("Agency");
    expect(result.current.planStatus).toBe("error");
  });
});
