# Analysis Route OpenAI Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the `analyze-url` and `ai-analyze` Supabase Edge Functions into an Express route calling OpenAI directly, then remove Supabase and Lovable entirely from the codebase — this is the last remaining dependency on either.

**Architecture:** The same two-step flow (Firecrawl scrape → AI scoring, with a heuristic fallback when AI is unavailable) moves into three focused server modules (`analysisPrompt.js` for the prompt/constants, `heuristicAnalysis.js` for the rule-based fallback, `openai.js` for the direct OpenAI call) plus one Express route (`server/routes/analyze.js`) that wires them together exactly like `analyze-url/index.ts` did. The client's `src/lib/api/analyze.ts` swaps its `supabase.functions.invoke` call for a plain `fetch` to the new route, keeping the exact same function signature and error-throwing contract so no other file that calls `analyzeUrl()` needs to change. Once this lands, `src/integrations/supabase/`, `src/integrations/lovable/`, and the entire `supabase/` directory are deleted.

**Tech Stack:** Express (existing), `fetch` (built into Node 24, no library needed), Vitest + `supertest` (existing).

## Global Constraints

- Reference spec: `docs/superpowers/specs/2026-07-01-node-hostinger-redesign-design.md` §4 (`ai-analyze`/`analyze-url` rows).
- The client-facing contract of `analyzeUrl(url, analysisType, device): Promise<AnalysisResult>` (from `src/lib/mockData.ts`) does not change — it still throws on failure and resolves to the same `AnalysisResult` shape, since `Index.tsx` and `BulkAnalysis.tsx` both call it and aren't part of this plan.
- Any failure of the AI step (network error, non-2xx response, missing content, malformed JSON) falls back to the heuristic analysis — this matches `analyze-url/index.ts`'s existing behavior exactly (it never surfaces AI-specific error messages to the caller, just silently falls back).
- `GEO_BENCHMARKS` from the original `analyze-url/index.ts` is dead code (defined, never referenced anywhere in that file) — it is not ported.
- New env var: `OPENAI_API_KEY`. `FIRECRAWL_API_KEY` (already used) needs adding to `.env.example` since it was never documented there.
- Supabase and Lovable are only removed in the final task, after the new route is proven working — don't delete them early and leave the app broken mid-plan.

---

### Task 1: Port the analysis prompt builder

**Files:**
- Create: `server/lib/analysisPrompt.js`
- Test: `server/lib/analysisPrompt.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `buildAnalysisPrompt(analysisType, markdown, url, device): string` — consumed by Task 4's route

- [ ] **Step 1: Write the failing test**

Create `server/lib/analysisPrompt.test.js`:

```js
import { describe, it, expect } from "vitest";
import { buildAnalysisPrompt } from "./analysisPrompt.js";

