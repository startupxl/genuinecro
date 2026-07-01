# GenuineCRO — Platform Roadmap (Phase 2+)

**Date:** 2026-07-01
**Status:** Directional — each phase gets its own design spec before implementation

Phase 1 (see `2026-07-01-node-hostinger-redesign-design.md`) ships the Node.js/Hostinger/Firebase migration, the interface redesign, and a nav shell covering the full intended information architecture — with only Dashboard, Conversion, Monitoring, Action Center, and Reports functionally real. This doc maps out the remaining sections as future, independently-specced sub-projects. Nothing here is scheduled or estimated yet — it exists so future sessions have a map to follow.

## Phase 2 — Technical SEO
Crawl-based audit: sitemap/robots.txt validation, redirect chains, broken links, canonical tags, crawlability. Requires a multi-page crawler (Firecrawl can likely be reused for this, in crawl mode rather than single-page scrape mode) and a new scoring model separate from the Conversion category weights.

## Phase 3 — Performance & Accessibility
- **Performance**: real Core Web Vitals (LCP, CLS, INP) via an integration with Google PageSpeed Insights API or a self-run Lighthouse pass — replacing the current heuristic-only speed signals.
- **Accessibility**: WCAG scanning via an axe-core-based integration.
Both are natural pairings since they're typically run against the same rendered page and can share a "technical health" section of the Dashboard.

## Phase 4 — Security
Baseline security posture checks: SSL/TLS configuration, security headers (CSP, HSTS, etc.), exposed sensitive endpoints. Read-only/non-intrusive checks only — no active vulnerability scanning against third-party sites without explicit authorization.

## Phase 5 — Monitoring: Scheduling & Alerts
Phase 1 ships passive scan history/trends. Phase 5 adds **recurring scheduled audits** (e.g., weekly re-scan of a tracked client site) and **alerting** (email notification when a score drops or a new critical issue appears). On Hostinger shared hosting, this is feasible via hPanel's cron job feature hitting an authenticated API endpoint on a schedule — no persistent background worker process required.

## Phase 6 — Competitor Analysis
Side-by-side comparison of a tracked site against one or more competitor URLs, and "before vs. after" comparison across two points in time for the same site. Builds on the existing `ComparisonView` component (currently used for desktop-vs-mobile) generalized to arbitrary URL pairs.

## Phase 7 — Full Team-Based Action Center
Phase 1's Action Center is single-user (aggregate + mark resolved). Phase 7 adds team accounts/seats, task assignment to specific teammates, due dates, and completion tracking with attribution — likely tied to introducing an "Organization" concept above the individual user account, which also affects billing (seat-based pricing) and Firestore security rules (shared org-level document access).

## Sequencing Notes
- Phases are ordered by a rough mix of "user value" and "reuses Phase 1 infrastructure," not fixed priority — revisit ordering based on actual user feedback after Phase 1 ships.
- Each phase should go through its own brainstorming → spec → plan cycle rather than being pre-planned in detail here, since requirements (e.g., which Lighthouse metrics matter most, what alert channels users actually want) are better discovered closer to when that phase starts.
