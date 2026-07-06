import express from "express";
import { buildMultivariateIdeaPrompt } from "../lib/multivariateIdeaPrompt.js";
import { callOpenAI } from "../lib/openai.js";

const router = express.Router();

router.post("/expand", async (req, res) => {
  try {
    const { baseIdea, pageContext, goal } = req.body;

    if (!baseIdea || !pageContext || !goal) {
      return res.status(400).json({ success: false, error: "A base idea, page context, and goal are required" });
    }

    const prompt = buildMultivariateIdeaPrompt({ baseIdea, pageContext, goal });
    const aiData = await callOpenAI(prompt);

    res.json({
      success: true,
      data: {
        factors: aiData.factors || [],
        suggestedCombinations: aiData.suggestedCombinations || [],
        testingNote: aiData.testingNote || "",
      },
    });
  } catch (error) {
    console.error("Multivariate idea expansion error:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Multivariate idea expansion failed" });
  }
});

export default router;
