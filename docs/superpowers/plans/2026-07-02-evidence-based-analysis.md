# Evidence-Based Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ground Homepage and Checkout analysis findings in real, named, publicly-documented UX/CRO research, and make that evidence visible in the UI, instead of the AI's current uncited freeform findings.

**Architecture:** A new static data module (`server/lib/criteriaLibrary.js`) holds ~10 cited criteria each for `homepage` and `checkout`. `analysisPrompt.js` injects this list into the AI prompt for those two page types only, instructing the AI to cite a criterion's source when a finding matches it. The route passes the resulting `sourceCitation` field through untouched. The client's `FrictionCard`/`EvidencePanel` surface it when present.

**Tech Stack:** No new dependencies.

## Global Constraints

- Reference spec: `docs/superpowers/specs/2026-07-02-evidence-based-analysis-design.md`.
- Only `homepage` and `checkout` get criteria libraries in this plan — the other five page types (`blog-content`, `lead-form`, `product-page`, `landing-marketing`, `landing-paid-media`) are untouched.
- Criteria `category` values must be one of the six existing keys in `SCORING_CATEGORIES` (`server/lib/analysisPrompt.js`): `ux-clarity`, `trust-credibility`, `friction-effort`, `speed-performance`, `intent-match`, `funnel-health`.
- `sourceCitation` is optional on every friction point — the AI is not forced to manufacture one when a finding doesn't match a named criterion.
- `heuristicAnalysis.js` (the AI-failure fallback) is not touched — no fabricated citations there.

---

### Task 1: Criteria library data module

**Files:**
- Create: `server/lib/criteriaLibrary.js`
- Create: `server/lib/criteriaLibrary.test.js`

**Interfaces:**
- Produces: `CRITERIA_LIBRARY: { homepage: Criterion[], checkout: Criterion[] }` where `Criterion = { id: string, category: string, rule: string, guidance: string, source: string }` — consumed by Task 2 (`analysisPrompt.js`)

- [ ] **Step 1: Write the failing test**

Create `server/lib/criteriaLibrary.test.js`:

```js
import { describe, it, expect } from "vitest";
import { CRITERIA_LIBRARY } from "./criteriaLibrary.js";

const VALID_CATEGORIES = ["ux-clarity", "trust-credibility", "friction-effort", "speed-performance", "intent-match", "funnel-health"];

describe("CRITERIA_LIBRARY", () => {
  it("has ten criteria each for homepage and checkout", () => {
    expect(CRITERIA_LIBRARY.homepage).toHaveLength(10);
    expect(CRITERIA_LIBRARY.checkout).toHaveLength(10);
  });

  it("gives every criterion an id, a valid category, a rule, guidance, and a source", () => {
    for (const pageType of ["homepage", "checkout"]) {
      for (const criterion of CRITERIA_LIBRARY[pageType]) {
        expect(typeof criterion.id).toBe("string");
        expect(criterion.id.length).toBeGreaterThan(0);
        expect(VALID_CATEGORIES).toContain(criterion.category);
        expect(typeof criterion.rule).toBe("string");
        expect(criterion.rule.length).toBeGreaterThan(0);
        expect(typeof criterion.guidance).toBe("string");
        expect(criterion.guidance.length).toBeGreaterThan(0);
        expect(typeof criterion.source).toBe("string");
        expect(criterion.source.length).toBeGreaterThan(0);
      }
    }
  });

  it("has unique ids across both page types", () => {
    const allIds = [...CRITERIA_LIBRARY.homepage, ...CRITERIA_LIBRARY.checkout].map((c) => c.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/lib/criteriaLibrary.test.js`
Expected: FAIL — `Cannot find module './criteriaLibrary.js'`

- [ ] **Step 3: Write `server/lib/criteriaLibrary.js`**