describe("buildAnalysisPrompt", () => {
  it("includes the URL, page type label, and device in the prompt", () => {
    const prompt = buildAnalysisPrompt("checkout", "# Some page content", "https://example.com", "desktop");
    expect(prompt).toContain("URL: https://example.com");
    expect(prompt).toContain("Page Type: Checkout");
    expect(prompt).toContain("Device: DESKTOP");
  });

  it("uses mobile-specific guidance for the mobile device", () => {
    const prompt = buildAnalysisPrompt("homepage", "content", "https://example.com", "mobile");
    expect(prompt).toContain("MOBILE experience");
    expect(prompt).toContain("touch targets (44px min)");
  });

  it("uses desktop-specific guidance for the desktop device", () => {
    const prompt = buildAnalysisPrompt("homepage", "content", "https://example.com", "desktop");
    expect(prompt).toContain("DESKTOP experience");
  });

  it("truncates page content to 14000 characters", () => {
    const longMarkdown = "x".repeat(20000);
    const prompt = buildAnalysisPrompt("homepage", longMarkdown, "https://example.com", "desktop");
    const contentSection = prompt.split("PAGE CONTENT:\n")[1];
    expect(contentSection.length).toBe(14000);
  });

  it("falls back to homepage emphasis for an unrecognized analysis type", () => {
    const prompt = buildAnalysisPrompt("unknown-type", "content", "https://example.com", "desktop");
    expect(prompt).toContain("Homepage is the gateway");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/lib/analysisPrompt.test.js`
Expected: FAIL — `Cannot find module './analysisPrompt.js'`

- [ ] **Step 3: Write `server/lib/analysisPrompt.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/lib/analysisPrompt.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/analysisPrompt.js server/lib/analysisPrompt.test.js
git commit -m "Port the analysis prompt builder to server/lib"
```

---

### Task 2: Port the heuristic fallback analysis

**Files:**
- Create: `server/lib/heuristicAnalysis.js`
- Test: `server/lib/heuristicAnalysis.test.js`

**Interfaces:**
- Consumes: `SCORING_CATEGORIES` from `server/lib/analysisPrompt.js` (Task 1)
- Produces: `generateHeuristicAnalysis(markdown, url, analysisType, device, screenshotUrl): AnalysisResult` — consumed by Task 4's route as the AI-unavailable fallback

- [ ] **Step 1: Write the failing test**

Create `server/lib/heuristicAnalysis.test.js`:

```js
import { describe, it, expect } from "vitest";
import { generateHeuristicAnalysis } from "./heuristicAnalysis.js";

describe("generateHeuristicAnalysis", () => {
  it("flags weak content hierarchy when there are fewer than 3 headings", () => {
    const result = generateHeuristicAnalysis("Just some plain text with no headings at all.", "https://example.com", "homepage", "desktop", null);
    const titles = result.frictionPoints.map((p) => p.title);
    expect(titles).toContain("Weak content hierarchy");
  });

  it("flags missing pricing on a paid landing page", () => {
    const markdown = "# Welcome\nGet started today with our amazing product for everyone.";
    const result = generateHeuristicAnalysis(markdown, "https://example.com", "landing-paid-media", "desktop", null);
    const titles = result.frictionPoints.map((p) => p.title);
    expect(titles).toContain("Paid landing page lacks pricing");
  });

  it("adds mobile-specific tap-target findings on mobile", () => {
    const result = generateHeuristicAnalysis("# Heading\n## Sub\n### Sub2\nGet started now.", "https://example.com", "homepage", "mobile", null);
    const titles = result.frictionPoints.map((p) => p.title);
    expect(titles).toContain("Mobile tap targets need review");
  });

  it("computes a conversion score, grade, and sorted friction points", () => {
    const result = generateHeuristicAnalysis("content with no structure", "https://example.com", "homepage", "desktop", "https://shot.example/img.png");
    expect(typeof result.conversionScore).toBe("number");
    expect(result.grade).toBeTruthy();
    expect(result.screenshotUrl).toBe("https://shot.example/img.png");
    for (let i = 1; i < result.frictionPoints.length; i++) {
      expect(result.frictionPoints[i - 1].impactScore).toBeGreaterThanOrEqual(result.frictionPoints[i].impactScore);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/lib/heuristicAnalysis.test.js`
Expected: FAIL — `Cannot find module './heuristicAnalysis.js'`

- [ ] **Step 3: Write `server/lib/heuristicAnalysis.js`**

```js
import { SCORING_CATEGORIES } from "./analysisPrompt.js";

export function generateHeuristicAnalysis(markdown, url, analysisType, device, screenshotUrl) {
  const points = [];
  const lower = markdown.toLowerCase();
  const wordCount = markdown.split(/\s+/).length;
  const isMobile = device === "mobile";
  const headingCount = (markdown.match(/^#{1,3}\s/gm) || []).length;
  const linkCount = (markdown.match(/\[.*?\]\(.*?\)/g) || []).length;
  const imageCount = (markdown.match(/!\[/g) || []).length;
  const formIndicators = (lower.match(/\b(input|form|submit|email|password|name|phone|address)\b/g) || []).length;
  const hasReviews = /review|testimonial|rating|stars?|★/i.test(lower);
  const hasTrustBadges = /ssl|secure|trust|verified|guarantee|money.?back|badge|certified/i.test(lower);
  const hasSocialProof = /\d+[\s,]*\+?\s*(users?|customers?|clients?|companies|businesses|downloads?)/i.test(lower);
  const hasPricing = /\$\d|pricing|price|cost|free trial|per month|\/mo/i.test(lower);
  const hasFaq = /faq|frequently asked|common questions/i.test(lower);
  const hasContact = /contact|phone|tel:|email us|chat|support/i.test(lower);
  const ctaWords = (lower.match(/\b(buy|subscribe|sign up|get started|try|start|download|join|book|request|order|add to cart)\b/gi) || []).length;

  const addPoint = (category, severity, title, description, selector, fix, impactScore, roiEstimate, cluster, benchLabel) => {
    points.push({
      id: `fp-${points.length + 1}`, category, severity, title, description, selector, fix,
      impactScore, roiEstimate, insightCluster: cluster, screenshotUrl,
      benchmark: { industryAvg: Math.round(impactScore * 0.6), topPerformers: Math.round(impactScore * 1.1), label: benchLabel },
      abTest: { testName: `${title} Test`, hypothesis: `Fixing "${title}" improves conversion`, control: "Current state", variant: "Optimized version", metric: "Conversion rate", duration: "2 weeks" },
    });
  };

  // ── UX Clarity rules ──
  if (headingCount < 3) {
    addPoint("ux-clarity", "high", "Weak content hierarchy", `Only ${headingCount} headings detected. Users can't scan the page effectively.${isMobile ? " Critical on mobile where screen real estate is limited." : ""}`, "h1, h2, h3", "Add clear H2/H3 headings to create a scannable content structure. Each section should have a descriptive heading.", 75, "Could improve scroll depth by 15-25%", "Clarity Gap", "Content Structure Score");
  }
  if (ctaWords < 1) {
    addPoint("ux-clarity", "high", "No clear call-to-action found", "Page lacks action-oriented language. Users have no clear next step, which directly kills conversion.", "body", "Add a prominent, action-oriented CTA above the fold. Use verbs like 'Get Started', 'Try Free', 'Buy Now'.", 90, "Could increase conversion by 20-40%", "Clarity Gap", "CTA Presence Score");
  } else if (ctaWords > 6) {
    addPoint("ux-clarity", "med", "Too many competing CTAs", `${ctaWords} action phrases found. Multiple CTAs create decision paralysis and dilute the primary conversion path.`, "button, a.cta", "Establish one dominant CTA. Secondary actions should be visually subordinate.", 65, "Could increase primary CTA clicks by 10-18%", "Clarity Gap", "CTA Focus Score");
  }
  if (linkCount > 20) {
    addPoint("ux-clarity", "med", "Navigation overload detected", `${linkCount} links found. ${isMobile ? "On mobile, dense links cause mis-taps." : "Excessive choices create decision paralysis."} Best practice is ≤7 primary nav items.`, "nav, header", isMobile ? "Use hamburger menu with 5-7 items max. Ensure 44px tap targets." : "Reduce to 5-7 primary links. Group secondary items in dropdowns.", 62, "Could increase CTA click-through by 10%", "Clarity Gap", "Navigation Simplicity");
  }

  // ── Trust & Credibility rules ──
  if (!hasReviews) {
    addPoint("trust-credibility", "high", "No customer reviews or ratings", "Reviews are the #1 trust signal for conversion. Their absence reduces purchase confidence significantly.", "main, .reviews", "Add customer reviews with star ratings. Even 5-10 reviews dramatically improve trust.", 82, "Could increase conversion by 15-30%", "Trust Gap", "Social Proof Score");
  }
  if (!hasTrustBadges) {
    addPoint("trust-credibility", "high", "Missing trust and security badges", "No trust badges, security seals, or guarantees detected. Users need reassurance, especially before providing personal data or payment.", "footer, .checkout", "Add trust badges (SSL, payment security, money-back guarantee) near CTAs and forms.", 78, "Could increase form completion by 12-20%", "Trust Gap", "Trust Badge Score");
  }
  if (!hasSocialProof) {
    addPoint("trust-credibility", "med", "No social proof indicators", "No user counts, customer logos, or usage statistics found. Social proof validates the decision to convert.", "header, .hero", "Add social proof: '10,000+ customers', client logos, or usage statistics near the hero section.", 68, "Could increase trust perception by 25%", "Trust Gap", "Social Proof Presence");
  }
  if (!hasContact) {
    addPoint("trust-credibility", "med", "No visible contact information", `No phone, email, or chat found. ${isMobile ? "Mobile users expect tap-to-call." : "Reduces trust for cautious visitors."}`, "header, footer", isMobile ? "Add tap-to-call in mobile header or sticky contact bar." : "Add phone number and live chat to header/footer.", 65, "Could increase form submissions by 12%", "Trust Gap", "Contact Visibility");
  }
  if (!hasFaq) {
    addPoint("trust-credibility", "low", "No FAQ section detected", "FAQs address objections pre-emptively and reduce support burden while improving conversion confidence.", "main", "Add an FAQ section addressing top 5-8 customer objections.", 45, "Could reduce bounce by 5-8%", "Trust Gap", "FAQ Presence");
  }

  // ── Friction & Effort rules ──
  if (formIndicators > 8) {
    addPoint("friction-effort", "high", "Form appears overly complex", `${formIndicators} form-related elements detected. Best practice is ≤5 fields. Every extra field drops conversion ~5-10%.`, "form, input", "Reduce to essential fields only. Use progressive disclosure or multi-step forms for complexity.", 85, "Could increase form completion by 20-35%", "Effort Gap", "Form Complexity Score");
  }
  if (wordCount > 2500 && (analysisType === "lead-form" || analysisType === "checkout" || analysisType === "landing-paid-media")) {
    addPoint("friction-effort", "med", "Excessive content for conversion page", `~${wordCount} words on a ${analysisType} page. Conversion-focused pages should be concise and action-oriented.`, "main", "Trim content to essentials. Use expandable sections for details. Keep focus on the conversion action.", 60, "Could reduce bounce by 10-15%", "Effort Gap", "Content Conciseness");
  }

  // ── Speed & Performance rules ──
  if (isMobile) {
    addPoint("speed-performance", "high", "Mobile performance critical", "Mobile users on cellular connections need optimized loading. ~53% of mobile users abandon sites that take >3s to load.", "head, body", "Implement critical CSS inlining, lazy-load below-fold images, use responsive srcset, minimize JS.", 82, "Could reduce mobile bounce by 15-25%", "Speed Gap", "Mobile Performance Score");
  }
  if (imageCount > 10 && !lower.includes("lazy")) {
    addPoint("speed-performance", "med", "Many images without lazy loading", `${imageCount} images detected with no evidence of lazy loading. This increases initial page weight and load time.`, "img", "Add loading='lazy' to below-fold images. Use modern formats (WebP/AVIF) and responsive srcset.", 65, "Could improve load time by 20-40%", "Speed Gap", "Image Optimization");
  }

  // ── Intent Match rules ──
  if (analysisType === "landing-paid-media" && !hasPricing) {
    addPoint("intent-match", "high", "Paid landing page lacks pricing", "Users from paid ads expect immediate pricing clarity. Missing pricing creates friction and increases bounce.", "main, .pricing", "Add clear pricing or 'Starting from $X' near the hero. Paid traffic has high intent — don't make them search.", 80, "Could reduce bounce by 20-30%", "Motivation Gap", "Pricing Clarity");
  }
  if (analysisType === "product-page" && !hasPricing) {
    addPoint("intent-match", "high", "Product page missing pricing", "No pricing information detected. Price transparency is essential for purchase decisions.", ".product, main", "Display pricing prominently with any applicable discounts or payment options.", 85, "Could increase add-to-cart by 15-25%", "Motivation Gap", "Pricing Visibility");
  }

  // ── Mobile-specific rules ──
  if (isMobile) {
    addPoint("friction-effort", "high", "Mobile tap targets need review", "Interactive elements must be ≥44x44px with adequate spacing. Small/close buttons cause mis-taps and frustration.", "button, a, input", "Ensure all tap targets are minimum 44x44px with 8px+ spacing between interactive elements.", 78, "Could reduce mobile error rate by 30%", "Effort Gap", "Tap Target Compliance");
  }

  // ── Compute scores ──
  const catKeys = Object.keys(SCORING_CATEGORIES);
  const categoryScores = {};
  let weightedTotal = 0;

  for (const cat of catKeys) {
    const catPoints = points.filter((p) => p.category === cat);
    const maxRules = cat === "friction-effort" ? 25 : cat === "ux-clarity" || cat === "trust-credibility" ? 20 : 15;
    const failedCount = catPoints.length;
    const passed = maxRules - failedCount;
    const score = Math.max(10, Math.round((passed / maxRules) * 100));
    categoryScores[cat] = { score, passed, total: maxRules, industryAvg: 55 };
    weightedTotal += score * SCORING_CATEGORIES[cat].weight;
  }

  const overallScore = Math.round(weightedTotal);
  let grade = "Needs Optimization";
  if (overallScore >= 90) grade = "Elite";
  else if (overallScore >= 75) grade = "Strong";
  else if (overallScore >= 50) grade = "Needs Optimization";
  else if (overallScore >= 30) grade = "High Friction";
  else grade = "Broken Experience";

  let cappedScore = overallScore;
  if (!hasTrustBadges && !hasReviews) cappedScore = Math.round(cappedScore * 0.8);

  const topIssues = points
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 3)
    .map((p) => p.title);

  return {
    url,
    timestamp: new Date().toISOString(),
    device,
    analysisType,
    screenshotUrl,
    conversionScore: cappedScore,
    grade,
    topIssues,
    insightSummary: {
      trustGap: points.filter((p) => p.insightCluster === "Trust Gap").length > 0 ? "Trust signals are insufficient — missing reviews, badges, or social proof." : "Trust signals appear adequate.",
      clarityGap: points.filter((p) => p.insightCluster === "Clarity Gap").length > 0 ? "Page clarity needs improvement — CTA, hierarchy, or navigation issues detected." : "Page clarity is reasonable.",
      effortGap: points.filter((p) => p.insightCluster === "Effort Gap").length > 0 ? "User effort is too high — forms, interactions, or cognitive load need reduction." : "Effort level appears manageable.",
      motivationGap: points.filter((p) => p.insightCluster === "Motivation Gap").length > 0 ? "Motivation drivers are weak — pricing, value prop, or urgency missing." : "Motivation signals are present.",
      speedGap: points.filter((p) => p.insightCluster === "Speed Gap").length > 0 ? "Performance concerns detected — load time or resource optimization needed." : "Performance appears acceptable.",
    },
    frictionPoints: points.sort((a, b) => b.impactScore - a.impactScore),
    benchmark: {
      overallScore: cappedScore,
      industryAvg: 55,
      topQuartile: 78,
      categoryScores,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/lib/heuristicAnalysis.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/heuristicAnalysis.js server/lib/heuristicAnalysis.test.js
git commit -m "Port the heuristic fallback analysis to server/lib"
```

---

### Task 3: Direct OpenAI call wrapper

**Files:**
- Create: `server/lib/openai.js`
- Test: `server/lib/openai.test.js`

**Interfaces:**
- Consumes: `OPENAI_API_KEY` env var
- Produces: `callOpenAI(prompt): Promise<object>` — resolves to the parsed JSON analysis object, or throws on any failure (network error, non-2xx, missing content, malformed JSON). Consumed by Task 4's route.

- [ ] **Step 1: Write the failing tests**

Create `server/lib/openai.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
global.fetch = fetchMock;

process.env.OPENAI_API_KEY = "test-openai-key";

const { callOpenAI } = await import("./openai.js");

describe("callOpenAI", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("returns the parsed JSON from a successful response", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"conversionScore": 70}' } }] }),
    });

    const result = await callOpenAI("some prompt");

    expect(result).toEqual({ conversionScore: 70 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-openai-key" }),
      })
    );
  });

  it("strips markdown code fences before parsing", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '```json\n{"conversionScore": 55}\n```' } }] }),
    });

    const result = await callOpenAI("some prompt");
    expect(result).toEqual({ conversionScore: 55 });
  });

  it("throws when the response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, text: async () => "rate limited" });
    await expect(callOpenAI("some prompt")).rejects.toThrow();
  });

  it("throws when there is no content in the response", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) });
    await expect(callOpenAI("some prompt")).rejects.toThrow("No response from AI model");
  });

  it("throws when the content isn't valid JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "not json at all" } }] }),
    });
    await expect(callOpenAI("some prompt")).rejects.toThrow("Failed to parse AI analysis results");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/lib/openai.test.js`
Expected: FAIL — `Cannot find module './openai.js'`

- [ ] **Step 3: Write `server/lib/openai.js`**

```js
export async function callOpenAI(prompt) {
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
    body: JSON.stringify({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "You are a senior CRO (Conversion Rate Optimization) expert. You analyze web pages for friction points and provide specific, actionable recommendations. Always return valid JSON only, no markdown formatting or code blocks.",
        },
        { role: "user", content: prompt },
      ],
    }),
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/lib/openai.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/openai.js server/lib/openai.test.js
git commit -m "Add direct OpenAI call wrapper, replacing Lovable's AI gateway"
```

---

### Task 4: Express analysis route

**Files:**
- Create: `server/routes/analyze.js`
- Test: `server/routes/analyze.test.js`
- Modify: `server.js`

**Interfaces:**
- Consumes: `buildAnalysisPrompt` (Task 1), `generateHeuristicAnalysis` (Task 2), `callOpenAI` (Task 3), `FIRECRAWL_API_KEY` env var
- Produces: `POST /api/analyze/analyze-url` returning `{ success: true, data: AnalysisResult }` or `{ success: false, error: string }` — consumed by Task 5's client code

- [ ] **Step 1: Write the failing tests**

Create `server/routes/analyze.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const buildAnalysisPromptMock = vi.fn(() => "built-prompt");
const generateHeuristicAnalysisMock = vi.fn();
const callOpenAIMock = vi.fn();

