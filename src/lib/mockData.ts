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
  // New scoring categories
  "ux-clarity": "UX Clarity",
  "trust-credibility": "Trust & Credibility",
  "friction-effort": "Friction & Effort",
  "speed-performance": "Speed & Performance",
  "intent-match": "Intent Match",
  "funnel-health": "Funnel Health",
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

import frictionLowContrastCta from "@/assets/friction-low-contrast-cta.png";
import frictionCtaBelowFold from "@/assets/friction-cta-below-fold.png";
import frictionFlatHierarchy from "@/assets/friction-flat-hierarchy.png";
import frictionLongForm from "@/assets/friction-long-form.png";
import frictionInconsistentButtons from "@/assets/friction-inconsistent-buttons.png";
import frictionMixedContent from "@/assets/friction-mixed-content.png";

// ─── Homepage Analysis ───
const homepageFrictionPoints: FrictionPoint[] = [
  { id: "hp-1", category: "navigation", severity: "high", title: "Navigation Lacks Clear Hierarchy", description: "The main nav has 11 top-level items with no grouping or dropdowns. Users suffer decision paralysis — Hick's Law predicts a 40% slower time-to-click with this many options.", selector: "nav.main-nav", fix: "Reduce to 5-7 top-level items. Group secondary items under descriptive dropdowns. Highlight the primary CTA separately.", impactScore: 91, sourceCitation: "Hick's Law (Hick, 1952; Hyman, 1953) — decision time increases with number of choices", benchmark: { industryAvg: 38, topPerformers: 7, label: "38% of homepages exceed 8 nav items. Top performers average 5." }, abTest: { testName: "Simplified Navigation", hypothesis: "Reducing nav items from 11 to 6 will increase CTA clicks by 15%", control: "Current 11-item flat navigation", variant: "6 top-level items with grouped dropdowns", metric: "Nav CTA click-through rate", duration: "2 weeks" } },
  { id: "hp-2", category: "content-hierarchy", severity: "high", title: "Hero Lacks a Single Clear Message", description: "The hero section contains two headlines, a subtitle, a video, and three CTAs. Visitors can't determine the primary value proposition within 3 seconds.", selector: "section.hero", fix: "One headline, one subline, one primary CTA. Remove competing elements. Use visual hierarchy to guide the eye.", impactScore: 94, screenshotUrl: frictionFlatHierarchy, benchmark: { industryAvg: 45, topPerformers: 9, label: "55% of top homepages convey their value prop in a single sentence." }, abTest: { testName: "Single Hero Message", hypothesis: "A single headline + CTA will increase scroll depth by 20% and hero CTA clicks by 25%", control: "Current multi-headline hero with 3 CTAs", variant: "Single headline, single subline, one primary CTA", metric: "Hero CTA click rate & bounce rate", duration: "2 weeks" } },
  { id: "hp-3", category: "performance", severity: "high", title: "Hero Image LCP: 5.2s", description: "A 3.1MB uncompressed hero image blocks rendering. On mobile, users see a blank screen for 5+ seconds before content appears.", selector: "img.hero-bg", fix: "Convert to WebP, add srcset for responsive sizes, use fetchpriority='high' and a low-quality placeholder.", impactScore: 87, benchmark: { industryAvg: 48, topPerformers: 11, label: "Median homepage LCP is 3.1s. Top quartile achieves <2s." }, abTest: { testName: "Optimized Hero Image", hypothesis: "WebP with LQIP will reduce LCP from 5.2s to <2s and decrease bounce by 12%", control: "3.1MB uncompressed PNG hero", variant: "WebP with srcset and fetchpriority='high'", metric: "LCP time & bounce rate", duration: "1 week" } },
  { id: "hp-4", category: "navigation", severity: "med", title: "Mobile Nav Opens Full-Screen Overlay", description: "The mobile hamburger menu opens a full-screen overlay with no visible close button. 28% of users get lost and abandon.", selector: "nav.mobile-menu", fix: "Use a slide-out drawer with a clear X button and a visible back path. Keep page context partially visible.", impactScore: 72, benchmark: { industryAvg: 33, topPerformers: 6, label: "67% of top mobile homepages use slide-out navigation, not full-screen overlays." }, abTest: { testName: "Slide-Out Mobile Nav", hypothesis: "A slide-out drawer will reduce nav abandonment by 20% vs full-screen overlay", control: "Full-screen overlay navigation", variant: "Slide-out drawer with visible close button", metric: "Mobile nav completion rate", duration: "2 weeks" } },
  { id: "hp-5", category: "content-hierarchy", severity: "med", title: "No Clear Path for Different Audiences", description: "The homepage treats all visitors the same. There's no segmentation for enterprise vs. small business, or by role/use case.", selector: "section.below-hero", fix: "Add audience-based entry points ('For Teams', 'For Enterprise', 'For Developers') below the hero.", impactScore: 68, benchmark: { industryAvg: 40, topPerformers: 10, label: "60% of high-converting B2B homepages segment by audience." }, abTest: { testName: "Audience Segmentation", hypothesis: "Adding persona-based CTAs will increase engagement by 18% for enterprise visitors", control: "Single generic content path", variant: "3 audience-based entry points below hero", metric: "Segment click-through & conversion by audience", duration: "3 weeks" } },
  { id: "hp-6", category: "visual", severity: "med", title: "Footer Contains 60+ Links", description: "The footer is a wall of text with 60+ unorganized links. It overwhelms rather than aids navigation.", selector: "footer", fix: "Organize into 4-5 clear columns. Prioritize key links. Use collapsible sections on mobile.", impactScore: 45, screenshotUrl: frictionLowContrastCta, benchmark: { industryAvg: 52, topPerformers: 14, label: "48% of top homepages keep footer links under 30." }, abTest: { testName: "Streamlined Footer", hypothesis: "Reducing footer links to 25 organized in columns will increase footer CTA clicks by 30%", control: "60+ unorganized footer links", variant: "25 links in 5 organized columns", metric: "Footer link click-through rate", duration: "2 weeks" } },
  { id: "hp-7", category: "ux", severity: "med", title: "Auto-Playing Carousel in Hero", description: "A 4-slide carousel auto-rotates every 3 seconds. Users can't finish reading a slide before it changes. Click-through rates on slides 2-4 are typically <1%.", selector: "div.hero-carousel", fix: "Replace with a static hero or a manually controlled tabbed layout. If keeping, pause on hover and add clear indicators.", impactScore: 63, benchmark: { industryAvg: 31, topPerformers: 4, label: "69% of top-performing homepages have removed auto-playing carousels." }, abTest: { testName: "Static vs Carousel Hero", hypothesis: "A static hero will increase primary CTA clicks by 20% vs auto-rotating carousel", control: "Auto-playing 4-slide carousel", variant: "Static hero with single message", metric: "Hero CTA click-through rate", duration: "2 weeks" } },
  { id: "hp-8", category: "accessibility", severity: "high", title: "Skip Navigation Link Missing", description: "No 'skip to main content' link exists. Keyboard and screen reader users must tab through the entire nav on every page load.", selector: "body > :first-child", fix: "Add a visually hidden skip link as the first focusable element: <a href='#main' class='sr-only focus:not-sr-only'>Skip to content</a>", impactScore: 56, benchmark: { industryAvg: 62, topPerformers: 5, label: "38% of sites include skip navigation. It's a WCAG 2.1 AA requirement." }, abTest: { testName: "Skip Navigation Link", hypothesis: "Adding skip-nav will reduce time-to-content for keyboard users by 60%", control: "No skip navigation link", variant: "Skip-to-content link as first focusable element", metric: "Keyboard user task completion time", duration: "1 week" } },
  { id: "hp-9", category: "performance", severity: "low", title: "Third-Party Scripts Block Interactivity", description: "12 third-party scripts (analytics, chat widget, heatmaps) load synchronously, pushing Time to Interactive to 8.4s.", selector: "script[src*='third-party']", fix: "Defer non-critical scripts. Load chat widget on user interaction. Use Google Tag Manager with delayed loading.", impactScore: 52, benchmark: { industryAvg: 55, topPerformers: 12, label: "Median TBT is 1.8s. Top quartile achieves <300ms." }, abTest: { testName: "Deferred Script Loading", hypothesis: "Deferring non-critical scripts will reduce TTI from 8.4s to <3s and improve conversion by 8%", control: "12 synchronous third-party scripts", variant: "Deferred loading with interaction triggers", metric: "Time to Interactive & conversion rate", duration: "1 week" } },
  { id: "hp-10", category: "ux", severity: "low", title: "No Search Functionality", description: "The homepage has no search bar or search icon. For sites with 50+ pages, 30% of users prefer search over navigation.", selector: "header", fix: "Add a search icon in the header that opens an overlay search with autocomplete suggestions.", impactScore: 41, benchmark: { industryAvg: 44, topPerformers: 8, label: "56% of top homepages offer prominent search. Industry: 44%." }, abTest: { testName: "Header Search Addition", hypothesis: "Adding search will increase pages-per-session by 15% for returning visitors", control: "No search functionality", variant: "Search icon with overlay autocomplete", metric: "Pages per session & task completion rate", duration: "3 weeks" } },
];

