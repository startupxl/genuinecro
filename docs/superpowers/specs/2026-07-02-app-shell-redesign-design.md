# App Shell Redesign — Design Spec

**Date:** 2026-07-02
**Status:** Approved — ready for implementation plan

Started as "add a profile card to Dashboard," grew into a full navigation unification after discussion. Reference: a gym-management dashboard screenshot (purple sidebar, profile block, colorful stat cards, charts) and an earlier login-page reference (split-screen, gradient panel).

## Decisions

Settled through a mix of terminal Q&A and a visual mockup pass (browser companion for 3 of 4; the 4th fell back to text after a connectivity issue):

1. **Profile placement:** A compact profile row pinned to the **bottom** of the left sidebar (avatar + name + plan tier), matching the Slack/Notion pattern — not a large card, not at the top.
2. **Anonymous state:** The same bottom slot shows a "Sign in" button instead of a profile row when nobody's logged in. The sidebar itself stays visible even to anonymous visitors (e.g. on the homepage scan flow) — no separate anonymous-only header variant.
3. **Scope — everywhere:** This sidebar becomes the universal app shell. It replaces the current top `AppHeader` bar on **every** page: the homepage scan flow, analysis/comparison result views, Bulk Analysis, Account, Settings, Subscription, and all legal/help pages (Privacy, Terms, Cancellation, Delivery, Contact, Help Center). `AppHeader.tsx` is deleted once nothing uses it.
4. **Exception:** `AuthPage` (the sign-in/signup screen) is NOT wrapped in the sidebar — it stays a standalone full-screen split panel. Showing sidebar nav for features someone can't use yet, right next to the sidebar's own "Sign in" prompt, would be circular.
5. **Dashboard stat cards:** Restyled to match the reference closely — icon-circle cards, with the primary metric (Sites Tracked) getting a solid brand-color "hero" fill; Critical and Avg Score Trend keep white backgrounds with colored icon circles (red/green respectively).
6. **Login page preview panel:** Upgraded from the current score + 2 issue rows to include a small illustrative bar chart and a floating "Trend" card overlapping the corner, matching the reference's floating Cost Analytics popup style. Static/illustrative, not live data.

## Architecture

### Component changes

- **`src/components/DashboardLayout.tsx` → renamed `src/components/AppShell.tsx`** (export renamed `AppShell`). Structure unchanged (`flex` row: sidebar + `<main>{children}</main>`), but it now accepts an optional `onLogoClick?: () => void` prop, passed through to the sidebar's logo. Defaults to `navigate("/")` when not provided. This override exists because `Index.tsx` needs the logo click to reset its own local `result`/`comparisonResults` state (via its existing `goHome` function) rather than just re-navigating to the same route, which wouldn't clear state on its own.
- **`src/components/WorkspaceNav.tsx`** gains two new pieces, becoming the full sidebar:
  - A logo/home link at the top (moved from `AppHeader`), calling the `onLogoClick` override or `navigate("/")`.
  - A 9th nav entry, **Bulk** (`/bulk`, `real: true`) — `AppHeader` was the only place Bulk Analysis was linked from; it needs a home in the new nav since `AppHeader` is going away.
  - A profile row at the bottom: signed-in users see avatar + display name + plan tier, opening a dropdown (reusing the existing `DropdownMenu` primitives already used in `AppHeader`) with Account / Subscription / Help Center / Settings / Sign out — the same items `AppHeader`'s dropdown had. Anonymous visitors see a "Sign in" button in the same slot, calling an `onSignIn?: () => void` prop threaded down from whichever page owns the auth-modal state. Plan tier text comes from the existing `useSubscription()` hook's `currentPlan` field (already used by `useUsageTracking.ts`) — no new data source needed.
- **`src/components/AppHeader.tsx` deleted.**
- **`AnalysisView.tsx` / `ComparisonView.tsx`:** drop their `<AppHeader onGoHome={} onSignIn={} compact />` line. Also drop their `onSignIn` prop entirely — since results are now login-gated (see the login-gated-results spec), these components only ever render when `user` is already truthy, so `onSignIn` was already dead code by the time this change lands. Keep `onGoHome`, now threaded into `AppShell`'s `onLogoClick`.
- **All other pages currently rendering `<AppHeader>` directly** (`Index.tsx`'s `LandingView` state, `BulkAnalysis.tsx`, `Account.tsx`, `Settings.tsx`, `Subscription.tsx`, `PrivacyPolicy.tsx`, `TermsConditions.tsx`, `CancellationRefunds.tsx`, `DeliveryPolicy.tsx`, `ContactUs.tsx`, `HelpCenter.tsx`) switch to self-wrapping with `<AppShell>...</AppShell>`, following the same pattern `Dashboard.tsx`/`Technical.tsx`/`ActionCenter.tsx` already use — each page wraps itself, routes in `App.tsx` don't change.

### Dashboard card restyle

`Dashboard.tsx`'s three existing stat cards change visual treatment only — no new data, same `sites`/`criticalCount`/`avgDelta` values already computed:
- **Sites Tracked:** solid `bg-primary` fill, white text, `Globe` icon (already imported) in a translucent white circle, top-right.
- **Critical (Score < 50):** white card, red (`bg-destructive/10` circle, `text-destructive` icon) `AlertTriangle` icon top-right.
- **Avg Score Trend:** white card, green (`bg-primary/10` circle if positive else `bg-destructive/10`) icon circle with `TrendingUp`/`TrendingDown` (already imported, already conditionally chosen elsewhere in the file) top-right.

### AuthPage preview panel enrichment

Inside the existing `data-testid="auth-preview-panel"` panel, below the score+issues card already built: a static 5-bar mini bar chart (illustrative heights, reusing the `bg-primary`/`bg-primary/30` tokens) and a small floating card (`absolute`-positioned, overlapping the top-right corner of the score card, `shadow-lg`) showing a "Trend" label and a `+N pts` value in the existing green trend color.

## What This Does NOT Cover (by design)

No changes to the actual nav section content/routing (still the same 8 workspace sections + the new Bulk entry). No live/real data in the AuthPage chart — it's illustrative. No changes to `AuthPage`'s own auth logic. Doesn't address the still-open Hostinger `/api/*` CDN routing issue — that's a separate, unresolved infrastructure problem tracked outside this spec.