vi.mock("../lib/analysisPrompt.js", () => ({
  buildAnalysisPrompt: (...args) => buildAnalysisPromptMock(...args),
}));
vi.mock("../lib/heuristicAnalysis.js", () => ({
  generateHeuristicAnalysis: (...args) => generateHeuristicAnalysisMock(...args),
}));
vi.mock("../lib/openai.js", () => ({
  callOpenAI: (...args) => callOpenAIMock(...args),
}));

const fetchMock = vi.fn();
global.fetch = fetchMock;

const { default: analyzeRouter } = await import("./analyze.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/analyze", analyzeRouter);
  return app;
}

describe("POST /api/analyze/analyze-url", () => {
  beforeEach(() => {
    buildAnalysisPromptMock.mockClear();
    generateHeuristicAnalysisMock.mockReset();
    callOpenAIMock.mockReset();
    fetchMock.mockReset();
    process.env.FIRECRAWL_API_KEY = "test-firecrawl-key";
  });

  it("returns 400 when the URL is missing", async () => {
    const res = await request(buildApp()).post("/api/analyze/analyze-url").send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: "URL is required" });
  });

  it("returns the scrape error when Firecrawl fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: "Scrape blocked" }) });

    const res = await request(buildApp())
      .post("/api/analyze/analyze-url")
      .send({ url: "example.com" });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ success: false, error: "Scrape blocked" });
  });

  it("returns AI-analyzed results on the happy path", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { markdown: "# Page content", screenshot: "https://shot.example/a.png" } }),
    });
    callOpenAIMock.mockResolvedValue({
      conversionScore: 72,
      grade: "Strong",
      topIssues: ["Issue A"],
      insightSummary: {},
      categoryScores: {},
      frictionPoints: [{ category: "ux-clarity", severity: "high", title: "Test issue", impactScore: 80 }],
    });

    const res = await request(buildApp())
      .post("/api/analyze/analyze-url")
      .send({ url: "example.com", analysisType: "homepage", device: "desktop" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.conversionScore).toBe(72);
    expect(res.body.data.frictionPoints[0].screenshotUrl).toBe("https://shot.example/a.png");
    expect(generateHeuristicAnalysisMock).not.toHaveBeenCalled();
  });

  it("falls back to the heuristic analysis when the AI call fails", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { markdown: "# Page content", screenshot: null } }),
    });
    callOpenAIMock.mockRejectedValue(new Error("AI unavailable"));
    generateHeuristicAnalysisMock.mockReturnValue({ conversionScore: 40, frictionPoints: [] });

    const res = await request(buildApp())
      .post("/api/analyze/analyze-url")
      .send({ url: "example.com", analysisType: "homepage", device: "desktop" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { conversionScore: 40, frictionPoints: [] } });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/routes/analyze.test.js`
Expected: FAIL — `Cannot find module './analyze.js'`

- [ ] **Step 3: Write `server/routes/analyze.js`**

```js
import express from "express";
import { buildAnalysisPrompt } from "../lib/analysisPrompt.js";
import { generateHeuristicAnalysis } from "../lib/heuristicAnalysis.js";
import { callOpenAI } from "../lib/openai.js";

