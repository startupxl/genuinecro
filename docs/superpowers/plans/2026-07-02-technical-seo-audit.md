# Technical SEO Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Technical" nav section real — a standalone single-page SEO audit (canonical tag, indexability, robots.txt, sitemap.xml, live link-health checks) with its own 0-100 score, wired into the existing usage quota, Action Center, and Dashboard trend logic.

**Architecture:** A new Express route (`server/routes/technical.js`) fetches the raw HTML of a single page and runs a set of independent check functions (`server/lib/technicalChecks.js`) plus a scoring function (`server/lib/technicalScoring.js`) that combines them into one score and an itemized issue list shaped like the existing `FrictionPointInput` type. The client (`src/pages/Technical.tsx`) is a standalone URL-input-to-report page reusing the existing `useUsageTracking`/`createActionItems`/severity-stripe patterns already built for Conversion and Action Center — no new persistence code, just new calls into the existing `trackAnalysis`/`createActionItems` functions with `analysisType: "technical"`.

**Tech Stack:** Express + `cheerio` (new dependency, server-side HTML parsing) on the backend; React + the existing Firebase/Firestore client modules on the frontend; Vitest + `supertest` + `@testing-library/react` for tests (all existing).

## Global Constraints

- Reference spec: `docs/superpowers/specs/2026-07-02-technical-seo-audit-design.md`.
- Single-page audit only — no multi-page crawling in this plan.
- Every link found on the audited page gets a live HTTP check (not capped).
- Scoring weights: canonical 20, indexability 20, robots.txt 15, sitemap.xml 15, link health 30 — sum to 100.
- Link-health issue `impactScore`: `30 - 30 * ok/total` points lost, divided evenly across every broken/redirect-chain issue, rounded to the nearest integer with a floor of 1 per issue.
- Technical audits share the same usage quota as Conversion audits via the existing `trackAnalysis` function, and their issues flow into the existing `actionItems` collection via `createActionItems` — no new Firestore collections in this plan.
- Dashboard's per-domain score trend (`groupAnalysesByDomain`) must exclude `analysisType === "technical"` records so the existing Conversion trend is unaffected.
- All outbound requests from the server (page fetch, robots.txt, sitemap.xml, link checks) send `User-Agent: GenuineCRO-TechnicalAudit/1.0`.
- Response envelope on the new route matches the existing `/api/analyze/analyze-url` convention: `{ success: true, data: {...} }` or `{ success: false, error: "..." }`.

---

### Task 1: Technical checks library

**Files:**
- Modify: `package.json` (add `cheerio` dependency)
- Create: `server/lib/technicalChecks.js`
- Create: `server/lib/technicalChecks.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `extractCanonical(html): { present: boolean, href: string | null }`, `extractIndexability(html): { indexable: boolean, reason: string | null }`, `extractLinks(html, baseUrl): string[]`, `checkRobotsTxt(origin): Promise<{ exists: boolean, valid: boolean, issue: string | null }>`, `checkSitemap(origin): Promise<{ exists: boolean, valid: boolean, issue: string | null }>`, `checkLinks(links: string[]): Promise<Array<{ url: string, status: "ok" | "broken" | "redirect-chain", hops: number, finalStatus: number | null }>>` — consumed by Task 3's route

- [ ] **Step 1: Install cheerio**

Run: `npm install cheerio`
Expected: `package.json`'s `dependencies` gains a `cheerio` entry.

- [ ] **Step 2: Write the failing tests**

Create `server/lib/technicalChecks.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractCanonical, extractIndexability, extractLinks, checkRobotsTxt, checkSitemap, checkLinks } from "./technicalChecks.js";

describe("extractCanonical", () => {
  it("finds a canonical link tag", () => {
    const html = `<html><head><link rel="canonical" href="https://example.com/page"></head></html>`;
    expect(extractCanonical(html)).toEqual({ present: true, href: "https://example.com/page" });
  });

  it("reports absent when there is no canonical tag", () => {
    const html = `<html><head></head></html>`;
    expect(extractCanonical(html)).toEqual({ present: false, href: null });
  });
});

