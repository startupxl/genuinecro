import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// In-memory Firestore stand-in: just enough of doc/runTransaction/updateDoc/increment.
const store = new Map();
let failTransactions = false;
vi.mock("../firebaseServerAuth.js", () => ({ serverDb: {}, ensureServerSignedIn: async () => {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db, col, id) => ({ path: `${col}/${id}` }),
  increment: (n) => ({ __inc: n }),
  updateDoc: async (ref, patch) => {
    const cur = store.get(ref.path) ?? {};
    for (const [k, v] of Object.entries(patch)) cur[k] = v?.__inc !== undefined ? (cur[k] ?? 0) + v.__inc : v;
    store.set(ref.path, cur);
  },
  runTransaction: async (_db, fn) => {
    if (failTransactions) throw new Error("PERMISSION_DENIED");
    const writes = [];
    const tx = {
      get: async (ref) => ({ exists: () => store.has(ref.path), data: () => store.get(ref.path) }),
      set: (ref, data) => writes.push([ref, data]),
    };
    const out = await fn(tx);
    writes.forEach(([ref, data]) => store.set(ref.path, data));
    return out;
  },
}));

const { auditQuota } = await import("./quota.js");

function buildApp({ plan = "free", user = { uid: "u1" }, handlerStatus = 200 } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    req.plan = plan;
    next();
  });
  app.post("/analyze", auditQuota(), (req, res) => res.status(handlerStatus).json({ success: handlerStatus < 400 }));
  return app;
}
const post = (app, body = {}) => request(app).post("/analyze").send(body);
const wait = () => new Promise((r) => setTimeout(r, 20)); // let res.on("finish") refunds settle

beforeEach(() => {
  store.clear();
  failTransactions = false;
});

describe("auditQuota", () => {
  it("lets a free user run 3 audits then blocks the 4th with quota_exceeded", async () => {
    const app = buildApp({ plan: "free" });
    for (let i = 0; i < 3; i += 1) expect((await post(app)).status).toBe(200);
    const blocked = await post(app);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ code: "quota_exceeded" });
    expect(blocked.body.error).toMatch(/all 3 audits/);
    expect(new Date(blocked.body.resetsAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("gives paid plans their larger allowance", async () => {
    store.set("usage/u1", { windowStart: new Date().toISOString(), count: 249 });
    const app = buildApp({ plan: "pro" });
    expect((await post(app)).status).toBe(200);
    expect((await post(app)).status).toBe(429);
  });

  it("starts a fresh 30-day window once the old one has expired", async () => {
    store.set("usage/u1", { windowStart: new Date(Date.now() - 31 * 86_400_000).toISOString(), count: 3 });
    expect((await post(buildApp({ plan: "free" }))).status).toBe(200);
    expect(store.get("usage/u1").count).toBe(1);
  });

  it("stops at exactly the limit across a burst of requests", async () => {
    const app = buildApp({ plan: "free" });
    const results = [];
    for (let i = 0; i < 6; i += 1) results.push((await post(app)).status);
    expect(results.filter((s) => s === 200)).toHaveLength(3);
    expect(results.filter((s) => s === 429)).toHaveLength(3);
  });

  it("refunds the slot when the audit itself fails", async () => {
    const app = buildApp({ plan: "free", handlerStatus: 502 });
    await post(app);
    await wait();
    expect(store.get("usage/u1").count).toBe(0);
  });

  it("doesn't touch the counter for anonymous visitors", async () => {
    expect((await post(buildApp({ user: null }))).status).toBe(200);
    expect(store.size).toBe(0);
  });

  it("requires a paid plan for mobile analysis and doesn't count it", async () => {
    const free = await post(buildApp({ plan: "free" }), { device: "mobile" });
    expect(free.status).toBe(403);
    expect(free.body.code).toBe("plan_required");

    expect((await post(buildApp({ plan: "pro" }), { device: "mobile" })).status).toBe(200);
    expect(store.size).toBe(0);
  });

  it("fails open (and logs) if the counter can't be read or written", async () => {
    failTransactions = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await post(buildApp({ plan: "free" }))).status).toBe(200);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
