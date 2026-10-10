import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// Small limits so the caps are testable. Read by config/limits.js at import time.
vi.hoisted(() => {
  process.env.LIMIT_ANON_PER_IP_PER_DAY = "2";
  process.env.LIMIT_ANON_GLOBAL_PER_DAY = "3";
  process.env.LIMIT_FREE_PER_DAY = "2";
  process.env.LIMIT_AI_PER_USER_PER_HOUR = "2";
});

// Every real router is replaced by a stub that just says "reached handler" —
// this file tests the wiring in front of the routes, not the routes themselves.
async function stubRouter() {
  const express = (await import("express")).default;
  const router = express.Router();
  router.all(/.*/, (req, res) => res.json({ success: true, reached: true }));
  return { default: router };
}
vi.mock("./routes/paypal.js", stubRouter);
vi.mock("./routes/analyze.js", stubRouter);
vi.mock("./routes/technical.js", stubRouter);
vi.mock("./routes/messageMatch.js", stubRouter);
vi.mock("./routes/variantCopy.js", stubRouter);
vi.mock("./routes/multivariateIdea.js", stubRouter);
vi.mock("./routes/testBrief.js", stubRouter);
vi.mock("./routes/funnelInsights.js", stubRouter);
vi.mock("./routes/ga4.js", stubRouter);
vi.mock("./routes/appAudit.js", stubRouter);

const PLANS = { "pro-token": "Pro", "agency-token": "agency" };
const USERS = { "free-token": "free-user", "pro-token": "pro-user", "agency-token": "agency-user" };

vi.mock("./firebaseServerAuth.js", () => ({
  serverDb: {},
  ensureServerSignedIn: async () => {},
  verifyIdToken: async (header) => {
    if (!header?.startsWith("Bearer ")) throw new Error("Missing Authorization header");
    const uid = USERS[header.slice(7)];
    if (!uid) throw new Error("Invalid or expired token");
    return { uid };
  },
}));
vi.mock("firebase/firestore", () => ({
  // quota counter: this file doesn't test it (quota.test.js does) — never blocks.
  runTransaction: async (_db, fn) => fn({ get: async () => ({ exists: () => false, data: () => undefined }), set: () => {} }),
  updateDoc: async () => {},
  increment: (n) => ({ __inc: n }),
  doc: (_db, _col, uid) => ({ uid }),
  getDoc: async ({ uid }) => {
    const token = Object.keys(USERS).find((t) => USERS[t] === uid);
    const plan = PLANS[token];
    return plan ? { exists: () => true, data: () => ({ status: "active", plan_name: plan }) } : { exists: () => false };
  },
}));

const { createApp } = await import("./app.js");
const { clearAuthCaches } = await import("./middleware/auth.js");
const { resetAllLimiters } = await import("./middleware/limiters.js");

const app = createApp({ distDir: "/nonexistent" });
const as = (token, ip = "9.9.9.9") => (r) => {
  r.set("X-Forwarded-For", ip);
  return token ? r.set("Authorization", `Bearer ${token}`) : r;
};
const post = (path, token, ip) => as(token, ip)(request(app).post(path)).send({ x: 1 });

beforeEach(() => {
  clearAuthCaches();
  resetAllLimiters();
});

describe("routes that spend money are not open to anonymous callers", () => {
  it.each([
    "/api/message-match/check",
    "/api/variant-copy/generate",
    "/api/multivariate-idea/expand",
    "/api/test-brief/generate",
    "/api/funnel-insights/analyze",
    "/api/app-audit/analyze",
  ])("%s -> 401 without a token", async (path) => {
    const res = await post(path);
    expect(res.status).toBe(401);
    expect(res.body.reached).toBeUndefined();
  });

  it("-> 401 for an invalid token", async () => {
    expect((await post("/api/variant-copy/generate", "garbage")).status).toBe(401);
  });
});