```js
export const CRITERIA_LIBRARY = {
  homepage: [
    {
      id: "homepage-001",
      category: "ux-clarity",
      rule: "Value proposition clear within 5 seconds",
      guidance: "Visitors should understand what the site offers, for whom, and why it matters without scrolling or reading multiple sections.",
      source: "Nielsen Norman Group — research on above-the-fold attention and first impressions",
    },
    {
      id: "homepage-002",
      category: "ux-clarity",
      rule: "Single, high-contrast dominant call-to-action above the fold",
      guidance: "One clear next step should stand out, not several competing buttons of similar visual weight.",
      source: "Widely cited CRO research (CXL, Unbounce) on single-CTA pages outperforming multi-CTA pages",
    },
    {
      id: "homepage-003",
      category: "ux-clarity",
      rule: "F-pattern or Z-pattern visual hierarchy",
      guidance: "Key content should follow natural eye-tracking scan patterns rather than fighting against them.",
      source: "Nielsen Norman Group — \"F-Shaped Pattern For Reading Web Content\" eye-tracking studies",
    },
    {
      id: "homepage-004",
      category: "ux-clarity",
      rule: "Navigation limited to a manageable number of top-level items",
      guidance: "Fewer choices reduce decision time and cognitive load for a first-time visitor.",
      source: "Hick's Law (Hick, 1952; Hyman, 1953) — decision time increases with number of choices",
    },
    {
      id: "homepage-005",
      category: "trust-credibility",
      rule: "Trust signals visible without scrolling (reviews, security badges, recognizable customer logos)",
      guidance: "Visitors form trust judgments very quickly; signals need to be immediately visible, not buried below the fold.",
      source: "Baymard Institute's publicly available articles on trust signal placement",
    },
    {
      id: "homepage-006",
      category: "friction-effort",
      rule: "Mobile tap targets at least 44x44px",
      guidance: "Small tap targets cause mis-taps and frustration, especially in the primary navigation and CTA.",
      source: "Apple Human Interface Guidelines / Google Material Design accessibility guidance",
    },
    {
      id: "homepage-007",
      category: "speed-performance",
      rule: "Largest Contentful Paint under approximately 2.5 seconds",
      guidance: "Slow-loading hero content directly correlates with higher bounce rates before a visitor sees any value proposition.",
      source: "Google Core Web Vitals research correlating LCP with bounce and conversion rate",
    },
    {
      id: "homepage-008",
      category: "ux-clarity",
      rule: "No more than one primary decision presented at a time above the fold",
      guidance: "Too many simultaneous options increase abandonment through choice overload.",
      source: "Iyengar & Lepper (2000), \"When Choice is Demotivating\" — widely cited choice-overload research",
    },
    {
      id: "homepage-009",
      category: "ux-clarity",
      rule: "Body text meets WCAG AA contrast ratio (4.5:1 minimum)",
      guidance: "Low-contrast text reduces readability for all users and excludes visually impaired visitors entirely.",
      source: "WCAG 2.1 Success Criterion 1.4.3 (Contrast Minimum)",
    },
    {
      id: "homepage-010",
      category: "ux-clarity",
      rule: "Consistent visual language across sections (spacing, type, color use)",
      guidance: "Inconsistency increases cognitive load and undermines perceived credibility, even when each section looks fine in isolation.",
      source: "Nielsen's 10 Usability Heuristics — Consistency and Standards",
    },
  ],
  checkout: [
    {
      id: "checkout-001",
      category: "friction-effort",
      rule: "Guest checkout available (no forced account creation)",
      guidance: "Forcing account creation before purchase is one of the most consistently cited reasons for cart abandonment.",
      source: "Baymard Institute's publicly published checkout usability research",
    },
    {
      id: "checkout-002",
      category: "trust-credibility",
      rule: "Total cost including shipping and taxes shown before the final step",
      guidance: "Unexpected costs revealed late in checkout are consistently the top-cited reason for cart abandonment.",
      source: "Baymard Institute's publicly cited cart abandonment survey data (\"extra costs too high\" as a leading reason)",
    },
    {
      id: "checkout-003",
      category: "friction-effort",
      rule: "Visible progress indicator across checkout steps",
      guidance: "Users should always be able to see where they are in a multi-step process and how much remains.",
      source: "Nielsen's 10 Usability Heuristics — Visibility of System Status",
    },
    {
      id: "checkout-004",
      category: "friction-effort",
      rule: "Minimal form fields with inline validation",
      guidance: "Every additional field reduces completion rate; errors should be caught immediately, not after submission.",
      source: "Luke Wroblewski, \"Web Form Design: Filling in the Blanks\" — widely cited form-optimization research",
    },
    {
      id: "checkout-005",
      category: "friction-effort",
      rule: "Multiple payment methods available (card, digital wallets, etc.)",
      guidance: "Limited payment options exclude users who don't have or don't want to use the sole available method.",
      source: "Baymard Institute's publicly cited research on payment method availability and checkout completion",
    },
    {
      id: "checkout-006",
      category: "friction-effort",
      rule: "Clear, specific, non-technical error messages",
      guidance: "Generic or technical errors leave users unable to self-correct and often cause outright abandonment.",
      source: "Nielsen's 10 Usability Heuristics — Help Users Recognize, Diagnose, and Recover from Errors",
    },
    {
      id: "checkout-007",
      category: "trust-credibility",
      rule: "Security or trust badges near payment fields",
      guidance: "Visible reassurance at the moment of highest anxiety — entering payment details — measurably reduces abandonment.",
      source: "Established e-commerce trust research widely cited in CRO literature on trust-signal placement near sensitive form fields",
    },
    {
      id: "checkout-008",
      category: "friction-effort",
      rule: "Cart remains editable from within checkout (no dead-end flow)",
      guidance: "Users need to correct quantities or remove items without restarting the entire checkout process.",
      source: "Nielsen's 10 Usability Heuristics — User Control and Freedom",
    },
    {
      id: "checkout-009",
      category: "speed-performance",
      rule: "Checkout pages load quickly with no blocking scripts",
      guidance: "Performance issues at the checkout stage have an outsized impact on abandonment compared to other pages.",
      source: "Google Core Web Vitals research; checkout-stage performance sensitivity widely cited in e-commerce CRO literature",
    },
    {
      id: "checkout-010",
      category: "friction-effort",
      rule: "No unexpected interstitials or upsell interruptions during checkout",
      guidance: "Any interruption at this stage introduces a new decision point where the user can abandon the purchase entirely.",
      source: "General friction-reduction principle widely applied in checkout UX research",
    },
  ],
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/lib/criteriaLibrary.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/criteriaLibrary.js server/lib/criteriaLibrary.test.js
git commit -m "Add the evidence-based criteria library for Homepage and Checkout"
```