// ─── Blog/Content Analysis ───
const blogContentFrictionPoints: FrictionPoint[] = [
  { id: "bc-1", category: "readability", severity: "high", title: "Wall of Text — No Visual Breaks", description: "Paragraphs average 180+ words with no subheadings, images, or pull quotes. Reading engagement drops 58% after the first 200 words of unbroken text.", selector: "article p", fix: "Break text every 2-3 paragraphs with subheadings (H2/H3). Add images, pull quotes, or callout boxes every 300 words.", impactScore: 92, benchmark: { industryAvg: 42, topPerformers: 7, label: "58% of top blog posts use visual breaks every 150-200 words." }, abTest: { testName: "Visual Break Frequency", hypothesis: "Adding subheadings every 200 words will increase avg. read depth by 35%", control: "Long unbroken paragraphs", variant: "H2/H3 breaks + pull quotes every 200 words", metric: "Scroll depth & time on page", duration: "2 weeks" } },
  { id: "bc-2", category: "seo", severity: "high", title: "Missing Meta Description", description: "The page has no meta description tag. Search engines will auto-generate a snippet, often poorly representing the content and reducing CTR by 20-30%.", selector: "head meta[name='description']", fix: "Add a 150-160 character meta description that includes the primary keyword and a compelling reason to click.", impactScore: 88, benchmark: { industryAvg: 35, topPerformers: 5, label: "65% of top-ranking blog posts have optimized meta descriptions." }, abTest: { testName: "Meta Description Optimization", hypothesis: "A keyword-rich meta description will increase organic CTR by 20%", control: "No meta description (auto-generated)", variant: "150-char optimized meta description with CTA", metric: "Organic click-through rate", duration: "4 weeks" } },
  { id: "bc-3", category: "content-structure", severity: "high", title: "No Table of Contents", description: "A 3,000-word article with no table of contents or anchor navigation. Users can't jump to the section they need, increasing bounce rate by 25%.", selector: "article", fix: "Add a sticky table of contents with anchor links to each H2/H3. Highlight the current section on scroll.", impactScore: 84, benchmark: { industryAvg: 38, topPerformers: 8, label: "62% of top long-form content includes a table of contents." }, abTest: { testName: "Sticky Table of Contents", hypothesis: "A sticky TOC will reduce bounce rate by 20% and increase pages per session", control: "No table of contents", variant: "Sticky sidebar TOC with active section highlight", metric: "Bounce rate & scroll depth", duration: "2 weeks" } },
  { id: "bc-4", category: "engagement", severity: "high", title: "No Related Content or Next Steps", description: "The article ends abruptly with no related posts, category links, or content recommendations. Users exit instead of continuing to engage.", selector: "article + *", fix: "Add a 'Related Articles' section with 3 contextually relevant posts. Include a newsletter signup or content upgrade.", impactScore: 79, benchmark: { industryAvg: 41, topPerformers: 9, label: "59% of top content sites show related content. Average session depth increases 34%." }, abTest: { testName: "Related Content Module", hypothesis: "Adding 3 related articles will increase pages-per-session by 25%", control: "Article ends with no recommendations", variant: "3 contextual related articles + newsletter CTA", metric: "Pages per session & email signups", duration: "2 weeks" } },
  { id: "bc-5", category: "readability", severity: "med", title: "Line Length Exceeds 80 Characters", description: "Content lines span 120+ characters on desktop. Optimal readability is 50-75 characters per line.", selector: "article", fix: "Constrain content width to max-w-prose (65ch). Use comfortable line-height of 1.6-1.8.", impactScore: 71, benchmark: { industryAvg: 48, topPerformers: 10, label: "52% of top blogs constrain line length to 60-75 characters." }, abTest: { testName: "Optimal Line Length", hypothesis: "Constraining to 65ch will increase time on page by 15%", control: "120+ character line width", variant: "65ch max-width with 1.7 line-height", metric: "Time on page & scroll depth", duration: "2 weeks" } },
  { id: "bc-6", category: "seo", severity: "med", title: "Images Missing Alt Text", description: "6 of 8 images have empty or missing alt attributes. This hurts image search rankings and fails WCAG accessibility standards.", selector: "article img:not([alt])", fix: "Add descriptive alt text to every image. Include the target keyword naturally where relevant.", impactScore: 67, benchmark: { industryAvg: 55, topPerformers: 8, label: "45% of top-ranking articles have fully optimized image alt text." }, abTest: { testName: "Image Alt Text Optimization", hypothesis: "Descriptive alt text will increase image search traffic by 30%", control: "Images without alt text", variant: "Keyword-rich descriptive alt text on all images", metric: "Image search impressions & clicks", duration: "4 weeks" } },
  { id: "bc-7", category: "content-structure", severity: "med", title: "Heading Hierarchy Broken", description: "The article jumps from H1 to H4, skipping H2 and H3 entirely.", selector: "article h1 ~ h4", fix: "Fix heading hierarchy: H1 (title) → H2 (sections) → H3 (subsections). Never skip levels.", impactScore: 62, benchmark: { industryAvg: 44, topPerformers: 6, label: "56% of top-ranking pages maintain proper heading hierarchy." }, abTest: { testName: "Proper Heading Hierarchy", hypothesis: "Fixing H1→H2→H3 hierarchy will improve featured snippet appearances by 15%", control: "Broken heading hierarchy (H1→H4)", variant: "Proper H1→H2→H3 structure", metric: "Featured snippet wins & organic rankings", duration: "4 weeks" } },
  { id: "bc-8", category: "engagement", severity: "med", title: "No Email Capture or Content Upgrade", description: "The article drives traffic but has no mechanism to capture readers as subscribers.", selector: "article", fix: "Add an inline newsletter signup after the introduction and a content upgrade (PDF, checklist) mid-article.", impactScore: 58, benchmark: { industryAvg: 36, topPerformers: 7, label: "64% of top content marketers include mid-article email capture." }, abTest: { testName: "Inline Email Capture", hypothesis: "Mid-article email CTA will capture 3-5% of readers as subscribers", control: "No email capture in article", variant: "Inline signup after intro + content upgrade mid-article", metric: "Email signup rate per article view", duration: "3 weeks" } },
  { id: "bc-9", category: "performance", severity: "med", title: "Unoptimized Images: 4.2MB Total", description: "8 images total 4.2MB. None are lazy-loaded. All load on initial page render, pushing LCP to 4.8s.", selector: "article img", fix: "Convert to WebP, add loading='lazy' to below-fold images, implement srcset for responsive sizes.", impactScore: 74, benchmark: { industryAvg: 46, topPerformers: 10, label: "Median blog page weight is 1.8MB. Top quartile achieves <800KB." }, abTest: { testName: "Image Optimization", hypothesis: "WebP + lazy loading will reduce page weight by 70% and improve bounce rate by 10%", control: "4.2MB unoptimized images, all eager-loaded", variant: "WebP with lazy loading and srcset", metric: "LCP & bounce rate", duration: "1 week" } },
  { id: "bc-10", category: "accessibility", severity: "low", title: "Code Blocks Not Accessible", description: "Code snippets use <div> elements with no role, no syntax highlighting contrast check, and no copy button.", selector: "div.code-block", fix: "Use <pre><code> with role='code'. Add a copy button. Ensure syntax colors meet 4.5:1 contrast ratio.", impactScore: 38, benchmark: { industryAvg: 61, topPerformers: 15, label: "39% of tech blogs have accessible code blocks." }, abTest: { testName: "Accessible Code Blocks", hypothesis: "Copy button + proper semantics will increase code snippet engagement by 25%", control: "Div-based code blocks, no copy button", variant: "Semantic <pre><code> with copy button and WCAG contrast", metric: "Code block copy clicks & time spent", duration: "2 weeks" } },
];

