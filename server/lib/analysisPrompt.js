import { CRITERIA_LIBRARY } from "./criteriaLibrary.js";

// ── Scoring categories mapped from the 100+ rule engine ──
export const SCORING_CATEGORIES = {
  "content-hierarchy": { weight: 0.10, label: "Content Hierarchy" },
  navigation: { weight: 0.10, label: "Navigation" },
  performance: { weight: 0.12, label: "Performance" },
  accessibility: { weight: 0.08, label: "Accessibility" },
  "visual-friction": { weight: 0.08, label: "Visual Friction" },
  "ux-friction": { weight: 0.12, label: "UX Friction" },
  "trust-credibility": { weight: 0.15, label: "Trust & Credibility" },
  "form-friction": { weight: 0.10, label: "Form Friction" },
  "cta-effectiveness": { weight: 0.10, label: "CTA Effectiveness" },
  "checkout-friction": { weight: 0.05, label: "Checkout Friction" },
};

// ── Benchmark data (from BENCHMARK.md) ──
export const DEVICE_BENCHMARKS = {
  mobile: { conversionRate: "2.7–2.8%", addToCart: "6–8%", cartAbandonment: "70–72%", trafficShare: "76–77%" },
  desktop: { conversionRate: "2.7–2.8%", addToCart: "6–8%", cartAbandonment: "68–70%", trafficShare: "22–23%" },
  tablet: { conversionRate: "~2.9%", addToCart: "7–9%", cartAbandonment: "65–68%", trafficShare: "~1–2%" },
};

// ── The 100+ rules organized by scoring category ──
const RULES_REFERENCE = `
## A. Content Hierarchy (10 rules)
Clear headline above fold; Value prop understood <5s; No jargon; Clear reading flow (Z/F pattern); No competing elements; Important info above fold; Font readability (size/contrast); No clutter; Info chunked; Content depth matches intent.

## B. Navigation (10 rules)
Simple nav (≤7 items); No dead-end pages; Easy back navigation; Breadcrumbs (product pages); Sticky nav; Ad → landing consistency; Keyword → headline alignment; Clear next step; Consistent tone; Geo relevance.

## C. Performance (12 rules)
Load time <2.5s; FCP <1.8s; Mobile optimized; Images compressed; Lazy loading; No heavy blocking scripts; CDN usage; Minimal JS execution; No layout shifts (CLS); Server response <500ms; Page weight <2MB; Fonts optimized.

## D. Accessibility (8 rules)
Mobile tap targets ≥44x44px with spacing; Sufficient color contrast (WCAG AA); Alt text on images; Keyboard navigable; Screen-reader friendly headings; No autoplay interruptions; Readable font sizes on mobile; Device-specific optimization.

## E. Visual Friction (8 rules)
No aggressive interstitials; Popups not blocking CTA; No unexpected redirects; No broken links; No autoplay video with sound; No overlapping elements; Consistent visual language; No spammy popups early.

## F. UX Friction (12 rules)
Too many choices avoided; Clear decision path; No conflicting CTAs; Minimal scrolling for action; Personalization; No irrelevant distractions; Offer relevance; No bait-and-switch; Product matches expectation; Audience targeting clear; Strong above-fold match; No unnecessary fields.

## G. Trust & Credibility (15 rules)
Customer reviews visible; Ratings displayed; Real testimonials; Trust badges (payment/security); HTTPS enforced; Clear return/refund policy; Contact info visible; Brand story available; Real product images; Social proof count; Media mentions; Guarantees; Verified reviews; FAQ section; Policy pages accessible.

## H. Form Friction (10 rules)
Fields ≤5; Autofill enabled; Guest checkout; No forced signup; Inline validation; Clear error messages; Mobile keyboard optimized; Dropdowns minimized; Progress indicator; No unnecessary fields.

## I. CTA Effectiveness (10 rules)
Primary CTA visible without scroll; Only 1 dominant CTA; Action-oriented CTA language; High CTA contrast; CTA repeated logically; Pricing visible and clear; Transparent pricing; No hidden fees; CTA click-through rate vs benchmark; Form completion rate vs benchmark.

## J. Checkout Friction (5 rules)
Shipping cost shown early; Taxes visible; Multiple payment options; Fast checkout (<3 steps); Save cart.
`;

