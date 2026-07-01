import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const verifyIdTokenMock = vi.fn();
const ensureServerSignedInMock = vi.fn().mockResolvedValue(undefined);
const docMock = vi.fn((..._args) => ({ __doc: true }));
const getDocMock = vi.fn();
const setDocMock = vi.fn();
const collectionMock = vi.fn((..._args) => ({ __collection: true }));
const queryMock = vi.fn((..._args) => ({ __query: true }));
const whereMock = vi.fn((..._args) => ({ __where: true }));
const limitMock = vi.fn((..._args) => ({ __limit: true }));
const getDocsMock = vi.fn();
const updateDocMock = vi.fn();

vi.mock("../firebaseServerAuth.js", () => ({
  verifyIdToken: (...args) => verifyIdTokenMock(...args),
  ensureServerSignedIn: (...args) => ensureServerSignedInMock(...args),
  serverDb: {},
}));

vi.mock("firebase/firestore", () => ({
  doc: (...args) => docMock(...args),
  getDoc: (...args) => getDocMock(...args),
  setDoc: (...args) => setDocMock(...args),
  collection: (...args) => collectionMock(...args),
  query: (...args) => queryMock(...args),
  where: (...args) => whereMock(...args),
  limit: (...args) => limitMock(...args),
  getDocs: (...args) => getDocsMock(...args),
  updateDoc: (...args) => updateDocMock(...args),
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
    getDocMock.mockReset();
    setDocMock.mockReset();
    getDocsMock.mockReset();
    updateDocMock.mockReset();
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
    getDocMock.mockResolvedValue({ exists: () => false });

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
    setDocMock.mockResolvedValue(undefined);

    const res = await request(buildApp())
      .post("/api/paypal/create-subscription")
      .set("Authorization", "Bearer test-token")
      .send({ plan_id: "plan-1", plan_name: "growth" });

    expect(res.status).toBe(200);
    expect(res.body.subscription_id).toBe("sub-123");
    expect(res.body.approve_url).toBe("https://paypal.example/approve");
    expect(setDocMock).toHaveBeenCalledWith(
      { __doc: true },
      expect.objectContaining({ paypal_subscription_id: "sub-123", plan_name: "growth" }),
      { merge: true }
    );
  });

  it("updates subscription status from a webhook event", async () => {
    getDocsMock.mockResolvedValue({ empty: false, docs: [{ ref: { __ref: true } }] });
    updateDocMock.mockResolvedValue(undefined);

    const res = await request(buildApp())
      .post("/api/paypal/webhook")
      .send({ event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "sub-123" } });

    expect(res.status).toBe(200);
    expect(updateDocMock).toHaveBeenCalledWith({ __ref: true }, expect.objectContaining({ status: "active" }));
  });
});