describe("extractIndexability", () => {
  it("is indexable when there is no robots meta tag", () => {
    const html = `<html><head></head></html>`;
    expect(extractIndexability(html)).toEqual({ indexable: true, reason: null });
  });

  it("is not indexable when meta robots contains noindex", () => {
    const html = `<html><head><meta name="robots" content="noindex, nofollow"></head></html>`;
    expect(extractIndexability(html)).toEqual({ indexable: false, reason: "meta robots tag contains noindex" });
  });
});

describe("extractLinks", () => {
  it("resolves relative links to absolute URLs, dedupes, and skips non-http hrefs", () => {
    const html = `
      <a href="/about">About</a>
      <a href="https://example.com/about">About again</a>
      <a href="#section">Anchor</a>
      <a href="mailto:hi@example.com">Email</a>
    `;
    const links = extractLinks(html, "https://example.com/");
    expect(links).toEqual(["https://example.com/about"]);
  });
});

describe("checkRobotsTxt", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it("reports valid when robots.txt exists with content", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "User-agent: *\nDisallow:" });
    const result = await checkRobotsTxt("https://example.com");
    expect(result).toEqual({ exists: true, valid: true, issue: null });
  });

  it("reports missing when robots.txt returns a 404", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => "" });
    const result = await checkRobotsTxt("https://example.com");
    expect(result).toEqual({ exists: false, valid: false, issue: "robots.txt returned 404" });
  });
});

describe("checkSitemap", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it("reports valid when sitemap.xml has url entries", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => `<urlset><url><loc>https://example.com/</loc></url></urlset>` });
    const result = await checkSitemap("https://example.com");
    expect(result).toEqual({ exists: true, valid: true, issue: null });
  });

  it("reports invalid when sitemap.xml has no url entries", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => `<not-a-sitemap></not-a-sitemap>` });
    const result = await checkSitemap("https://example.com");
    expect(result).toEqual({ exists: true, valid: false, issue: "sitemap.xml does not contain any <url> or <sitemap> entries" });
  });
});

describe("checkLinks", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it("classifies a 200 response as ok", async () => {
    fetchMock.mockResolvedValue({ status: 200, headers: { get: () => null } });
    const results = await checkLinks(["https://example.com/ok"]);
    expect(results).toEqual([{ url: "https://example.com/ok", status: "ok", hops: 0, finalStatus: 200 }]);
  });

  it("classifies a 404 response as broken", async () => {
    fetchMock.mockResolvedValue({ status: 404, headers: { get: () => null } });
    const results = await checkLinks(["https://example.com/missing"]);
    expect(results).toEqual([{ url: "https://example.com/missing", status: "broken", hops: 0, finalStatus: 404 }]);
  });

  it("follows a redirect and classifies the final result as redirect-chain", async () => {
    fetchMock
      .mockResolvedValueOnce({ status: 301, headers: { get: (h) => (h === "location" ? "https://example.com/new" : null) } })
      .mockResolvedValueOnce({ status: 200, headers: { get: () => null } });

    const results = await checkLinks(["https://example.com/old"]);
    expect(results).toEqual([{ url: "https://example.com/old", status: "redirect-chain", hops: 1, finalStatus: 200 }]);
  });

  it("checks multiple links", async () => {
    fetchMock.mockResolvedValue({ status: 200, headers: { get: () => null } });
    const results = await checkLinks(["https://example.com/a", "https://example.com/b"]);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.url).sort()).toEqual(["https://example.com/a", "https://example.com/b"]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run server/lib/technicalChecks.test.js`
Expected: FAIL — `Cannot find module './technicalChecks.js'`

- [ ] **Step 4: Write `server/lib/technicalChecks.js`**

```js
import * as cheerio from "cheerio";

export function extractCanonical(html) {
  const $ = cheerio.load(html);
  const href = $('link[rel="canonical"]').attr("href") || null;
  return { present: !!href, href };
}

export function extractIndexability(html) {
  const $ = cheerio.load(html);
  const content = $('meta[name="robots"]').attr("content") || "";
  const indexable = !/noindex/i.test(content);
  return { indexable, reason: indexable ? null : "meta robots tag contains noindex" };
}

export function extractLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const links = new Set();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;
    try {
      links.add(new URL(href, baseUrl).toString());
    } catch {
      // ignore unparsable hrefs
    }
  });
  return [...links];
}

const AUDIT_USER_AGENT = "GenuineCRO-TechnicalAudit/1.0";

