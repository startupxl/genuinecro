# Technical SEO Audit — Design Spec

**Date:** 2026-07-02
**Status:** Approved — ready for implementation plan

This is Phase 2 of the platform roadmap (`docs/superpowers/specs/2026-07-01-genuinecro-platform-roadmap.md`), scoped down to a v1 that fits a single implementation plan. It makes the "Technical" nav section real.

## Decisions

These were settled through Q&A with the user before writing this spec:

1. **Trigger model:** Technical is a separate, standalone audit type — its own page (`/technical`) with its own URL input and submit flow. It is not bundled into the existing Conversion analysis and is not tied to an existing tracked site.
2. **Crawl scope:** Single page only. No multi-page crawler in v1. Site-wide artifacts (`robots.txt`, `sitemap.xml`) are still checked since they're one fetch each, not a crawl.
3. **Link checking:** Every link found on the audited page gets a live HTTP check (not capped, not skipped).
4. **Scoring:** A single 0-100 Technical Score, computed from weighted checks, plus a list of specific issues — mirroring the existing Conversion Score pattern.
5. **Action Center integration:** Technical issues are written as `actionItems` too, using the exact same collection and functions built for the Conversion Action Center. One unified "what's open" list.
6. **Usage quota:** Technical audits share the same audit quota as Conversion audits (the existing `useUsageTracking`/plan-limit system), via the same `trackAnalysis` call.
7. **Dashboard trend integrity:** Because sharing the quota means writing into the same `analyses` collection the Dashboard reads, `groupAnalysesByDomain` is updated to exclude `analysisType === "technical"` records so the existing Conversion score trend on Dashboard is unaffected.
8. **Page layout:** `/technical` is a standalone URL-input-to-report flow (like today's Conversion flow at `/`), not a Dashboard-style tracked-site list with drill-down.

## Architecture

### Backend

**New dependency:** `cheerio` (server-side HTML parsing). `jsdom` already exists in the repo but only as a `devDependency` for the Vitest test environment — it should not be pulled into production server code for this. `cheerio` is the standard lightweight choice for parsing/querying HTML server-side.

**New files:**
- `server/lib/technicalChecks.js` — the individual, independently-testable check functions:
  - `extractCanonical(html)` → `{ present: boolean, href: string | null }`
  - `extractIndexability(html)` → `{ indexable: boolean, reason: string | null }` (true unless a `<meta name="robots" content="noindex...">` is present)
  - `extractLinks(html, baseUrl)` → `string[]` of absolute URLs found in `<a href>` on the page
  - `checkRobotsTxt(origin)` → fetches `${origin}/robots.txt`, returns `{ exists: boolean, valid: boolean, issue: string | null }`
  - `checkSitemap(origin)` → fetches `${origin}/sitemap.xml`, returns `{ exists: boolean, valid: boolean, issue: string | null }` (valid = parses as XML and has at least one `<url>` or `<sitemap>` entry)
  - `checkLinks(links)` → for each link, follows redirects manually (max 5 hops) with a 6-second timeout per link, classifies as `{ url, status: "ok" | "broken" | "redirect-chain", hops, finalStatus }`. Runs with a concurrency cap of 8 in-flight requests at a time.
- `server/lib/technicalScoring.js` — `computeTechnicalScore({ canonical, indexability, robotsTxt, sitemap, linkResults })` → `{ score: number, issues: FrictionPointInput[] }` (see Scoring Model below). `FrictionPointInput` is the same shape already defined in `src/lib/firebase/actionItems.ts` (`category, severity, title, description, fix, impactScore`) — the server builds plain objects matching that shape so the client can pass them straight into `createActionItems` with no transformation.
- `server/routes/technical.js` — `POST /api/technical/audit`, body `{ url: string }`:
  1. Validates `url` is present and well-formed (400 if not).
  2. `fetch(url, { headers: { "User-Agent": "GenuineCRO-TechnicalAudit/1.0" } })` to get raw HTML. On network failure or non-2xx, returns `502` with `{ error: "Could not fetch the page" }`.
  3. Runs `extractCanonical`, `extractIndexability`, `extractLinks` against the HTML.
  4. Runs `checkRobotsTxt`/`checkSitemap` against the URL's origin, and `checkLinks` against the extracted links, in parallel.
  5. Calls `computeTechnicalScore(...)` and responds `200` with `{ url, technicalScore, checks: { canonical, indexability, robotsTxt, sitemap, linkSummary }, issues }`, where `linkSummary` is `{ total, ok, broken, redirectChains }`.

**Modified files:**
- `server.js` — mount `app.use("/api/technical", technicalRouter)`.

### Scoring Model

Weights sum to 100:
- Canonical tag present: **20 points** (0 if missing; full 20 if present — v1 doesn't try to validate the canonical target is correct, just that one exists, since determining "correctness" requires knowing the user's intended canonical strategy)
- Indexability: **20 points** (0 if a blocking `noindex` is found, full 20 otherwise)
- `robots.txt`: **15 points** (0 if missing or invalid, full 15 if present and valid — a missing `robots.txt` is not a hard requirement for a site to function, but its absence is flagged as a minor issue since it's a common SEO best practice)
- `sitemap.xml`: **15 points** (0 if missing or invalid, full 15 if present and valid)
- Link health: **30 points**, scaled linearly as `30 * (ok / total)` from `checkLinks` results (a page with no links scores full 30 here, since there's nothing to penalize)

Each failed/partial component produces one entry in `issues[]`, shaped as:
```js
{
  category: "technical-seo",
  severity: "high" | "med" | "low",
  title: "...",
  description: "...",
  fix: "...",
  impactScore: /* points lost from that component, out of 100 */
}
```
Severity mapping: canonical/indexability failures are `high` (core discoverability), robots.txt/sitemap failures are `med`, individual broken links/redirect chains are `low` each (but each broken link and each redirect chain gets its own issue entry, so a page with many broken links surfaces many low-severity issues rather than one aggregate one — consistent with how Conversion friction points are already itemized rather than summarized).

For link issues specifically: the total points lost from the 30-point link health component (`30 - 30 * ok / total`) is divided evenly across every broken/redirect-chain issue found, rounded to the nearest integer with a floor of 1 per issue — e.g. 10 links, 3 broken → 9 points lost ÷ 3 issues = 3 `impactScore` each.

### Frontend

**New files:**
- `src/lib/api/technical.ts` — `runTechnicalAudit(url: string): Promise<TechnicalAuditResult>`, POSTs to `/api/technical/audit`, throws on non-2xx (mirrors the existing `src/lib/api/analyze.ts` pattern).
- `src/pages/Technical.tsx` — wrapped in `DashboardLayout` (keeps the nav visible, consistent with Dashboard/Action Center). Contains:
  - A URL input + "Run Audit" button at the top (always visible, unlike Dashboard which only shows a button that navigates elsewhere).
  - A loading state while the audit runs.
  - On success: a Technical Score display (reusing the same score-display treatment already used elsewhere) plus the issue list, rendered with the same severity-stripe card pattern used in `ActionCenter.tsx`.
  - On success and signed-in: calls `trackAnalysis(url, "technical", "desktop", technicalScore)` then `createActionItems(user.uid, url, "technical", issues)`.
  - On failure: a toast error, matching the existing analyze-flow error pattern.
  - Anonymous users can still run an audit (consistent with Conversion's anonymous-allowed-up-to-quota behavior) but won't have results persisted anywhere beyond the anonymous usage counter — same as Conversion today.

**Modified files:**
- `src/App.tsx` — `/technical` route becomes `<Technical />` instead of the `ComingSoon` placeholder.
- `src/components/WorkspaceNav.tsx` — "Technical" section's `real` flag becomes `true`.
- `src/lib/firebase/analyses.ts` — `groupAnalysesByDomain` filters out records where `analysisType === "technical"` before computing `latestScore`/`previousScore`/`scoreDelta`/`analysisCount` for a domain (so a domain with only Technical audits and no Conversion audits simply doesn't appear on Dashboard yet — consistent with Dashboard being scoped to Conversion trend only for now).

## Error Handling

- Page fetch failure (network error, non-2xx, timeout): user sees a toast, no partial report rendered, nothing recorded.
- `robots.txt`/`sitemap.xml` fetch failure (404, network error): treated as "not present," not a hard error — folded into the score/issues normally, audit still completes.
- Individual link check failure/timeout: classified as `"broken"`, doesn't fail the overall audit.
- Malformed URL input: rejected client-side before hitting the API (reuse existing URL-normalization logic already in `Index.tsx`'s `handleAnalyze` — prepend `https://` if no scheme given).

## Testing

Each new server-side check function (`extractCanonical`, `extractIndexability`, `extractLinks`, `checkRobotsTxt`, `checkSitemap`, `checkLinks`) gets isolated unit tests with mocked `fetch`/HTML fixtures. `computeTechnicalScore` gets unit tests covering full-score, zero-score, and mixed cases. The route gets `supertest` integration tests mocking the check modules, mirroring `server/routes/analyze.test.js`'s existing pattern. The client page gets a `@testing-library/react` test mocking `runTechnicalAudit`/`trackAnalysis`/`createActionItems`, mirroring `ActionCenter.test.tsx`'s pattern.

## What This Does NOT Cover (by design)

Multi-page crawling, redirect-chain detection across a whole site (only redirects encountered while following a single link are checked), Core Web Vitals/performance (Phase 3), accessibility scanning (Phase 3), security headers (Phase 4), scheduled re-audits/alerting (Phase 5), and any Dashboard surfacing of Technical scores (deferred until there's a concrete need — avoids coupling two different scoring systems into one trend line prematurely, per decision 7 above).
