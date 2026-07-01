# Visual Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the already-decided visual design system (Indigo Tint palette, Fraunces/Geist typography, left-border severity stripes) across the existing app — a pure reskin with zero layout, copy, or information-architecture changes.

**Architecture:** All color/typography tokens live in `src/index.css` as CSS custom properties already consumed everywhere via Tailwind (`tailwind.config.ts` maps `bg-primary`, `text-foreground`, etc. to these variables) — so updating the token values in one file re-themes the whole app without touching component markup. Two things need markup changes: (1) a new `.font-display` utility class needs to actually be applied to page headline elements, since the existing `.text-display` class was defined but never used anywhere (dead CSS), and (2) `FrictionCard.tsx`'s severity indicator changes from a pill-shaped badge to a left-border stripe, per the design decision.

**Tech Stack:** Tailwind CSS (existing), Vitest + `@testing-library/react` (existing).

## Global Constraints

- Reference spec: `docs/superpowers/specs/2026-07-01-node-hostinger-redesign-design.md` §7 (Visual Design System).
- Exact token values from the spec (do not deviate): `--background: 225 100% 98%`, `--foreground: 244 47% 20%`, `--primary: 243 75% 59%`, `--muted-foreground: 248 24% 63%`, `--border`/`--secondary`: `230 47% 92%`/`230 47% 95%`, `--destructive` unchanged (`0 84% 60%`).
- Fraunces (display) + Geist Sans (body/UI, fixing the existing bug where `index.css` references `'Geist Sans'` but only imports `Geist Mono`) + Geist Mono (unchanged, already correct).
- No IA, layout, copy, or routing changes in this plan — this is strictly visual tokens + the one component pattern change already decided (severity stripes). The Dashboard/IA shell is a separate future plan.
- Applying a CSS class name to existing JSX (Task 2) is low enough risk that per-file component tests would be disproportionate busywork — that task is verified via `grep` (confirming the class was added) plus the existing full test suite and `tsc` as a regression safety net, not new component tests. `FrictionCard.tsx` (Task 3) gets a real behavioral test since its conditional logic is actually changing, not just gaining a static class name.

---

### Task 1: Update design tokens and typography in `index.css`

**Files:**
- Modify: `src/index.css`
- Test: `src/index.css.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: the new CSS custom property values and the `.font-display` utility class, consumed by Task 2 (applied to headline elements) and used implicitly everywhere else via Tailwind's existing token mapping

- [ ] **Step 1: Write the failing test**

Create `src/index.css.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const css = readFileSync(resolve(__dirname, "./index.css"), "utf-8");

