async function callOpenAIChat(messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "gpt-5-mini", messages }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI analysis failed [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response from AI model");
  }

  try {
    const cleaned = content.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Failed to parse AI analysis results");
  }
}

export async function callOpenAI(prompt) {
  return callOpenAIChat([
    {
      role: "system",
      content:
        "You are a senior CRO (Conversion Rate Optimization) expert. You analyze web pages for friction points and provide specific, actionable recommendations. Always return valid JSON only, no markdown formatting or code blocks.",
    },
    { role: "user", content: prompt },
  ]);
}

// Same contract as callOpenAI, but the user message also carries an image —
// used for screenshot-based audits where there's no scraped page text at all.
export async function callOpenAIVision(prompt, imageDataUrl) {
  return callOpenAIChat([
    {
      role: "system",
      content:
        "You are a senior product designer and CRO expert. You analyze product screenshots for UX friction points and provide specific, actionable recommendations. Always return valid JSON only, no markdown formatting or code blocks.",
    },
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    },
  ]);
}
