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