// ── Analysis type → relevant emphasis ──
const ANALYSIS_TYPE_EMPHASIS = {
  homepage: "Focus heavily on Content Hierarchy (hero messaging, value prop), Navigation, and Trust & Credibility. Homepage is the gateway — visual hierarchy and clear CTA paths are critical.",
  "blog-content": "Focus on Content Hierarchy (readability, content structure, headings), UX Friction (content depth matching search intent), and Visual Friction (distraction-free reading experience, no aggressive interstitials).",
  checkout: "Focus heavily on Checkout Friction (payment options, shipping costs, save cart), Form Friction (fields, guest checkout), and Trust & Credibility (security badges, transparent pricing).",
  "lead-form": "Focus on Form Friction (field count, inline validation), Trust & Credibility (social proof, guarantees), and CTA Effectiveness (clear CTA, value exchange messaging).",
  "product-page": "Focus on Trust & Credibility (reviews, ratings, images, guarantees), Content Hierarchy (value proposition, feature presentation), and CTA Effectiveness (add-to-cart friction, decision complexity).",
  "landing-marketing": "Focus on Content Hierarchy (hero messaging, single dominant CTA), UX Friction (message consistency), and Trust & Credibility (social proof, testimonials). Conversion path should be tight.",
  "landing-paid-media": "Focus heavily on UX Friction (ad-to-page message consistency, keyword alignment), CTA Effectiveness (attention ratio, single CTA), and Performance (bounce prevention). Every element must reinforce the paid traffic's intent.",
};

const ANALYSIS_TYPE_LABELS = {
  homepage: "Homepage", "blog-content": "Blog / Content", checkout: "Checkout",
  "lead-form": "Lead / Form", "product-page": "Product Page",
  "landing-marketing": "Landing Page — Marketing", "landing-paid-media": "Landing Page — Paid Media",
};

function buildCriteriaSection(analysisType) {
  const criteria = CRITERIA_LIBRARY[analysisType];
  if (!criteria) return "";

  const list = criteria
    .map((c) => `- [${c.id}] ${c.rule}: ${c.guidance} (Source: ${c.source})`)
    .join("\n");

  return `

## NAMED EVIDENCE-BASED CRITERIA
Check the page specifically against each of these named, sourced criteria. When a friction point you report matches one of these criteria, include a "sourceCitation" field on that friction point containing the exact Source text shown for it below. Not every finding needs to match one of these — only add "sourceCitation" when there's a genuine match; never invent a citation.
${list}`;
}

