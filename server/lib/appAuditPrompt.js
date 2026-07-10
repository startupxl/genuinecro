export function buildAppAuditPrompt(screenLabel, context) {
  const labelClause = screenLabel ? ` — "${screenLabel}"` : "";
  const contextClause = context ? `\n\nWhat this screen should let the user do: ${context}` : "";

  return `You are a senior product designer and UX researcher reviewing a screenshot of an authenticated in-app screen from a SaaS product${labelClause}.${contextClause}

Look at the screenshot directly and evaluate the PRODUCT EXPERIENCE, not marketing conversion. Focus on:
- Onboarding friction: is it clear what to do next, is progress visible, does the empty state guide the user toward value or just look blank/broken
- Feature discoverability: are important features/actions visible and findable, or buried
- Navigation complexity: is the information architecture clear, are there too many competing paths
- Upgrade/paywall clarity: if there's an upgrade prompt or locked feature, is it clear why and what they'd get
- Settings findability and clarity
- Visual hierarchy and clutter: is the most important action or information easy to find at a glance
- Trust and polish: does the screen look reliable, professional, and error-free

For each issue, describe its LOCATION in the screenshot (e.g. "top-right upgrade banner", "empty state in the main content area") since there's no DOM selector for a screenshot — only what's visible in the image.

Return ONLY valid JSON:
{
  "conversionScore": 0-100 (overall product-experience quality of this screen),
  "grade": "one of: Excellent, Good, Needs Optimization, Poor",
  "topIssues": ["short issue titles, most impactful first"],
  "frictionPoints": [
    {
      "category": "one of: onboarding-friction, feature-presentation, navigation, ux-clarity, engagement, content-hierarchy, trust-credibility, accessibility, visual",
      "severity": "high, med, or low",
      "title": "short issue title",
      "description": "what's wrong and why it hurts the product experience",
      "location": "where in the screenshot this issue is",
      "fix": "a concrete, specific fix",
      "impactScore": 0-100,
      "roiEstimate": "a short plain-English estimate of the impact of fixing this"
    }
  ]
}`;
}