// ─── Checkout Analysis ───
const checkoutFrictionPoints: FrictionPoint[] = [
  { id: "ck-1", category: "cart-friction", severity: "high", title: "Cart Requires Account Creation", description: "Users must create an account before completing checkout. 35% of cart abandonments happen because of forced account creation.", selector: "form.account-creation", fix: "Offer guest checkout as the default. Allow optional account creation post-purchase.", impactScore: 95, sourceCitation: "Baymard Institute's publicly published checkout usability research", benchmark: { industryAvg: 34, topPerformers: 5, label: "66% of top e-commerce sites offer guest checkout." }, abTest: { testName: "Guest Checkout Default", hypothesis: "Making guest checkout default will reduce cart abandonment by 25%", control: "Forced account creation before purchase", variant: "Guest checkout default with optional post-purchase signup", metric: "Checkout completion rate", duration: "2 weeks" } },
  { id: "ck-2", category: "payment-ux", severity: "high", title: "Only 2 Payment Methods Available", description: "Only credit card and PayPal are offered. No Apple Pay, Google Pay, or BNPL options.", selector: "section.payment-methods", fix: "Add Apple Pay, Google Pay, and at least one BNPL option (Klarna/Affirm).", impactScore: 89, benchmark: { industryAvg: 42, topPerformers: 8, label: "58% of top checkout flows offer 4+ payment methods." }, abTest: { testName: "Expanded Payment Methods", hypothesis: "Adding Apple Pay + BNPL will increase checkout completion by 12%", control: "Credit card + PayPal only", variant: "CC + PayPal + Apple Pay + Google Pay + Klarna", metric: "Payment step completion rate", duration: "3 weeks" } },
  { id: "ck-3", category: "trust-security", severity: "high", title: "No Security Badges or SSL Indicators", description: "The checkout page shows no trust badges, security seals, or SSL indicators. 17% of users abandon due to security concerns.", selector: "section.checkout-form", fix: "Add Norton/McAfee security badge, SSL lock icon near the payment form, and 'Secure checkout' header.", impactScore: 86, benchmark: { industryAvg: 37, topPerformers: 6, label: "63% of top checkout pages display security trust badges." }, abTest: { testName: "Trust Badge Placement", hypothesis: "Security badges near payment form will reduce abandonment by 15%", control: "No trust badges or security indicators", variant: "Norton badge + SSL icon + 'Secure Checkout' header", metric: "Payment form completion rate", duration: "2 weeks" } },
  { id: "ck-4", category: "abandonment-risk", severity: "high", title: "Surprise Shipping Costs at Final Step", description: "Shipping costs aren't revealed until the final checkout step. Unexpected costs are the #1 reason for cart abandonment.", selector: "div.order-summary", fix: "Show estimated shipping on the product page and cart. Highlight free shipping thresholds.", impactScore: 93, sourceCitation: "Baymard Institute's publicly cited cart abandonment survey data (\"extra costs too high\" as a leading reason)", benchmark: { industryAvg: 39, topPerformers: 7, label: "61% of top stores show shipping costs before checkout begins." }, abTest: { testName: "Early Shipping Cost Display", hypothesis: "Showing shipping costs on cart page will reduce checkout abandonment by 20%", control: "Shipping revealed at final checkout step", variant: "Estimated shipping shown on product & cart pages", metric: "Cart-to-purchase conversion rate", duration: "2 weeks" } },
  { id: "ck-5", category: "cart-friction", severity: "med", title: "Can't Edit Cart From Checkout", description: "Users must navigate back to the cart page to change quantities or remove items.", selector: "div.checkout-cart-summary", fix: "Add inline quantity controls and remove buttons directly in the checkout order summary.", impactScore: 72, benchmark: { industryAvg: 43, topPerformers: 9, label: "57% of top checkouts allow inline cart editing." }, abTest: { testName: "Inline Cart Editing", hypothesis: "Inline quantity controls will reduce back-navigation by 40%", control: "Must return to cart to edit", variant: "Inline quantity controls in checkout summary", metric: "Checkout completion rate & back-nav rate", duration: "2 weeks" } },
  { id: "ck-6", category: "payment-ux", severity: "med", title: "Credit Card Form Has Poor Input Formatting", description: "The card number field doesn't auto-format, doesn't show card type detection, and doesn't auto-advance.", selector: "input.card-number", fix: "Auto-format card number with spaces. Detect card type and show logo. Auto-advance to expiry.", impactScore: 65, benchmark: { industryAvg: 45, topPerformers: 10, label: "55% of top checkouts use smart card input formatting." }, abTest: { testName: "Smart Card Input", hypothesis: "Auto-formatting + card detection will reduce payment errors by 30%", control: "Plain text input, no formatting", variant: "Auto-formatted input with card type logo detection", metric: "Payment error rate & form completion time", duration: "2 weeks" } },
  { id: "ck-7", category: "trust-security", severity: "med", title: "No Return Policy Visible", description: "The checkout page makes no mention of return policy, money-back guarantee, or refund terms.", selector: "section.checkout", fix: "Add a concise return policy summary ('30-day free returns') near the CTA.", impactScore: 61, benchmark: { industryAvg: 40, topPerformers: 8, label: "60% of top checkouts surface return/guarantee info." }, abTest: { testName: "Visible Return Policy", hypothesis: "Return policy near CTA will increase conversion by 10%", control: "No return policy on checkout page", variant: "'30-day free returns' badge near Place Order button", metric: "Checkout conversion rate", duration: "2 weeks" } },
  { id: "ck-8", category: "abandonment-risk", severity: "med", title: "No Progress Indicator", description: "The multi-step checkout has no progress bar or step indicator.", selector: "div.checkout-steps", fix: "Add a clear progress bar: Shipping → Payment → Review → Confirmation.", impactScore: 58, benchmark: { industryAvg: 36, topPerformers: 7, label: "64% of top multi-step checkouts include progress indicators." }, abTest: { testName: "Checkout Progress Bar", hypothesis: "A step indicator will reduce mid-checkout abandonment by 15%", control: "No progress indicator", variant: "4-step progress bar with current step highlighted", metric: "Step-by-step drop-off rate", duration: "2 weeks" } },
  { id: "ck-9", category: "performance", severity: "med", title: "Checkout Page Load: 4.5s", description: "Heavy scripts and unoptimized assets push checkout page load to 4.5s.", selector: "document", fix: "Lazy-load non-critical scripts, inline critical CSS, preload payment provider scripts.", impactScore: 76, benchmark: { industryAvg: 44, topPerformers: 9, label: "Median checkout LCP is 2.8s. Top quartile achieves <1.5s." }, abTest: { testName: "Checkout Speed Optimization", hypothesis: "Reducing load to <2s will increase conversion by 10%", control: "4.5s checkout page load", variant: "Optimized with deferred scripts and inlined CSS", metric: "Checkout conversion rate & LCP", duration: "1 week" } },
  { id: "ck-10", category: "ux", severity: "low", title: "No Order Summary on Mobile", description: "On mobile, the order summary is collapsed and hidden by default.", selector: "div.order-summary-mobile", fix: "Show a compact but visible order summary on mobile, expanded by default.", impactScore: 48, benchmark: { industryAvg: 50, topPerformers: 12, label: "50% of mobile checkouts hide the order summary." }, abTest: { testName: "Mobile Order Summary Visibility", hypothesis: "Expanded-by-default summary will reduce mobile support tickets by 20%", control: "Collapsed/hidden order summary on mobile", variant: "Compact visible summary, expanded by default", metric: "Mobile checkout completion rate", duration: "2 weeks" } },
];