export function buildAnalysisPrompt(analysisType, markdown, url, device) {
  const typeLabel = ANALYSIS_TYPE_LABELS[analysisType] || analysisType;
  const emphasis = ANALYSIS_TYPE_EMPHASIS[analysisType] || ANALYSIS_TYPE_EMPHASIS.homepage;
  const deviceBench = DEVICE_BENCHMARKS[device] || DEVICE_BENCHMARKS.desktop;
  const criteriaSection = buildCriteriaSection(analysisType);

  const deviceContext = device === "mobile"
    ? "You are analyzing the MOBILE experience. Focus on touch targets (44px min), thumb-zone accessibility, mobile viewport issues, responsive layout, tap target spacing, text readability on small screens, mobile keyboard optimization, and cellular performance."
    : "You are analyzing the DESKTOP experience. Focus on mouse interactions, hover states, wide viewport layout, navigation hierarchy, F/Z pattern reading flow, and desktop UX patterns.";

  return `You are a world-class CRO (Conversion Rate Optimization) expert using a structured 100+ rule validation engine.

URL: ${url}
Page Type: ${typeLabel}
Device: ${device.toUpperCase()}

${deviceContext}

## PAGE-TYPE EMPHASIS
${emphasis}

## SCORING SYSTEM (Lighthouse-style, 0–100)
Final Conversion Score = weighted sum:
${Object.entries(SCORING_CATEGORIES).map(([, c]) => `- ${c.label} × ${c.weight.toFixed(2)}`).join("\n")}

Severity mapping: 90–100 = Elite | 75–89 = Strong | 50–74 = Needs Optimization | 30–49 = High Friction | <30 = Broken

## PENALTY RULES
- If load time appears >4s → cap total score at 60
- If no trust signals found → reduce score by 20%
- If checkout has >3 steps or >5 form fields → cap Checkout Friction at 50

## DEVICE BENCHMARKS (Global Averages)
- Conversion Rate: ${deviceBench.conversionRate}
- Add-to-Cart Rate: ${deviceBench.addToCart}
- Cart Abandonment: ${deviceBench.cartAbandonment}
- Traffic Share: ${deviceBench.trafficShare}

## THE 100+ RULE ENGINE — Evaluate against ALL of these:
${RULES_REFERENCE}
${criteriaSection}

## ANALYSIS INSTRUCTIONS
1. Evaluate the page content against EVERY relevant rule in the engine above
2. For each FAILED rule, generate a friction point
3. Use the scoring system to calculate category scores and an overall conversion score
4. Prioritize the TOP issues by revenue impact — not just a generic checklist
5. Be SPECIFIC, not generic. Instead of "Improve CTA" → "Your CTA is below the fold on mobile — 73% of users never see it"
6. Include ROI estimation where possible: "Fixing this could increase conversion by X%"
7. Group issues into insight clusters: Trust Gap, Clarity Gap, Effort Gap, Motivation Gap
8. For the A/B test "duration", never give a bare guess. Base it on two factors and say so in "durationRationale":
   (a) run for at least 1-2 full weeks regardless of traffic, to average out weekday/weekend behavior differences;
   (b) the site needs enough conversions per variant to trust the result — lower-traffic pages or smaller expected
   effects (from roiEstimate/impactScore) need longer. Use the device's baseline conversion rate above as the
   reference point, and state the assumption in plain language so the reader can judge whether it fits their real
   traffic, e.g. "Assumes traffic sufficient to reach ~300-350 conversions per variant at the ~2.7% baseline desktop
   conversion rate — extend the test if your traffic or conversion volume is lower."

For each friction point, provide:
- category: one of ${Object.keys(SCORING_CATEGORIES).map((c) => `"${c}"`).join(", ")}
- severity: "high" | "med" | "low"
- title: concise (max 8 words)
- description: specific explanation with ${device} observations. Be insight-driven, not checklist-driven.
- selector: CSS selector or page area
- fix: specific, actionable fix for ${device}
- impactScore: 1–100 estimated conversion impact
- roiEstimate: string like "Could increase conversion by 5-12%" or "May reduce bounce by 15%"
- insightCluster: one of "Trust Gap", "Clarity Gap", "Effort Gap", "Motivation Gap", "Speed Gap"
- benchmark: { industryAvg (0-100), topPerformers (0-100), label (what's measured) }
- abTest: { testName, hypothesis, control, variant, metric, duration, durationRationale (see instruction 8) }

Return ONLY valid JSON:
{
  "conversionScore": 68,
  "grade": "Needs Optimization",
  "topIssues": ["High checkout friction", "Weak trust signals", "Slow mobile load"],
  "insightSummary": {
    "trustGap": "Description of trust issues...",
    "clarityGap": "Description of clarity issues...",
    "effortGap": "Description of effort/friction issues...",
    "motivationGap": "Description of motivation issues...",
    "speedGap": "Description of speed issues..."
  },
  "categoryScores": {
    "content-hierarchy": { "score": 65, "passed": 6, "total": 10, "industryAvg": 55 },
    "navigation": { "score": 60, "passed": 6, "total": 10, "industryAvg": 55 },
    "performance": { "score": 70, "passed": 8, "total": 12, "industryAvg": 60 },
    "accessibility": { "score": 55, "passed": 4, "total": 8, "industryAvg": 50 },
    "visual-friction": { "score": 75, "passed": 6, "total": 8, "industryAvg": 60 },
    "ux-friction": { "score": 58, "passed": 7, "total": 12, "industryAvg": 55 },
    "trust-credibility": { "score": 45, "passed": 7, "total": 15, "industryAvg": 55 },
    "form-friction": { "score": 52, "passed": 5, "total": 10, "industryAvg": 50 },
    "cta-effectiveness": { "score": 66, "passed": 7, "total": 10, "industryAvg": 55 },
    "checkout-friction": { "score": 50, "passed": 2, "total": 5, "industryAvg": 50 }
  },
  "frictionPoints": [
    {
      "category": "content-hierarchy",
      "severity": "high",
      "title": "CTA buried below the fold",
      "description": "The primary CTA is not visible without scrolling...",
      "selector": ".hero-section",
      "fix": "Move primary CTA above the fold...",
      "impactScore": 85,
      "roiEstimate": "Could increase click-through by 15-25%",
      "insightCluster": "Clarity Gap",
      "benchmark": { "industryAvg": 60, "topPerformers": 90, "label": "CTA Visibility Score" },
      "abTest": { "testName": "CTA Placement", "hypothesis": "...", "control": "...", "variant": "...", "metric": "...", "duration": "2 weeks", "durationRationale": "Assumes traffic sufficient to reach ~300-350 conversions per variant at the ~2.7% baseline desktop conversion rate over 2 weeks — extend the test if your traffic or conversion volume is lower." }
    }
  ],
  "benchmark": {
    "overallScore": 62,
    "industryAvg": 55,
    "topQuartile": 78,
    "categoryScores": {}
  }
}

Find 8-15 friction points, prioritized by REVENUE IMPACT. Top 3 issues should be tied to money.

PAGE CONTENT:
${markdown.slice(0, 14000)}`;
}