---

### Task 2: Inject criteria into the analysis prompt

**Files:**
- Modify: `server/lib/analysisPrompt.js`
- Modify: `server/lib/analysisPrompt.test.js`

**Interfaces:**
- Consumes: `CRITERIA_LIBRARY` (Task 1)
- Produces: no new exports — `buildAnalysisPrompt`'s return value changes for `homepage`/`checkout`, consumed by Task 3 (unaffected, since Task 3 only cares about the AI's JSON response shape)

- [ ] **Step 1: Check the current test file's structure**

Run: `cat server/lib/analysisPrompt.test.js` and note its existing test names before adding to it, so the new tests don't duplicate an existing description.

- [ ] **Step 2: Write the failing tests**

Add these two tests to `server/lib/analysisPrompt.test.js` (inside the existing `describe` block, alongside the current tests):

```js
  it("includes the named evidence-based criteria for homepage", () => {
    const prompt = buildAnalysisPrompt("homepage", "# Some content", "https://example.com", "desktop");
    expect(prompt).toContain("NAMED EVIDENCE-BASED CRITERIA");
    expect(prompt).toContain("homepage-001");
    expect(prompt).toContain("Nielsen Norman Group");
  });

  it("includes the named evidence-based criteria for checkout", () => {
    const prompt = buildAnalysisPrompt("checkout", "# Some content", "https://example.com", "desktop");
    expect(prompt).toContain("NAMED EVIDENCE-BASED CRITERIA");
    expect(prompt).toContain("checkout-001");
    expect(prompt).toContain("Baymard Institute");
  });

  it("does not include the evidence-based criteria section for other page types", () => {
    const prompt = buildAnalysisPrompt("product-page", "# Some content", "https://example.com", "desktop");
    expect(prompt).not.toContain("NAMED EVIDENCE-BASED CRITERIA");
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run server/lib/analysisPrompt.test.js`
Expected: FAIL — the new section doesn't exist in the prompt yet.

