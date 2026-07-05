import { SCORING_CATEGORIES, DEVICE_BENCHMARKS } from "./analysisPrompt.js";

export function generateHeuristicAnalysis(markdown, url, analysisType, device, screenshotUrl) {
  const points = [];
  const lower = markdown.toLowerCase();
  const deviceBench = DEVICE_BENCHMARKS[device] || DEVICE_BENCHMARKS.desktop;
  const durationRationale = `Assumes traffic sufficient to reach ~300-350 conversions per variant at the ~${deviceBench.conversionRate} baseline ${device} conversion rate over 2 weeks — extend the test if your traffic or conversion volume is lower.`;
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

  const addPoint = (category, severity, title, description, selector, fix, impactScore, roiEstimate, cluster, benchLabel, effort, confidence) => {
    points.push({
      id: `fp-${points.length + 1}`, category, severity, title, description, selector, fix,
      impactScore, roiEstimate, insightCluster: cluster, screenshotUrl, effort, confidence,
      benchmark: { industryAvg: Math.round(impactScore * 0.6), topPerformers: Math.round(impactScore * 1.1), label: benchLabel },
      abTest: { testName: `${title} Test`, hypothesis: `Fixing "${title}" improves conversion`, control: "Current state", variant: "Optimized version", metric: "Conversion rate", duration: "2 weeks", durationRationale },
    });
  };

  // ── Content Hierarchy / CTA Effectiveness / Navigation rules ──
  if (headingCount < 3) {
    addPoint("content-hierarchy", "high", "Weak content hierarchy", `Only ${headingCount} headings detected. Users can't scan the page effectively.${isMobile ? " Critical on mobile where screen real estate is limited." : ""}`, "h1, h2, h3", "Add clear H2/H3 headings to create a scannable content structure. Each section should have a descriptive heading.", 75, "Could improve scroll depth by 15-25%", "Clarity Gap", "Content Structure Score", "low", "high");
  }
  if (ctaWords < 1) {
    addPoint("cta-effectiveness", "high", "No clear call-to-action found", "Page lacks action-oriented language. Users have no clear next step, which directly kills conversion.", "body", "Add a prominent, action-oriented CTA above the fold. Use verbs like 'Get Started', 'Try Free', 'Buy Now'.", 90, "Could increase conversion by 20-40%", "Clarity Gap", "CTA Presence Score", "low", "high");
  } else if (ctaWords > 6) {
    addPoint("cta-effectiveness", "med", "Too many competing CTAs", `${ctaWords} action phrases found. Multiple CTAs create decision paralysis and dilute the primary conversion path.`, "button, a.cta", "Establish one dominant CTA. Secondary actions should be visually subordinate.", 65, "Could increase primary CTA clicks by 10-18%", "Clarity Gap", "CTA Focus Score", "medium", "medium");
  }
  if (linkCount > 20) {
    addPoint("navigation", "med", "Navigation overload detected", `${linkCount} links found. ${isMobile ? "On mobile, dense links cause mis-taps." : "Excessive choices create decision paralysis."} Best practice is ≤7 primary nav items.`, "nav, header", isMobile ? "Use hamburger menu with 5-7 items max. Ensure 44px tap targets." : "Reduce to 5-7 primary links. Group secondary items in dropdowns.", 62, "Could increase CTA click-through by 10%", "Clarity Gap", "Navigation Simplicity", "medium", "medium");
  }

  // ── Trust & Credibility rules ──
  if (!hasReviews) {
    addPoint("trust-credibility", "high", "No customer reviews or ratings", "Reviews are the #1 trust signal for conversion. Their absence reduces purchase confidence significantly.", "main, .reviews", "Add customer reviews with star ratings. Even 5-10 reviews dramatically improve trust.", 82, "Could increase conversion by 15-30%", "Trust Gap", "Social Proof Score", "high", "high");
  }
  if (!hasTrustBadges) {
    addPoint("trust-credibility", "high", "Missing trust and security badges", "No trust badges, security seals, or guarantees detected. Users need reassurance, especially before providing personal data or payment.", "footer, .checkout", "Add trust badges (SSL, payment security, money-back guarantee) near CTAs and forms.", 78, "Could increase form completion by 12-20%", "Trust Gap", "Trust Badge Score", "low", "high");
  }
  if (!hasSocialProof) {
    addPoint("trust-credibility", "med", "No social proof indicators", "No user counts, customer logos, or usage statistics found. Social proof validates the decision to convert.", "header, .hero", "Add social proof: '10,000+ customers', client logos, or usage statistics near the hero section.", 68, "Could increase trust perception by 25%", "Trust Gap", "Social Proof Presence", "low", "medium");
  }
  if (!hasContact) {
    addPoint("trust-credibility", "med", "No visible contact information", `No phone, email, or chat found. ${isMobile ? "Mobile users expect tap-to-call." : "Reduces trust for cautious visitors."}`, "header, footer", isMobile ? "Add tap-to-call in mobile header or sticky contact bar." : "Add phone number and live chat to header/footer.", 65, "Could increase form submissions by 12%", "Trust Gap", "Contact Visibility", "low", "medium");
  }
  if (!hasFaq) {
    addPoint("trust-credibility", "low", "No FAQ section detected", "FAQs address objections pre-emptively and reduce support burden while improving conversion confidence.", "main", "Add an FAQ section addressing top 5-8 customer objections.", 45, "Could reduce bounce by 5-8%", "Trust Gap", "FAQ Presence", "medium", "low");
  }

  // ── Form Friction / UX Friction rules ──
  if (formIndicators > 8) {
    addPoint("form-friction", "high", "Form appears overly complex", `${formIndicators} form-related elements detected. Best practice is ≤5 fields. Every extra field drops conversion ~5-10%.`, "form, input", "Reduce to essential fields only. Use progressive disclosure or multi-step forms for complexity.", 85, "Could increase form completion by 20-35%", "Effort Gap", "Form Complexity Score", "high", "high");
  }
  if (wordCount > 2500 && (analysisType === "lead-form" || analysisType === "checkout" || analysisType === "landing-paid-media")) {
    addPoint("ux-friction", "med", "Excessive content for conversion page", `~${wordCount} words on a ${analysisType} page. Conversion-focused pages should be concise and action-oriented.`, "main", "Trim content to essentials. Use expandable sections for details. Keep focus on the conversion action.", 60, "Could reduce bounce by 10-15%", "Effort Gap", "Content Conciseness", "medium", "medium");
  }

  // ── Performance rules ──
  if (isMobile) {
    addPoint("performance", "high", "Mobile performance critical", "Mobile users on cellular connections need optimized loading. ~53% of mobile users abandon sites that take >3s to load.", "head, body", "Implement critical CSS inlining, lazy-load below-fold images, use responsive srcset, minimize JS.", 82, "Could reduce mobile bounce by 15-25%", "Speed Gap", "Mobile Performance Score", "high", "high");
  }
  if (imageCount > 10 && !lower.includes("lazy")) {
    addPoint("performance", "med", "Many images without lazy loading", `${imageCount} images detected with no evidence of lazy loading. This increases initial page weight and load time.`, "img", "Add loading='lazy' to below-fold images. Use modern formats (WebP/AVIF) and responsive srcset.", 65, "Could improve load time by 20-40%", "Speed Gap", "Image Optimization", "low", "high");
  }

  // ── CTA Effectiveness (pricing clarity) rules ──
  if (analysisType === "landing-paid-media" && !hasPricing) {
    addPoint("cta-effectiveness", "high", "Paid landing page lacks pricing", "Users from paid ads expect immediate pricing clarity. Missing pricing creates friction and increases bounce.", "main, .pricing", "Add clear pricing or 'Starting from $X' near the hero. Paid traffic has high intent — don't make them search.", 80, "Could reduce bounce by 20-30%", "Motivation Gap", "Pricing Clarity", "medium", "high");
  }
  if (analysisType === "product-page" && !hasPricing) {
    addPoint("cta-effectiveness", "high", "Product page missing pricing", "No pricing information detected. Price transparency is essential for purchase decisions.", ".product, main", "Display pricing prominently with any applicable discounts or payment options.", 85, "Could increase add-to-cart by 15-25%", "Motivation Gap", "Pricing Visibility", "medium", "high");
  }

  // ── Accessibility rules ──
  if (isMobile) {
    addPoint("accessibility", "high", "Mobile tap targets need review", "Interactive elements must be ≥44x44px with adequate spacing. Small/close buttons cause mis-taps and frustration.", "button, a, input", "Ensure all tap targets are minimum 44x44px with 8px+ spacing between interactive elements.", 78, "Could reduce mobile error rate by 30%", "Effort Gap", "Tap Target Compliance", "medium", "high");
  }

  // ── Compute scores ──
  const catKeys = Object.keys(SCORING_CATEGORIES);
  const categoryScores = {};
  let weightedTotal = 0;

  for (const cat of catKeys) {
    const catPoints = points.filter((p) => p.category === cat);
    const maxRules = Math.round(SCORING_CATEGORIES[cat].weight * 100);
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
