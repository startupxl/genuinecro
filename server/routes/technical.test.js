import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const extractCanonicalMock = vi.fn();
const extractIndexabilityMock = vi.fn();
const extractLinksMock = vi.fn();
const checkRobotsTxtMock = vi.fn();
const checkSitemapMock = vi.fn();
const checkLinksMock = vi.fn();
const computeTechnicalScoreMock = vi.fn();

vi.mock("../lib/technicalChecks.js", () => ({
  extractCanonical: (...args) => extractCanonicalMock(...args),
  extractIndexability: (...args) => extractIndexabilityMock(...args),
  extractLinks: (...args) => extractLinksMock(...args),
  checkRobotsTxt: (...args) => checkRobotsTxtMock(...args),
  checkSitemap: (...args) => checkSitemapMock(...args),
  checkLinks: (...args) => checkLinksMock(...args),
}));
vi.mock("../lib/technicalScoring.js", () => ({
  computeTechnicalScore: (...args) => computeTechnicalScoreMock(...args),
}));

const fetchMock = vi.fn();
global.fetch = fetchMock;

const { default: technicalRouter } = await import("./technical.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/technical", technicalRouter);
  return app;
}

describe("POST /api/technical/audit", () => {
  beforeEach(() => {
    extractCanonicalMock.mockReset();
    extractIndexabilityMock.mockReset();
    extractLinksMock.mockReset();
    checkRobotsTxtMock.mockReset();
    checkSitemapMock.mockReset();
    checkLinksMock.mockReset();
    computeTechnicalScoreMock.mockReset();
    fetchMock.mockReset();
  });

  it("returns 400 when the URL is missing", async () => {
    const res = await request(buildApp()).post("/api/technical/audit").send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: "URL is required" });
  });

  it("returns 502 when the page cannot be fetched", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    const res = await request(buildApp()).post("/api/technical/audit").send({ url: "example.com" });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ success: false, error: "Could not fetch the page (404)" });
  });

  it("returns the computed technical audit on the happy path", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "<html></html>" });
    extractCanonicalMock.mockReturnValue({ present: true, href: "https://example.com/" });
    extractIndexabilityMock.mockReturnValue({ indexable: true, reason: null });
    extractLinksMock.mockReturnValue(["https://example.com/a"]);
    checkRobotsTxtMock.mockResolvedValue({ exists: true, valid: true, issue: null });
    checkSitemapMock.mockResolvedValue({ exists: true, valid: true, issue: null });
    checkLinksMock.mockResolvedValue([{ url: "https://example.com/a", status: "ok", hops: 0, finalStatus: 200 }]);
    computeTechnicalScoreMock.mockReturnValue({
      score: 100,
      issues: [],
      linkSummary: { total: 1, ok: 1, broken: 0, redirectChains: 0 },
    });

    const res = await request(buildApp()).post("/api/technical/audit").send({ url: "example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        url: "https://example.com",
        technicalScore: 100,
        checks: {
          canonical: { present: true, href: "https://example.com/" },
          indexability: { indexable: true, reason: null },
          robotsTxt: { exists: true, valid: true, issue: null },
          sitemap: { exists: true, valid: true, issue: null },
          linkSummary: { total: 1, ok: 1, broken: 0, redirectChains: 0 },
        },
        issues: [],
      },
    });
    expect(checkLinksMock).toHaveBeenCalledWith(["https://example.com/a"]);
  });
});
