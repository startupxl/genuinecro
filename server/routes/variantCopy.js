import express from "express";
import { buildVariantCopyPrompt } from "../lib/variantCopyPrompt.js";
import { callOpenAI } from "../lib/openai.js";

const router = express.Router();

router.post("/generate", async (req, res) => {
  try {
    const { category, title, description, fix } = req.body;

    if (!category || !title || !description || !fix) {
      return res.status(400).json({ success: false, error: "Friction point details are required" });
    }

    const prompt = buildVariantCopyPrompt({ category, title, description, fix });
    const aiData = await callOpenAI(prompt);

    res.json({ success: true, data: { variants: aiData.variants || [] } });
  } catch (error) {
    console.error("Variant copy generation error:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Variant copy generation failed" });
  }
});

export default router;
