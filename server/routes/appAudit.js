import express from "express";
import { buildAppAuditPrompt } from "../lib/appAuditPrompt.js";
import { callOpenAIVision } from "../lib/openai.js";
import { saveScreenshot } from "../lib/screenshotStorage.js";

const router = express.Router();

router.post("/analyze", async (req, res) => {
  try {
    const { imageDataUrl, screenLabel, context } = req.body;

    if (!imageDataUrl || typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
      return res.status(400).json({ success: false, error: "A screenshot image is required" });
    }

    const prompt = buildAppAuditPrompt(screenLabel || "", context || "");
    const aiData = await callOpenAIVision(prompt, imageDataUrl);
    const screenshotUrl = saveScreenshot(imageDataUrl);

    const frictionPoints = (aiData.frictionPoints || []).map((fp, i) => ({
      id: `fp-${i + 1}`,
      category: fp.category || "ux-clarity",
      severity: fp.severity || "med",
      title: fp.title || "Issue detected",
      description: fp.description || "",
      selector: fp.location || "screenshot",
      fix: fp.fix || "",
      impactScore: fp.impactScore || 50,
      roiEstimate: fp.roiEstimate || "",
      insightCluster: "",
      sourceCitation: null,
      screenshotUrl,
      benchmark: { industryAvg: 50, topPerformers: 80, label: "Score" },
      abTest: { testName: "", hypothesis: "", control: "", variant: "", metric: "", duration: "", durationRationale: "" },
    }));

    const result = {
      url: screenLabel || "In-app screen",
      timestamp: new Date().toISOString(),
      device: "desktop",
      analysisType: "app-screen",
      screenshotUrl,
      conversionScore: aiData.conversionScore ?? 50,
      grade: aiData.grade || "Needs Optimization",
      topIssues: aiData.topIssues || [],
      insightSummary: {},
      frictionPoints,
      benchmark: {
        overallScore: aiData.conversionScore ?? 50,
        industryAvg: 55,
        topQuartile: 78,
        categoryScores: {},
      },
    };

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("App audit error:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "App audit failed" });
  }
});

export default router;
