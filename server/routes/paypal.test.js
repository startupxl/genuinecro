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
    process.env.PAYPAL_PLAN_ID_PRO = "P-PRO";
    process.env.PAYPAL_PLAN_ID_AGENCY = "P-AGENCY";
    process.env.PAYPAL_WEBHOOK_ID = "WH-1";
    process.env.FRONTEND_URL = "https://app.genuinecro.com";
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

  const subscriptionFetches = () =>
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

  it("creates a PayPal subscription and stores the plan derived from the plan ID", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
    subscriptionFetches();
    setDocMock.mockResolvedValue(undefined);

    const res = await request(buildApp())
      .post("/api/paypal/create-subscription")
      .set("Authorization", "Bearer test-token")
      .send({ plan_id: "P-PRO" });

    expect(res.status).toBe(200);
    expect(res.body.subscription_id).toBe("sub-123");
    expect(res.body.approve_url).toBe("https://paypal.example/approve");
    expect(setDocMock).toHaveBeenCalledWith(
      { __doc: true },
      expect.objectContaining({ paypal_subscription_id: "sub-123", plan_name: "pro" }),
      { merge: true }
    );
  });

  it("ignores a plan_name sent by the browser (can't buy Pro and be recorded as Agency)", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
    subscriptionFetches();
    setDocMock.mockResolvedValue(undefined);

    await request(buildApp())
      .post("/api/paypal/create-subscription")
      .set("Authorization", "Bearer test-token")
      .send({ plan_id: "P-PRO", plan_name: "agency" });

    expect(setDocMock).toHaveBeenCalledWith({ __doc: true }, expect.objectContaining({ plan_name: "pro" }), { merge: true });
  });

  it("rejects a plan ID that isn't one of ours, without calling PayPal", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
    const res = await request(buildApp())
      .post("/api/paypal/create-subscription")
      .set("Authorization", "Bearer test-token")
      .send({ plan_id: "P-SOMETHING-CHEAP", plan_name: "agency" });

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it("only sends PayPal return URLs on our own origins", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
    subscriptionFetches();
    setDocMock.mockResolvedValue(undefined);

    await request(buildApp())
      .post("/api/paypal/create-subscription")
      .set("Authorization", "Bearer test-token")
      .send({ plan_id: "P-AGENCY", return_url: "https://evil.example/phish", cancel_url: "https://app.genuinecro.com/subscription?canceled=true" });

    const sent = JSON.parse(fetchMock.mock.calls[1][1].body).application_context;
    expect(sent.return_url).toBe("https://genuinecro.com/subscription?success=true"); // fell back
    expect(sent.cancel_url).toBe("https://app.genuinecro.com/subscription?canceled=true"); // allowed as-is
  });

  describe("webhook", () => {
    const signedHeaders = {
      "paypal-transmission-id": "tid",
      "paypal-transmission-time": "2026-10-10T00:00:00Z",
      "paypal-cert-url": "https://api.paypal.com/cert.pem",
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-transmission-sig": "sig",
    };
    const activated = { event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "sub-123", plan_id: "P-AGENCY" } };
    const verifyResponses = (status) =>
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token-abc" }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ verification_status: status }) });

    it("updates the subscription (status and PayPal's plan) when the signature verifies", async () => {
      verifyResponses("SUCCESS");
      getDocsMock.mockResolvedValue({ empty: false, docs: [{ ref: { __ref: true } }] });
      updateDocMock.mockResolvedValue(undefined);

      const res = await request(buildApp()).post("/api/paypal/webhook").set(signedHeaders).send(activated);

      expect(res.status).toBe(200);
      expect(updateDocMock).toHaveBeenCalledWith({ __ref: true }, expect.objectContaining({ status: "active", plan_name: "agency" }));
      const verifyCall = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(verifyCall).toMatchObject({ webhook_id: "WH-1", transmission_id: "tid", webhook_event: activated });
    });

    it("rejects a forged webhook (no PayPal signature headers) without touching Firestore", async () => {
      const res = await request(buildApp()).post("/api/paypal/webhook").send(activated);
      expect(res.status).toBe(401);
      expect(updateDocMock).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects a webhook PayPal says is not genuine", async () => {
      verifyResponses("FAILURE");
      const res = await request(buildApp()).post("/api/paypal/webhook").set(signedHeaders).send(activated);
      expect(res.status).toBe(401);
      expect(updateDocMock).not.toHaveBeenCalled();
    });

    it("fails closed (503) when PAYPAL_WEBHOOK_ID isn't configured", async () => {
      delete process.env.PAYPAL_WEBHOOK_ID;
      const res = await request(buildApp()).post("/api/paypal/webhook").set(signedHeaders).send(activated);
      expect(res.status).toBe(503);
      expect(updateDocMock).not.toHaveBeenCalled();
    });
  });
});
