import type { ConversionGoal } from "./conversionGoals";

export type FrictionSeverity = "high" | "med" | "low";

export type FrictionCategory =
  | "visual"
  | "technical"
  | "ux"
  | "accessibility"
  | "performance"
  | "value-proposition"
  | "feature-presentation"
  | "onboarding-friction"
  | "message-match"
  | "conversion-funnel"
  | "bounce-risk"
  | "navigation"
  | "content-hierarchy"
  | "readability"
  | "content-structure"
  | "seo"
  | "engagement"
  | "cart-friction"
  | "payment-ux"
  | "trust-security"
  | "abandonment-risk"
  | "form-ux"
  | "trust-signals"
  | "conversion-clarity"
  | "ux-clarity"
  | "trust-credibility"
  | "friction-effort"
  | "speed-performance"
  | "intent-match"
  | "funnel-health";

export type AnalysisType =
  | "homepage"
  | "blog-content"
  | "checkout"
  | "lead-form"
  | "product-page"
  | "landing-marketing"
  | "landing-paid-media";

export const analysisTypeLabels: Record<AnalysisType, string> = {
  homepage: "Homepage",
  "blog-content": "Blog / Content",
  checkout: "Checkout",
  "lead-form": "Lead / Form",
  "product-page": "Product Page",
  "landing-marketing": "Landing Page — Marketing",
  "landing-paid-media": "Landing Page — Paid Media",
};

/** Detect page type from URL path and query params */
export function detectPageType(url: string): AnalysisType {
  try {
    let formatted = url.trim();
    if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
      formatted = `https://${formatted}`;
    }
    const parsed = new URL(formatted);
    const hostname = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const params = parsed.search.toLowerCase();
    const full = path + params;

    // Checkout patterns
    if (/\/(checkout|cart|basket|order|payment|pay|billing)(\/|$|\?)/.test(path)) return "checkout";

    // Lead / form patterns
    if (/\/(contact|signup|sign-up|register|subscribe|demo|request|quote|get-started|form|apply|enquiry|inquiry|book|schedule|onboarding|join|waitlist|newsletter)(\/|$|\?)/.test(path)) return "lead-form";

    // Blog / content patterns — check subdomain first, then path segments, then slug heuristics
    if (/^blog\./.test(hostname)) return "blog-content";
    if (/\/(blog|article|articles|post|posts|news|journal|story|stories|resources|guides?|learn|academy|insights|whitepapers?|tutorials?|tips|how-to|faq|help|knowledge-base|kb|category|tag|archive)(\/|$)/.test(path)) return "blog-content";
    // Slug-like paths with dates (e.g. /2024/03/my-post or /my-long-post-title)
    if (/\/\d{4}\/\d{2}\//.test(path)) return "blog-content";
    // Long hyphenated slugs (4+ words) are very likely blog posts
    const slugSegments = path.split("/").filter(Boolean);
    if (slugSegments.length >= 1) {
      const lastSegment = slugSegments[slugSegments.length - 1];
      const wordCount = lastSegment.split("-").length;
      if (wordCount >= 4 && !/\.(html?|php|aspx?)$/.test(lastSegment)) return "blog-content";
    }

    // Product page patterns
    if (/\/(products?|item|items|shop|store|catalog|catalogue|sku|buy|pricing|plans?|collections?|listing|deal|deals)(\/|$)/.test(path)) return "product-page";
    // Product detail pages often have /p/ or /dp/ (Amazon-style)
    if (/\/(p|dp|pd|gp\/product)\//.test(path)) return "product-page";

    // Paid media landing page — UTM / ad params
    if (/[?&](utm_|gclid|fbclid|msclkid|ttclid|dclid|li_fat_id|mc_cid|hsa_|wbraid|gbraid)/.test(full)) return "landing-paid-media";

    // Marketing landing page patterns
    if (/\/(lp|landing|campaign|promo|offer|webinar|ebook|download|free|trial|launch|special|exclusive|limited|deal)(\/|$)/.test(path)) return "landing-marketing";

    // Homepage — root path, or just domain, or /home, /index
    if (path === "/" || path === "" || /^\/(home|index|welcome|main)(\/?|\.html?)$/.test(path)) return "homepage";

    // If path has only one short segment (likely a top-level page like /about, /features, /team)
    // treat as marketing landing page rather than defaulting to homepage
    if (slugSegments.length === 1 && slugSegments[0].split("-").length < 4) return "landing-marketing";

    // Default fallback — marketing landing page is safer than homepage for deep URLs
    return "landing-marketing";
  } catch {
    return "homepage";
  }
}

export interface ABTestRecommendation {
  testName: string;
  hypothesis: string;
  control: string;
  variant: string;
  metric: string;
  duration: string;
  /** Explains the assumption behind the recommended duration (traffic/conversion-rate/sample-size), so the reader can judge whether it fits their real numbers. */
  durationRationale?: string;
}

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
  /** Set only on domain-aggregated friction points (see SiteDetail) — the distinct pages this issue was found on. */
  affectedUrls?: string[];
}