describe("plan gates mirror the UI", () => {
  it.each([
    "/api/variant-copy/generate",
    "/api/multivariate-idea/expand",
    "/api/test-brief/generate",
    "/api/funnel-insights/analyze",
    "/api/app-audit/analyze",
  ])("%s -> 403 plan_required for a free account", async (path) => {
    const res = await post(path, "free-token");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("plan_required");
  });

  it("lets Pro and Agency accounts through (plan name is case-insensitive)", async () => {
    expect((await post("/api/variant-copy/generate", "pro-token")).body.reached).toBe(true);
    expect((await post("/api/funnel-insights/analyze", "agency-token")).body.reached).toBe(true);
  });

  it("message-match only needs sign-in (the UI doesn't plan-gate it)", async () => {
    expect((await post("/api/message-match/check", "free-token")).body.reached).toBe(true);
  });
});

describe("rate limits", () => {
  it("caps Pro AI routes per user per hour", async () => {
    expect((await post("/api/variant-copy/generate", "pro-token")).status).toBe(200);
    expect((await post("/api/test-brief/generate", "pro-token")).status).toBe(200);
    const third = await post("/api/funnel-insights/analyze", "pro-token");
    expect(third.status).toBe(429);
    expect(third.headers["retry-after"]).toBeDefined();
  });

  it("anonymous scans are allowed but capped per IP", async () => {
    expect((await post("/api/analyze/analyze-url", null, "1.1.1.1")).status).toBe(200);
    expect((await post("/api/technical/audit", null, "1.1.1.1")).status).toBe(200);
    const third = await post("/api/analyze/analyze-url", null, "1.1.1.1");
    expect(third.status).toBe(429);
    expect(third.body.error).toMatch(/create an account/i);
    // a different visitor is unaffected
    expect((await post("/api/analyze/analyze-url", null, "2.2.2.2")).status).toBe(200);
  });

  it("a global ceiling caps total anonymous traffic across IPs", async () => {
    await post("/api/analyze/analyze-url", null, "3.3.3.1");
    await post("/api/analyze/analyze-url", null, "3.3.3.2");
    await post("/api/analyze/analyze-url", null, "3.3.3.3");
    const res = await post("/api/analyze/analyze-url", null, "3.3.3.4");
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/at capacity/i);
  });

  it("signed-in free accounts get a per-account daily cap, not the anonymous one", async () => {
    expect((await post("/api/analyze/analyze-url", "free-token", "4.4.4.4")).status).toBe(200);
    expect((await post("/api/analyze/analyze-url", "free-token", "5.5.5.5")).status).toBe(200); // different IP, same account
    expect((await post("/api/analyze/analyze-url", "free-token", "6.6.6.6")).status).toBe(429);
  });

  it("a stale/invalid token on a scan is treated as anonymous, not an error", async () => {
    expect((await post("/api/analyze/analyze-url", "expired", "7.7.7.7")).status).toBe(200);
  });
});

describe("request size", () => {
  it("rejects a JSON body over 100kb on normal routes with a clean 413", async () => {
    const res = await as(null, "8.8.8.8")(request(app).post("/api/analyze/analyze-url")).send({ blob: "x".repeat(200_000) });
    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
  });

  it("returns 401 BEFORE reading a large app-audit upload", async () => {
    const res = await as(null, "8.8.4.4")(request(app).post("/api/app-audit/analyze")).send({ blob: "x".repeat(2_000_000) });
    expect(res.status).toBe(401);
  });

  it("lets a signed-in Pro user upload a large screenshot body", async () => {
    const res = await post("/api/app-audit/analyze", "pro-token").catch((e) => e);
    expect(res.status).toBe(200);
    const big = await as("pro-token")(request(app).post("/api/app-audit/analyze")).send({ blob: "x".repeat(2_000_000) });
    expect(big.status).toBe(200);
  });
});

describe("PayPal endpoints", () => {
  it("rate-limits checkout creation per IP", async () => {
    let last;
    for (let i = 0; i < 11; i += 1) last = await post("/api/paypal/create-subscription", "pro-token", "10.1.1.1");
    expect(last.status).toBe(429);
  });
});

describe("misc hardening", () => {
  it("returns a JSON 404 for unknown API routes (not the SPA shell)", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: "Not found" });
  });

  it("does not advertise Express", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("leaves the PayPal webhook and GA4 OAuth callback reachable without a user token", async () => {
    expect((await request(app).post("/api/paypal/webhook").send({})).status).toBe(200);
    expect((await request(app).get("/api/ga4/oauth/callback")).status).toBe(200);
  });
});