const router = express.Router();

router.post("/analyze-url", async (req, res) => {
  try {
    const { url, analysisType = "homepage", device = "desktop" } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: "URL is required" });
    }

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey) {
      return res.status(500).json({ success: false, error: "Firecrawl connector not configured" });
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["markdown", "links", "screenshot"],
        onlyMainContent: false,
        waitFor: 2000,
        ...(device === "mobile" ? { mobile: true } : {}),
      }),
    });

    const scrapeData = await scrapeRes.json();

    if (!scrapeRes.ok) {
      console.error("Firecrawl error:", scrapeData);
      return res.status(scrapeRes.status).json({ success: false, error: scrapeData.error || `Scrape failed (${scrapeRes.status})` });
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    const screenshotUrl = scrapeData.data?.screenshot || scrapeData.screenshot || null;

    if (!markdown) {
      return res.status(422).json({ success: false, error: "No content extracted from URL" });
    }

    const prompt = buildAnalysisPrompt(analysisType, markdown, formattedUrl, device);

    let aiData;
    try {
      aiData = await callOpenAI(prompt);
    } catch (err) {
      console.log("AI analysis unavailable, using heuristic analysis:", err.message);
      const heuristicResult = generateHeuristicAnalysis(markdown, formattedUrl, analysisType, device, screenshotUrl);
      return res.json({ success: true, data: heuristicResult });
    }

    const frictionPoints = (aiData.frictionPoints || []).map((fp, i) => ({
      id: `fp-${i + 1}`,
      category: fp.category || "ux-clarity",
      severity: fp.severity || "med",
      title: fp.title || "Issue detected",
      description: fp.description || "",
      selector: fp.selector || "body",
      fix: fp.fix || "",
      impactScore: fp.impactScore || 50,
      roiEstimate: fp.roiEstimate || "",
      insightCluster: fp.insightCluster || "",
      screenshotUrl,
      benchmark: fp.benchmark || { industryAvg: 50, topPerformers: 80, label: "Score" },
      abTest: fp.abTest || { testName: "", hypothesis: "", control: "", variant: "", metric: "", duration: "" },
    }));

    const result = {
      url: formattedUrl,
      timestamp: new Date().toISOString(),
      device,
      analysisType,
      screenshotUrl,
      conversionScore: aiData.conversionScore || aiData.benchmark?.overallScore || 50,
      grade: aiData.grade || "Needs Optimization",
      topIssues: aiData.topIssues || [],
      insightSummary: aiData.insightSummary || {},
      frictionPoints,
      benchmark: {
        overallScore: aiData.conversionScore || aiData.benchmark?.overallScore || 50,
        industryAvg: aiData.benchmark?.industryAvg || 55,
        topQuartile: aiData.benchmark?.topQuartile || 78,
        categoryScores: aiData.categoryScores || aiData.benchmark?.categoryScores || {},
      },
    };

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Analysis failed" });
  }
});

