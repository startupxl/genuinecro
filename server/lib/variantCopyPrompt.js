export function buildVariantCopyPrompt(point) {
  return `You are a senior conversion copywriter. A CRO audit found this friction point on a live page:

Category: ${point.category}
Issue: ${point.title}
Description: ${point.description}
Recommended fix direction: ${point.fix}

Generate 3 concrete, ready-to-test copy variants that implement this fix. Each variant must be actual, complete, usable copy a team could paste directly into a test — not a description of what to do. Depending on what the fix calls for, that might be headline text, CTA button text, microcopy, or form-field labels. Make the three variants meaningfully different approaches (e.g. urgency-led, benefit-led, social-proof-led), not minor wording tweaks of each other.

Return ONLY valid JSON:
{
  "variants": [
    { "label": "Variant A", "copy": "the actual copy text", "rationale": "why this angle might work" },
    { "label": "Variant B", "copy": "the actual copy text", "rationale": "why this angle might work" },
    { "label": "Variant C", "copy": "the actual copy text", "rationale": "why this angle might work" }
  ]
}`;
}
