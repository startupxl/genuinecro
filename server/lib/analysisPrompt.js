// ── Scoring categories mapped from the 100+ rule engine ──
export const SCORING_CATEGORIES = {
  "ux-clarity": { weight: 0.20, label: "UX Clarity" },
  "trust-credibility": { weight: 0.20, label: "Trust & Credibility" },
  "friction-effort": { weight: 0.20, label: "Friction & Effort" },
  "speed-performance": { weight: 0.15, label: "Speed & Performance" },
  "intent-match": { weight: 0.15, label: "Intent Match" },
  "funnel-health": { weight: 0.10, label: "Funnel Health" },
};

// ── Benchmark data (from BENCHMARK.md) ──
const DEVICE_BENCHMARKS = {
  mobile: { conversionRate: "2.7–2.8%", addToCart: "6–8%", cartAbandonment: "70–72%", trafficShare: "76–77%" },
  desktop: { conversionRate: "2.7–2.8%", addToCart: "6–8%", cartAbandonment: "68–70%", trafficShare: "22–23%" },
  tablet: { conversionRate: "~2.9%", addToCart: "7–9%", cartAbandonment: "65–68%", trafficShare: "~1–2%" },
};

// ── The 100+ rules organized by scoring category ──
const RULES_REFERENCE = `
## A. UX Clarity (20 rules)
**Messaging & Value Prop:** Clear headline above fold; Value prop understood <5s; No jargon; Benefit > feature clarity; USP visible.
**CTA Clarity:** Primary CTA visible without scroll; Only 1 dominant CTA; Action-oriented CTA language; High CTA contrast; CTA repeated logically.
**Visual Hierarchy:** Clear reading flow (Z/F pattern); No competing elements; Important info above fold; Font readability (size/contrast); No clutter.
**Navigation:** Simple nav (≤7 items); No dead-end pages; Easy back navigation; Breadcrumbs (product pages); Sticky nav.

## B. Trust & Credibility (20 rules)
Customer reviews visible; Ratings displayed; Real testimonials; Trust badges (payment/security); HTTPS enforced; Clear return/refund policy; Contact info visible; Brand story available; Real product images; Social proof count; Media mentions; Guarantees; Transparent pricing; No hidden fees; Shipping info upfront; User-generated content; Verified reviews; FAQ section; Policy pages accessible; No spammy popups early.

## C. Friction & Effort (25 rules)
**Forms:** Fields ≤5; Autofill enabled; Guest checkout; No forced signup; Inline validation; Clear error messages; Mobile keyboard optimized; Dropdowns minimized; Progress indicator; No unnecessary fields.
**Cognitive Load:** Too many choices avoided; Clear decision path; No conflicting CTAs; Info chunked; Minimal scrolling for action.
**Checkout:** Shipping cost shown early; Taxes visible; Multiple payment options; Fast checkout (<3 steps); Save cart.
**Interaction:** No broken links; No unexpected redirects; No autoplay interruptions; Popups not blocking CTA; No aggressive interstitials.

## D. Speed & Performance (15 rules)
Load time <2.5s; FCP <1.8s; Mobile optimized; Images compressed; Lazy loading; No heavy blocking scripts; CDN usage; Minimal JS execution; No layout shifts (CLS); Server response <500ms; Page weight <2MB; Fonts optimized; No render-blocking CSS; Caching; Smooth scrolling.

## E. Intent Match (15 rules)
Ad → landing consistency; Keyword → headline alignment; Audience targeting clear; Offer relevance; No bait-and-switch; Product matches expectation; Pricing matches intent; Personalization; Geo relevance; Device-specific optimization; Content depth matches intent; No irrelevant distractions; Clear next step; Strong above-fold match; Consistent tone.

## F. Funnel Health (15 rules)
Conversion rate vs benchmark; Add-to-cart vs benchmark; Cart abandonment vs benchmark; Mobile vs desktop gap; Drop-off at product page; Drop-off at checkout; Repeat user conversion; Bounce rate; Session duration; Rage clicks; Scroll depth; CTA click-through rate; Form completion rate; Exit rate on key pages; Revenue per visitor.
`;

// ── Analysis type → relevant emphasis ──
const ANALYSIS_TYPE_EMPHASIS = {
  homepage: "Focus heavily on UX Clarity (hero messaging, value prop, navigation) and Trust & Credibility. Homepage is the gateway — visual hierarchy and clear CTA paths are critical.",
  "blog-content": "Focus on UX Clarity (readability, content structure, headings), Intent Match (content depth matching search intent), and Friction & Effort (distraction-free reading experience, no aggressive interstitials).",
  checkout: "Focus heavily on Friction & Effort (form fields, checkout steps, payment options, guest checkout) and Trust & Credibility (security badges, transparent pricing, shipping costs). Also assess Funnel Health benchmarks.",
  "lead-form": "Focus on Friction & Effort (form optimization, field count, inline validation), Trust & Credibility (social proof, guarantees), and UX Clarity (clear CTA, value exchange messaging).",
  "product-page": "Focus on Trust & Credibility (reviews, ratings, images, guarantees), UX Clarity (value proposition, feature presentation), and Friction & Effort (add-to-cart friction, decision complexity).",
  "landing-marketing": "Focus on UX Clarity (hero messaging, single dominant CTA), Intent Match (message consistency), and Trust & Credibility (social proof, testimonials). Conversion funnel should be tight.",
  "landing-paid-media": "Focus heavily on Intent Match (ad-to-page message consistency, keyword alignment), UX Clarity (attention ratio, single CTA), and Speed & Performance (bounce prevention). Every element must reinforce the paid traffic's intent.",
};