// ─── Lead/Form Submission Analysis ───
const leadFormFrictionPoints: FrictionPoint[] = [
  { id: "lf-1", category: "form-ux", severity: "high", title: "Form Has 12+ Fields", description: "The lead form requires 12 fields. Each field beyond 3 reduces conversion by 11%.", selector: "form.lead-form", fix: "Reduce to 3-4 fields: name, email, one qualifying question. Use progressive profiling.", impactScore: 94, screenshotUrl: frictionLongForm, benchmark: { industryAvg: 36, topPerformers: 5, label: "Top-converting forms average 3 fields. Industry median: 7." }, abTest: { testName: "Minimal Form Fields", hypothesis: "Reducing to 3 fields will increase form submissions by 40%", control: "12-field lead form", variant: "3 fields: name, email, one qualifying question", metric: "Form submission rate", duration: "2 weeks" } },
  { id: "lf-2", category: "conversion-clarity", severity: "high", title: "CTA Button Says 'Submit'", description: "The form button reads 'Submit' — a generic, anxiety-inducing label. Value-driven CTAs convert 30%+ better.", selector: "button[type='submit']", fix: "Replace 'Submit' with a value-driven label: 'Get My Free Guide', 'Start My Trial', or 'See My Results'.", impactScore: 88, benchmark: { industryAvg: 52, topPerformers: 8, label: "48% of top forms use value-driven CTA copy." }, abTest: { testName: "Value-Driven CTA Copy", hypothesis: "Changing 'Submit' to 'Get My Free Report' will increase conversions by 25%", control: "Button text: 'Submit'", variant: "Button text: 'Get My Free Report →'", metric: "Form submission rate", duration: "2 weeks" } },
  { id: "lf-3", category: "trust-signals", severity: "high", title: "No Privacy Statement Near Form", description: "The form collects email and phone but shows no privacy policy link or data usage note.", selector: "form.lead-form", fix: "Add 'We'll never share your info' and a privacy policy link directly below the form.", impactScore: 83, benchmark: { industryAvg: 40, topPerformers: 7, label: "60% of top lead forms include a privacy assurance near the CTA." }, abTest: { testName: "Privacy Assurance Statement", hypothesis: "Adding privacy note will increase form completions by 12%", control: "No privacy statement near form", variant: "'We'll never share your info' + privacy link below CTA", metric: "Form submission rate", duration: "2 weeks" } },
  { id: "lf-4", category: "form-ux", severity: "high", title: "No Inline Validation", description: "Errors only appear after form submission as a generic alert. Users lose their input.", selector: "form.lead-form input", fix: "Add real-time inline validation on blur. Show specific error messages next to each field.", impactScore: 80, benchmark: { industryAvg: 44, topPerformers: 6, label: "56% of top forms use inline validation." }, abTest: { testName: "Inline Form Validation", hypothesis: "Real-time validation will reduce form errors by 30% and increase completions by 15%", control: "Validation only on submit, generic error alert", variant: "On-blur inline validation with field-specific messages", metric: "Form error rate & completion rate", duration: "2 weeks" } },
  { id: "lf-5", category: "conversion-clarity", severity: "med", title: "No Clear Value Proposition Above Form", description: "The form appears without context about what the user will receive.", selector: "section.form-section h2", fix: "Add a benefit-driven headline above the form with 2-3 bullet points of what they'll receive.", impactScore: 75, benchmark: { industryAvg: 38, topPerformers: 8, label: "62% of top lead forms include a clear value proposition above the form." }, abTest: { testName: "Form Value Proposition", hypothesis: "Benefit headline + 3 bullet points will increase form starts by 20%", control: "Form with no contextual headline", variant: "Benefit headline + 3 value bullets above form", metric: "Form start rate & submission rate", duration: "2 weeks" } },
  { id: "lf-6", category: "trust-signals", severity: "med", title: "No Social Proof Near Form", description: "The form area has no testimonials, user counts, company logos, or star ratings.", selector: "div.form-container", fix: "Add a testimonial quote or '10,000+ marketers trust us' near the form. Include 3-4 client logos.", impactScore: 69, benchmark: { industryAvg: 41, topPerformers: 9, label: "59% of top lead pages include social proof adjacent to the form." }, abTest: { testName: "Social Proof Near Form", hypothesis: "Adding testimonial + logos will increase form submissions by 18%", control: "No social proof near form", variant: "Testimonial quote + 4 client logos adjacent to form", metric: "Form submission rate", duration: "2 weeks" } },
  { id: "lf-7", category: "form-ux", severity: "med", title: "Phone Number Field is Required", description: "Phone number is required. 37% of users abandon when phone is required.", selector: "input[type='tel'][required]", fix: "Make phone optional or remove it entirely.", impactScore: 77, benchmark: { industryAvg: 33, topPerformers: 4, label: "67% of top forms make phone optional or omit it entirely." }, abTest: { testName: "Optional Phone Field", hypothesis: "Making phone optional will increase form completions by 25%", control: "Phone number as required field", variant: "Phone field marked optional (or removed)", metric: "Form completion rate & lead quality score", duration: "2 weeks" } },
  { id: "lf-8", category: "ux", severity: "med", title: "Form Not Visible Without Scrolling", description: "The form is positioned below 2 sections. Users must scroll 1,400px to reach it.", selector: "form.lead-form", fix: "Move the form above the fold or add a sticky 'Get Started' bar.", impactScore: 71, screenshotUrl: frictionCtaBelowFold, benchmark: { industryAvg: 35, topPerformers: 6, label: "65% of top lead pages show the form within the first viewport." }, abTest: { testName: "Above-the-Fold Form", hypothesis: "Moving the form above the fold will increase submissions by 30%", control: "Form at 1,400px scroll depth", variant: "Form in first viewport with 2-column layout", metric: "Form visibility rate & submission rate", duration: "2 weeks" } },
  { id: "lf-9", category: "performance", severity: "med", title: "Form Loads Third-Party Scripts Synchronously", description: "reCAPTCHA, analytics, and form tracking scripts add 2.3s to Time to Interactive.", selector: "script[src*='recaptcha']", fix: "Defer reCAPTCHA until form focus. Lazy-load analytics.", impactScore: 62, benchmark: { industryAvg: 47, topPerformers: 10, label: "53% of top forms defer heavy scripts until user interaction." }, abTest: { testName: "Deferred Form Scripts", hypothesis: "Deferring reCAPTCHA until focus will reduce TTI by 2s", control: "Synchronous reCAPTCHA + analytics loading", variant: "reCAPTCHA on focus, async analytics", metric: "Time to Interactive & form start rate", duration: "1 week" } },
  { id: "lf-10", category: "accessibility", severity: "low", title: "Form Labels Not Associated with Inputs", description: "Form labels use proximity but lack 'for' attributes.", selector: "form label:not([for])", fix: "Add matching for/id attributes to all label/input pairs.", impactScore: 44, benchmark: { industryAvg: 56, topPerformers: 8, label: "44% of forms properly associate all labels." }, abTest: { testName: "Accessible Form Labels", hypothesis: "Proper label association will reduce form errors by 15%", control: "Labels without for/id association", variant: "All labels properly linked with for/id attributes", metric: "Form error rate & accessibility audit score", duration: "1 week" } },
];