export async function checkRobotsTxt(origin) {
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": AUDIT_USER_AGENT } });
    if (!res.ok) {
      return { exists: false, valid: false, issue: `robots.txt returned ${res.status}` };
    }
    const text = await res.text();
    const valid = text.trim().length > 0;
    return { exists: true, valid, issue: valid ? null : "robots.txt is empty" };
  } catch {
    return { exists: false, valid: false, issue: "robots.txt could not be fetched" };
  }
}

export async function checkSitemap(origin) {
  try {
    const res = await fetch(`${origin}/sitemap.xml`, { headers: { "User-Agent": AUDIT_USER_AGENT } });
    if (!res.ok) {
      return { exists: false, valid: false, issue: `sitemap.xml returned ${res.status}` };
    }
    const text = await res.text();
    const valid = /<url(set)?[\s>]/i.test(text) || /<sitemap[\s>]/i.test(text);
    return { exists: true, valid, issue: valid ? null : "sitemap.xml does not contain any <url> or <sitemap> entries" };
  } catch {
    return { exists: false, valid: false, issue: "sitemap.xml could not be fetched" };
  }
}

const LINK_CONCURRENCY = 8;
const MAX_REDIRECT_HOPS = 5;
const LINK_TIMEOUT_MS = 6000;

async function checkOneLink(url) {
  let currentUrl = url;
  let hops = 0;

  try {
    while (hops <= MAX_REDIRECT_HOPS) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LINK_TIMEOUT_MS);
      let res;
      try {
        res = await fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: { "User-Agent": AUDIT_USER_AGENT },
        });
      } finally {
        clearTimeout(timeout);
      }

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) {
          return { url, status: "broken", hops, finalStatus: res.status };
        }
        currentUrl = new URL(location, currentUrl).toString();
        hops += 1;
        continue;
      }

      if (res.status >= 400) {
        return { url, status: "broken", hops, finalStatus: res.status };
      }

      return { url, status: hops > 0 ? "redirect-chain" : "ok", hops, finalStatus: res.status };
    }
    return { url, status: "broken", hops, finalStatus: null };
  } catch {
    return { url, status: "broken", hops, finalStatus: null };
  }
}

