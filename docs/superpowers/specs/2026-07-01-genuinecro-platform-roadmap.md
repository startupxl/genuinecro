# GenuineCRO — Platform Roadmap (Phase 2+)

**Date:** 2026-07-01
**Status:** Directional — each phase gets its own design spec before implementation

Phase 1 (see `2026-07-01-node-hostinger-redesign-design.md`) ships the Node.js/Hostinger/Firebase migration, the interface redesign, and a nav shell covering the full intended information architecture — with Dashboard, Conversion, Monitoring, Action Center, and Reports (including white-label branding) functionally real, plus a full feature-parity audit ensuring nothing from the existing source (Help Center, Contact Us, legal pages, A/B test recommendations, benchmark comparisons, etc.) is silently dropped, and real (non-placeholder) Contact Us email delivery, notification/digest emails via Kit, and report localization (en/es/fr/de). This doc maps out the remaining sections as future, independently-specced sub-projects. Nothing here is scheduled or estimated yet — it exists so future sessions have a map to follow.

## Phase 2 — Technical SEO
Crawl-based audit: sitemap/robots.txt validation, redirect chains, broken links, canonical tags, crawlability. Requires a multi-page crawler (Firecrawl can likely be reused for this, in crawl mode rather than single-page scrape mode) and a new scoring model separate from the Conversion category weights.

## Phase 3 — Performance & Accessibility
- **Performance**: real Core Web Vitals (LCP, CLS, INP) via an integration with Google PageSpeed Insights API or a self-run Lighthouse pass — replacing the current heuristic-only speed signals.
- **Accessibility**: WCAG scanning via an axe-core-based integration.
Both are natural pairings since they're typically run against the same rendered page and can share a "technical health" section of the Dashboard.

## Phase 4 — Security
Baseline security posture checks: SSL/TLS configuration, security headers (CSP, HSTS, etc.), exposed sensitive endpoints. Read-only/non-intrusive checks only — no active vulnerability scanning against third-party sites without explicit authorization.

## Phase 5 — Monitoring: Scheduled Re-Scans & Score/Issue Alerts
Phase 1 already ships passive scan history/trends, plus the underlying cron-hits-endpoint and Kit email plumbing (built for the weekly digest — see design doc §6.2). Phase 5 reuses that plumbing and adds the harder logic on top: **recurring scheduled re-audits** of a tracked client site, and **alerting** — diffing each new scan against the previous one and emailing when a score drops or a new critical issue appears.

## Phase 6 — Competitor Analysis
Side-by-side comparison of a tracked site against one or more competitor URLs, and "before vs. after" comparison across two points in time for the same site. Builds on the existing `ComparisonView` component (currently used for desktop-vs-mobile) generalized to arbitrary URL pairs.

## Phase 7 — Team Accounts & Collaboration
Found during the Phase 1 feature audit: the Subscription page markets "Team collaboration" (Pro) and "3 team accounts" (Agency), but no multi-user/organization concept exists anywhere in the current source. Phase 7 introduces an "Organization" concept above the individual user account — seat-based accounts, shared access to teammates' analyses/reports, and (as one part of it) full Action Center task assignment with due dates and completion attribution. Also affects billing (seat-based pricing) and Firestore security rules (shared org-level document access).

## Phase 8 — Multi-Page Funnel Diagnostics
Found during the Phase 1 feature audit: the Subscription page markets "multi-page funnel diagnostics" (Pro/Agency), but today's "funnel-health" is only one of six score categories evaluated on a *single* analyzed page — there's no actual multi-step funnel tracking. Phase 8 adds real funnel tracking: define a sequence of pages (e.g., landing → cart → checkout → confirmation), analyze each step, and surface drop-off/friction trends across the sequence rather than in isolation.

## Phase 9 — Public API Access
Found during the Phase 1 feature audit: the Subscription page markets "API access" (Pro/Agency), but no public API, API key management, or rate limiting exists anywhere today. Phase 9 adds an authenticated REST API (API key issuance/rotation in Account settings, per-plan rate limits) so Pro/Agency customers can trigger analyses and pull results programmatically — likely the same Express routes Phase 1 builds for the web app, exposed behind API-key auth instead of session auth.

## Sequencing Notes
- Phases are ordered by a rough mix of "user value" and "reuses Phase 1 infrastructure," not fixed priority — revisit ordering based on actual user feedback after Phase 1 ships.
- Each phase should go through its own brainstorming → spec → plan cycle rather than being pre-planned in detail here, since requirements (e.g., which Lighthouse metrics matter most, what alert channels users actually want) are better discovered closer to when that phase starts.
- Phases 7-9 were added after a line-by-line audit of the existing source code turned up features that are marketed on the Subscription page today but were never actually built or enforced anywhere in the app — see design doc §9 for the full list.