// ─── Product Page Analysis ───
const productPageFrictionPoints: FrictionPoint[] = [
  { id: "pp-1", category: "value-proposition", severity: "high", title: "Unclear Hero Headline", description: "The hero headline uses jargon instead of communicating a clear benefit. Users can't determine what the product does within 5 seconds.", selector: "h1.hero-title", fix: "Rewrite headline to: [Action verb] + [Outcome] + [Timeframe].", impactScore: 95, benchmark: { industryAvg: 47, topPerformers: 8, label: "47% of SaaS landing pages fail the 5-second clarity test" }, abTest: { testName: "Clarity-First Headline", hypothesis: "Benefit-driven headline will increase demo requests by 30%", control: "'Next-gen synergy platform'", variant: "'Build landing pages that convert — in minutes'", metric: "Demo request rate & bounce rate", duration: "2 weeks" } },
  { id: "pp-2", category: "value-proposition", severity: "high", title: "No Pricing Transparency", description: "Pricing is hidden behind a 'Contact Sales' wall. 76% of B2B buyers say pricing visibility is their top factor.", selector: "section.pricing", fix: "Add at least a starting price ('From $29/mo') or a price range.", impactScore: 89, benchmark: { industryAvg: 38, topPerformers: 11, label: "38% of product pages hide pricing entirely." }, abTest: { testName: "Visible Pricing", hypothesis: "Showing 'From $29/mo' will increase qualified leads by 20%", control: "'Contact Sales' for pricing", variant: "Starting price displayed + comparison table", metric: "Pricing page engagement & lead quality", duration: "3 weeks" } },
  { id: "pp-3", category: "feature-presentation", severity: "high", title: "Feature List Without Benefits", description: "12 features listed with technical labels only. No explanation of why each matters.", selector: "section.features ul", fix: "Add a benefit subtitle under each feature.", impactScore: 82, benchmark: { industryAvg: 55, topPerformers: 12, label: "55% of product pages list features without mapping to outcomes" }, abTest: { testName: "Feature-Benefit Mapping", hypothesis: "Adding benefit subtitles will increase feature section engagement by 25%", control: "Technical feature labels only", variant: "Feature label + benefit subtitle for each", metric: "Feature section scroll depth & CTA clicks", duration: "2 weeks" } },
  { id: "pp-4", category: "feature-presentation", severity: "med", title: "No Product Screenshots or Demo", description: "The product page describes functionality in text only. No screenshots, GIFs, or interactive demo.", selector: "section.features", fix: "Add annotated screenshots or a short demo video above the fold.", impactScore: 78, benchmark: { industryAvg: 33, topPerformers: 5, label: "67% of top product pages include an interactive demo or video" }, abTest: { testName: "Interactive Demo vs Static", hypothesis: "Adding an interactive demo will increase trial signups by 25%", control: "Text-only feature descriptions", variant: "Interactive product demo above the fold", metric: "Trial signup rate & time on page", duration: "3 weeks" } },
  { id: "pp-5", category: "value-proposition", severity: "med", title: "Social Proof Buried Below Content", description: "Customer logos and testimonials appear after 3 scroll depths. 80% of users never reach them.", selector: "section.social-proof", fix: "Move a compact logo bar directly below the hero.", impactScore: 72, benchmark: { industryAvg: 42, topPerformers: 9, label: "58% of high-converting pages place social proof within the first viewport" }, abTest: { testName: "Above-Fold Social Proof", hypothesis: "Moving logos below hero will increase CTA clicks by 15%", control: "Social proof at 3x scroll depth", variant: "Logo bar below hero + testimonial near CTA", metric: "Hero CTA click-through rate", duration: "2 weeks" } },
  { id: "pp-6", category: "onboarding-friction", severity: "high", title: "Trial Requires Credit Card", description: "Users must enter payment details before accessing the trial. CC-free trials convert 2-3x better.", selector: "form.trial-signup", fix: "Remove the credit card requirement for trial signup.", impactScore: 91, benchmark: { industryAvg: 35, topPerformers: 4, label: "35% of SaaS products require CC for trial." }, abTest: { testName: "No-CC Trial Signup", hypothesis: "Removing CC requirement will 2x trial signups", control: "Credit card required for trial", variant: "No credit card — collect payment at trial end", metric: "Trial signup rate & trial-to-paid conversion", duration: "4 weeks" } },
  { id: "pp-7", category: "onboarding-friction", severity: "med", title: "5-Step Signup Wizard", description: "The signup flow has 5 sequential steps before the user sees the product.", selector: "div.onboarding-wizard", fix: "Reduce to 2 steps max: account creation → product.", impactScore: 74, benchmark: { industryAvg: 41, topPerformers: 8, label: "Top quartile onboards in ≤2 steps." }, abTest: { testName: "2-Step Onboarding", hypothesis: "Reducing to 2 steps will increase activation rate by 35%", control: "5-step signup wizard", variant: "2 steps: create account → see product", metric: "Signup completion rate & time to first value", duration: "3 weeks" } },
  { id: "pp-8", category: "onboarding-friction", severity: "low", title: "No Time-to-Value Signal", description: "The page doesn't communicate how quickly users will see results.", selector: "section.hero", fix: "Add a time-to-value statement near the CTA.", impactScore: 48, benchmark: { industryAvg: 56, topPerformers: 14, label: "44% of top product pages include a time-to-value promise" }, abTest: { testName: "Time-to-Value Promise", hypothesis: "Adding 'See results in 2 minutes' will increase CTA clicks by 12%", control: "No time-to-value messaging", variant: "'See your first report in under 2 minutes' near CTA", metric: "CTA click-through rate", duration: "2 weeks" } },
  { id: "pp-9", category: "visual", severity: "med", title: "Competing CTAs Dilute Focus", description: "4 different CTA buttons with equal visual weight.", selector: "button.cta, a.cta", fix: "Designate one primary CTA (filled) and demote others to ghost/link.", impactScore: 68, benchmark: { industryAvg: 44, topPerformers: 10, label: "44% of product pages have 3+ competing CTAs." }, abTest: { testName: "Single Primary CTA", hypothesis: "One filled CTA + ghost secondary will increase primary action by 22%", control: "4 CTAs with equal visual weight", variant: "1 primary filled CTA + 1 ghost secondary", metric: "Primary CTA click-through rate", duration: "2 weeks" } },
  { id: "pp-10", category: "performance", severity: "med", title: "Heavy Demo Video Blocks Page Load", description: "An auto-playing 8MB video loads synchronously, pushing LCP to 5.2s.", selector: "video.hero-demo", fix: "Lazy-load the video. Show a thumbnail with a play button.", impactScore: 64, benchmark: { industryAvg: 29, topPerformers: 6, label: "29% of product pages auto-load heavy media." }, abTest: { testName: "Lazy-Loaded Demo Video", hypothesis: "Thumbnail + play button will reduce LCP by 60%", control: "Auto-playing 8MB hero video", variant: "Poster thumbnail with click-to-play", metric: "LCP & video play rate", duration: "1 week" } },
];