export interface CategoryScore {
  score: number;
  passed?: number;
  total?: number;
  industryAvg: number;
}

export interface InsightSummary {
  trustGap?: string;
  clarityGap?: string;
  effortGap?: string;
  motivationGap?: string;
  speedGap?: string;
}

export interface BenchmarkSummary {
  overallScore: number;
  industryAvg: number;
  topQuartile: number;
  categoryScores: Partial<Record<string, CategoryScore>>;
}

export interface AnalysisResult {
  url: string;
  timestamp: string;
  device: "desktop" | "mobile";
  analysisType: AnalysisType;
  frictionPoints: FrictionPoint[];
  benchmark: BenchmarkSummary;
  screenshotUrl?: string;
  conversionScore?: number;
  grade?: string;
  topIssues?: string[];
  insightSummary?: InsightSummary;
  conversionGoal?: ConversionGoal;
}

/** Flattens a BenchmarkSummary's per-category scores down to plain numbers for storage. */
export function extractCategoryScores(benchmark: BenchmarkSummary): Record<string, number> {
  const scores: Record<string, number> = {};
  if (!benchmark.categoryScores) return scores;
  for (const [category, categoryScore] of Object.entries(benchmark.categoryScores)) {
    if (categoryScore) scores[category] = categoryScore.score;
  }
  return scores;
}

export const categoryLabels: Record<string, string> = {
  visual: "Visual Friction",
  technical: "Technical Friction",
  ux: "UX Friction",
  accessibility: "Accessibility",
  performance: "Performance",
  "value-proposition": "Value Proposition",
  "feature-presentation": "Feature Presentation",
  "onboarding-friction": "Onboarding Friction",
  "message-match": "Message Match",
  "conversion-funnel": "Conversion Funnel",
  "bounce-risk": "Bounce Risk",
  navigation: "Navigation",
  "content-hierarchy": "Content Hierarchy",
  readability: "Readability",
  "content-structure": "Content Structure",
  seo: "SEO",
  engagement: "Engagement",
  "cart-friction": "Cart Friction",
  "payment-ux": "Payment UX",
  "trust-security": "Trust & Security",
  "abandonment-risk": "Abandonment Risk",
  "form-ux": "Form UX",
  "trust-signals": "Trust Signals",
  "conversion-clarity": "Conversion Clarity",
  // Previous scoring categories (retired, kept for historical records)
  "ux-clarity": "UX Clarity",
  "trust-credibility": "Trust & Credibility",
  "friction-effort": "Friction & Effort",
  "speed-performance": "Speed & Performance",
  "intent-match": "Intent Match",
  "funnel-health": "Funnel Health",
  // Current scoring categories (10-category taxonomy)
  "visual-friction": "Visual Friction",
  "ux-friction": "UX Friction",
  "form-friction": "Form Friction",
  "cta-effectiveness": "CTA Effectiveness",
  "checkout-friction": "Checkout Friction",
  // Technical audit category (separate scoring engine, merged into unified audits)
  "technical-seo": "Technical SEO",
};

export const categoryIcons: Record<string, string> = {
  visual: "eye", technical: "code", ux: "mouse-pointer", accessibility: "scan", performance: "clock",
  "value-proposition": "sparkles", "feature-presentation": "layout-grid", "onboarding-friction": "door-open",
  "message-match": "message-square-diff", "conversion-funnel": "funnel", "bounce-risk": "arrow-up-from-line",
  navigation: "compass", "content-hierarchy": "layers", readability: "book-open", "content-structure": "list-tree",
  seo: "search", engagement: "heart", "cart-friction": "shopping-cart", "payment-ux": "credit-card",
  "trust-security": "shield-check", "abandonment-risk": "log-out", "form-ux": "text-cursor-input",
  "trust-signals": "badge-check", "conversion-clarity": "target",
  "ux-clarity": "eye", "trust-credibility": "shield-check", "friction-effort": "zap",
  "speed-performance": "clock", "intent-match": "target", "funnel-health": "funnel",
};

export const categoriesForType: Record<AnalysisType, FrictionCategory[]> = {
  homepage: ["visual", "ux", "performance", "accessibility", "navigation", "content-hierarchy"],
  "blog-content": ["readability", "content-structure", "seo", "engagement", "performance", "accessibility"],
  checkout: ["cart-friction", "payment-ux", "trust-security", "abandonment-risk", "performance", "ux"],
  "lead-form": ["form-ux", "trust-signals", "conversion-clarity", "ux", "performance", "accessibility"],
  "product-page": ["value-proposition", "feature-presentation", "onboarding-friction", "visual", "ux", "performance"],
  "landing-marketing": ["visual", "ux", "performance", "accessibility", "content-hierarchy", "conversion-funnel"],
  "landing-paid-media": ["message-match", "conversion-funnel", "bounce-risk", "visual", "ux", "performance"],
};

