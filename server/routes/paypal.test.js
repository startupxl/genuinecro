import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const verifyIdTokenMock = vi.fn();
const docSetMock = vi.fn();
const docGetMock = vi.fn();
const whereGetMock = vi.fn();
const updateMock = vi.fn();

vi.mock("../firebaseAdmin.js", () => ({
  verifyIdToken: (...args) => verifyIdTokenMock(...args),
  adminDb: {
    collection: () => ({
      doc: () => ({
        set: docSetMock,
        get: docGetMock,
      }),
      where: () => ({
        limit: () => ({
          get: whereGetMock,
        }),
      }),
    }),
  },
}));

const fetchMock = vi.fn();
global.fetch = fetchMock;

const { default: paypalRouter } = await import("./paypal.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/paypal", paypalRouter);
  return app;
}

describe("PayPal Express routes", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
    docSetMock.mockReset();
    docGetMock.mockReset();
    whereGetMock.mockReset();
    fetchMock.mockReset();
    process.env.PAYPAL_CLIENT_ID = "test-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "test-secret";
  });

  it("returns 401 when the Authorization header is missing", async () => {
    verifyIdTokenMock.mockRejectedValue(new Error("Missing Authorization header"));
    const res = await request(buildApp()).get("/api/paypal/subscription-status");
    expect(res.status).toBe(401);
  });

  it("returns free plan when no subscription document exists", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
    docGetMock.mockResolvedValue({ exists: false });

    const res = await request(buildApp())
      .get("/api/paypal/subscription-status")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subscription: null, plan: "free" });
  });

  it("creates a PayPal subscription and stores it in Firestore", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token-abc" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "sub-123",
          status: "APPROVAL_PENDING",
          links: [{ rel: "approve", href: "https://paypal.example/approve" }],
        }),
      });
    docSetMock.mockResolvedValue(undefined);

    const res = await request(buildApp())
      .post("/api/paypal/create-subscription")
      .set("Authorization", "Bearer test-token")
      .send({ plan_id: "plan-1", plan_name: "growth" });

    expect(res.status).toBe(200);
    expect(res.body.subscription_id).toBe("sub-123");
    expect(res.body.approve_url).toBe("https://paypal.example/approve");
    expect(docSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ paypal_subscription_id: "sub-123", plan_name: "growth" }),
      { merge: true }
    );
  });

  it("updates subscription status from a webhook event", async () => {
    const docRef = { update: updateMock };
    whereGetMock.mockResolvedValue({ empty: false, docs: [{ ref: docRef }] });
    updateMock.mockResolvedValue(undefined);

    const res = await request(buildApp())
      .post("/api/paypal/webhook")
      .send({ event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "sub-123" } });

    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
  });
});