// ─── Landing Page — Marketing Analysis ───
const landingMarketingFrictionPoints: FrictionPoint[] = [
  { id: "lm-1", category: "accessibility", severity: "high", title: "Low-Contrast Call to Action", description: 'The primary "Get Started" button has a contrast ratio of 2.1:1 against its background, failing WCAG AA.', selector: "button.cta-main", fix: "background-color: #1a73e8; color: #ffffff; /* Contrast ratio: 7.2:1 */", impactScore: 92, screenshotUrl: frictionLowContrastCta, benchmark: { industryAvg: 41, topPerformers: 8, label: "41% of SaaS landing pages fail WCAG AA contrast on CTAs" }, abTest: { testName: "High-Contrast CTA", hypothesis: "WCAG AA compliant CTA will increase clicks by 20%", control: "2.1:1 contrast ratio CTA", variant: "7.2:1 contrast ratio blue CTA on white", metric: "CTA click-through rate", duration: "2 weeks" } },
  { id: "lm-2", category: "ux", severity: "high", title: "CTA Below the Fold", description: "The primary conversion action is positioned at 1,240px from the top.", selector: "section.hero > .cta-container", fix: "Move CTA to within the first 600px. Consider a sticky CTA bar.", impactScore: 88, screenshotUrl: frictionCtaBelowFold, benchmark: { industryAvg: 34, topPerformers: 5, label: "34% of sites bury the primary CTA below the fold" }, abTest: { testName: "Above-Fold CTA Placement", hypothesis: "Moving CTA to hero will increase conversions by 25%", control: "CTA at 1,240px scroll depth", variant: "CTA within first 600px + sticky bar on scroll", metric: "CTA visibility rate & conversion rate", duration: "2 weeks" } },
  { id: "lm-3", category: "performance", severity: "high", title: "Largest Contentful Paint: 4.8s", description: "The hero image (2.4MB, uncompressed PNG) blocks the LCP.", selector: "img.hero-banner", fix: 'Convert to WebP, add loading="lazy", implement srcset for responsive sizes.', impactScore: 85, benchmark: { industryAvg: 53, topPerformers: 12, label: "Industry median LCP is 2.5s. Top quartile achieves <1.8s" }, abTest: { testName: "WebP Hero Optimization", hypothesis: "WebP + srcset will reduce LCP from 4.8s to <2s", control: "2.4MB uncompressed PNG hero", variant: "WebP with responsive srcset", metric: "LCP & mobile bounce rate", duration: "1 week" } },
  { id: "lm-4", category: "visual", severity: "med", title: "Flat Visual Hierarchy", description: "All text elements use similar font sizes (14-16px) and weights (400-500).", selector: "main > *", fix: "Establish a type scale: H1 at 2.5rem/700, H2 at 1.75rem/600, body at 1rem/400.", impactScore: 71, screenshotUrl: frictionFlatHierarchy, benchmark: { industryAvg: 62, topPerformers: 18, label: "62% of sites use fewer than 3 distinct type sizes" }, abTest: { testName: "Typography Hierarchy", hypothesis: "Clear type scale will reduce bounce by 12%", control: "Uniform 14-16px / 400-500 weight", variant: "H1: 2.5rem/700, H2: 1.75rem/600, body: 1rem/400", metric: "Scroll depth & bounce rate", duration: "2 weeks" } },
  { id: "lm-5", category: "content-hierarchy", severity: "med", title: "Benefits Section Uses Feature-Speak", description: "The benefits section lists technical features rather than user outcomes.", selector: "section.benefits", fix: "Reframe each feature as a benefit: 'AI-powered analytics → Know exactly where you're losing customers.'", impactScore: 74, benchmark: { industryAvg: 48, topPerformers: 10, label: "52% of top marketing pages lead with outcomes, not features." }, abTest: { testName: "Benefits vs Features Copy", hypothesis: "Outcome-driven copy will increase section engagement by 20%", control: "Technical feature labels", variant: "Benefit-first copy with outcome statements", metric: "Section scroll depth & CTA clicks below", duration: "2 weeks" } },
  { id: "lm-6", category: "conversion-funnel", severity: "med", title: "Form Requires 8+ Fields", description: 'Sign-up form requests 8 fields. Forms with >4 fields see 40% more abandonment.', selector: "form#signup", fix: "Reduce to email-only for initial sign-up.", impactScore: 67, screenshotUrl: frictionLongForm, benchmark: { industryAvg: 28, topPerformers: 3, label: "Top converters average 2.3 fields. Industry median is 5" }, abTest: { testName: "Email-Only Signup", hypothesis: "Single email field will increase signups by 45%", control: "8-field signup form", variant: "Email-only field with progressive profiling", metric: "Signup conversion rate", duration: "2 weeks" } },
  { id: "lm-7", category: "visual", severity: "low", title: "Inconsistent Button Styles", description: "Three different button styles for equivalent actions across the page.", selector: "button, a.btn", fix: "Standardize: filled for primary CTA, ghost for secondary.", impactScore: 45, screenshotUrl: frictionInconsistentButtons, benchmark: { industryAvg: 57, topPerformers: 15, label: "57% of sites use 3+ button variants" }, abTest: { testName: "Unified Button System", hypothesis: "Consistent buttons will increase primary CTA clicks by 10%", control: "3 different button styles", variant: "Filled primary + ghost secondary only", metric: "Primary CTA click rate", duration: "2 weeks" } },
  { id: "lm-8", category: "performance", severity: "low", title: "Unused JavaScript: 340KB", description: "340KB of JavaScript is loaded but never executed on this page.", selector: "<script> tags", fix: "Implement code-splitting. Lazy-load analytics after user interaction.", impactScore: 38, benchmark: { industryAvg: 68, topPerformers: 22, label: "Median unused JS is 180KB. Top quartile ships <80KB" }, abTest: { testName: "JavaScript Tree-Shaking", hypothesis: "Removing unused JS will improve TTI by 1.5s", control: "340KB unused JavaScript", variant: "Code-split with lazy-loaded analytics", metric: "TTI & bounce rate", duration: "1 week" } },
  { id: "lm-9", category: "accessibility", severity: "med", title: "Missing Focus Indicators", description: 'Interactive elements have outline: none without alternative focus styles.', selector: "a, button, input", fix: "Add focus-visible styles: outline: 2px solid currentColor; outline-offset: 2px;", impactScore: 58, benchmark: { industryAvg: 72, topPerformers: 19, label: "72% of sites remove focus outlines" }, abTest: { testName: "Focus Indicator Styles", hypothesis: "Custom focus styles will improve keyboard navigation by 30%", control: "outline: none on all interactive elements", variant: "focus-visible: 2px solid currentColor", metric: "Keyboard task completion rate", duration: "1 week" } },
  { id: "lm-10", category: "ux", severity: "low", title: "No Social Proof Above the Fold", description: "Testimonials and trust indicators are placed at the bottom of the page.", selector: "section.testimonials", fix: "Add a compact logo bar or star rating near the hero CTA.", impactScore: 42, benchmark: { industryAvg: 48, topPerformers: 9, label: "52% of high-converting pages show social proof above the fold" }, abTest: { testName: "Hero Social Proof", hypothesis: "Logo bar below hero will increase CTA clicks by 12%", control: "Social proof at page bottom only", variant: "Compact logo bar + star rating near hero CTA", metric: "Hero CTA click-through rate", duration: "2 weeks" } },
  { id: "lm-11", category: "content-hierarchy", severity: "high", title: "Mixed Content Zones Confuse Users", description: "Product features, testimonials, and pricing are interspersed without clear section delineation.", selector: "main > section", fix: "Group related content into clearly delineated sections with distinct background colors.", impactScore: 78, screenshotUrl: frictionMixedContent, benchmark: { industryAvg: 42, topPerformers: 8, label: "58% of top marketing pages use clear section delineation." }, abTest: { testName: "Section Delineation", hypothesis: "Clear section boundaries will improve comprehension by 25%", control: "Mixed content without section breaks", variant: "Alternating background colors with consistent spacing", metric: "Scroll depth & section engagement time", duration: "2 weeks" } },
];