export default router;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/routes/analyze.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Mount the router in `server.js`**

In `server.js`, add the import alongside the existing `paypalRouter` import:

```javascript
import analyzeRouter from "./server/routes/analyze.js";
```

And mount it alongside the existing `app.use("/api/paypal", paypalRouter);` line:

```javascript
app.use("/api/analyze", analyzeRouter);
```

- [ ] **Step 6: Boot-verify the server**

```bash
npm run build
node server.js &
sleep 1
curl -s http://localhost:3000/api/health
kill %1
```

Expected: `{"status":"ok"}`

- [ ] **Step 7: Commit**

```bash
git add server.js server/routes/analyze.js server/routes/analyze.test.js
git commit -m "Add Express analysis route wiring Firecrawl + OpenAI + heuristic fallback"
```

---

### Task 5: Point the client at the new route

**Files:**
- Modify: `src/lib/api/analyze.ts`
- Test: `src/lib/api/analyze.test.ts`

**Interfaces:**
- Consumes: `POST /api/analyze/analyze-url` (Task 4)
- Produces: `analyzeUrl(url, analysisType, device): Promise<AnalysisResult>` — same signature as before, still consumed unchanged by `Index.tsx` and `BulkAnalysis.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/api/analyze.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeUrl } from "./analyze";

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

describe("analyzeUrl", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("posts to the analyze-url route and returns the result data", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { conversionScore: 65 } }),
    });

    const result = await analyzeUrl("https://example.com", "homepage", "desktop");

    expect(result).toEqual({ conversionScore: 65 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analyze/analyze-url",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ url: "https://example.com", analysisType: "homepage", device: "desktop" }),
      })
    );
  });

  it("throws when the response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ success: false, error: "Scrape failed" }) });
    await expect(analyzeUrl("https://example.com", "homepage", "desktop")).rejects.toThrow("Scrape failed");
  });

  it("throws when success is false even with a 200 status", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: false, error: "No content extracted" }) });
    await expect(analyzeUrl("https://example.com", "homepage", "desktop")).rejects.toThrow("No content extracted");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/api/analyze.test.ts`
