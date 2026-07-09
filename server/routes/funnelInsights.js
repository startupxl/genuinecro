import express from "express";
import { buildFunnelInsightsPrompt } from "../lib/funnelInsightsPrompt.js";
import { callOpenAI } from "../lib/openai.js";

const router = express.Router();

router.post("/analyze", async (req, res) => {
  try {
    const { steps } = req.body;

    if (!Array.isArray(steps) || steps.length < 2) {
      return res.status(400).json({ success: false, error: "At least two funnel steps are required" });
    }

    const prompt = buildFunnelInsightsPrompt(steps);
    const aiData = await callOpenAI(prompt);

    res.json({
      success: true,
      data: {
        weakestStepIndex: aiData.weakestStepIndex ?? 0,
        summary: aiData.summary || "",
        transitionIssues: aiData.transitionIssues || [],
        recommendations: aiData.recommendations || [],
      },
    });
  } catch (error) {
    console.error("Funnel insights error:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Funnel analysis failed" });
  }
});

export default router;
