export function buildMultivariateIdeaPrompt({ baseIdea, pageContext, goal }) {
  return `You are a senior CRO experimentation strategist. A team has one testing idea and wants to expand it into a proper multivariate test design.

Page/element: ${pageContext}
Base idea: ${baseIdea}
Conversion goal: ${goal}

Break this single idea into 2-3 independent factors (distinct elements that could each be varied on their own), and for each factor list the control plus 1-2 alternative levels a team could actually build. Then suggest 2-4 concrete combinations of those levels worth testing together as multivariate cells, with a short rationale for each. Finally, add one practical note about the traffic/duration trade-off of testing that many combinations at once (e.g. suggesting a fractional design if the full factorial is too large).

Return ONLY valid JSON:
{
  "factors": [
    { "name": "factor name", "levels": ["Control: ...", "Alternative: ...", "Alternative: ..."] }
  ],
  "suggestedCombinations": [
    { "label": "Combination 1", "description": "which levels this combination pairs together", "rationale": "why this pairing is worth testing" }
  ],
  "testingNote": "one practical note about traffic/duration trade-offs for this design"
}`;
}
