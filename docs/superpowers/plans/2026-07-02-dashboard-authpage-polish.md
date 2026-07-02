# Dashboard & AuthPage Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the two visual upgrades deferred from the App Shell Redesign: Dashboard's stat cards become icon-circle cards with one highlighted "hero" card, and the login page's preview panel gets a mini bar chart plus a floating "Trend" card overlay.

**Architecture:** Both are pure presentation changes to existing pages — no new data, no new state, no new dependencies. `Dashboard.tsx`'s three stat cards keep using the same `sites.length`/`criticalCount`/`avgDelta` values, just with new markup/classes. `AuthPage.tsx`'s existing preview panel gets two new static (illustrative, not live-data) elements added inside the already-existing score card.

**Tech Stack:** No new dependencies — existing Tailwind classes and `lucide-react` icons already used elsewhere in the app (`AlertTriangle` is newly imported into `Dashboard.tsx`, already used elsewhere in the codebase).

## Global Constraints

- Reference: the design decisions made during the App Shell Redesign discussion — Dashboard card option "A" (icon-circle cards, one solid-fill hero card) and AuthPage panel option "C" (mini bar chart + floating overlay card), both confirmed with the user via the visual mockup pass.
- No new colors — reuse `--primary`/`--destructive`/existing `friction-*` tokens exactly as used elsewhere in the app.
- The bar chart and "+8 pts" trend figure in the AuthPage panel are illustrative/static, not real data — this mirrors the existing score-card content in that panel, which is also static.

---

### Task 1: Dashboard stat card restyle

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/Dashboard.test.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new

- [ ] **Step 1: Write the failing test**

In `src/pages/Dashboard.test.tsx`, add this test inside the existing `describe("Dashboard", ...)` block:

```tsx
  it("gives the Sites Tracked card the highlighted hero treatment", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 68, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Sites Tracked")).toBeInTheDocument();
    });
    const heroCard = screen.getByText("Sites Tracked").closest("div.bg-primary");
    expect(heroCard).not.toBeNull();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pages/Dashboard.test.tsx`
Expected: FAIL — the "Sites Tracked" card doesn't have a `bg-primary` ancestor yet (today it's `bg-surface border border-border`, same as the other two cards).

- [ ] **Step 3: Restyle the stat cards in `src/pages/Dashboard.tsx`**

Replace:

```tsx
import { Plus, Globe, TrendingUp, TrendingDown } from "lucide-react";
```

with:

```tsx
import { Plus, Globe, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
```

Replace:

```tsx
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Sites Tracked</p>
              <p className="text-2xl font-semibold text-foreground">{sites.length}</p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Critical (Score &lt; 50)</p>
              <p className="text-2xl font-semibold text-destructive">{criticalCount}</p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Avg Score Trend</p>
              <p className={`text-2xl font-semibold ${avgDelta >= 0 ? "text-primary" : "text-destructive"}`}>
                {avgDelta >= 0 ? "+" : ""}{avgDelta}
              </p>
            </div>
          </div>
```

with:

```tsx
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-primary rounded-lg p-4 text-primary-foreground">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-primary-foreground/70">Sites Tracked</p>
                <div className="h-7 w-7 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <Globe className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="text-2xl font-semibold">{sites.length}</p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Critical (Score &lt; 50)</p>
                <div className="h-7 w-7 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-destructive">{criticalCount}</p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Score Trend</p>
                <div className={`h-7 w-7 rounded-full flex items-center justify-center ${avgDelta >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                  {avgDelta >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-primary" /> : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                </div>
              </div>
              <p className={`text-2xl font-semibold ${avgDelta >= 0 ? "text-primary" : "text-destructive"}`}>
                {avgDelta >= 0 ? "+" : ""}{avgDelta}
              </p>
            </div>
          </div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/pages/Dashboard.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/Dashboard.test.tsx
git commit -m "Restyle Dashboard's stat cards with icon circles and a highlighted hero card"
```

---

### Task 2: AuthPage preview panel enrichment

**Files:**
- Modify: `src/components/AuthPage.tsx`
- Modify: `src/components/AuthPage.test.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new

- [ ] **Step 1: Write the failing test**

In `src/components/AuthPage.test.tsx`, add this test inside the existing `describe("AuthPage", ...)` block:

```tsx
  it("renders a mini chart and a floating trend card in the preview panel", () => {
    render(<AuthPage onBack={() => {}} />);
    expect(screen.getByTestId("auth-preview-chart")).toBeInTheDocument();
    expect(screen.getByText("+8 pts")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/AuthPage.test.tsx`
Expected: FAIL — neither element exists yet.

- [ ] **Step 3: Add the chart and floating trend card in `src/components/AuthPage.tsx`**

Replace:

```tsx
          <div className="bg-surface rounded-lg shadow-lg p-4 text-left">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Conversion Score</span>
              <span className="text-2xl font-semibold text-foreground">72</span>
            </div>
            <div className="space-y-2">
              <div className="border-l-4 border-l-friction-high bg-background rounded p-2">
                <p className="text-xs font-medium text-foreground">Weak call-to-action</p>
              </div>
              <div className="border-l-4 border-l-friction-med bg-background rounded p-2">
                <p className="text-xs font-medium text-foreground">Slow page load</p>
              </div>
            </div>
          </div>
```

with:

```tsx
          <div className="bg-surface rounded-lg shadow-lg p-4 text-left relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Conversion Score</span>
              <span className="text-2xl font-semibold text-foreground">72</span>
            </div>
            <div data-testid="auth-preview-chart" className="flex items-end gap-1 h-10 mb-3">
              <div className="flex-1 bg-primary/30 rounded-sm" style={{ height: "40%" }} />
              <div className="flex-1 bg-primary/30 rounded-sm" style={{ height: "70%" }} />
              <div className="flex-1 bg-primary rounded-sm" style={{ height: "90%" }} />
              <div className="flex-1 bg-primary/30 rounded-sm" style={{ height: "55%" }} />
              <div className="flex-1 bg-primary/30 rounded-sm" style={{ height: "65%" }} />
            </div>
            <div className="space-y-2">
              <div className="border-l-4 border-l-friction-high bg-background rounded p-2">
                <p className="text-xs font-medium text-foreground">Weak call-to-action</p>
              </div>
              <div className="border-l-4 border-l-friction-med bg-background rounded p-2">
                <p className="text-xs font-medium text-foreground">Slow page load</p>
              </div>
            </div>
            <div className="absolute -top-3 -right-3 bg-background border border-border rounded-lg shadow-lg px-3 py-2 text-left">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Trend</p>
              <p className="text-xs font-semibold text-primary">+8 pts</p>
            </div>
          </div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/AuthPage.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full test suite and a type-check**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.app.json
```

Expected: all tests pass, no type errors.

- [ ] **Step 6: Boot-verify with the dev server**

Using the Claude Code preview tooling: check `/dashboard` (with any signed-in session data available) for the new hero card, and check the login page (submit a URL as an anonymous visitor to reach the sign-up gate, or navigate to a route that renders `AuthPage` directly) for the chart and floating trend card. Screenshot both.

- [ ] **Step 7: Commit**

```bash
git add src/components/AuthPage.tsx src/components/AuthPage.test.tsx
git commit -m "Add a mini chart and floating trend card to AuthPage's preview panel"
```