export async function checkLinks(links) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < links.length) {
      const current = links[index];
      index += 1;
      results.push(await checkOneLink(current));
    }
  }

  const workerCount = Math.min(LINK_CONCURRENCY, links.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/lib/technicalChecks.test.js`
Expected: PASS (9 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json server/lib/technicalChecks.js server/lib/technicalChecks.test.js
git commit -m "Add the technical SEO checks library"
```

---

### Task 2: Technical scoring

**Files:**
- Create: `server/lib/technicalScoring.js`
- Create: `server/lib/technicalScoring.test.js`

**Interfaces:**
- Consumes: nothing (takes plain objects matching Task 1's return shapes as input)
- Produces: `computeTechnicalScore({ canonical, indexability, robotsTxt, sitemap, linkResults }): { score: number, issues: Array<{ category: string, severity: "high"|"med"|"low", title: string, description: string, fix: string, impactScore: number }>, linkSummary: { total: number, ok: number, broken: number, redirectChains: number } }` — consumed by Task 3's route

- [ ] **Step 1: Write the failing tests**

Create `server/lib/technicalScoring.test.js`:

```js
import { describe, it, expect } from "vitest";
import { computeTechnicalScore } from "./technicalScoring.js";

const passingChecks = {
  canonical: { present: true, href: "https://example.com/" },
  indexability: { indexable: true, reason: null },
  robotsTxt: { exists: true, valid: true, issue: null },
  sitemap: { exists: true, valid: true, issue: null },
  linkResults: [],
};

describe("computeTechnicalScore", () => {
  it("returns a full 100 score with no issues when everything passes and there are no links", () => {
    const result = computeTechnicalScore(passingChecks);
    expect(result.score).toBe(100);
    expect(result.issues).toEqual([]);
    expect(result.linkSummary).toEqual({ total: 0, ok: 0, broken: 0, redirectChains: 0 });
  });

  it("returns a 0 score with an issue for each failed component when everything fails", () => {
    const result = computeTechnicalScore({
      canonical: { present: false, href: null },
      indexability: { indexable: false, reason: "meta robots tag contains noindex" },
      robotsTxt: { exists: false, valid: false, issue: "robots.txt could not be fetched" },
      sitemap: { exists: false, valid: false, issue: "sitemap.xml could not be fetched" },
      linkResults: [{ url: "https://example.com/a", status: "broken", hops: 0, finalStatus: 404 }],
    });

    expect(result.score).toBe(0);
    expect(result.issues).toHaveLength(5);
    expect(result.issues.map((i) => i.title)).toEqual([
      "Missing canonical tag",
      "Page is not indexable",
      "robots.txt missing or invalid",
      "sitemap.xml missing or invalid",
      "Broken link: https://example.com/a",
    ]);
  });

  it("splits lost link-health points evenly across broken/redirect issues", () => {
    const result = computeTechnicalScore({
      ...passingChecks,
      linkResults: [
        { url: "https://example.com/a", status: "ok", hops: 0, finalStatus: 200 },
        { url: "https://example.com/b", status: "broken", hops: 0, finalStatus: 404 },
        { url: "https://example.com/c", status: "redirect-chain", hops: 2, finalStatus: 200 },
      ],
    });

    // link score = round(30 * 1/3) = 10, points lost = 20, split across 2 issues = 10 each
    // total score = canonical 20 + indexability 20 + robotsTxt 15 + sitemap 15 + linkScore 10 = 80
    expect(result.score).toBe(80);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].impactScore).toBe(10);
    expect(result.issues[1].impactScore).toBe(10);
    expect(result.linkSummary).toEqual({ total: 3, ok: 1, broken: 1, redirectChains: 1 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/lib/technicalScoring.test.js`
Expected: FAIL — `Cannot find module './technicalScoring.js'`

- [ ] **Step 3: Write `server/lib/technicalScoring.js`**

```js
function buildLinkIssues(linkResults) {
  const total = linkResults.length;
  if (total === 0) {
    return { linkScore: 30, issues: [], summary: { total: 0, ok: 0, broken: 0, redirectChains: 0 } };
  }

  const broken = linkResults.filter((r) => r.status === "broken");
  const redirectChains = linkResults.filter((r) => r.status === "redirect-chain");
  const ok = total - broken.length - redirectChains.length;

  const linkScore = Math.round(30 * (ok / total));
  const pointsLost = 30 - linkScore;
  const flagged = [...broken, ...redirectChains];
  const perIssue = flagged.length > 0 ? Math.max(1, Math.round(pointsLost / flagged.length)) : 0;

  const issues = flagged.map((link) => ({
    category: "technical-seo",
    severity: "low",
    title: link.status === "broken" ? `Broken link: ${link.url}` : `Redirect chain: ${link.url}`,
    description:
      link.status === "broken"
        ? `This link returned ${link.finalStatus ?? "no response"} after ${link.hops} redirect${link.hops === 1 ? "" : "s"}.`
        : `This link redirects ${link.hops} time${link.hops === 1 ? "" : "s"} before resolving.`,
    fix: link.status === "broken" ? "Update or remove this link." : "Point this link directly at its final destination.",
    impactScore: perIssue,
  }));

  return { linkScore, issues, summary: { total, ok, broken: broken.length, redirectChains: redirectChains.length } };
}

export function computeTechnicalScore({ canonical, indexability, robotsTxt, sitemap, linkResults }) {
  const issues = [];

  const canonicalScore = canonical.present ? 20 : 0;
  if (!canonical.present) {
    issues.push({
      category: "technical-seo",
      severity: "high",
      title: "Missing canonical tag",
      description: "This page has no <link rel=\"canonical\"> tag, which can lead to duplicate-content issues.",
      fix: "Add a self-referential canonical tag to the page's <head>.",
      impactScore: 20,
    });
  }

  const indexabilityScore = indexability.indexable ? 20 : 0;
  if (!indexability.indexable) {
    issues.push({
      category: "technical-seo",
      severity: "high",
      title: "Page is not indexable",
      description: indexability.reason,
      fix: "Remove the noindex directive if this page should appear in search results.",
      impactScore: 20,
    });
  }

  const robotsScore = robotsTxt.exists && robotsTxt.valid ? 15 : 0;
  if (robotsScore === 0) {
    issues.push({
      category: "technical-seo",
      severity: "med",
      title: "robots.txt missing or invalid",
      description: robotsTxt.issue || "robots.txt could not be validated.",
      fix: "Add a valid robots.txt file at your site's root.",
      impactScore: 15,
    });
  }

  const sitemapScore = sitemap.exists && sitemap.valid ? 15 : 0;
  if (sitemapScore === 0) {
    issues.push({
      category: "technical-seo",
      severity: "med",
      title: "sitemap.xml missing or invalid",
      description: sitemap.issue || "sitemap.xml could not be validated.",
      fix: "Add a valid sitemap.xml file at your site's root and submit it to search engines.",
      impactScore: 15,
    });
  }

  const { linkScore, issues: linkIssues, summary: linkSummary } = buildLinkIssues(linkResults);
  issues.push(...linkIssues);

  const score = canonicalScore + indexabilityScore + robotsScore + sitemapScore + linkScore;

  return { score, issues, linkSummary };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/lib/technicalScoring.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/technicalScoring.js server/lib/technicalScoring.test.js
git commit -m "Add the technical SEO scoring model"
```

---

### Task 3: Technical audit route

**Files:**
- Create: `server/routes/technical.js`
- Create: `server/routes/technical.test.js`
- Modify: `server.js`

**Interfaces:**
- Consumes: `extractCanonical`, `extractIndexability`, `extractLinks`, `checkRobotsTxt`, `checkSitemap`, `checkLinks` (Task 1), `computeTechnicalScore` (Task 2)
- Produces: `POST /api/technical/audit` — consumed by Task 4's client module

- [ ] **Step 1: Write the failing tests**

Create `server/routes/technical.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/routes/technical.test.js`
Expected: FAIL — `Cannot find module './technical.js'`

- [ ] **Step 3: Write `server/routes/technical.js`**

```js
import express from "express";
import { extractCanonical, extractIndexability, extractLinks, checkRobotsTxt, checkSitemap, checkLinks } from "../lib/technicalChecks.js";
import { computeTechnicalScore } from "../lib/technicalScoring.js";

const router = express.Router();

router.post("/audit", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: "URL is required" });
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    let pageRes;
    try {
      pageRes = await fetch(formattedUrl, { headers: { "User-Agent": "GenuineCRO-TechnicalAudit/1.0" } });
    } catch {
      return res.status(502).json({ success: false, error: "Could not fetch the page" });
    }

    if (!pageRes.ok) {
      return res.status(502).json({ success: false, error: `Could not fetch the page (${pageRes.status})` });
    }

    const html = await pageRes.text();
    const origin = new URL(formattedUrl).origin;

    const canonical = extractCanonical(html);
    const indexability = extractIndexability(html);
    const links = extractLinks(html, formattedUrl);

    const [robotsTxt, sitemap, linkResults] = await Promise.all([
      checkRobotsTxt(origin),
      checkSitemap(origin),
      checkLinks(links),
    ]);

    const { score, issues, linkSummary } = computeTechnicalScore({ canonical, indexability, robotsTxt, sitemap, linkResults });

    res.json({
      success: true,
      data: {
        url: formattedUrl,
        technicalScore: score,
        checks: { canonical, indexability, robotsTxt, sitemap, linkSummary },
        issues,
      },
    });
  } catch (error) {
    console.error("Technical audit error:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Technical audit failed" });
  }
});

export default router;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/routes/technical.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Mount the route in `server.js`**

In `server.js`, add the import alongside the existing route imports:

```js
import technicalRouter from "./server/routes/technical.js";
```

And mount it alongside the existing routes:

```js
app.use("/api/paypal", paypalRouter);
app.use("/api/analyze", analyzeRouter);
app.use("/api/technical", technicalRouter);
```

- [ ] **Step 6: Commit**

```bash
git add server/routes/technical.js server/routes/technical.test.js server.js
git commit -m "Add the technical audit route"
```

---

### Task 4: Technical client and page

**Files:**
- Create: `src/lib/api/technical.ts`
- Create: `src/lib/api/technical.test.ts`
- Create: `src/pages/Technical.tsx`
- Create: `src/pages/Technical.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (existing), `useUsageTracking()` (existing, returns `{ usage: { used, limit, canAnalyze, requiresAuth, requiresPaid, periodStart, periodEnd }, trackAnalysis }`), `createActionItems` (`src/lib/firebase/actionItems.ts`), `DashboardLayout`, `AuthPage`, `UpgradeWall` (all existing components)
- Produces: `runTechnicalAudit(url: string): Promise<TechnicalAuditResult>` where `TechnicalAuditResult = { url: string, technicalScore: number, checks: { canonical: {present, href}, indexability: {indexable, reason}, robotsTxt: {exists, valid, issue}, sitemap: {exists, valid, issue}, linkSummary: {total, ok, broken, redirectChains} }, issues: Array<{category, severity, title, description, fix, impactScore}> }` — consumed by Task 5's route wiring (already wired here for use, Task 5 only adds the App.tsx/WorkspaceNav.tsx routing)

- [ ] **Step 1: Write the failing test for the API client**

Create `src/lib/api/technical.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runTechnicalAudit } from "./technical";

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

describe("runTechnicalAudit", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("posts to the technical audit route and returns the result data", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { url: "https://example.com", technicalScore: 80, checks: {}, issues: [] } }),
    });

    const result = await runTechnicalAudit("example.com");

    expect(result.technicalScore).toBe(80);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/technical/audit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ url: "example.com" }),
      })
    );
  });

  it("throws when the response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ success: false, error: "Could not fetch the page (404)" }) });
    await expect(runTechnicalAudit("example.com")).rejects.toThrow("Could not fetch the page (404)");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/api/technical.test.ts`
Expected: FAIL — `Cannot find module './technical'`

- [ ] **Step 3: Write `src/lib/api/technical.ts`**

```ts
export interface TechnicalIssue {
  category: string;
  severity: "high" | "med" | "low";
  title: string;
  description: string;
  fix: string;
  impactScore: number;
}

export interface TechnicalAuditResult {
  url: string;
  technicalScore: number;
  checks: {
    canonical: { present: boolean; href: string | null };
    indexability: { indexable: boolean; reason: string | null };
    robotsTxt: { exists: boolean; valid: boolean; issue: string | null };
    sitemap: { exists: boolean; valid: boolean; issue: string | null };
    linkSummary: { total: number; ok: number; broken: number; redirectChains: number };
  };
  issues: TechnicalIssue[];
}

export async function runTechnicalAudit(url: string): Promise<TechnicalAuditResult> {
  const response = await fetch("/api/technical/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "Technical audit failed");
  }

  return data.data as TechnicalAuditResult;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/api/technical.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test for the page**

Create `src/pages/Technical.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const runTechnicalAuditMock = vi.fn();
const createActionItemsMock = vi.fn();
const trackAnalysisMock = vi.fn();

vi.mock("@/lib/api/technical", () => ({
  runTechnicalAudit: (...args: unknown[]) => runTechnicalAuditMock(...args),
}));

vi.mock("@/lib/firebase/actionItems", () => ({
  createActionItems: (...args: unknown[]) => createActionItemsMock(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));

vi.mock("@/hooks/useUsageTracking", () => ({
  useUsageTracking: () => ({
    usage: { used: 0, limit: 10, canAnalyze: true, requiresAuth: false, requiresPaid: false, periodStart: null, periodEnd: null },
    trackAnalysis: (...args: unknown[]) => trackAnalysisMock(...args),
  }),
}));

import Technical from "./Technical";

describe("Technical", () => {
  beforeEach(() => {
    runTechnicalAuditMock.mockReset();
    createActionItemsMock.mockReset();
    trackAnalysisMock.mockReset();
  });

  it("runs an audit and renders the score plus issues", async () => {
    runTechnicalAuditMock.mockResolvedValue({
      url: "https://example.com",
      technicalScore: 80,
      checks: {
        canonical: { present: true, href: "https://example.com/" },
        indexability: { indexable: true, reason: null },
        robotsTxt: { exists: true, valid: true, issue: null },
        sitemap: { exists: true, valid: true, issue: null },
        linkSummary: { total: 2, ok: 1, broken: 1, redirectChains: 0 },
      },
      issues: [
        {
          category: "technical-seo",
          severity: "low",
          title: "Broken link: https://example.com/a",
          description: "This link returned 404.",
          fix: "Update or remove this link.",
          impactScore: 30,
        },
      ],
    });
    trackAnalysisMock.mockResolvedValue(undefined);
    createActionItemsMock.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <Technical />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("example.com"), { target: { value: "example.com" } });
    fireEvent.click(screen.getByText("Run Audit"));

    await waitFor(() => {
      expect(screen.getByText("80/100")).toBeInTheDocument();
    });

    expect(screen.getByText("Broken link: https://example.com/a")).toBeInTheDocument();
    expect(trackAnalysisMock).toHaveBeenCalledWith("https://example.com", "technical", "desktop", 80);
    expect(createActionItemsMock).toHaveBeenCalledWith("uid-1", "https://example.com", "technical", [
      {
        category: "technical-seo",
        severity: "low",
        title: "Broken link: https://example.com/a",
        description: "This link returned 404.",
        fix: "Update or remove this link.",
        impactScore: 30,
      },
    ]);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/pages/Technical.test.tsx`
Expected: FAIL — `Cannot find module './Technical'`

- [ ] **Step 7: Write `src/pages/Technical.tsx`**

```tsx
import { useState, useCallback } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { createActionItems } from "@/lib/firebase/actionItems";
import { runTechnicalAudit, type TechnicalAuditResult } from "@/lib/api/technical";
import DashboardLayout from "@/components/DashboardLayout";
import AuthPage from "@/components/AuthPage";
import UpgradeWall from "@/components/UpgradeWall";
import { toast } from "sonner";

const severityBorderClass: Record<string, string> = {
  high: "border-l-4 border-l-friction-high",
  med: "border-l-4 border-l-friction-med",
  low: "border-l-4 border-l-friction-low",
};

const Technical = () => {
  const { user } = useAuth();
  const { usage, trackAnalysis } = useUsageTracking();
  const [url, setUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<TechnicalAuditResult | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showUpgradeWall, setShowUpgradeWall] = useState(false);

  const handleRunAudit = useCallback(async () => {
    if (!url.trim()) return;
    if (usage.requiresAuth) {
      setShowAuth(true);
      return;
    }
    if (usage.requiresPaid) {
      setShowUpgradeWall(true);
      return;
    }

    let formatted = url.trim();
    if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
      formatted = `https://${formatted}`;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const audit = await runTechnicalAudit(formatted);
      setResult(audit);
      await trackAnalysis(formatted, "technical", "desktop", audit.technicalScore);
      if (user) await createActionItems(user.uid, formatted, "technical", audit.issues);
      toast.success(`Technical audit complete — score ${audit.technicalScore}/100`);
    } catch (err) {
      toast.error("Technical audit failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsRunning(false);
    }
  }, [url, usage, trackAnalysis, user]);

  if (showAuth && !user) {
    return <AuthPage onBack={() => setShowAuth(false)} message="You've used your free audits. Create an account to get more!" />;
  }

  return (
    <DashboardLayout>
      {showUpgradeWall && (
        <UpgradeWall
          used={usage.used}
          limit={usage.limit}
          isAnon={!user}
          onSignIn={() => {
            setShowUpgradeWall(false);
            setShowAuth(true);
          }}
        />
      )}

      <h1 className="text-xl font-semibold text-foreground font-display mb-6">Technical</h1>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="example.com"
          className="flex-1 h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
          disabled={isRunning}
        />
        <button
          onClick={handleRunAudit}
          disabled={isRunning || !url.trim()}
          className="flex items-center gap-1.5 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
          {isRunning ? "Auditing…" : "Run Audit"}
        </button>
      </div>

      {result && (
        <>
          <div className="bg-surface border border-border rounded-lg p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Technical Score</p>
              <p className="text-2xl font-semibold text-foreground">{result.technicalScore}/100</p>
            </div>
            <div className="text-xs text-muted-foreground text-right">
              <p>{result.checks.linkSummary.ok} of {result.checks.linkSummary.total} links healthy</p>
            </div>
          </div>

          {result.issues.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No technical issues found.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {result.issues.map((issue, i) => (
                <div
                  key={`${issue.title}-${i}`}
                  className={`bg-surface p-4 shadow-card rounded-lg ${severityBorderClass[issue.severity]}`}
                >
                  <h3 className="text-sm font-medium text-foreground mb-1">{issue.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{issue.description}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
};

export default Technical;
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/pages/Technical.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 9: Commit**

```bash
git add src/lib/api/technical.ts src/lib/api/technical.test.ts src/pages/Technical.tsx src/pages/Technical.test.tsx
git commit -m "Add the Technical audit page and API client"
```

---

### Task 5: Wire up the route, nav, and Dashboard trend filter

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/WorkspaceNav.tsx`
- Modify: `src/lib/firebase/analyses.ts`
- Modify: `src/lib/firebase/analyses.test.ts`

**Interfaces:**
- Consumes: `Technical` (Task 4)
- Produces: nothing new — this task only connects already-built pieces and adjusts `groupAnalysesByDomain`'s filtering

- [ ] **Step 1: Replace the `/technical` placeholder route in `src/App.tsx`**

Add the import alongside the existing page imports:

```tsx
import Technical from "./pages/Technical.tsx";
```

Replace:

```tsx
            <Route path="/technical" element={<DashboardLayout><ComingSoon title="Technical" /></DashboardLayout>} />
```

with:

```tsx
            <Route path="/technical" element={<Technical />} />
```

- [ ] **Step 2: Mark "Technical" as real in `src/components/WorkspaceNav.tsx`**

Replace:

```tsx
  { label: "Technical", path: "/technical", icon: Wrench, real: false },
```

with:

```tsx
  { label: "Technical", path: "/technical", icon: Wrench, real: true },
```

- [ ] **Step 3: Write the failing test for the Dashboard trend filter**

In `src/lib/firebase/analyses.test.ts`, add this test inside the existing `describe("groupAnalysesByDomain", ...)` block (after the last existing `it(...)`):

```ts
  it("excludes technical audits from the domain's score trend", () => {
    const summaries = groupAnalysesByDomain([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 70, createdAt: "2026-06-01T00:00:00.000Z" },
      { url: "https://example.com", analysisType: "technical", device: "desktop", conversionScore: 40, createdAt: "2026-06-02T00:00:00.000Z" },
    ]);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].latestScore).toBe(70);
    expect(summaries[0].analysisCount).toBe(1);
  });
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/lib/firebase/analyses.test.ts`
Expected: FAIL — the new test's `latestScore` comes back as `40` (the technical record, since it has the later `createdAt`) instead of `70`.

- [ ] **Step 5: Update `groupAnalysesByDomain` in `src/lib/firebase/analyses.ts`**

Replace:

```ts
export function groupAnalysesByDomain(analyses: AnalysisRecord[]): SiteSummary[] {
  const byDomain = new Map<string, AnalysisRecord[]>();

  for (const analysis of analyses) {
```

with:

```ts
export function groupAnalysesByDomain(analyses: AnalysisRecord[]): SiteSummary[] {
  const byDomain = new Map<string, AnalysisRecord[]>();

  for (const analysis of analyses) {
    if (analysis.analysisType === "technical") continue;
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/lib/firebase/analyses.test.ts`
Expected: PASS (all tests in the file, including the new one)

- [ ] **Step 7: Run the full test suite and type-check**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.app.json
```

Expected: all tests pass, no type errors.

- [ ] **Step 8: Boot-verify with the dev server**

Using the Claude Code preview tooling, navigate to `/technical` and confirm: the URL input and "Run Audit" button render, the WorkspaceNav's "Technical" dot now shows as real (same color as Dashboard/Conversion/Action Center), and there are no console errors. A live audit run isn't verifiable in this environment without a reachable target URL, but the empty-state render and quota-gate render (with `usage.requiresAuth` mocked in the earlier test) are already covered by Task 4's test.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/components/WorkspaceNav.tsx src/lib/firebase/analyses.ts src/lib/firebase/analyses.test.ts
git commit -m "Wire up the Technical route, nav, and Dashboard trend filter"
```

---

## What This Plan Does NOT Cover (by design)

Multi-page crawling, redirect-chain detection across a whole site, Core Web Vitals/performance (Phase 3), accessibility scanning (Phase 3), security headers (Phase 4), scheduled re-audits/alerting (Phase 5), and any Dashboard surfacing of Technical scores — see the design spec's "What This Does NOT Cover" section for the full list.
