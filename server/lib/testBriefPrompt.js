export function buildTestBriefPrompt({ hypothesis, page, goal, context }) {
  return `You are a senior CRO analyst writing a formal A/B test brief for a stakeholder review.

Page/URL: ${page}
Hypothesis: ${hypothesis}
Primary conversion goal: ${goal}
Additional context: ${context || "None provided"}

Write a complete, ready-to-share test brief. Be specific and concrete rather than generic — the variants must be actual described changes, not placeholders.

Return ONLY valid JSON:
{
  "problemStatement": "1-2 sentences on the problem this test addresses",
  "hypothesis": "a clear, falsifiable if/then hypothesis statement",
  "successMetric": "the single primary metric that decides win/lose",
  "secondaryMetrics": ["a secondary metric to watch", "another secondary metric to watch"],
  "variants": [
    { "name": "Control", "description": "what the control looks like today" },
    { "name": "Variant A", "description": "the specific change being tested" }
  ],
  "audienceAndSplit": "who sees the test and the traffic split (e.g. 50/50 all visitors)",
  "estimatedDuration": "a realistic run-time estimate with a one-sentence reason",
  "risks": ["a risk or caveat to flag before launching", "another risk or caveat"]
}`;
}
