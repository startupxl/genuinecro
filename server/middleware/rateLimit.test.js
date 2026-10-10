import { describe, it, expect, vi, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { createRateLimiter } from "./rateLimit.js";

function buildApp(limiter) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(limiter);
  app.get("/", (req, res) => res.json({ ok: true }));
  return app;
}

describe("createRateLimiter", () => {
  afterEach(() => vi.useRealTimers());

  it("allows up to max requests then returns 429 with Retry-After", async () => {
    const app = buildApp(createRateLimiter({ windowMs: 60_000, max: 2, key: (r) => r.ip }));
    expect((await request(app).get("/")).status).toBe(200);
    const second = await request(app).get("/");
    expect(second.status).toBe(200);
    expect(second.headers["ratelimit-remaining"]).toBe("0");

    const third = await request(app).get("/");
    expect(third.status).toBe(429);
    expect(third.body).toMatchObject({ success: false, code: "rate_limited" });
    expect(Number(third.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("tracks each key separately (per-IP via X-Forwarded-For)", async () => {
    const app = buildApp(createRateLimiter({ windowMs: 60_000, max: 1, key: (r) => r.ip }));
    expect((await request(app).get("/").set("X-Forwarded-For", "1.1.1.1")).status).toBe(200);
    expect((await request(app).get("/").set("X-Forwarded-For", "1.1.1.1")).status).toBe(429);
    expect((await request(app).get("/").set("X-Forwarded-For", "2.2.2.2")).status).toBe(200);
  });

  it("starts a fresh window after windowMs", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const app = buildApp(createRateLimiter({ windowMs: 1000, max: 1, key: () => "k" }));
    expect((await request(app).get("/")).status).toBe(200);
    expect((await request(app).get("/")).status).toBe(429);
    vi.setSystemTime(Date.now() + 1500);
    expect((await request(app).get("/")).status).toBe(200);
  });

  it("supports a per-request max function", async () => {
    const app = buildApp(createRateLimiter({ windowMs: 60_000, max: (r) => (r.headers["x-tier"] === "big" ? 3 : 1), key: () => "k" }));
    expect((await request(app).get("/").set("x-tier", "big")).headers["ratelimit-limit"]).toBe("3");
  });
});
