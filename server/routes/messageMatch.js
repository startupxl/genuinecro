import express from "express";
import { buildMessageMatchPrompt } from "../lib/messageMatchPrompt.js";
import { generateHeuristicMessageMatch } from "../lib/heuristicMessageMatch.js";
import { callOpenAI } from "../lib/openai.js";

const router = express.Router();

router.post("/check", async (req, res) => {
  try {
    const { url, sourceMessage } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: "URL is required" });
    }
    if (!sourceMessage || !sourceMessage.trim()) {
      return res.status(400).json({ success: false, error: "Source message is required" });
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
        formats: ["markdown"],
        onlyMainContent: false,
        waitFor: 2000,
      }),
    });

    const scrapeData = await scrapeRes.json();

    if (!scrapeRes.ok) {
      console.error("Firecrawl error:", scrapeData);
      return res.status(scrapeRes.status).json({ success: false, error: scrapeData.error || `Scrape failed (${scrapeRes.status})` });
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";

    if (!markdown) {
      return res.status(422).json({ success: false, error: "No content extracted from URL" });
    }

    const prompt = buildMessageMatchPrompt(sourceMessage.trim(), markdown, formattedUrl);

    let result;
    try {
      const aiData = await callOpenAI(prompt);
      result = {
        url: formattedUrl,
        sourceMessage: sourceMessage.trim(),
        matchScore: aiData.matchScore ?? 50,
        verdict: aiData.verdict || "Partial Match",
        pageHeadline: aiData.pageHeadline || "",
        alignedElements: aiData.alignedElements || [],
        misalignedElements: aiData.misalignedElements || [],
        recommendations: aiData.recommendations || [],
      };
    } catch (err) {
      console.log("AI message match unavailable, using heuristic checker:", err.message);
      result = generateHeuristicMessageMatch(sourceMessage.trim(), markdown, formattedUrl);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Message match error:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Message match check failed" });
  }
});

export default router;
