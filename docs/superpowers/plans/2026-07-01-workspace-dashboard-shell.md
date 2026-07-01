# Workspace Dashboard Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first real slice of the Dashboard/IA shell — a persistent left-nav workspace (Dashboard/Technical/Content/Conversion/Monitoring/Analysis/Action Center/Reports, real-vs-coming-soon) with a working Dashboard page showing client sites grouped by domain with score trends, reachable from a new "Dashboard" link in the existing top header.

**Architecture:** A new `WorkspaceNav` left-sidebar and `DashboardLayout` wrapper (composes the existing `AppHeader` + the new sidebar) provide the shell; `Dashboard.tsx` is the first real page inside it, backed by a new Firestore query (`getRecentAnalyses`) and a pure grouping function (`groupAnalysesByDomain`) added to the existing `src/lib/firebase/analyses.ts`. Getting real score trends requires the `analyses` Firestore documents to actually store the conversion score, which they don't yet — that's Task 1, a small but necessary extension to work already shipped in an earlier plan. Six other sections (Technical, Content, Monitoring's dedicated page, Analysis, Action Center, Reports) render a shared `ComingSoon` placeholder — each becomes real in its own future plan.

**Tech Stack:** React Router (existing), Firestore client SDK (existing), Vitest + `@testing-library/react` (existing).

## Global Constraints

- Reference spec: `docs/superpowers/specs/2026-07-01-node-hostinger-redesign-design.md` §6 (Information Architecture) and the companion roadmap doc.
- Visual system already built (Indigo Tint palette, Fraunces display font via `.font-display`, `bg-surface`/`border-border`/`text-muted-foreground` tokens) — reuse it, don't introduce new tokens.
- This plan does **not** change what `/` shows — logged-in users still see the existing landing/analysis flow at `/`, reached from a new "Dashboard" link added to `AppHeader` instead. Making `/dashboard` the actual post-login landing page is a fast, safe follow-up once this is proven out; folding it into this plan risks entangling with `Index.tsx`'s already-tested analysis/comparison state machine.
- If a Firestore query in this plan needs a composite index that doesn't exist yet, Firestore's own error includes a direct link to create it with one click (same pattern already used for the `analyses` usage-tracking query) — don't try to pre-guess index shapes without a live project to verify against.
- Every new component/function gets a real test; `ComingSoon` (a two-line static component) gets one lightweight test rather than none, since it's cheap and still catches accidental breakage.

---

### Task 1: Store the conversion score on analysis records

**Files:**
- Modify: `src/lib/firebase/analyses.ts`
- Modify: `src/lib/firebase/analyses.test.ts`
- Modify: `src/hooks/useUsageTracking.ts`
- Modify: `src/hooks/useUsageTracking.test.ts`
- Modify: `src/pages/Index.tsx`
- Modify: `src/pages/BulkAnalysis.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: `AnalysisEntry` now includes `conversionScore: number`; `trackAnalysis(url, analysisType, device, conversionScore)` — the new 4th parameter, consumed by Task 2's dashboard data layer (via the Firestore documents it writes) and by every existing caller of `trackAnalysis`

- [ ] **Step 1: Update the failing test for `recordAnalysis`**

In `src/lib/firebase/analyses.test.ts`, replace the `"records an analysis with a server timestamp"` test:

```ts
  it("records an analysis with a server timestamp", async () => {
    addDocMock.mockResolvedValue(undefined);
    await recordAnalysis({ userId: "uid-1", url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 72 });
    expect(addDocMock).toHaveBeenCalledWith(
      { __collection: true },
      expect.objectContaining({
        userId: "uid-1",
        url: "https://example.com",
        analysisType: "homepage",
        device: "desktop",
        conversionScore: 72,
        createdAt: "server-timestamp",
      })
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/firebase/analyses.test.ts`
Expected: FAIL — `AnalysisEntry` doesn't have a `conversionScore` field yet, so this is a type error caught by `vitest`'s esbuild transform failing, or the assertion fails because the field isn't passed through.

- [ ] **Step 3: Add `conversionScore` to `AnalysisEntry`**

In `src/lib/firebase/analyses.ts`, replace:

```ts
export interface AnalysisEntry {
  userId: string | null;
  url: string;
  analysisType: string;
  device: string;
}
```

with:

```ts
export interface AnalysisEntry {
  userId: string | null;
  url: string;
  analysisType: string;
  device: string;
  conversionScore: number;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/firebase/analyses.test.ts`
Expected: PASS

- [ ] **Step 5: Update `useUsageTracking`'s `trackAnalysis` to accept and pass through the score**

In `src/hooks/useUsageTracking.test.ts`, replace the `"records an analysis for a signed-in user via Firestore"` test:

```ts
  it("records an analysis for a signed-in user via Firestore", async () => {
    countAnalysesSinceMock.mockResolvedValue(0);
    recordAnalysisMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useUsageTracking());

    await waitFor(() => expect(result.current.usage).toBeDefined());
    await result.current.trackAnalysis("https://example.com", "homepage", "desktop", 72);

    expect(recordAnalysisMock).toHaveBeenCalledWith({
      userId: "uid-1",
      url: "https://example.com",
      analysisType: "homepage",
      device: "desktop",
      conversionScore: 72,
    });
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/hooks/useUsageTracking.test.ts`
Expected: FAIL — `trackAnalysis` doesn't accept a 4th argument yet, so `conversionScore` is never passed to `recordAnalysis`.

- [ ] **Step 7: Update `trackAnalysis`'s signature in `src/hooks/useUsageTracking.ts`**

Replace:

```ts
  const trackAnalysis = useCallback(async (url: string, analysisType: string, device: string) => {
    if (user) {
      await recordAnalysis({ userId: user.uid, url, analysisType, device });
    } else {
      incrementAnonUsage();
    }
    await fetchUsage();
  }, [user, incrementAnonUsage, fetchUsage]);
```

with:

```ts
  const trackAnalysis = useCallback(async (url: string, analysisType: string, device: string, conversionScore: number) => {
    if (user) {
      await recordAnalysis({ userId: user.uid, url, analysisType, device, conversionScore });
    } else {
      incrementAnonUsage();
    }
    await fetchUsage();
  }, [user, incrementAnonUsage, fetchUsage]);
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/hooks/useUsageTracking.test.ts`
Expected: PASS

- [ ] **Step 9: Update the two call sites in `src/pages/Index.tsx`**

Replace both occurrences inside the `device === "both"` branch:

```tsx
        setComparisonResults({ desktop: desktopData, mobile: mobileData });
        await trackAnalysis(formatted, type, "desktop");
        toast.success(`Found ${desktopData.frictionPoints.length} desktop + ${mobileData.frictionPoints.length} mobile friction points`);
```

with:

```tsx
        setComparisonResults({ desktop: desktopData, mobile: mobileData });
        await trackAnalysis(formatted, type, "desktop", desktopData.conversionScore ?? desktopData.benchmark.overallScore);
        toast.success(`Found ${desktopData.frictionPoints.length} desktop + ${mobileData.frictionPoints.length} mobile friction points`);
```

and:

```tsx
        setComparisonResults({ desktop: mockDesktop, mobile: mockMobile });
        await trackAnalysis(formatted, type, "desktop");
```

with:

```tsx
        setComparisonResults({ desktop: mockDesktop, mobile: mockMobile });
        await trackAnalysis(formatted, type, "desktop", mockDesktop.conversionScore ?? mockDesktop.benchmark.overallScore);
```

Then replace both occurrences inside the single-device branch:

```tsx
        const data = await analyzeUrl(formatted, type, device);
        setResult(data);
        await trackAnalysis(formatted, type, device);
        toast.success(`Found ${data.frictionPoints.length} friction points (${device})`);
```

with:

```tsx
        const data = await analyzeUrl(formatted, type, device);
        setResult(data);
        await trackAnalysis(formatted, type, device, data.conversionScore ?? data.benchmark.overallScore);
        toast.success(`Found ${data.frictionPoints.length} friction points (${device})`);
```

and:

```tsx
        const mockResult = generateMockAnalysis(formatted, type);
        setResult(mockResult);
        await trackAnalysis(formatted, type, device);
```

with:

```tsx
        const mockResult = generateMockAnalysis(formatted, type);
        setResult(mockResult);
        await trackAnalysis(formatted, type, device, mockResult.conversionScore ?? mockResult.benchmark.overallScore);
```

- [ ] **Step 10: Update the call site in `src/pages/BulkAnalysis.tsx`**

Replace:

```tsx
        const result = await analyzeUrl(url, type, "desktop");
        await trackAnalysis(url, type, "desktop");
```

with:

```tsx
        const result = await analyzeUrl(url, type, "desktop");
        await trackAnalysis(url, type, "desktop", result.conversionScore ?? result.benchmark.overallScore);
```

- [ ] **Step 11: Run the full test suite and type-check**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.app.json
```

Expected: all tests pass, no type errors.

- [ ] **Step 12: Commit**

```bash
git add src/lib/firebase/analyses.ts src/lib/firebase/analyses.test.ts \
  src/hooks/useUsageTracking.ts src/hooks/useUsageTracking.test.ts \
  src/pages/Index.tsx src/pages/BulkAnalysis.tsx
git commit -m "Store conversion score on analysis records for Dashboard trends"
```

---

### Task 2: Dashboard data layer — recent analyses and per-domain grouping

**Files:**
- Modify: `src/lib/firebase/analyses.ts`
- Modify: `src/lib/firebase/analyses.test.ts`

**Interfaces:**
- Consumes: `db` from `@/integrations/firebase/client` (already imported in this file), `AnalysisEntry` (Task 1)
- Produces: `AnalysisRecord` interface (`{ url, analysisType, device, conversionScore, createdAt }`), `getRecentAnalyses(userId, take?): Promise<AnalysisRecord[]>`, `SiteSummary` interface (`{ domain, latestScore, previousScore, scoreDelta, lastAnalyzedAt, analysisCount }`), `groupAnalysesByDomain(analyses: AnalysisRecord[]): SiteSummary[]` — both consumed by Task 5's `Dashboard.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/firebase/analyses.test.ts` (add these imports to the existing `import { recordAnalysis, countAnalysesSince } from "./analyses";` line, changing it to also import the new functions, and add `orderBy`/`limit` to the `firebase/firestore` mock):

Replace the `vi.mock("firebase/firestore", ...)` block:

```ts
vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => collectionMock(...args),
  addDoc: (...args: unknown[]) => addDocMock(...args),
  query: (...args: unknown[]) => queryMock(...args),
  where: (...args: unknown[]) => whereMock(...args),
  orderBy: (...args: unknown[]) => orderByMock(...args),
  limit: (...args: unknown[]) => limitMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  getCountFromServer: (...args: unknown[]) => getCountFromServerMock(...args),
  serverTimestamp: () => "server-timestamp",
  Timestamp: { fromDate: (d: Date) => ({ __timestamp: d.toISOString() }) },
}));
```

Add these two mocks alongside the existing `const collectionMock = ...` declarations:

```ts
const orderByMock = vi.fn((..._args: unknown[]) => ({ __orderBy: true }));
const limitMock = vi.fn((..._args: unknown[]) => ({ __limit: true }));
const getDocsMock = vi.fn();
```

Change the import line to:

```ts
import { recordAnalysis, countAnalysesSince, getRecentAnalyses, groupAnalysesByDomain } from "./analyses";
```

Add to the `beforeEach`'s reset list:

```ts
    getDocsMock.mockReset();
```

Then add these test blocks:

```ts
describe("getRecentAnalyses", () => {
  it("maps Firestore docs into AnalysisRecord objects", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        {
          data: () => ({
            url: "https://a.example.com",
            analysisType: "homepage",
            device: "desktop",
            conversionScore: 72,
            createdAt: { toDate: () => new Date("2026-06-01T00:00:00.000Z") },
          }),
        },
      ],
    });

    const records = await getRecentAnalyses("uid-1");

    expect(records).toEqual([
      {
        url: "https://a.example.com",
        analysisType: "homepage",
        device: "desktop",
        conversionScore: 72,
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("groupAnalysesByDomain", () => {
  it("groups analyses by hostname and strips a leading www.", () => {
    const summaries = groupAnalysesByDomain([
      { url: "https://www.example.com/checkout", analysisType: "checkout", device: "desktop", conversionScore: 60, createdAt: "2026-06-01T00:00:00.000Z" },
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 50, createdAt: "2026-05-01T00:00:00.000Z" },
    ]);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].domain).toBe("example.com");
    expect(summaries[0].analysisCount).toBe(2);
  });

  it("computes the latest score, previous score, and delta from the two most recent analyses", () => {
    const summaries = groupAnalysesByDomain([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 70, createdAt: "2026-06-01T00:00:00.000Z" },
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 55, createdAt: "2026-05-01T00:00:00.000Z" },
    ]);

    expect(summaries[0].latestScore).toBe(70);
    expect(summaries[0].previousScore).toBe(55);
    expect(summaries[0].scoreDelta).toBe(15);
  });

  it("leaves previousScore and scoreDelta null when there's only one analysis for a domain", () => {
    const summaries = groupAnalysesByDomain([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 70, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    expect(summaries[0].previousScore).toBeNull();
    expect(summaries[0].scoreDelta).toBeNull();
  });

  it("sorts sites by most recently analyzed first", () => {
    const summaries = groupAnalysesByDomain([
      { url: "https://older.example.com", analysisType: "homepage", device: "desktop", conversionScore: 70, createdAt: "2026-05-01T00:00:00.000Z" },
      { url: "https://newer.example.com", analysisType: "homepage", device: "desktop", conversionScore: 70, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    expect(summaries.map((s) => s.domain)).toEqual(["newer.example.com", "older.example.com"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/firebase/analyses.test.ts`
Expected: FAIL — `getRecentAnalyses` and `groupAnalysesByDomain` don't exist yet.

- [ ] **Step 3: Add the new functions to `src/lib/firebase/analyses.ts`**

Replace the `import` line at the top:

```ts
import { collection, addDoc, query, where, getCountFromServer, serverTimestamp, Timestamp } from "firebase/firestore";
```

with:

```ts
import { collection, addDoc, query, where, orderBy, limit, getDocs, getCountFromServer, serverTimestamp, Timestamp } from "firebase/firestore";
```

Append to the end of the file:

```ts
export interface AnalysisRecord {
  url: string;
  analysisType: string;
  device: string;
  conversionScore: number;
  createdAt: string;
}

export async function getRecentAnalyses(userId: string, take = 200): Promise<AnalysisRecord[]> {
  const q = query(
    collection(db, "analyses"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(take)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data() as {
      url: string;
      analysisType: string;
      device: string;
      conversionScore: number;
      createdAt: { toDate: () => Date } | string;
    };
    return {
      url: data.url,
      analysisType: data.analysisType,
      device: data.device,
      conversionScore: data.conversionScore,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : data.createdAt.toDate().toISOString(),
    };
  });
}

export interface SiteSummary {
  domain: string;
  latestScore: number;
  previousScore: number | null;
  scoreDelta: number | null;
  lastAnalyzedAt: string;
  analysisCount: number;
}

export function groupAnalysesByDomain(analyses: AnalysisRecord[]): SiteSummary[] {
  const byDomain = new Map<string, AnalysisRecord[]>();

  for (const analysis of analyses) {
    let domain: string;
    try {
      domain = new URL(analysis.url).hostname.replace(/^www\./, "");
    } catch {
      domain = analysis.url;
    }
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(analysis);
  }

  const summaries: SiteSummary[] = [];
  for (const [domain, records] of byDomain) {
    const sorted = [...records].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latest = sorted[0];
    const previous = sorted[1] ?? null;
    summaries.push({
      domain,
      latestScore: latest.conversionScore,
      previousScore: previous ? previous.conversionScore : null,
      scoreDelta: previous ? latest.conversionScore - previous.conversionScore : null,
      lastAnalyzedAt: latest.createdAt,
      analysisCount: sorted.length,
    });
  }

  return summaries.sort((a, b) => new Date(b.lastAnalyzedAt).getTime() - new Date(a.lastAnalyzedAt).getTime());
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/firebase/analyses.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/firebase/analyses.ts src/lib/firebase/analyses.test.ts
git commit -m "Add getRecentAnalyses and groupAnalysesByDomain for the Dashboard"
```

---

### Task 3: Workspace nav shell

**Files:**
- Create: `src/components/WorkspaceNav.tsx`
- Create: `src/components/WorkspaceNav.test.tsx`
- Create: `src/components/DashboardLayout.tsx`

**Interfaces:**
- Consumes: existing `AppHeader` component
- Produces: `WorkspaceNav` (no props), `DashboardLayout` (`{ children: ReactNode }`) — consumed by Task 5 (`Dashboard.tsx`) and Task 6 (the "coming soon" routes)

- [ ] **Step 1: Write the failing test**

Create `src/components/WorkspaceNav.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WorkspaceNav from "./WorkspaceNav";

describe("WorkspaceNav", () => {
  it("renders all eight sections with Dashboard and Conversion marked real", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );

    ["Dashboard", "Technical", "Content", "Conversion", "Monitoring", "Analysis", "Action Center", "Reports"].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("highlights the active section based on the current route", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );

    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink).toHaveClass("bg-secondary");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/WorkspaceNav.test.tsx`
Expected: FAIL — `Cannot find module './WorkspaceNav'`

- [ ] **Step 3: Write `src/components/WorkspaceNav.tsx`**

```tsx
import { LayoutDashboard, Wrench, FileText, Search, Activity, Swords, CheckSquare, FileBarChart } from "lucide-react";
import { NavLink } from "react-router-dom";

interface NavSection {
  label: string;
  path: string;
  icon: React.ElementType;
  real: boolean;
}

const sections: NavSection[] = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, real: true },
  { label: "Technical", path: "/technical", icon: Wrench, real: false },
  { label: "Content", path: "/content", icon: FileText, real: false },
  { label: "Conversion", path: "/", icon: Search, real: true },
  { label: "Monitoring", path: "/monitoring", icon: Activity, real: false },
  { label: "Analysis", path: "/competitor-analysis", icon: Swords, real: false },
  { label: "Action Center", path: "/action-center", icon: CheckSquare, real: false },
  { label: "Reports", path: "/reports", icon: FileBarChart, real: false },
];

const WorkspaceNav = () => {
  return (
    <nav className="w-48 flex-shrink-0 border-r border-border bg-surface py-4">
      {sections.map((section) => (
        <NavLink
          key={section.path}
          to={section.path}
          end={section.path === "/"}
          className={({ isActive }) =>
            `flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
              isActive
                ? "bg-secondary text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`
          }
        >
          <span
            className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${section.real ? "bg-primary" : "bg-muted-foreground/40"}`}
          />
          <section.icon className="h-3.5 w-3.5 flex-shrink-0" />
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
};

export default WorkspaceNav;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/WorkspaceNav.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Write `src/components/DashboardLayout.tsx`**

```tsx
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "./AppHeader";
import WorkspaceNav from "./WorkspaceNav";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/dashboard")} onSignIn={() => navigate("/")} />
      <div className="flex flex-1 min-h-0">
        <WorkspaceNav />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
```

(No dedicated test for `DashboardLayout` — it's pure composition of already-tested `AppHeader` and `WorkspaceNav`; its behavior is exercised through Task 5's `Dashboard.tsx` test.)

- [ ] **Step 6: Commit**

```bash
git add src/components/WorkspaceNav.tsx src/components/WorkspaceNav.test.tsx src/components/DashboardLayout.tsx
git commit -m "Add the workspace nav shell (WorkspaceNav + DashboardLayout)"
```

---

### Task 4: Coming-soon placeholder

**Files:**
- Create: `src/components/ComingSoon.tsx`
- Create: `src/components/ComingSoon.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `ComingSoon({ title: string })` — consumed by Task 6's placeholder routes

- [ ] **Step 1: Write the failing test**

Create `src/components/ComingSoon.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComingSoon from "./ComingSoon";

describe("ComingSoon", () => {
  it("renders the given section title", () => {
    render(<ComingSoon title="Technical" />);
    expect(screen.getByText("Technical")).toBeInTheDocument();
    expect(screen.getByText("This section is coming soon.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ComingSoon.test.tsx`
Expected: FAIL — `Cannot find module './ComingSoon'`

- [ ] **Step 3: Write `src/components/ComingSoon.tsx`**

```tsx
interface ComingSoonProps {
  title: string;
}

const ComingSoon = ({ title }: ComingSoonProps) => {
  return (
    <div className="text-center py-16">
      <h1 className="text-xl font-semibold text-foreground font-display mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground">This section is coming soon.</p>
    </div>
  );
};

export default ComingSoon;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ComingSoon.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ComingSoon.tsx src/components/ComingSoon.test.tsx
git commit -m "Add the ComingSoon placeholder component"
```

---

### Task 5: Dashboard page

**Files:**
- Create: `src/pages/Dashboard.tsx`
- Create: `src/pages/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `getRecentAnalyses`, `groupAnalysesByDomain`, `SiteSummary` (Task 2), `DashboardLayout` (Task 3), `useAuth()`
- Produces: no new exports — consumed by Task 6's `/dashboard` route

- [ ] **Step 1: Write the failing tests**

Create `src/pages/Dashboard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getRecentAnalysesMock = vi.fn();

vi.mock("@/lib/firebase/analyses", () => ({
  getRecentAnalyses: (...args: unknown[]) => getRecentAnalysesMock(...args),
  groupAnalysesByDomain: vi.fn((records: Array<{ url: string; conversionScore: number; createdAt: string }>) => {
    if (records.length === 0) return [];
    return [
      {
        domain: "example.com",
        latestScore: records[0].conversionScore,
        previousScore: null,
        scoreDelta: null,
        lastAnalyzedAt: records[0].createdAt,
        analysisCount: records.length,
      },
    ];
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));

import Dashboard from "./Dashboard";

describe("Dashboard", () => {
  beforeEach(() => {
    getRecentAnalysesMock.mockReset();
  });

  it("shows an empty state when there are no audits yet", async () => {
    getRecentAnalysesMock.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("No audits yet — run your first analysis to see it here.")).toBeInTheDocument();
    });
  });

  it("renders site summaries once analyses load", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 68, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("example.com")).toBeInTheDocument();
    });
    expect(screen.getByText("68")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/Dashboard.test.tsx`
Expected: FAIL — `Cannot find module './Dashboard'`

- [ ] **Step 3: Write `src/pages/Dashboard.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Globe, TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { getRecentAnalyses, groupAnalysesByDomain, type SiteSummary } from "@/lib/firebase/analyses";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    getRecentAnalyses(user.uid).then((records) => {
      setSites(groupAnalysesByDomain(records));
      setLoading(false);
    });
  }, [user]);

  const criticalCount = sites.filter((s) => s.latestScore < 50).length;
  const avgDelta = sites.length > 0
    ? Math.round(sites.reduce((sum, s) => sum + (s.scoreDelta ?? 0), 0) / sites.length)
    : 0;

  if (!user) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Please sign in to view your dashboard.</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-foreground font-display">Dashboard</h1>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Audit
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your audits…</p>
      ) : sites.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No audits yet — run your first analysis to see it here.</p>
        </div>
      ) : (
        <>
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

          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              Client Sites
            </div>
            {sites.map((site) => (
              <div
                key={site.domain}
                className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{site.domain}</p>
                  <p className="text-xs text-muted-foreground">{site.analysisCount} audit{site.analysisCount === 1 ? "" : "s"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-foreground">{site.latestScore}</span>
                  {site.scoreDelta !== null && (
                    <span className={`flex items-center gap-0.5 text-xs ${site.scoreDelta >= 0 ? "text-primary" : "text-destructive"}`}>
                      {site.scoreDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {site.scoreDelta >= 0 ? "+" : ""}{site.scoreDelta}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  );
};

export default Dashboard;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pages/Dashboard.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/Dashboard.test.tsx
git commit -m "Add the Dashboard page with per-site score trends"
```

---

### Task 6: Wire up routes and the header nav link

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppHeader.tsx`

**Interfaces:**
- Consumes: `Dashboard` (Task 5), `DashboardLayout` + `ComingSoon` (Tasks 3-4)
- Produces: seven new reachable routes; no new exports

- [ ] **Step 1: Add the new routes to `src/App.tsx`**

Add these imports alongside the existing page imports:

```tsx
import Dashboard from "./pages/Dashboard.tsx";
import DashboardLayout from "@/components/DashboardLayout";
import ComingSoon from "@/components/ComingSoon";
```

Add these routes above the `{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}` comment, alongside the existing `<Route path="/bulk" ... />` line:

```tsx
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/technical" element={<DashboardLayout><ComingSoon title="Technical" /></DashboardLayout>} />
            <Route path="/content" element={<DashboardLayout><ComingSoon title="Content" /></DashboardLayout>} />
            <Route path="/monitoring" element={<DashboardLayout><ComingSoon title="Monitoring" /></DashboardLayout>} />
            <Route path="/competitor-analysis" element={<DashboardLayout><ComingSoon title="Analysis" /></DashboardLayout>} />
            <Route path="/action-center" element={<DashboardLayout><ComingSoon title="Action Center" /></DashboardLayout>} />
            <Route path="/reports" element={<DashboardLayout><ComingSoon title="Reports" /></DashboardLayout>} />
```

- [ ] **Step 2: Add a "Dashboard" link to `AppHeader`'s nav**

In `src/components/AppHeader.tsx`, add `LayoutDashboard` to the existing lucide-react import line:

```tsx
import { Home, LogIn, LogOut, User, ChevronDown, CreditCard, UserCog, HelpCircle, Settings, FileSpreadsheet, LayoutDashboard } from "lucide-react";
```

Replace the `navLinks` array:

```tsx
  const navLinks = [
    { label: "Home", icon: Home, action: onGoHome || (() => navigate("/")), path: "/" },
    { label: "Bulk", icon: FileSpreadsheet, action: () => navigate("/bulk"), path: "/bulk" },
    { label: "Account", icon: UserCog, action: () => navigate("/account"), path: "/account" },
    { label: "Subscription", icon: CreditCard, action: () => navigate("/subscription"), path: "/subscription" },
    { label: "Help Center", icon: HelpCircle, action: () => navigate("/help"), path: "/help" },
    { label: "Settings", icon: Settings, action: () => navigate("/settings"), path: "/settings" },
  ];
```

with:

```tsx
  const navLinks = [
    { label: "Home", icon: Home, action: onGoHome || (() => navigate("/")), path: "/" },
    { label: "Dashboard", icon: LayoutDashboard, action: () => navigate("/dashboard"), path: "/dashboard" },
    { label: "Bulk", icon: FileSpreadsheet, action: () => navigate("/bulk"), path: "/bulk" },
    { label: "Account", icon: UserCog, action: () => navigate("/account"), path: "/account" },
    { label: "Subscription", icon: CreditCard, action: () => navigate("/subscription"), path: "/subscription" },
    { label: "Help Center", icon: HelpCircle, action: () => navigate("/help"), path: "/help" },
    { label: "Settings", icon: Settings, action: () => navigate("/settings"), path: "/settings" },
  ];
```

- [ ] **Step 3: Run the full test suite and type-check**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.app.json
```

Expected: all tests pass, no type errors.

- [ ] **Step 4: Boot-verify with the dev server**

Start the dev server (or use the Claude Code preview tooling already configured in `.claude/launch.json`) and confirm:
- `/dashboard` renders the sidebar + Dashboard page without console errors
- `/technical`, `/content`, `/monitoring`, `/competitor-analysis`, `/action-center`, `/reports` each render the sidebar + a "Coming soon" message
- The top header now shows a "Dashboard" link

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/AppHeader.tsx
git commit -m "Wire up Dashboard/coming-soon routes and the header nav link"
```

---

## What this plan does NOT cover (by design)

`/` still shows the existing landing/analysis flow for everyone, including logged-in users — switching logged-in users' default landing to `/dashboard` is a fast follow-up, not bundled here. Technical, Content, the dedicated Monitoring page (trend charts, scan history), Analysis (competitor comparison), Action Center, and Reports are all still "Coming soon" placeholders — each becomes real in its own future plan, per the roadmap doc.
