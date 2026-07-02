# Login-Gated Results & Auth Redesign — Design Spec

**Date:** 2026-07-02
**Status:** Approved — ready for implementation plan

## Decisions

Settled through Q&A with the user, informed by two reference screenshots of split-screen login pages (form left, bold color panel with a dashboard preview and tagline on the right):

1. **Login gate point:** Anonymous visitors must sign in before viewing ANY scan result — not just after N free views. No anonymous result-viewing at all.
2. **Scan timing:** The scan still runs immediately when a URL is submitted, regardless of auth state. The result is held in client state; the sign-in/signup screen is shown instead of the report until the visitor logs in. No re-scan needed after they authenticate — the already-computed result is revealed immediately.
3. **Anonymous submission limit:** One free scan attempt per anonymous visitor. After that one submission, trying to submit another URL is blocked outright by a hard sign-up wall — no "try another URL" escape hatch. (Mechanically: this repurposes the existing anonymous usage counter in `useUsageTracking.ts`, dropping its limit from 3 to 1.)
4. **Signed-in free-tier limit:** Drops from 10 audits/month to 3 total. (This number isn't shown anywhere in the Subscription page's marketing copy today, so this is a silent internal change, not a copy change.)
5. **Retroactive save on signup:** The scan that triggered the gate gets saved to the new account the moment signup/login completes — appears in Dashboard history and Action Center, and counts as 1 of the 3 free-tier scans. Nothing the visitor already saw "disappears."
6. **Scope:** Only the homepage's single-URL scan flow (`src/pages/Index.tsx`, covering both the single-device and desktop+mobile comparison paths). The Technical audit page and Bulk Analysis remain unchanged — anonymous users can still use those exactly as today.
7. **Visual redesign:** The shared `AuthPage` component (used for every sign-in/signup touchpoint app-wide, not a separate component just for this gate) becomes split-screen: existing email/Google form on the left, a new right-side panel in the existing Indigo Tint primary color with a small preview of what a scan report looks like and a tagline. No new color tokens — reuses `--primary`/`--primary-foreground` via Tailwind gradient utilities. The right panel is hidden on narrow viewports (single-column, form only).

## Architecture

### Anonymous submission limit (Task 1 territory)

`src/hooks/useUsageTracking.ts`: `FREE_LIMIT_ANON` changes from `3` to `1`. `PLAN_LIMITS.free` changes from `10` to `3`. No other change to this file — the existing `requiresAuth`/`requiresPaid` computation, `incrementAnonUsage`, and `countAnalysesSince`-based signed-in counting all keep working exactly as they do today, just against the new thresholds.

### Result-gating and retroactive save (Index.tsx)

Today, `Index.tsx` renders `AnalysisView`/`ComparisonView` directly once `result`/`comparisonResults` is set and `isAnalyzing` is false — with no auth check at render time (the only auth check today happens *before* a scan runs, via `usage.requiresAuth`). This changes:

- The render branches for `comparisonResults` and `result` both gain an `!user` check: if there's a completed result but no signed-in user, render `AuthPage` (in `signup`-first mode, with a message like "Your results are ready — sign in to view them.") instead of `AnalysisView`/`ComparisonView`.
- A new `resultRecorded` boolean state tracks whether the *current* result has already been persisted (`recordAnalysis` + `createActionItems`). It's reset to `false` at the start of every new `handleAnalyze` call, and set to `true` immediately after the existing inline `trackAnalysis`/`createActionItems` calls succeed — but only in the branch where `user` was already truthy at scan time (the normal signed-in flow, unchanged from today).
- A new effect watches `user`: when it becomes truthy and there's a held result with `resultRecorded === false`, it calls `trackAnalysis` (which persists to Firestore since `user` is now set) and `createActionItems` for that held result, then sets `resultRecorded` to `true`. This is what makes the retroactive save happen — the moment the auth state listener fires after signup/login, this effect fires once and the already-rendered result becomes visible (since the render branch's `!user` check now passes).
- For the desktop+mobile comparison path, the same pattern applies using the `desktop` result — consistent with how `trackAnalysis` already only ever records the desktop half of a comparison run today.
- `AuthPage` gains an optional `initialMode?: "login" | "signup"` prop (default `"login"`, preserving today's behavior everywhere else it's used). The new results-gate call site passes `initialMode="signup"`, since an anonymous visitor at this point doesn't have an account yet.

### Visual redesign (AuthPage.tsx)

The existing form logic (Google button, email/password fields, mode switching, forgot-password) is unchanged — only the layout wrapper changes. The current single centered `max-w-sm` column becomes the left half of a `flex` row on medium+ screens. A new right-side `<div>` (hidden below the `md` breakpoint) holds:
- A tagline (e.g., "See exactly where visitors drop off.")
- A small static preview card mimicking a scan report (score number + 2-3 mini friction rows) — built with existing Tailwind classes and the existing severity-stripe pattern already used in `FrictionCard`/`ActionCenter`/`Technical`, not a screenshot or new asset.
- Background using `bg-gradient-to-br from-primary to-primary/80` (or similar existing-token gradient), matching the reference screenshots' bold color-panel treatment without introducing new palette values.

## What This Does NOT Cover (by design)

Technical audit page and Bulk Analysis keep today's anonymous-allowed behavior — not touched in this round. No changes to the actual scan/scoring logic, Dashboard, or Action Center beyond the retroactive-save call already described. No new Firestore collections or rules — this reuses `recordAnalysis`/`createActionItems`, which already exist and already have rules deployed.
