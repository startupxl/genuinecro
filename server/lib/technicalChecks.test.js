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
