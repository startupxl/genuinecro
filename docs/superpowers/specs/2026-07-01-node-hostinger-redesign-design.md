# GenuineCRO — Node.js/Hostinger Migration & Interface Redesign

**Date:** 2026-07-01
**Status:** Approved for planning

## 1. Overview & Goals

GenuineCRO is currently a Vite + React + TypeScript SPA (shadcn/ui, Tailwind, Framer Motion) backed entirely by Supabase (Auth, Postgres, Storage, Edge Functions) plus PayPal, Firecrawl, and Lovable's proprietary AI gateway. This spec covers two coupled efforts:

1. **Re-platforming** the app to run as a self-contained Node.js application, deployable to Hostinger's shared/Business hosting (Node.js App feature) via GitHub, with Firebase replacing Supabase and OpenAI replacing Lovable's AI gateway.
2. **Redesigning the interface** to be modern, clean, interactive, and action-driven, with an information architecture that matches GenuineCRO's target audience: SaaS companies, SMBs, Enterprises, and agencies servicing SMB/Enterprise clients.

This is **Phase 1** of a larger platform vision (see companion roadmap doc). Phase 1 delivers a working, deployed product with today's real capability (AI-driven conversion friction analysis) presented inside a much richer information architecture shell — with clearly-marked "coming soon" sections for future audit engines, so the product already looks and feels like the category-rich platform being built toward, without overstating what's real.

## 2. Target Audience & Positioning

Audience: SaaS companies, SMBs, Enterprises, and agencies who service SMB/Enterprise clients. The existing plan tiers already reflect this segmentation and should be leaned into, not rebuilt:

| Plan | Segment | Key capabilities |
|---|---|---|
| Free / Starter | Individual / early SMB | Basic single-page analysis |
| Growth | Growing SMB | + Mobile analysis, desktop/mobile comparison, funnel analysis |
| Pro | Mid-market / SMB scaling up | + Exports, team sharing, API access |
| Agency | Agencies serving SMB/Enterprise clients | + White-label reports, client-ready dashboards |

Design implication: Dashboard, bulk/multi-client analysis, and white-label reporting are first-class, prominent surfaces in the redesign — not gated afterthoughts discovered only via an upgrade toast.

## 3. Architecture: Hosting & Deployment