- [ ] **Step 4: Add the criteria injection to `buildAnalysisPrompt`**

`analysisPrompt.js` has no import statements today — it starts directly with the `SCORING_CATEGORIES` export. Add a new import line at the very top of the file:

Replace:

```js
// ── Scoring categories mapped from the 100+ rule engine ──
export const SCORING_CATEGORIES = {
```

with:

```js
import { CRITERIA_LIBRARY } from "./criteriaLibrary.js";

// ── Scoring categories mapped from the 100+ rule engine ──
export const SCORING_CATEGORIES = {
```

Then replace:

```js
export function buildAnalysisPrompt(analysisType, markdown, url, device) {
  const typeLabel = ANALYSIS_TYPE_LABELS[analysisType] || analysisType;
  const emphasis = ANALYSIS_TYPE_EMPHASIS[analysisType] || ANALYSIS_TYPE_EMPHASIS.homepage;
  const deviceBench = DEVICE_BENCHMARKS[device] || DEVICE_BENCHMARKS.desktop;
```

with:

```js
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
```

Then find the line in the returned template string that reads:

```js
## THE 100+ RULE ENGINE — Evaluate against ALL of these:
${RULES_REFERENCE}
```

and replace it with:

```js
## THE 100+ RULE ENGINE — Evaluate against ALL of these:
${RULES_REFERENCE}
${criteriaSection}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run server/lib/analysisPrompt.test.js`
Expected: PASS (all tests, including the 3 new ones)

- [ ] **Step 6: Commit**

```bash
git add server/lib/analysisPrompt.js server/lib/analysisPrompt.test.js
git commit -m "Inject named, sourced criteria into the Homepage and Checkout analysis prompt"
```

---

### Task 3: Pass `sourceCitation` through the analyze route

**Files:**
- Modify: `server/routes/analyze.js`
- Modify: `server/routes/analyze.test.js`

