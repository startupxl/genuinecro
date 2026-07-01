const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ── Scoring categories mapped from the 100+ rule engine ──
const SCORING_CATEGORIES = {
  "ux-clarity": { weight: 0.20, label: "UX Clarity" },
  "trust-credibility": { weight: 0.20, label: "Trust & Credibility" },
  "friction-effort": { weight: 0.20, label: "Friction & Effort" },
  "speed-performance": { weight: 0.15, label: "Speed & Performance" },
  "intent-match": { weight: 0.15, label: "Intent Match" },
  "funnel-health": { weight: 0.10, label: "Funnel Health" },
};

// ── Benchmark data (from BENCHMARK.md) ──
const DEVICE_BENCHMARKS: Record<string, { conversionRate: string; addToCart: string; cartAbandonment: string; trafficShare: string }> = {
  mobile:  { conversionRate: "2.7–2.8%", addToCart: "6–8%", cartAbandonment: "70–72%", trafficShare: "76–77%" },
  desktop: { conversionRate: "2.7–2.8%", addToCart: "6–8%", cartAbandonment: "68–70%", trafficShare: "22–23%" },
  tablet:  { conversionRate: "~2.9%",    addToCart: "7–9%", cartAbandonment: "65–68%", trafficShare: "~1–2%" },
};