describe("index.css design tokens", () => {
  it("uses the Indigo Tint palette values", () => {
    expect(css).toContain("--background: 225 100% 98%;");
    expect(css).toContain("--foreground: 244 47% 20%;");
    expect(css).toContain("--primary: 243 75% 59%;");
    expect(css).toContain("--muted-foreground: 248 24% 63%;");
    expect(css).toContain("--border: 230 47% 92%;");
    expect(css).toContain("--destructive: 0 84% 60%;");
  });

  it("imports Fraunces and the correctly-named Geist family", () => {
    expect(css).toMatch(/@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Fraunces[^']*'\)/);
    expect(css).toContain("family=Geist:");
  });

  it("sets the body font-family to the correctly-named Geist family (not 'Geist Sans')", () => {
    expect(css).toContain("font-family: 'Geist', -apple-system");
  });

  it("defines a font-display utility using Fraunces", () => {
    expect(css).toMatch(/\.font-display\s*{[^}]*font-family:\s*'Fraunces'/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/index.css.test.ts`
Expected: FAIL — current `index.css` has the old blue palette (`--background: 210 20% 98%`, etc.), imports only `Geist Mono`, and has no `.font-display` class.

- [ ] **Step 3: Replace the entire contents of `src/index.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..600&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 225 100% 98%;
    --foreground: 244 47% 20%;

    --card: 0 0% 100%;
    --card-foreground: 244 47% 20%;

    --popover: 0 0% 100%;
    --popover-foreground: 244 47% 20%;

    --primary: 243 75% 59%;
    --primary-foreground: 0 0% 100%;

    --secondary: 230 47% 95%;
    --secondary-foreground: 244 47% 20%;

    --muted: 230 47% 95%;
    --muted-foreground: 248 24% 63%;

    --accent: 230 47% 95%;
    --accent-foreground: 244 47% 20%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;

    --border: 230 47% 92%;
    --input: 230 47% 92%;
    --ring: 243 75% 59%;

    --radius: 0.5rem;

    --friction-high: 0 84% 60%;
    --friction-med: 38 92% 50%;
    --friction-low: 243 75% 59%;

    --surface: 0 0% 100%;

    --shadow-card: 0 0 0 1px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.02);
    --shadow-card-hover: 0 0 0 1px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05);
    --shadow-input: inset 0 1px 2px rgba(0,0,0,0.05);

    --sidebar-background: 0 0% 100%;
    --sidebar-foreground: 244 47% 20%;
    --sidebar-primary: 243 75% 59%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 230 47% 95%;
    --sidebar-accent-foreground: 244 47% 20%;
    --sidebar-border: 230 47% 92%;
    --sidebar-ring: 243 75% 59%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground antialiased;
    font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  code, .font-mono {
    font-family: 'Geist Mono', 'SF Mono', 'Fira Code', monospace;
  }
}

@layer components {
  .font-display {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 500;
  }

  .text-display {
    @apply text-xl leading-tight tracking-tight;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .text-body {
    @apply text-sm leading-relaxed tracking-normal;
  }

  .text-label {
    @apply text-xs leading-tight tracking-widest uppercase font-bold;
  }

  .text-small {
    @apply text-xs leading-tight;
    letter-spacing: 0.04em;
  }

  .shadow-card {
    box-shadow: var(--shadow-card);
  }

  .shadow-card-hover {
    box-shadow: var(--shadow-card-hover);
  }

  .shadow-input {
    box-shadow: var(--shadow-input);
  }

  .badge-high {
    @apply bg-destructive/10 text-destructive;
  }

  .badge-med {
    background: hsl(var(--friction-med) / 0.1);
    color: hsl(var(--friction-med));
  }

  .badge-low {
    @apply bg-primary/10 text-primary;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/index.css.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/index.css.test.ts
git commit -m "Apply Indigo Tint palette and Fraunces/Geist typography tokens"
```

---

### Task 2: Apply the display font to page headlines

**Files:**
- Modify: `src/pages/Account.tsx`
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/HelpCenter.tsx`
- Modify: `src/pages/ContactUs.tsx`
- Modify: `src/pages/BulkAnalysis.tsx`
- Modify: `src/pages/Subscription.tsx`
- Modify: `src/pages/NotFound.tsx`
- Modify: `src/pages/PrivacyPolicy.tsx`
- Modify: `src/pages/TermsConditions.tsx`
- Modify: `src/pages/CancellationRefunds.tsx`
- Modify: `src/pages/DeliveryPolicy.tsx`
- Modify: `src/components/AuthPage.tsx`
- Modify: `src/pages/ResetPassword.tsx`

**Interfaces:**
- Consumes: `.font-display` CSS class from Task 1
- Produces: nothing new — this task only adds a class name to existing headline elements

- [ ] **Step 1: Add `font-display` to each page's headline element**

In `src/pages/Account.tsx`, replace:
```tsx
        <h1 className="text-xl font-semibold text-foreground">Account Settings</h1>
```
with:
```tsx
        <h1 className="text-xl font-semibold text-foreground font-display">Account Settings</h1>
```

In `src/pages/Settings.tsx`, replace:
```tsx
            <h1 className="text-xl font-semibold text-foreground">Settings</h1>
```
with:
```tsx
            <h1 className="text-xl font-semibold text-foreground font-display">Settings</h1>
```

In `src/pages/HelpCenter.tsx`, replace:
```tsx
          <h1 className="text-xl font-semibold text-foreground">Help Center</h1>
```
with:
```tsx
          <h1 className="text-xl font-semibold text-foreground font-display">Help Center</h1>
```

In `src/pages/ContactUs.tsx`, replace:
```tsx
          <h1 className="text-xl font-semibold text-foreground">Contact Us</h1>
```
with:
```tsx
          <h1 className="text-xl font-semibold text-foreground font-display">Contact Us</h1>
```

In `src/pages/BulkAnalysis.tsx`, replace:
```tsx
          <h1 className="text-2xl font-bold text-foreground">Bulk Analysis</h1>
```
with:
```tsx
          <h1 className="text-2xl font-bold text-foreground font-display">Bulk Analysis</h1>
```

In `src/pages/Subscription.tsx`, replace:
```tsx
          <h2 className="text-2xl font-bold text-foreground">
            All features included. No hidden limitations.
          </h2>
```
with:
```tsx
          <h2 className="text-2xl font-bold text-foreground font-display">
            All features included. No hidden limitations.
          </h2>
```

In `src/pages/NotFound.tsx`, replace:
```tsx
        <h1 className="mb-4 text-4xl font-bold">404</h1>
```
with:
```tsx
        <h1 className="mb-4 text-4xl font-bold font-display">404</h1>
```

In `src/pages/PrivacyPolicy.tsx`, replace:
```tsx
        <h1 className="text-xl font-semibold text-foreground">Privacy Policy</h1>
```
with:
```tsx
        <h1 className="text-xl font-semibold text-foreground font-display">Privacy Policy</h1>
```

In `src/pages/TermsConditions.tsx`, replace:
```tsx
        <h1 className="text-xl font-semibold text-foreground">Terms & Conditions</h1>
```
with:
```tsx
        <h1 className="text-xl font-semibold text-foreground font-display">Terms & Conditions</h1>
```

In `src/pages/CancellationRefunds.tsx`, replace:
```tsx
        <h1 className="text-xl font-semibold text-foreground">Cancellation & Refunds</h1>
```
with:
```tsx
        <h1 className="text-xl font-semibold text-foreground font-display">Cancellation & Refunds</h1>
```

In `src/pages/DeliveryPolicy.tsx`, replace:
```tsx
        <h1 className="text-xl font-semibold text-foreground">Delivery Policy</h1>
```
with:
```tsx
        <h1 className="text-xl font-semibold text-foreground font-display">Delivery Policy</h1>
```

In `src/components/AuthPage.tsx`, replace:
```tsx
        <h1 className="text-xl font-semibold text-foreground mb-1">
          GenuineCRO
        </h1>
```
with:
```tsx
        <h1 className="text-xl font-semibold text-foreground mb-1 font-display">
          GenuineCRO
        </h1>
```

In `src/pages/ResetPassword.tsx`, replace:
```tsx
        <h1 className="text-xl font-semibold text-foreground mb-1">GenuineCRO</h1>
```
with:
```tsx
        <h1 className="text-xl font-semibold text-foreground mb-1 font-display">GenuineCRO</h1>
```

- [ ] **Step 2: Verify each file got exactly one `font-display` addition**

```bash
for f in src/pages/Account.tsx src/pages/Settings.tsx src/pages/HelpCenter.tsx \
  src/pages/ContactUs.tsx src/pages/BulkAnalysis.tsx src/pages/Subscription.tsx \
  src/pages/NotFound.tsx src/pages/PrivacyPolicy.tsx src/pages/TermsConditions.tsx \
  src/pages/CancellationRefunds.tsx src/pages/DeliveryPolicy.tsx \
  src/components/AuthPage.tsx src/pages/ResetPassword.tsx; do
  count=$(grep -c "font-display" "$f")
  echo "$f: $count"
done
```

Expected: every file prints `1`.

- [ ] **Step 3: Run the full test suite and type-check as a regression check**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.app.json
```

Expected: all existing tests still pass (this task doesn't change behavior, only a class name), no new type errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Account.tsx src/pages/Settings.tsx src/pages/HelpCenter.tsx \
  src/pages/ContactUs.tsx src/pages/BulkAnalysis.tsx src/pages/Subscription.tsx \
  src/pages/NotFound.tsx src/pages/PrivacyPolicy.tsx src/pages/TermsConditions.tsx \
  src/pages/CancellationRefunds.tsx src/pages/DeliveryPolicy.tsx \
  src/components/AuthPage.tsx src/pages/ResetPassword.tsx
git commit -m "Apply the Fraunces display font to page headlines"
```

---

### Task 3: Left-border severity stripe on `FrictionCard`

**Files:**
- Modify: `src/components/FrictionCard.tsx`
- Test: `src/components/FrictionCard.test.tsx`

**Interfaces:**
- Consumes: `friction-high`/`friction-med`/`friction-low` Tailwind color tokens (already defined in `tailwind.config.ts`, unchanged by this plan)
- Produces: no new exports — `FrictionCard` keeps the same props (`point`, `index`, `isSelected`, `onClick`)

- [ ] **Step 1: Write the failing tests**

Create `src/components/FrictionCard.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import FrictionCard from "./FrictionCard";
import type { FrictionPoint } from "@/lib/mockData";

function buildPoint(overrides: Partial<FrictionPoint> = {}): FrictionPoint {
  return {
    id: "fp-1",
    category: "ux-clarity",
    severity: "high",
    title: "Test friction point",
    description: "A description of the issue.",
    selector: ".hero",
    fix: "Do the fix.",
    impactScore: 80,
    roiEstimate: "Could increase conversion by 10%",
    insightCluster: "Clarity Gap",
    benchmark: { industryAvg: 50, topPerformers: 80, label: "Score" },
    abTest: { testName: "Test", hypothesis: "H", control: "C", variant: "V", metric: "M", duration: "2 weeks" },
    ...overrides,
  };
}

describe("FrictionCard", () => {
  it("applies a red left-border stripe and 'Critical' label for high severity", () => {
    const { container } = render(
      <FrictionCard point={buildPoint({ severity: "high" })} index={0} isSelected={false} onClick={() => {}} />
    );
    expect(container.firstChild).toHaveClass("border-l-friction-high");
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("applies the medium-severity border and 'Warning' label", () => {
    const { container } = render(
      <FrictionCard point={buildPoint({ severity: "med" })} index={0} isSelected={false} onClick={() => {}} />
    );
    expect(container.firstChild).toHaveClass("border-l-friction-med");
    expect(screen.getByText("Warning")).toBeInTheDocument();
  });

  it("applies the low-severity border and 'Info' label", () => {
    const { container } = render(
      <FrictionCard point={buildPoint({ severity: "low" })} index={0} isSelected={false} onClick={() => {}} />
    );
    expect(container.firstChild).toHaveClass("border-l-friction-low");
    expect(screen.getByText("Info")).toBeInTheDocument();
  });

  it("no longer renders a pill-shaped severity badge", () => {
    const { container } = render(
      <FrictionCard point={buildPoint({ severity: "high" })} index={0} isSelected={false} onClick={() => {}} />
    );
    expect(container.querySelector(".badge-high")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/FrictionCard.test.tsx`
Expected: FAIL — current implementation renders a `badge-high`/`badge-med`/`badge-low` pill, not a `border-l-friction-*` class on the card itself.

- [ ] **Step 3: Replace the entire contents of `src/components/FrictionCard.tsx`**

```tsx
import { motion } from "framer-motion";
import { Clock, Eye, MousePointer, Code, ScanLine, Copy, Check, Sparkles, LayoutGrid, DoorOpen, MessageSquareDiff, Filter as FilterIcon, ArrowUpFromLine, Compass, Layers, BookOpen, ListTree, Search, Heart, ShoppingCart, CreditCard, ShieldCheck, LogOut, TextCursorInput, BadgeCheck, Target, Zap, TrendingUp, BarChart3 } from "lucide-react";
import { useState } from "react";
import type { FrictionPoint, FrictionSeverity } from "@/lib/mockData";
import { categoryLabels } from "@/lib/mockData";

const categoryIconMap: Record<string, React.ElementType> = {
  visual: Eye, technical: Code, ux: MousePointer, accessibility: ScanLine, performance: Clock,
  "value-proposition": Sparkles, "feature-presentation": LayoutGrid, "onboarding-friction": DoorOpen,
  "message-match": MessageSquareDiff, "conversion-funnel": FilterIcon, "bounce-risk": ArrowUpFromLine,
  navigation: Compass, "content-hierarchy": Layers, readability: BookOpen, "content-structure": ListTree,
  seo: Search, engagement: Heart, "cart-friction": ShoppingCart, "payment-ux": CreditCard,
  "trust-security": ShieldCheck, "abandonment-risk": LogOut, "form-ux": TextCursorInput,
  "trust-signals": BadgeCheck, "conversion-clarity": Target,
  // New scoring categories
  "ux-clarity": Eye, "trust-credibility": ShieldCheck, "friction-effort": Zap,
  "speed-performance": Clock, "intent-match": Target, "funnel-health": BarChart3,
};

const severityBorderClass: Record<FrictionSeverity, string> = {
  high: "border-l-4 border-l-friction-high",
  med: "border-l-4 border-l-friction-med",
  low: "border-l-4 border-l-friction-low",
};

const severityTextClass: Record<FrictionSeverity, string> = {
  high: "text-friction-high", med: "text-friction-med", low: "text-friction-low",
};

const severityLabel: Record<FrictionSeverity, string> = {
  high: "Critical", med: "Warning", low: "Info",
};

interface FrictionCardProps {
  point: FrictionPoint;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}

const FrictionCard = ({ point, index, isSelected, onClick }: FrictionCardProps) => {
  const [copied, setCopied] = useState(false);
  const Icon = categoryIconMap[point.category] || Eye;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(point.fix);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -1 }}
      onClick={onClick}
      className={`group relative bg-surface p-4 shadow-card rounded-lg transition-shadow cursor-pointer ${severityBorderClass[point.severity]} ${
        isSelected ? "shadow-card-hover ring-1 ring-primary/20" : "hover:shadow-card-hover"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-3 w-3 text-muted-foreground" />
          <span className="text-label text-muted-foreground" style={{ fontSize: "10px" }}>
            {categoryLabels[point.category] || point.category}
          </span>
          {point.insightCluster && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {point.insightCluster}
            </span>
          )}
        </div>
        <span className={`text-[11px] font-medium ${severityTextClass[point.severity]}`}>
          {severityLabel[point.severity]}
        </span>
      </div>

      <h3 className="text-sm font-medium text-foreground mb-1">{point.title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed mb-2 line-clamp-2">
        {point.description}
      </p>

      {/* ROI Estimate */}
      {point.roiEstimate && (
        <div className="flex items-center gap-1.5 mb-3 px-2 py-1 rounded-md bg-primary/5 w-fit">
          <TrendingUp className="h-3 w-3 text-primary" />
          <span className="text-[11px] text-primary font-medium">{point.roiEstimate}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground font-mono">
          {point.selector}
        </code>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-secondary"
        >
          {copied ? (
            <><Check className="h-3 w-3" /> Copied</>
          ) : (
            <><Copy className="h-3 w-3" /> Copy Fix</>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default FrictionCard;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/FrictionCard.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full test suite as a regression check**

```bash
npx vitest run
```

Expected: all tests pass, including `ComparisonView`'s existing behavior (it renders `FrictionCard` internally but has no dedicated test file today, so there's nothing to break there beyond what manual/visual verification would catch — out of scope for this plan to add).

- [ ] **Step 6: Commit**

```bash
git add src/components/FrictionCard.tsx src/components/FrictionCard.test.tsx
git commit -m "Replace FrictionCard's pill severity badge with a left-border stripe"
```

---

## What this plan does NOT cover (by design)

The Dashboard/IA shell (new persistent nav, Dashboard page, Monitoring, Action Center, Reports), the landing page's layout (still logo-based, not the serif-headline mockup explored during brainstorming), and any copy changes are all out of scope — this plan only ships the token-level visual system. See `docs/superpowers/specs/2026-07-01-node-hostinger-redesign-design.md` §6 for the IA work still ahead.