**Interfaces:**
- Consumes: nothing new (reads `fp.sourceCitation` off the AI's raw JSON response, same as it reads `fp.category`/`fp.severity`/etc. today)
- Produces: each object in the route's `frictionPoints` response array gains a `sourceCitation: string | null` field — consumed by Task 4 (client-side `FrictionPoint` type and rendering)

- [ ] **Step 1: Write the failing test**

Add this test to `server/routes/analyze.test.js`, inside the existing `describe("POST /api/analyze/analyze-url", ...)` block:

```js
  it("passes through sourceCitation when the AI includes it on a friction point", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { markdown: "# Page content", screenshot: null } }),
    });
    callOpenAIMock.mockResolvedValue({
      conversionScore: 72,
      grade: "Strong",
      topIssues: [],
      insightSummary: {},
      categoryScores: {},
      frictionPoints: [
        { category: "friction-effort", severity: "high", title: "Forced account creation", impactScore: 90, sourceCitation: "Baymard Institute's publicly published checkout usability research" },
      ],
    });

    const res = await request(buildApp())
      .post("/api/analyze/analyze-url")
      .send({ url: "example.com", analysisType: "checkout", device: "desktop" });

    expect(res.status).toBe(200);
    expect(res.body.data.frictionPoints[0].sourceCitation).toBe("Baymard Institute's publicly published checkout usability research");
  });

  it("defaults sourceCitation to null when the AI omits it", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { markdown: "# Page content", screenshot: null } }),
    });
    callOpenAIMock.mockResolvedValue({
      conversionScore: 72,
      grade: "Strong",
      topIssues: [],
      insightSummary: {},
      categoryScores: {},
      frictionPoints: [
        { category: "ux-clarity", severity: "med", title: "Generic issue", impactScore: 50 },
      ],
    });

    const res = await request(buildApp())
      .post("/api/analyze/analyze-url")
      .send({ url: "example.com", analysisType: "homepage", device: "desktop" });

    expect(res.status).toBe(200);
    expect(res.body.data.frictionPoints[0].sourceCitation).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/routes/analyze.test.js`
Expected: FAIL — `sourceCitation` is `undefined` (not present at all) on the response object, since the route doesn't map it yet.

- [ ] **Step 3: Add the pass-through in `server/routes/analyze.js`**

Replace:

```js
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
```

with:

```js
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
      sourceCitation: fp.sourceCitation || null,
      screenshotUrl,
      benchmark: fp.benchmark || { industryAvg: 50, topPerformers: 80, label: "Score" },
      abTest: fp.abTest || { testName: "", hypothesis: "", control: "", variant: "", metric: "", duration: "" },
    }));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/routes/analyze.test.js`
Expected: PASS (all tests, including the 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add server/routes/analyze.js server/routes/analyze.test.js
git commit -m "Pass sourceCitation through the analyze route"
```

---

### Task 4: Surface the evidence in the UI

**Files:**
- Modify: `src/lib/mockData.ts`
- Modify: `src/components/FrictionCard.tsx`
- Modify: `src/components/FrictionCard.test.tsx`
- Modify: `src/components/EvidencePanel.tsx`
- Create: `src/components/EvidencePanel.test.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: `FrictionPoint` gains `sourceCitation?: string` — consumed by both components

- [ ] **Step 1: Add `sourceCitation` to the `FrictionPoint` interface**

In `src/lib/mockData.ts`, replace:

```ts
export interface FrictionPoint {
  id: string;
  category: FrictionCategory;
  severity: FrictionSeverity;
  title: string;
  description: string;
  selector: string;
  fix: string;
  impactScore: number;
  roiEstimate?: string;
  insightCluster?: string;
  screenshotUrl?: string;
  benchmark: {
    industryAvg: number;
    topPerformers: number;
    label: string;
  };
  abTest: ABTestRecommendation;
}
```

with:

```ts
export interface FrictionPoint {
  id: string;
  category: FrictionCategory;
  severity: FrictionSeverity;
  title: string;
  description: string;
  selector: string;
  fix: string;
  impactScore: number;
  roiEstimate?: string;
  insightCluster?: string;
  screenshotUrl?: string;
  sourceCitation?: string;
  benchmark: {
    industryAvg: number;
    topPerformers: number;
    label: string;
  };
  abTest: ABTestRecommendation;
}
```

- [ ] **Step 2: Add real citations to two existing homepage and two existing checkout mock friction points**

In `src/lib/mockData.ts`, find the `hp-1` entry (inside `homepageFrictionPoints`) and add `sourceCitation` to it. Replace:

```ts
  { id: "hp-1", category: "navigation", severity: "high", title: "Navigation Lacks Clear Hierarchy", description: "The main nav has 11 top-level items with no grouping or dropdowns. Users suffer decision paralysis — Hick's Law predicts a 40% slower time-to-click with this many options.", selector: "nav.main-nav", fix: "Reduce to 5-7 top-level items. Group secondary items under descriptive dropdowns. Highlight the primary CTA separately.", impactScore: 91, benchmark: { industryAvg: 38, topPerformers: 7, label: "38% of homepages exceed 8 nav items. Top performers average 5." }, abTest: { testName: "Simplified Navigation", hypothesis: "Reducing nav items from 11 to 6 will increase CTA clicks by 15%", control: "Current 11-item flat navigation", variant: "6 top-level items with grouped dropdowns", metric: "Nav CTA click-through rate", duration: "2 weeks" } },
```

with:

```ts
  { id: "hp-1", category: "navigation", severity: "high", title: "Navigation Lacks Clear Hierarchy", description: "The main nav has 11 top-level items with no grouping or dropdowns. Users suffer decision paralysis — Hick's Law predicts a 40% slower time-to-click with this many options.", selector: "nav.main-nav", fix: "Reduce to 5-7 top-level items. Group secondary items under descriptive dropdowns. Highlight the primary CTA separately.", impactScore: 91, sourceCitation: "Hick's Law (Hick, 1952; Hyman, 1953) — decision time increases with number of choices", benchmark: { industryAvg: 38, topPerformers: 7, label: "38% of homepages exceed 8 nav items. Top performers average 5." }, abTest: { testName: "Simplified Navigation", hypothesis: "Reducing nav items from 11 to 6 will increase CTA clicks by 15%", control: "Current 11-item flat navigation", variant: "6 top-level items with grouped dropdowns", metric: "Nav CTA click-through rate", duration: "2 weeks" } },
```

Find the `ck-1` entry (inside `checkoutFrictionPoints`) and add `sourceCitation` to it. Replace:

```ts
  { id: "ck-1", category: "cart-friction", severity: "high", title: "Cart Requires Account Creation", description: "Users must create an account before completing checkout. 35% of cart abandonments happen because of forced account creation.", selector: "form.account-creation", fix: "Offer guest checkout as the default. Allow optional account creation post-purchase.", impactScore: 95, benchmark: { industryAvg: 34, topPerformers: 5, label: "66% of top e-commerce sites offer guest checkout." }, abTest: { testName: "Guest Checkout Default", hypothesis: "Making guest checkout default will reduce cart abandonment by 25%", control: "Forced account creation before purchase", variant: "Guest checkout default with optional post-purchase signup", metric: "Checkout completion rate", duration: "2 weeks" } },
```

with:

```ts
  { id: "ck-1", category: "cart-friction", severity: "high", title: "Cart Requires Account Creation", description: "Users must create an account before completing checkout. 35% of cart abandonments happen because of forced account creation.", selector: "form.account-creation", fix: "Offer guest checkout as the default. Allow optional account creation post-purchase.", impactScore: 95, sourceCitation: "Baymard Institute's publicly published checkout usability research", benchmark: { industryAvg: 34, topPerformers: 5, label: "66% of top e-commerce sites offer guest checkout." }, abTest: { testName: "Guest Checkout Default", hypothesis: "Making guest checkout default will reduce cart abandonment by 25%", control: "Forced account creation before purchase", variant: "Guest checkout default with optional post-purchase signup", metric: "Checkout completion rate", duration: "2 weeks" } },
```

Find the `ck-4` entry and add `sourceCitation` to it. Replace:

```ts
  { id: "ck-4", category: "abandonment-risk", severity: "high", title: "Surprise Shipping Costs at Final Step", description: "Shipping costs aren't revealed until the final checkout step. Unexpected costs are the #1 reason for cart abandonment.", selector: "div.order-summary", fix: "Show estimated shipping on the product page and cart. Highlight free shipping thresholds.", impactScore: 93, benchmark: { industryAvg: 39, topPerformers: 7, label: "61% of top stores show shipping costs before checkout begins." }, abTest: { testName: "Early Shipping Cost Display", hypothesis: "Showing shipping costs on cart page will reduce checkout abandonment by 20%", control: "Shipping revealed at final checkout step", variant: "Estimated shipping shown on product & cart pages", metric: "Cart-to-purchase conversion rate", duration: "2 weeks" } },
```

with:

```ts
  { id: "ck-4", category: "abandonment-risk", severity: "high", title: "Surprise Shipping Costs at Final Step", description: "Shipping costs aren't revealed until the final checkout step. Unexpected costs are the #1 reason for cart abandonment.", selector: "div.order-summary", fix: "Show estimated shipping on the product page and cart. Highlight free shipping thresholds.", impactScore: 93, sourceCitation: "Baymard Institute's publicly cited cart abandonment survey data (\"extra costs too high\" as a leading reason)", benchmark: { industryAvg: 39, topPerformers: 7, label: "61% of top stores show shipping costs before checkout begins." }, abTest: { testName: "Early Shipping Cost Display", hypothesis: "Showing shipping costs on cart page will reduce checkout abandonment by 20%", control: "Shipping revealed at final checkout step", variant: "Estimated shipping shown on product & cart pages", metric: "Cart-to-purchase conversion rate", duration: "2 weeks" } },
```

- [ ] **Step 3: Write the failing test for `FrictionCard`**

In `src/components/FrictionCard.test.tsx`, add this test inside the existing `describe("FrictionCard", ...)` block:

```tsx
  it("shows an Evidence-based badge when the point has a sourceCitation", () => {
    render(
      <FrictionCard point={buildPoint({ sourceCitation: "Nielsen Norman Group — first impressions research" })} index={0} isSelected={false} onClick={() => {}} />
    );
    expect(screen.getByText("Evidence-based")).toBeInTheDocument();
  });

  it("does not show the Evidence-based badge when there is no sourceCitation", () => {
    render(
      <FrictionCard point={buildPoint({ sourceCitation: undefined })} index={0} isSelected={false} onClick={() => {}} />
    );
    expect(screen.queryByText("Evidence-based")).not.toBeInTheDocument();
  });
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/components/FrictionCard.test.tsx`
Expected: FAIL — no "Evidence-based" text exists in the component yet.

- [ ] **Step 5: Add the badge to `FrictionCard.tsx`**

Replace:

```tsx
import { Clock, Eye, MousePointer, Code, ScanLine, Copy, Check, Sparkles, LayoutGrid, DoorOpen, MessageSquareDiff, Filter as FilterIcon, ArrowUpFromLine, Compass, Layers, BookOpen, ListTree, Search, Heart, ShoppingCart, CreditCard, ShieldCheck, LogOut, TextCursorInput, BadgeCheck, Target, Zap, TrendingUp, BarChart3 } from "lucide-react";
```

with:

```tsx
import { Clock, Eye, MousePointer, Code, ScanLine, Copy, Check, Sparkles, LayoutGrid, DoorOpen, MessageSquareDiff, Filter as FilterIcon, ArrowUpFromLine, Compass, Layers, BookOpen, ListTree, Search, Heart, ShoppingCart, CreditCard, ShieldCheck, LogOut, TextCursorInput, BadgeCheck, Target, Zap, TrendingUp, BarChart3, ShieldCheck as EvidenceIcon } from "lucide-react";
```

Replace:

```tsx
          {point.insightCluster && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {point.insightCluster}
            </span>
          )}
        </div>
        <span className={`text-[11px] font-medium ${severityTextClass[point.severity]}`}>
          {severityLabel[point.severity]}
        </span>
      </div>
```

with:

```tsx
          {point.insightCluster && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {point.insightCluster}
            </span>
          )}
          {point.sourceCitation && (
            <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              <EvidenceIcon className="h-2.5 w-2.5" />
              Evidence-based
            </span>
          )}
        </div>
        <span className={`text-[11px] font-medium ${severityTextClass[point.severity]}`}>
          {severityLabel[point.severity]}
        </span>
      </div>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/FrictionCard.test.tsx`
Expected: PASS (all tests, including the 2 new ones)

- [ ] **Step 7: Write the failing test for `EvidencePanel`**

Create `src/components/EvidencePanel.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EvidencePanel from "./EvidencePanel";
import type { FrictionPoint } from "@/lib/mockData";

function buildPoint(overrides: Partial<FrictionPoint> = {}): FrictionPoint {
  return {
    id: "fp-1",
    category: "ux-clarity",
    severity: "high",
    title: "Test friction point",
    description: "A description of the issue.",
    selector: ".hero",
    fix: "Do the fix.",
    impactScore: 80,
    benchmark: { industryAvg: 50, topPerformers: 80, label: "Score" },
    abTest: { testName: "Test", hypothesis: "H", control: "C", variant: "V", metric: "M", duration: "2 weeks" },
    ...overrides,
  };
}

describe("EvidencePanel", () => {
  it("shows an Evidence Base section with the citation when present", () => {
    render(<EvidencePanel point={buildPoint({ sourceCitation: "Nielsen Norman Group — first impressions research" })} />);
    expect(screen.getByText("Evidence Base")).toBeInTheDocument();
    expect(screen.getByText("Nielsen Norman Group — first impressions research")).toBeInTheDocument();
  });

  it("does not show the Evidence Base section when there is no citation", () => {
    render(<EvidencePanel point={buildPoint({ sourceCitation: undefined })} />);
    expect(screen.queryByText("Evidence Base")).not.toBeInTheDocument();
  });

  it("shows a prompt to select a point when none is selected", () => {
    render(<EvidencePanel point={null} />);
    expect(screen.getByText("Select a friction point to view evidence and fix recommendations.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run the tests to verify they fail**

Run: `npx vitest run src/components/EvidencePanel.test.tsx`
Expected: FAIL — no "Evidence Base" section exists yet.

- [ ] **Step 9: Add the Evidence Base section to `EvidencePanel.tsx`**

Replace:

```tsx
              {/* Description */}
              <div>
                <h4 className="text-label text-muted-foreground mb-2" style={{ fontSize: "10px" }}>
                  Analysis
                </h4>
                <p className="text-body text-foreground/80">{point.description}</p>
              </div>
```

with:

```tsx
              {/* Description */}
              <div>
                <h4 className="text-label text-muted-foreground mb-2" style={{ fontSize: "10px" }}>
                  Analysis
                </h4>
                <p className="text-body text-foreground/80">{point.description}</p>
              </div>

              {/* Evidence Base */}
              {point.sourceCitation && (
                <div className="bg-primary/[0.04] rounded-md p-3 border border-primary/20">
                  <h4 className="text-label text-primary mb-1.5" style={{ fontSize: "10px" }}>
                    Evidence Base
                  </h4>
                  <p className="text-xs text-foreground/80 leading-relaxed">{point.sourceCitation}</p>
                </div>
              )}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run src/components/EvidencePanel.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 11: Run the full test suite and a type-check**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.app.json
```

Expected: all tests pass, no type errors.

- [ ] **Step 12: Boot-verify with the dev server**

Using the Claude Code preview tooling: navigate to `/` and view the demo/mock analysis for a homepage or checkout URL (real live analysis needs valid Firecrawl/OpenAI credentials not available in this environment, but the mock-fallback path already has real `sourceCitation` values from Step 2 and will render identically). Confirm the "Evidence-based" badge appears on the "Navigation Lacks Clear Hierarchy" (homepage) or "Cart Requires Account Creation" (checkout) friction card, and that clicking it shows the "Evidence Base" section with the citation text in the detail panel. Screenshot both states.

- [ ] **Step 13: Commit**

```bash
git add src/lib/mockData.ts src/components/FrictionCard.tsx src/components/FrictionCard.test.tsx src/components/EvidencePanel.tsx src/components/EvidencePanel.test.tsx
git commit -m "Surface evidence citations in FrictionCard and EvidencePanel"
```

---

## What This Plan Does NOT Cover (by design)

The other five page types (Blog/Content, Lead/Form, Product Page, Landing—Marketing, Landing—Paid Media) don't get criteria libraries here — future work once this proves out. The "Content" nav section itself is not built in this plan. `heuristicAnalysis.js` is not updated with citations. No multi-page/competitor benchmarking.