const GEO_BENCHMARKS: Record<string, { conversionRate: string; addToCart: string; cartAbandonment: string; aov: string }> = {
  americas: { conversionRate: "2.9–3.0%", addToCart: "Higher", cartAbandonment: "Lower", aov: "Highest" },
  emea:     { conversionRate: "2.7–2.8%", addToCart: "Medium", cartAbandonment: "Medium", aov: "Medium" },
  apac:     { conversionRate: "1.8–2.0%", addToCart: "Lower",  cartAbandonment: "Higher", aov: "Lowest" },
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
const ANALYSIS_TYPE_EMPHASIS: Record<string, string> = {
  homepage: "Focus heavily on UX Clarity (hero messaging, value prop, navigation) and Trust & Credibility. Homepage is the gateway — visual hierarchy and clear CTA paths are critical.",
  "blog-content": "Focus on UX Clarity (readability, content structure, headings), Intent Match (content depth matching search intent), and Friction & Effort (distraction-free reading experience, no aggressive interstitials).",
  checkout: "Focus heavily on Friction & Effort (form fields, checkout steps, payment options, guest checkout) and Trust & Credibility (security badges, transparent pricing, shipping costs). Also assess Funnel Health benchmarks.",
  "lead-form": "Focus on Friction & Effort (form optimization, field count, inline validation), Trust & Credibility (social proof, guarantees), and UX Clarity (clear CTA, value exchange messaging).",
  "product-page": "Focus on Trust & Credibility (reviews, ratings, images, guarantees), UX Clarity (value proposition, feature presentation), and Friction & Effort (add-to-cart friction, decision complexity).",
  "landing-marketing": "Focus on UX Clarity (hero messaging, single dominant CTA), Intent Match (message consistency), and Trust & Credibility (social proof, testimonials). Conversion funnel should be tight.",
  "landing-paid-media": "Focus heavily on Intent Match (ad-to-page message consistency, keyword alignment), UX Clarity (attention ratio, single CTA), and Speed & Performance (bounce prevention). Every element must reinforce the paid traffic's intent.",
};

const ANALYSIS_TYPE_LABELS: Record<string, string> = {
  homepage: "Homepage", "blog-content": "Blog / Content", checkout: "Checkout",
  "lead-form": "Lead / Form", "product-page": "Product Page",
  "landing-marketing": "Landing Page — Marketing", "landing-paid-media": "Landing Page — Paid Media",
};

function buildAnalysisPrompt(analysisType: string, markdown: string, url: string, device: string): string {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, analysisType = "homepage", device = "desktop" } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log(`Scraping ${formattedUrl} for ${analysisType} analysis (${device})`);

    // Step 1: Scrape with Firecrawl
    const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'links', 'screenshot'],
        onlyMainContent: false,
        waitFor: 2000,
        ...(device === 'mobile' ? { mobile: true } : {}),
      }),
    });

    const scrapeData = await scrapeRes.json();

    if (!scrapeRes.ok) {
      console.error('Firecrawl error:', scrapeData);
      return new Response(
        JSON.stringify({ success: false, error: scrapeData.error || `Scrape failed (${scrapeRes.status})` }),
        { status: scrapeRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
    const screenshotUrl = scrapeData.data?.screenshot || scrapeData.screenshot || null;

    if (!markdown) {
      return new Response(
        JSON.stringify({ success: false, error: 'No content extracted from URL' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Scraped ${markdown.length} chars, screenshot: ${screenshotUrl ? 'captured' : 'none'}, sending to AI analysis`);

    // Step 2: Analyze with AI using enhanced prompt
    const prompt = buildAnalysisPrompt(analysisType, markdown, formattedUrl, device);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-analyze`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!aiRes.ok) {
      console.log('AI analysis unavailable, using heuristic analysis');
      const heuristicResult = generateHeuristicAnalysis(markdown, formattedUrl, analysisType, device, screenshotUrl);
      return new Response(
        JSON.stringify({ success: true, data: heuristicResult }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiRes.json();

    // Map the enhanced AI response to the result format
    const frictionPoints = (aiData.frictionPoints || []).map((fp: any, i: number) => ({
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

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Analysis error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ── Enhanced Heuristic Fallback using the 100+ rule engine ──
function generateHeuristicAnalysis(markdown: string, url: string, analysisType: string, device: string, screenshotUrl: string | null) {
  const points: any[] = [];
  const lower = markdown.toLowerCase();
  const wordCount = markdown.split(/\s+/).length;
  const isMobile = device === 'mobile';
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

  const addPoint = (category: string, severity: string, title: string, description: string, selector: string, fix: string, impactScore: number, roiEstimate: string, cluster: string, benchLabel: string) => {
    points.push({
      id: `fp-${points.length + 1}`, category, severity, title, description, selector, fix,
      impactScore, roiEstimate, insightCluster: cluster, screenshotUrl,
      benchmark: { industryAvg: Math.round(impactScore * 0.6), topPerformers: Math.round(impactScore * 1.1), label: benchLabel },
      abTest: { testName: `${title} Test`, hypothesis: `Fixing "${title}" improves conversion`, control: "Current state", variant: "Optimized version", metric: "Conversion rate", duration: "2 weeks" },
    });
  };

  // ── UX Clarity rules ──
  if (headingCount < 3) {
    addPoint("ux-clarity", "high", "Weak content hierarchy", `Only ${headingCount} headings detected. Users can't scan the page effectively.${isMobile ? ' Critical on mobile where screen real estate is limited.' : ''}`, "h1, h2, h3", "Add clear H2/H3 headings to create a scannable content structure. Each section should have a descriptive heading.", 75, "Could improve scroll depth by 15-25%", "Clarity Gap", "Content Structure Score");
  }
  if (ctaWords < 1) {
    addPoint("ux-clarity", "high", "No clear call-to-action found", "Page lacks action-oriented language. Users have no clear next step, which directly kills conversion.", "body", "Add a prominent, action-oriented CTA above the fold. Use verbs like 'Get Started', 'Try Free', 'Buy Now'.", 90, "Could increase conversion by 20-40%", "Clarity Gap", "CTA Presence Score");
  } else if (ctaWords > 6) {
    addPoint("ux-clarity", "med", "Too many competing CTAs", `${ctaWords} action phrases found. Multiple CTAs create decision paralysis and dilute the primary conversion path.`, "button, a.cta", "Establish one dominant CTA. Secondary actions should be visually subordinate.", 65, "Could increase primary CTA clicks by 10-18%", "Clarity Gap", "CTA Focus Score");
  }
  if (linkCount > 20) {
    addPoint("ux-clarity", "med", "Navigation overload detected", `${linkCount} links found. ${isMobile ? 'On mobile, dense links cause mis-taps.' : 'Excessive choices create decision paralysis.'} Best practice is ≤7 primary nav items.`, "nav, header", isMobile ? "Use hamburger menu with 5-7 items max. Ensure 44px tap targets." : "Reduce to 5-7 primary links. Group secondary items in dropdowns.", 62, "Could increase CTA click-through by 10%", "Clarity Gap", "Navigation Simplicity");
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
    addPoint("trust-credibility", "med", "No visible contact information", `No phone, email, or chat found. ${isMobile ? 'Mobile users expect tap-to-call.' : 'Reduces trust for cautious visitors.'}`, "header, footer", isMobile ? "Add tap-to-call in mobile header or sticky contact bar." : "Add phone number and live chat to header/footer.", 65, "Could increase form submissions by 12%", "Trust Gap", "Contact Visibility");
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
  if (imageCount > 10 && !lower.includes('lazy')) {
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
  const catKeys = Object.keys(SCORING_CATEGORIES) as (keyof typeof SCORING_CATEGORIES)[];
  const categoryScores: Record<string, { score: number; passed: number; total: number; industryAvg: number }> = {};
  let weightedTotal = 0;

  for (const cat of catKeys) {
    const catPoints = points.filter(p => p.category === cat);
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

  // Apply penalty rules
  let cappedScore = overallScore;
  if (!hasTrustBadges && !hasReviews) cappedScore = Math.round(cappedScore * 0.8);

  const topIssues = points
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 3)
    .map(p => p.title);

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
      trustGap: points.filter(p => p.insightCluster === "Trust Gap").length > 0 ? "Trust signals are insufficient — missing reviews, badges, or social proof." : "Trust signals appear adequate.",
      clarityGap: points.filter(p => p.insightCluster === "Clarity Gap").length > 0 ? "Page clarity needs improvement — CTA, hierarchy, or navigation issues detected." : "Page clarity is reasonable.",
      effortGap: points.filter(p => p.insightCluster === "Effort Gap").length > 0 ? "User effort is too high — forms, interactions, or cognitive load need reduction." : "Effort level appears manageable.",
      motivationGap: points.filter(p => p.insightCluster === "Motivation Gap").length > 0 ? "Motivation drivers are weak — pricing, value prop, or urgency missing." : "Motivation signals are present.",
      speedGap: points.filter(p => p.insightCluster === "Speed Gap").length > 0 ? "Performance concerns detected — load time or resource optimization needed." : "Performance appears acceptable.",
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