- **Runtime**: A single Express (Node.js) server is the application Hostinger's "Node.js App" feature runs. It:
  - Serves the built Vite/React static assets (`dist/`) with SPA fallback routing (all non-API routes serve `index.html`).
  - Hosts all API routes under `/api/*` for business logic (see §4).
  - Runs same-origin with the frontend — no CORS configuration needed for first-party requests (a simplification vs. today's cross-origin Supabase Edge Function calls).
- **Hosting plan assumption**: Hostinger shared/Business hosting with the Node.js App panel. No root/SSH access assumed; no ability to install arbitrary system services (e.g., self-hosted Postgres) — this is why Firebase (managed) was chosen over self-hosting a database.
- **Deployment flow**: hPanel's Node.js App Git integration connects directly to `github.com/startupxl/genuinecro` (public repo). Pushes to `main` are pulled by Hostinger and the app is restarted. No GitHub Actions/CI pipeline required for Phase 1.
- **Environment variables** (configured in hPanel, never committed): `FIREBASE_*` (service account credentials), `OPENAI_API_KEY`, `FIRECRAWL_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`.

## 4. Backend Migration

Supabase is removed entirely. Replacements:

| Today (Supabase) | Replacement | Notes |
|---|---|---|
| Supabase Auth (email/password + Google via Lovable's OAuth wrapper) | **Firebase Auth** | Email/password + native Google provider. Removes the Lovable OAuth dependency too. |
| Postgres (`profiles`, `analyses`, `subscriptions` tables + RLS) | **Firestore** | Collections mirror existing tables (see §5). RLS-equivalent authorization is enforced by Firestore Security Rules for direct client reads, and by server-side checks in Express for anything written through the API. |
| Storage (`avatars` bucket) | **Firebase Storage** | Same bucket purpose, same upload/read pattern. |
| Edge Function `ai-analyze` (calls `ai.gateway.lovable.dev`) | **Express route calling OpenAI directly** | Same prompt/scoring engine (100+ rule reference, category weighting, JSON contract) ported as-is; only the model call target changes. |
| Edge Function `analyze-url` (Firecrawl scrape + AI call orchestration) | **Express route** | Same two-step flow (scrape → analyze), same heuristic fallback logic when AI is unavailable. |
| Edge Functions `paypal-create-subscription`, `paypal-webhook`, `paypal-subscription-status` | **Express routes** | Same PayPal flows, reading/writing Firestore instead of Postgres. |
| Firecrawl (scraping) | **Unchanged** | Already an external API, unaffected. |

## 5. Data Model (Firestore)

- **`users/{uid}`** — mirrors `profiles`: `email`, `displayName`, `avatarUrl`, `createdAt`. Created via a Firebase Auth `onCreate` trigger (Cloud Function) or lazily on first authenticated API call, mirroring the old `handle_new_user` trigger.
- **`analyses/{id}`** — mirrors the `analyses` table: `userId` (nullable for anon), `url`, `analysisType`, `device`, `conversionScore`, `grade`, `createdAt`. Powers usage tracking, Dashboard history, and Monitoring trends.
- **`subscriptions/{userId}`** — mirrors the `subscriptions` table: `paypalSubscriptionId`, `planName`, `status`, `currentPeriodStart`, `currentPeriodEnd`, `updatedAt`.
- **`actionItems/{id}`** (new, backs the Action Center) — derived/synced from friction points across a user's analyses: `userId`, `analysisId`, `title`, `category`, `severity`, `impactScore`, `status` (`open` | `resolved`), `createdAt`. Lightweight single-user status tracking for Phase 1; multi-user assignment is a Phase 2+ concern (needs team accounts).

Anonymous usage tracking (the 3-free-audit limit) stays client-side (localStorage), unchanged from today.

## 6. Information Architecture (Phase 1 scope)

A persistent left-nav workspace shell replaces "logged-in users land on a blank input screen every time." Anonymous/free visitors are unaffected — they still land on the simple single-URL input screen.

Nav sections and Phase 1 status:

| Section | Status | Phase 1 content |
|---|---|---|
| Dashboard | **Real** | Client sites grouped by domain, score trend, open-critical-issue count, "+ New Audit" |
| Technical | Coming soon | Placeholder |
| Content | Coming soon | Placeholder |
| Conversion | **Real** | Today's actual product — AI friction analysis (homepage, checkout, lead-form, product-page, landing variants), desktop/mobile/comparison modes |
| Monitoring | **Real** | Scan history + score trend per site (built from existing `analyses` data — no new data source needed) |
| Analysis (Competitor) | Coming soon | Placeholder |
| Action Center | **Real (lightweight)** | Aggregated open friction points across all of a user's analyses, mark resolved. No cross-user assignment yet. |
| Reports | **Real** | Existing CSV export and Jira-ticket copy, **plus new**: PDF export and a shareable read-only report link |

"Coming soon" sections are visible in the nav (to convey the full platform vision) but show a clear placeholder state when opened — never fabricated data.

Bulk Analysis (existing agency multi-client feature) is retained and surfaced from the Dashboard.

## 7. Visual Design System

- **Palette — "Indigo Tint"**: near-white cool background, deep indigo ink, single indigo accent reserved for progress indicators and primary actions, red reserved strictly for critical-severity indicators. Starting token values (to refine visually during implementation, following the existing HSL CSS-variable pattern in `index.css`):
  - `--background`: `225 100% 98%` (≈ `#FAFBFF`)
  - `--foreground`: `244 47% 20%` (≈ `#1E1B4B`)
  - `--primary`: `243 75% 59%` (≈ `#4F46E5`)
  - `--muted-foreground`: `248 24% 63%` (≈ `#8B87B8`)
  - `--border` / `--secondary`: `230 47% 92%` / `230 47% 95%`
  - `--destructive` (critical only): unchanged red (`0 84% 60%`)
- **Typography**:
  - Display/headlines: **Fraunces** (variable, optical-size axis), replacing the current bare `Georgia` fallback used in mockups.
  - Body/UI: **Geist Sans** — note: the current `index.css` references `'Geist Sans'` in the body font stack but never actually imports it (only `Geist Mono` is pulled from Google Fonts), so it silently falls back to system fonts today. This gets fixed as part of the font-stack upgrade by importing the correct family name (`Geist`) alongside `Fraunces` and `Geist Mono` in one `@import`.
  - Numeric/data: **Geist Mono** (unchanged, already correctly loaded).
- **Component pattern**: issue/friction cards use a left-border severity stripe (color-coded, critical = red) rather than the current pill-shaped severity badge — reads cleaner against the lighter Indigo Tint palette. Applied consistently across Conversion results, Action Center, and Reports.
- Applies consistently across the landing screen, Dashboard, Conversion results, and Reports.

## 8. Security Notes

- The classic PAT shared during this session (scopes: `repo`, `write:packages`) should be rotated after initial repo setup, since it's now recorded in conversation history. Implementation will use a fine-grained token scoped only to `startupxl/genuinecro` with `Contents: Read and write`.
- Firebase service account credentials and all third-party API keys are Hostinger environment variables, never committed to the repo.
- Firestore Security Rules enforce per-user read/write scoping (equivalent to today's Postgres RLS policies) for any data read directly by the client SDK.

## 9. Out of Scope (this spec)

Technical SEO, Performance/Core Web Vitals, Accessibility, Security auditing, scheduled/recurring monitoring with alerts, competitor comparison, and full team-based Action Center assignment are **not** built in Phase 1. They appear as "Coming soon" placeholders in the nav and are mapped as future phases in the companion roadmap doc: `2026-07-01-genuinecro-platform-roadmap.md`.