const ANALYSIS_TYPE_LABELS = {
  homepage: "Homepage", "blog-content": "Blog / Content", checkout: "Checkout",
  "lead-form": "Lead / Form", "product-page": "Product Page",
  "landing-marketing": "Landing Page — Marketing", "landing-paid-media": "Landing Page — Paid Media",
};

export function buildAnalysisPrompt(analysisType, markdown, url, device) {
  const typeLabel = ANALYSIS_TYPE_LABELS[analysisType] || analysisType;
  const emphasis = ANALYSIS_TYPE_EMPHASIS[analysisType] || ANALYSIS_TYPE_EMPHASIS.homepage;
  const deviceBench = DEVICE_BENCHMARKS[device] || DEVICE_BENCHMARKS.desktop;

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
- UX Clarity × 0.20
- Trust & Credibility × 0.20
- Friction & Effort × 0.20
- Speed & Performance × 0.15
- Intent Match × 0.15
- Funnel Health × 0.10

Severity mapping: 90–100 = Elite | 75–89 = Strong | 50–74 = Needs Optimization | 30–49 = High Friction | <30 = Broken

## PENALTY RULES
- If load time appears >4s → cap total score at 60
- If no trust signals found → reduce score by 20%
- If checkout has >3 steps or >5 form fields → cap Friction at 50

## DEVICE BENCHMARKS (Global Averages)
- Conversion Rate: ${deviceBench.conversionRate}
- Add-to-Cart Rate: ${deviceBench.addToCart}
- Cart Abandonment: ${deviceBench.cartAbandonment}
- Traffic Share: ${deviceBench.trafficShare}

## THE 100+ RULE ENGINE — Evaluate against ALL of these:
${RULES_REFERENCE}

## ANALYSIS INSTRUCTIONS
1. Evaluate the page content against EVERY relevant rule in the engine above
2. For each FAILED rule, generate a friction point
3. Use the scoring system to calculate category scores and an overall conversion score
4. Prioritize the TOP issues by revenue impact — not just a generic checklist
5. Be SPECIFIC, not generic. Instead of "Improve CTA" → "Your CTA is below the fold on mobile — 73% of users never see it"
6. Include ROI estimation where possible: "Fixing this could increase conversion by X%"
7. Group issues into insight clusters: Trust Gap, Clarity Gap, Effort Gap, Motivation Gap

For each friction point, provide:
- category: one of "ux-clarity", "trust-credibility", "friction-effort", "speed-performance", "intent-match", "funnel-health"
- severity: "high" | "med" | "low"
- title: concise (max 8 words)
- description: specific explanation with ${device} observations. Be insight-driven, not checklist-driven.
- selector: CSS selector or page area
- fix: specific, actionable fix for ${device}
- impactScore: 1–100 estimated conversion impact
- roiEstimate: string like "Could increase conversion by 5-12%" or "May reduce bounce by 15%"
- insightCluster: one of "Trust Gap", "Clarity Gap", "Effort Gap", "Motivation Gap", "Speed Gap"
- benchmark: { industryAvg (0-100), topPerformers (0-100), label (what's measured) }
- abTest: { testName, hypothesis, control, variant, metric, duration }

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
    "ux-clarity": { "score": 65, "passed": 14, "total": 20, "industryAvg": 55 },
    "trust-credibility": { "score": 45, "passed": 9, "total": 20, "industryAvg": 55 },
    "friction-effort": { "score": 52, "passed": 13, "total": 25, "industryAvg": 50 },
    "speed-performance": { "score": 70, "passed": 11, "total": 15, "industryAvg": 60 },
    "intent-match": { "score": 58, "passed": 9, "total": 15, "industryAvg": 55 },
    "funnel-health": { "score": 50, "passed": 7, "total": 15, "industryAvg": 50 }
  },
  "frictionPoints": [
    {
      "category": "ux-clarity",
      "severity": "high",
      "title": "CTA buried below the fold",
      "description": "The primary CTA is not visible without scrolling...",
      "selector": ".hero-section",
      "fix": "Move primary CTA above the fold...",
      "impactScore": 85,
      "roiEstimate": "Could increase click-through by 15-25%",
      "insightCluster": "Clarity Gap",
      "benchmark": { "industryAvg": 60, "topPerformers": 90, "label": "CTA Visibility Score" },
      "abTest": { "testName": "CTA Placement", "hypothesis": "...", "control": "...", "variant": "...", "metric": "...", "duration": "2 weeks" }
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
