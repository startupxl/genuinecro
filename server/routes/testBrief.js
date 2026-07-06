import express from "express";
import { buildTestBriefPrompt } from "../lib/testBriefPrompt.js";
import { callOpenAI } from "../lib/openai.js";

const router = express.Router();

router.post("/generate", async (req, res) => {
  try {
    const { hypothesis, page, goal, context } = req.body;

    if (!hypothesis || !page || !goal) {
      return res.status(400).json({ success: false, error: "A hypothesis, page, and goal are required" });
    }

    const prompt = buildTestBriefPrompt({ hypothesis, page, goal, context });
    const aiData = await callOpenAI(prompt);

    res.json({
      success: true,
      data: {
        problemStatement: aiData.problemStatement || "",
        hypothesis: aiData.hypothesis || hypothesis,
        successMetric: aiData.successMetric || "",
        secondaryMetrics: aiData.secondaryMetrics || [],
        variants: aiData.variants || [],
        audienceAndSplit: aiData.audienceAndSplit || "",
        estimatedDuration: aiData.estimatedDuration || "",
        risks: aiData.risks || [],
      },
    });
  } catch (error) {
    console.error("Test brief generation error:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Test brief generation failed" });
  }
});

export default router;
