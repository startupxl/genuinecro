export function buildFunnelInsightsPrompt(steps) {
  const stepLines = steps
    .map((step, i) => {
      const ga4Line = step.ga4
        ? `\nReal GA4 data (last 30 days): ${step.ga4.sessions} sessions, ${step.ga4.bounceRate}% bounce rate, ${step.ga4.engagementRate}% engagement rate`
        : "";
      return `Step ${i + 1} — ${step.label} (${step.url})\nConversion score: ${step.score}/100\nTop issues: ${
        step.topIssues.length > 0 ? step.topIssues.join("; ") : "none flagged"
      }${ga4Line}`;
    })
    .join("\n\n");

  return `You are a senior CRO analyst reviewing a multi-step conversion funnel. Each step below was audited individually, in the order a visitor moves through them:

${stepLines}

Now analyze the funnel AS A SEQUENCE — the things a single-page audit cannot see. Identify: which step most likely loses the most buyers (consider both its own score and its position — late-funnel weakness is costlier); step-to-step transition problems (message or design discontinuity, promises made on one step broken on the next, sudden effort spikes like a long form after a low-effort step); and the highest-leverage fixes ordered by expected revenue impact.

Where a step includes real GA4 data, treat it as ground truth over that step's estimated conversion score — a high score paired with a high real bounce rate means the audit missed something, and you should call that conflict out explicitly in your summary or transitionIssues. Steps without GA4 data should be judged on the estimated score and top issues alone.

Return ONLY valid JSON:
{
  "weakestStepIndex": 0,
  "summary": "2-3 sentence plain-English verdict on where and why this funnel leaks",
  "transitionIssues": ["a specific step-to-step discontinuity, naming both steps involved"],
  "recommendations": ["a concrete fix, ordered by expected revenue impact"]
}`;
}
