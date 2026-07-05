const STOP_WORDS = new Set(["the", "and", "for", "with", "your", "you", "from", "this", "that", "are", "was", "get", "our"]);

function extractPageHeadline(markdown) {
  const headingMatch = markdown.match(/^#{1,2}\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  const firstLine = markdown.split("\n").find((line) => line.trim().length > 0);
  return firstLine ? firstLine.trim() : "";
}

function extractKeywords(sourceMessage) {
  const words = sourceMessage.toLowerCase().match(/[a-z0-9']+/g) || [];
  return [...new Set(words)].filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

export function generateHeuristicMessageMatch(sourceMessage, markdown, url) {
  const pageHeadline = extractPageHeadline(markdown);
  const keywords = extractKeywords(sourceMessage);
  const lowerMarkdown = markdown.toLowerCase();
  const matched = keywords.filter((k) => lowerMarkdown.includes(k));
  const missing = keywords.filter((k) => !matched.includes(k));

  const matchScore = keywords.length > 0 ? Math.round((matched.length / keywords.length) * 100) : 50;

  let verdict = "Mismatch";
  if (matchScore >= 80) verdict = "Strong Match";
  else if (matchScore >= 50) verdict = "Partial Match";

  return {
    url,
    sourceMessage,
    matchScore,
    verdict,
    pageHeadline,
    alignedElements: matched.length > 0 ? [`Page content includes: ${matched.slice(0, 5).join(", ")}`] : [],
    misalignedElements: missing.length > 0 ? [`Page content is missing: ${missing.slice(0, 5).join(", ")}`] : [],
    recommendations:
      matchScore < 80
        ? ["Align the page headline and offer language more closely with the source message's exact wording."]
        : [],
  };
}
