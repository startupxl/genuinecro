import express from "express";
import { extractCanonical, extractIndexability, extractLinks, checkRobotsTxt, checkSitemap, checkLinks } from "../lib/technicalChecks.js";
import { computeTechnicalScore } from "../lib/technicalScoring.js";
import { safeFetch, readTextCapped, UnsafeUrlError } from "../lib/ssrf.js";

const router = express.Router();

router.post("/audit", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: "URL is required" });
    }

    if (typeof url !== "string") {
      return res.status(400).json({ success: false, error: "URL is required" });
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    let pageRes;
    try {
      pageRes = await safeFetch(formattedUrl, { headers: { "User-Agent": "GenuineCRO-TechnicalAudit/1.0" } });
    } catch (err) {
      if (err instanceof UnsafeUrlError) {
        return res.status(400).json({ success: false, error: "That URL can't be audited. Use a public http(s) address." });
      }
      return res.status(502).json({ success: false, error: "Could not fetch the page" });
    }

    if (!pageRes.ok) {
      return res.status(502).json({ success: false, error: `Could not fetch the page (${pageRes.status})` });
    }

    let html;
    try {
      html = await readTextCapped(pageRes, 2_000_000);
    } catch {
      return res.status(502).json({ success: false, error: "The page is too large to audit" });
    }
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
