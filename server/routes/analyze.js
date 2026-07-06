import express from "express";
import { buildAnalysisPrompt } from "../lib/analysisPrompt.js";
import { generateHeuristicAnalysis } from "../lib/heuristicAnalysis.js";
import { callOpenAI } from "../lib/openai.js";
import { recordCategoryScores } from "../lib/benchmarks.js";

const router = express.Router();

router.post("/analyze-url", async (req, res) => {
  try {
    const { url, analysisType = "homepage", device = "desktop", siteType } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: "URL is required" });
    }

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey) {
      return res.status(500).json({ success: false, error: "Firecrawl connector not configured" });
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["markdown", "links", "screenshot"],
        onlyMainContent: false,
        waitFor: 2000,
        ...(device === "mobile" ? { mobile: true } : {}),
      }),
    });

    const scrapeData = await scrapeRes.json();

    if (!scrapeRes.ok) {
      console.error("Firecrawl error:", scrapeData);
      return res.status(scrapeRes.status).json({ success: false, error: scrapeData.error || `Scrape failed (${scrapeRes.status})` });
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    const screenshotUrl = scrapeData.data?.screenshot || scrapeData.screenshot || null;

    if (!markdown) {
      return res.status(422).json({ success: false, error: "No content extracted from URL" });
    }

    const prompt = buildAnalysisPrompt(analysisType, markdown, formattedUrl, device, siteType);

    let aiData;
    try {
      aiData = await callOpenAI(prompt);
    } catch (err) {
      console.log("AI analysis unavailable, using heuristic analysis:", err.message);
      const heuristicResult = generateHeuristicAnalysis(markdown, formattedUrl, analysisType, device, screenshotUrl);
      return res.json({ success: true, data: heuristicResult });
    }

    const frictionPoints = (aiData.frictionPoints || []).map((fp, i) => ({
      id: `fp-${i + 1}`,
      category: fp.category || "ux-clarity",
      severity: fp.severity || "med",
      title: fp.title || "Issue detected",
      description: fp.description || "",
      selector: fp.selector || "body",
      fix: fp.fix || "",
      impactScore: fp.impactScore || 50,
      roiEstimate: fp.roiEstimate || "",
      insightCluster: fp.insightCluster || "",
      sourceCitation: fp.sourceCitation || null,
      effort: fp.effort || undefined,
      confidence: fp.confidence || undefined,
      screenshotUrl,
      benchmark: fp.benchmark || { industryAvg: 50, topPerformers: 80, label: "Score" },
      abTest: fp.abTest || { testName: "", hypothesis: "", control: "", variant: "", metric: "", duration: "", durationRationale: "" },
    }));

    const result = {
      url: formattedUrl,
      timestamp: new Date().toISOString(),
      device,
      analysisType,
      screenshotUrl,
      conversionScore: aiData.conversionScore || aiData.benchmark?.overallScore || 50,
      grade: aiData.grade || "Needs Optimization",
      topIssues: aiData.topIssues || [],
      insightSummary: aiData.insightSummary || {},
      frictionPoints,
      benchmark: {
        overallScore: aiData.conversionScore || aiData.benchmark?.overallScore || 50,
        industryAvg: aiData.benchmark?.industryAvg || 55,
        topQuartile: aiData.benchmark?.topQuartile || 78,
        categoryScores: aiData.categoryScores || aiData.benchmark?.categoryScores || {},
      },
    };

    if (Object.keys(result.benchmark.categoryScores).length > 0) {
      recordCategoryScores(result.benchmark.categoryScores).catch((err) =>
        console.error("Failed to record benchmark samples:", err)
      );
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Analysis failed" });
  }
});

export default router;