Expected: FAIL (current implementation calls `supabase.functions.invoke`, never `fetch`)

- [ ] **Step 3: Replace the entire contents of `src/lib/api/analyze.ts`**

```ts
import type { AnalysisResult, AnalysisType } from '@/lib/mockData';

export async function analyzeUrl(url: string, analysisType: AnalysisType, device: "desktop" | "mobile" = "desktop"): Promise<AnalysisResult> {
  const response = await fetch('/api/analyze/analyze-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, analysisType, device }),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || 'Analysis failed');
  }

  return data.data as AnalysisResult;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/api/analyze.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/analyze.ts src/lib/api/analyze.test.ts
git commit -m "Point analyzeUrl at the new Express route instead of Supabase"
```

---

### Task 6: Remove Supabase and Lovable entirely

**Files:**
- Delete: `src/integrations/supabase/client.ts`
- Delete: `src/integrations/supabase/types.ts`
- Delete: `src/integrations/lovable/index.ts`
- Delete: `supabase/` (entire directory — `functions/`, `migrations/`, `config.toml`)
- Modify: `package.json` (remove `@supabase/supabase-js` and `@lovable.dev/cloud-auth-js`)
- Modify: `.env.example` (remove Supabase vars, add `OPENAI_API_KEY` and `FIRECRAWL_API_KEY`)

