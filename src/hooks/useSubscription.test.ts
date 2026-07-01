import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const getIdTokenMock = vi.fn().mockResolvedValue("id-token-abc");
const fetchMock = vi.fn();
global.fetch = fetchMock;

vi.mock("./useAuth", () => ({
  useAuth: () => ({ user: { getIdToken: getIdTokenMock } }),
}));

import { useSubscription } from "./useSubscription";

describe("useSubscription", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    getIdTokenMock.mockClear();
  });

  it("fetches subscription status with a bearer token", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ subscription: { plan_name: "growth", status: "active" }, plan: "growth" }),
    });

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.currentPlan).toBe("Growth"));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/paypal/subscription-status",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer id-token-abc" }) })
    );
  });
});
