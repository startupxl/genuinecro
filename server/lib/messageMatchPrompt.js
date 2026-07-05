export function buildMessageMatchPrompt(sourceMessage, markdown, url) {
  return `You are a senior CRO expert evaluating MESSAGE MATCH — whether a landing page continues the promise made in the ad, email, or social post that drove the visitor to click through. Poor message match is one of the biggest drivers of bounce rate and wasted ad spend.

SOURCE MESSAGE (what the visitor saw before clicking through — e.g. an ad headline, email subject line, or social caption):
"${sourceMessage}"

LANDING PAGE URL: ${url}

Evaluate whether the landing page's headline, subheadline, offer, and primary CTA continue the specific promise made in the source message. Be specific: quote the actual headline/offer language from the page and compare it directly to the source message's core promise. Don't just assess general page quality — focus narrowly on message continuity.

Return ONLY valid JSON:
{
  "matchScore": 72,
  "verdict": "Strong Match" | "Partial Match" | "Mismatch",
  "pageHeadline": "the page's actual primary headline/hero copy",
  "alignedElements": ["specific ways the page continues the source message's promise"],
  "misalignedElements": ["specific ways the page breaks or dilutes the promise"],
  "recommendations": ["specific copy/element changes to tighten message match"]
}

PAGE CONTENT:
${markdown.slice(0, 8000)}`;
}