// ─── Landing Page — Paid Media Analysis ───
const landingPaidMediaFrictionPoints: FrictionPoint[] = [
  { id: "pm-1", category: "message-match", severity: "high", title: "Ad Headline ≠ Page Headline", description: "The ad promises '50% Off Your First Month' but the landing page headline reads 'Welcome to Our Platform'.", selector: "h1.page-headline", fix: "Mirror the ad headline exactly: '50% Off Your First Month — Claim Your Discount'.", impactScore: 96, benchmark: { industryAvg: 52, topPerformers: 6, label: "48% of paid pages don't match their ad headline." }, abTest: { testName: "Ad-to-Page Headline Match", hypothesis: "Matching ad headline 1:1 will reduce bounce by 30% and increase conversions by 25%", control: "Generic 'Welcome to Our Platform' headline", variant: "Exact ad copy: '50% Off Your First Month'", metric: "Bounce rate & conversion rate", duration: "2 weeks" } },
  { id: "pm-2", category: "message-match", severity: "high", title: "Missing Ad Creative Continuity", description: "The ad uses a blue color scheme with a specific product image, but the landing page has a completely different visual style.", selector: "section.hero", fix: "Use the same hero image, color palette, and visual style from the ad creative.", impactScore: 84, benchmark: { industryAvg: 44, topPerformers: 9, label: "56% of top ad campaigns maintain visual continuity" }, abTest: { testName: "Visual Scent Trail", hypothesis: "Matching ad visual style will reduce bounce by 18%", control: "Different visual style from ad creative", variant: "Same hero image, color palette, and typography as ad", metric: "Bounce rate & time on page", duration: "2 weeks" } },
  { id: "pm-3", category: "conversion-funnel", severity: "high", title: "Form Asks for Unnecessary Info", description: "Lead form requires company name, phone, job title. Every extra field reduces conversion by 11%.", selector: "form.lead-capture", fix: "Reduce to name + email. Use progressive profiling.", impactScore: 90, benchmark: { industryAvg: 39, topPerformers: 5, label: "Top-converting paid pages average 2 fields." }, abTest: { testName: "2-Field Lead Form", hypothesis: "Reducing to name + email will increase paid lead conversion by 40%", control: "5-field form", variant: "2 fields: name + email with progressive profiling", metric: "Form submission rate & cost per lead", duration: "2 weeks" } },
  { id: "pm-4", category: "conversion-funnel", severity: "med", title: "No Trust Signals Near CTA", description: "The conversion form has no security badges, privacy link, testimonial, or guarantee.", selector: "div.form-container", fix: "Add security badge, '30-day money-back guarantee', privacy note, and one testimonial.", impactScore: 73, benchmark: { industryAvg: 46, topPerformers: 11, label: "54% of top paid pages include trust signals adjacent to CTA" }, abTest: { testName: "CTA Trust Signals", hypothesis: "Trust signals near CTA will increase conversions by 15%", control: "No trust elements near form", variant: "Security badge + guarantee + testimonial + privacy note", metric: "Form submission rate", duration: "2 weeks" } },
  { id: "pm-5", category: "conversion-funnel", severity: "med", title: "No Urgency or Scarcity Element", description: "No time-limited offers, limited availability, or countdown timers.", selector: "section.offer", fix: "Add a genuine deadline: 'Offer ends March 31' or 'Only 12 spots remaining'.", impactScore: 61, benchmark: { industryAvg: 37, topPerformers: 8, label: "63% of high-converting paid pages include urgency" }, abTest: { testName: "Urgency Element", hypothesis: "A countdown timer will increase same-session conversions by 20%", control: "No urgency or scarcity messaging", variant: "Countdown timer + spots remaining counter", metric: "Same-session conversion rate", duration: "2 weeks" } },
  { id: "pm-6", category: "bounce-risk", severity: "high", title: "Page Load Time: 6.1s on Mobile", description: "Mobile load is 6.1s. 53% of mobile users abandon pages over 3 seconds.", selector: "document", fix: "Compress to WebP, defer non-critical JS, inline critical CSS. Target <2.5s LCP.", impactScore: 93, benchmark: { industryAvg: 48, topPerformers: 10, label: "Median paid page LCP is 3.8s. Top quartile achieves <2s." }, abTest: { testName: "Mobile Speed Optimization", hypothesis: "Reducing to <2.5s will save 30% of wasted ad spend from bounces", control: "6.1s mobile page load", variant: "WebP + deferred JS + inlined critical CSS", metric: "Mobile bounce rate & cost per conversion", duration: "1 week" } },
  { id: "pm-7", category: "bounce-risk", severity: "high", title: "Attention Ratio: 12:1", description: "12 outbound links but only 1 CTA. Every link is a potential exit wasting ad spend.", selector: "nav, footer, a:not(.cta)", fix: "Remove nav, footer links, and social icons. Only the CTA should be clickable.", impactScore: 87, benchmark: { industryAvg: 43, topPerformers: 7, label: "57% of top paid pages maintain a 1:1 attention ratio" }, abTest: { testName: "1:1 Attention Ratio", hypothesis: "Removing all non-CTA links will increase conversion by 20%", control: "12 outbound links + 1 CTA", variant: "CTA-only page with no navigation or footer links", metric: "Conversion rate & exit rate", duration: "2 weeks" } },
  { id: "pm-8", category: "bounce-risk", severity: "med", title: "No Mobile-Optimized Layout", description: "Desktop layout scaled down for mobile. Text too small, tap targets overlap.", selector: "body", fix: "Create a mobile-first layout: 16px+ text, 48px tap targets, CTA within first viewport.", impactScore: 76, benchmark: { industryAvg: 34, topPerformers: 6, label: "66% of top paid pages are mobile-first." }, abTest: { testName: "Mobile-First Layout", hypothesis: "Mobile-optimized layout will increase mobile conversions by 35%", control: "Desktop layout scaled down for mobile", variant: "Mobile-first: 16px text, 48px tap targets, CTA in viewport", metric: "Mobile conversion rate", duration: "2 weeks" } },
  { id: "pm-9", category: "message-match", severity: "med", title: "Offer Terms Not Visible", description: "Ad mentions '14-day free trial' but the page doesn't reference it until below the fold.", selector: "section.hero .offer-callout", fix: "Repeat the exact offer in the hero subheadline and next to the CTA.", impactScore: 69, benchmark: { industryAvg: 41, topPerformers: 8, label: "59% of top paid pages repeat the ad offer in the hero" }, abTest: { testName: "Hero Offer Repetition", hypothesis: "Repeating offer in hero will reduce bounce by 15%", control: "Offer mentioned only below fold", variant: "Offer in hero subheadline + next to CTA button", metric: "Bounce rate & CTA click rate", duration: "2 weeks" } },
  { id: "pm-10", category: "visual", severity: "low", title: "CTA Button Doesn't Stand Out", description: "CTA uses the same color as decorative elements, making it blend in.", selector: "button.cta-primary", fix: "Use a contrasting color that appears nowhere else. Add whitespace padding.", impactScore: 55, benchmark: { industryAvg: 39, topPerformers: 10, label: "61% of high-converting paid pages use a unique CTA color" }, abTest: { testName: "Unique CTA Color", hypothesis: "A unique contrasting CTA color will increase clicks by 15%", control: "CTA same color as decorative elements", variant: "Unique high-contrast CTA color with whitespace", metric: "CTA click-through rate", duration: "2 weeks" } },
  { id: "pm-11", category: "ux", severity: "low", title: "No Exit-Intent Recovery", description: "No exit-intent popup when users move to close. 10-15% of abandoning visitors can be recovered.", selector: "document", fix: "Add an exit-intent popup with a simplified offer.", impactScore: 44, benchmark: { industryAvg: 27, topPerformers: 5, label: "73% of top paid pages use exit-intent recovery." }, abTest: { testName: "Exit-Intent Popup", hypothesis: "Exit-intent with simplified offer will recover 10% of abandoning visitors", control: "No exit-intent detection", variant: "Exit popup: simplified offer headline + CTA + dismiss", metric: "Exit recovery rate & cost per acquisition", duration: "2 weeks" } },
];