**Interfaces:**
- Consumes: nothing (this is a pure removal task, safe now that Task 5 removed the last consumer)
- Produces: nothing new

- [ ] **Step 1: Confirm nothing still references Supabase or Lovable**

```bash
grep -rln "supabase\|lovable" src --include="*.ts" --include="*.tsx"
```

Expected: no output (empty) — if anything shows up, stop and investigate before deleting.

- [ ] **Step 2: Delete the files and directories**

```bash
rm -rf src/integrations/supabase src/integrations/lovable supabase
```

- [ ] **Step 3: Remove the unused dependencies**

```bash
npm uninstall @supabase/supabase-js @lovable.dev/cloud-auth-js
```

- [ ] **Step 4: Update `.env.example`**

Replace the entire contents of `.env.example`:

```
# Firebase (client)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_USE_FIREBASE_EMULATORS=false

# Firebase (server) — a dedicated Firebase Auth user, NOT a GCP service account.
# Create it in Firebase Console > Authentication > Users > Add user, with a
# long randomly-generated password. Must match firestore.rules' subscriptions
# match block if you use a different email than the default.
FIREBASE_SERVICE_EMAIL=experiments@genuinecro.com
FIREBASE_SERVICE_PASSWORD=

# PayPal (server)
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=

# Analysis (server)
FIRECRAWL_API_KEY=
OPENAI_API_KEY=
```

- [ ] **Step 5: Run the full test suite and type-check**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.app.json
```

Expected: all tests pass, no type errors. If `tsc` reports errors referencing deleted Supabase types, check whether any `.tsx`/`.ts` file still imports from `@/integrations/supabase` or `@/integrations/lovable` — the Step 1 grep should have caught this already, but re-verify.

- [ ] **Step 6: Boot-verify the full server one more time**

```bash
npm run build
node server.js &
sleep 1
curl -s http://localhost:3000/api/health
kill %1
```

Expected: `{"status":"ok"}`

- [ ] **Step 7: Commit**

```bash
git add -A -- package.json package-lock.json .env.example
git commit -m "Remove Supabase and Lovable entirely — fully migrated to Firebase/Express"
```

---

## What this plan does NOT cover (by design)

The visual redesign, Dashboard/IA shell, Monitoring, Action Center, Reports (PDF/white-label), Kit email/i18n, and the "Coming soon" placeholder sections are all still separate future plans — see `docs/superpowers/specs/2026-07-01-node-hostinger-redesign-design.md` and the companion roadmap doc. This plan's sole job is finishing the backend migration so the app has zero remaining Supabase/Lovable dependency.