export const generateMockAnalysis = (url: string, analysisType: AnalysisType = "homepage"): AnalysisResult => {
  const pointsByType: Record<AnalysisType, FrictionPoint[]> = {
    homepage: homepageFrictionPoints,
    "blog-content": blogContentFrictionPoints,
    checkout: checkoutFrictionPoints,
    "lead-form": leadFormFrictionPoints,
    "product-page": productPageFrictionPoints,
    "landing-marketing": landingMarketingFrictionPoints,
    "landing-paid-media": landingPaidMediaFrictionPoints,
  };

  const frictionPoints = [...pointsByType[analysisType]].sort((a, b) => b.impactScore - a.impactScore);
  const cats = categoriesForType[analysisType];

  const categoryScores: BenchmarkSummary["categoryScores"] = {};
  cats.forEach((cat) => {
    categoryScores[cat] = {
      score: Math.floor(Math.random() * 30 + 25),
      industryAvg: Math.floor(Math.random() * 15 + 45),
    };
  });

  return {
    url,
    timestamp: new Date().toISOString(),
    device: "desktop",
    analysisType,
    frictionPoints,
    benchmark: {
      overallScore: Math.floor(Math.random() * 20 + 30),
      industryAvg: 52,
      topQuartile: 81,
      categoryScores,
    },
  };
};
