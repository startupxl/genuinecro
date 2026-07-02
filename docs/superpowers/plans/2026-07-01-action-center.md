# Action Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Action Center section real — persist friction points from every analysis into a new `actionItems` Firestore collection, and give signed-in users a page listing their open issues across all audits with a "Mark Resolved" action.

**Architecture:** A new `src/lib/firebase/actionItems.ts` module (mirroring the existing `analyses.ts`/`users.ts` per-collection pattern) provides `createActionItems`, `getOpenActionItems`, and `resolveActionItem`. Friction points are denormalized directly onto each `actionItems` doc (no foreign key back to the parent analysis) — Action Center only needs to show "what's open and where it came from (URL)", not traverse back to a specific historical analysis run, so a foreign key would be unused complexity. `Index.tsx` and `BulkAnalysis.tsx` call `createActionItems` right after their existing `trackAnalysis` call, for signed-in users only.

**Tech Stack:** Firestore client SDK (existing), Vitest + `@testing-library/react` (existing).

## Global Constraints

- Reference spec: `docs/superpowers/specs/2026-07-01-node-hostinger-redesign-design.md` §5 (`actionItems` collection) and §6 (Action Center: "real, lightweight... no cross-user assignment yet").
- Action items are only created for signed-in users (`user` truthy) — anonymous usage has no persistent account for a later "open issues" list to belong to, matching how `trackAnalysis` already branches on `user`.
- Reuse the existing `friction-high`/`friction-med`/`friction-low` Tailwind color tokens and the left-border severity-stripe pattern already established in `FrictionCard.tsx` — don't introduce a new visual pattern for severity.
- Firestore write/update security is scoped per-user via rules (Task 1) — updates are restricted to only the `status` field, since that's the only mutation the client ever performs.

---

### Task 1: Firestore rules for `actionItems`

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- Consumes: nothing
- Produces: the access-control contract — `actionItems/{itemId}` readable/creatable only by its owner, updatable only by its owner and only for the `status` field

- [ ] **Step 1: Add the `actionItems` match block**

In `firestore.rules`, add this new match block inside `match /databases/{database}/documents { ... }`, alongside the existing `users`/`analyses`/`subscriptions` blocks:

```
    match /actionItems/{itemId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow update: if request.auth != null && request.auth.uid == resource.data.userId
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["status"]);
      allow delete: if false;
    }
```

- [ ] **Step 2: Verify (manual — cannot be run from this environment)**

Run `firebase deploy --only firestore:rules` once you have Firebase CLI access to the live project. Expected: `✔  Deploy complete!`

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "Add Firestore rules for the actionItems collection"
```

---

### Task 2: `actionItems` data module

**Files:**
- Create: `src/lib/firebase/actionItems.ts`
- Create: `src/lib/firebase/actionItems.test.ts`

**Interfaces:**
- Consumes: `db` from `@/integrations/firebase/client`
- Produces: `FrictionPointInput` interface (`{ category, severity, title, description, fix, impactScore }`), `ActionItem` interface (adds `id, userId, url, analysisType, status, createdAt`), `createActionItems(userId, url, analysisType, frictionPoints): Promise<void>`, `getOpenActionItems(userId): Promise<ActionItem[]>`, `resolveActionItem(itemId): Promise<void>` — consumed by Task 3 (`ActionCenter.tsx`) and Task 4 (`Index.tsx`/`BulkAnalysis.tsx`)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/firebase/actionItems.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const collectionMock = vi.fn((..._args: unknown[]) => ({ __collection: true }));
const addDocMock = vi.fn();
const queryMock = vi.fn((..._args: unknown[]) => ({ __query: true }));
const whereMock = vi.fn((..._args: unknown[]) => ({ __where: true }));
const orderByMock = vi.fn((..._args: unknown[]) => ({ __orderBy: true }));
const getDocsMock = vi.fn();
const docMock = vi.fn((..._args: unknown[]) => ({ __doc: true }));
const updateDocMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => collectionMock(...args),
  addDoc: (...args: unknown[]) => addDocMock(...args),
  query: (...args: unknown[]) => queryMock(...args),
  where: (...args: unknown[]) => whereMock(...args),
  orderBy: (...args: unknown[]) => orderByMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  doc: (...args: unknown[]) => docMock(...args),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  serverTimestamp: () => "server-timestamp",
}));

vi.mock("@/integrations/firebase/client", () => ({ db: {} }));

import { createActionItems, getOpenActionItems, resolveActionItem } from "./actionItems";

describe("createActionItems", () => {
  beforeEach(() => {
    addDocMock.mockReset();
  });

  it("writes one actionItems doc per friction point", async () => {
    addDocMock.mockResolvedValue(undefined);
    await createActionItems("uid-1", "https://example.com", "homepage", [
      { category: "ux-clarity", severity: "high", title: "Weak headline", description: "d1", fix: "f1", impactScore: 80 },
      { category: "trust-credibility", severity: "med", title: "No reviews", description: "d2", fix: "f2", impactScore: 60 },
    ]);

    expect(addDocMock).toHaveBeenCalledTimes(2);
    expect(addDocMock).toHaveBeenCalledWith(
      { __collection: true },
      expect.objectContaining({
        userId: "uid-1",
        url: "https://example.com",
        analysisType: "homepage",
        category: "ux-clarity",
        severity: "high",
        title: "Weak headline",
        status: "open",
        createdAt: "server-timestamp",
      })
    );
  });
});

describe("getOpenActionItems", () => {
  beforeEach(() => {
    getDocsMock.mockReset();
  });

  it("queries for open items belonging to the user, ordered by impact", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: "item-1",
          data: () => ({
            userId: "uid-1",
            url: "https://example.com",
            analysisType: "homepage",
            category: "ux-clarity",
            severity: "high",
            title: "Weak headline",
            description: "d1",
            fix: "f1",
            impactScore: 80,
            status: "open",
            createdAt: { toDate: () => new Date("2026-06-01T00:00:00.000Z") },
          }),
        },
      ],
    });

    const items = await getOpenActionItems("uid-1");

    expect(whereMock).toHaveBeenCalledWith("userId", "==", "uid-1");
    expect(whereMock).toHaveBeenCalledWith("status", "==", "open");
    expect(items).toEqual([
      {
        id: "item-1",
        userId: "uid-1",
        url: "https://example.com",
        analysisType: "homepage",
        category: "ux-clarity",
        severity: "high",
        title: "Weak headline",
        description: "d1",
        fix: "f1",
        impactScore: 80,
        status: "open",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("resolveActionItem", () => {
  it("updates the item's status to resolved", async () => {
    updateDocMock.mockResolvedValue(undefined);
    await resolveActionItem("item-1");
    expect(updateDocMock).toHaveBeenCalledWith({ __doc: true }, { status: "resolved" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/firebase/actionItems.test.ts`
Expected: FAIL — `Cannot find module './actionItems'`

- [ ] **Step 3: Write `src/lib/firebase/actionItems.ts`**

```ts
import { collection, addDoc, query, where, orderBy, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

export interface FrictionPointInput {
  category: string;
  severity: "high" | "med" | "low";
  title: string;
  description: string;
  fix: string;
  impactScore: number;
}

export interface ActionItem extends FrictionPointInput {
  id: string;
  userId: string;
  url: string;
  analysisType: string;
  status: "open" | "resolved";
  createdAt: string;
}

export async function createActionItems(
  userId: string,
  url: string,
  analysisType: string,
  frictionPoints: FrictionPointInput[]
): Promise<void> {
  await Promise.all(
    frictionPoints.map((fp) =>
      addDoc(collection(db, "actionItems"), {
        userId,
        url,
        analysisType,
        category: fp.category,
        severity: fp.severity,
        title: fp.title,
        description: fp.description,
        fix: fp.fix,
        impactScore: fp.impactScore,
        status: "open",
        createdAt: serverTimestamp(),
      })
    )
  );
}

export async function getOpenActionItems(userId: string): Promise<ActionItem[]> {
  const q = query(
    collection(db, "actionItems"),
    where("userId", "==", userId),
    where("status", "==", "open"),
    orderBy("impactScore", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as {
      userId: string;
      url: string;
      analysisType: string;
      category: string;
      severity: "high" | "med" | "low";
      title: string;
      description: string;
      fix: string;
      impactScore: number;
      status: "open" | "resolved";
      createdAt: { toDate: () => Date } | string;
    };
    return {
      id: docSnap.id,
      userId: data.userId,
      url: data.url,
      analysisType: data.analysisType,
      category: data.category,
      severity: data.severity,
      title: data.title,
      description: data.description,
      fix: data.fix,
      impactScore: data.impactScore,
      status: data.status,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : data.createdAt.toDate().toISOString(),
    };
  });
}

export async function resolveActionItem(itemId: string): Promise<void> {
  await updateDoc(doc(db, "actionItems", itemId), { status: "resolved" });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/firebase/actionItems.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/firebase/actionItems.ts src/lib/firebase/actionItems.test.ts
git commit -m "Add the actionItems Firestore data module"
```

---

### Task 3: Action Center page

**Files:**
- Create: `src/pages/ActionCenter.tsx`
- Create: `src/pages/ActionCenter.test.tsx`

**Interfaces:**
- Consumes: `getOpenActionItems`, `resolveActionItem`, `ActionItem` (Task 2), `DashboardLayout`, `useAuth()`
- Produces: no new exports — consumed by Task 4's `/action-center` route

- [ ] **Step 1: Write the failing tests**

Create `src/pages/ActionCenter.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getOpenActionItemsMock = vi.fn();
const resolveActionItemMock = vi.fn();

vi.mock("@/lib/firebase/actionItems", () => ({
  getOpenActionItems: (...args: unknown[]) => getOpenActionItemsMock(...args),
  resolveActionItem: (...args: unknown[]) => resolveActionItemMock(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));

import ActionCenter from "./ActionCenter";

describe("ActionCenter", () => {
  beforeEach(() => {
    getOpenActionItemsMock.mockReset();
    resolveActionItemMock.mockReset();
  });

  it("shows an empty state when there are no open issues", async () => {
    getOpenActionItemsMock.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <ActionCenter />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("No open issues — you're all caught up.")).toBeInTheDocument();
    });
  });

  it("renders open issues and removes one from the list when resolved", async () => {
    getOpenActionItemsMock.mockResolvedValue([
      {
        id: "item-1",
        userId: "uid-1",
        url: "https://example.com",
        analysisType: "homepage",
        category: "ux-clarity",
        severity: "high",
        title: "Weak headline",
        description: "Fix this",
        fix: "Do this",
        impactScore: 80,
        status: "open",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
    resolveActionItemMock.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ActionCenter />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Weak headline")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Mark Resolved"));

    await waitFor(() => {
      expect(resolveActionItemMock).toHaveBeenCalledWith("item-1");
      expect(screen.queryByText("Weak headline")).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/ActionCenter.test.tsx`
Expected: FAIL — `Cannot find module './ActionCenter'`

- [ ] **Step 3: Write `src/pages/ActionCenter.tsx`**

```tsx
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { getOpenActionItems, resolveActionItem, type ActionItem } from "@/lib/firebase/actionItems";

const severityBorderClass: Record<string, string> = {
  high: "border-l-4 border-l-friction-high",
  med: "border-l-4 border-l-friction-med",
  low: "border-l-4 border-l-friction-low",
};

const ActionCenter = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    getOpenActionItems(user.uid).then((records) => {
      setItems(records);
      setLoading(false);
    });
  }, [user]);

  const handleResolve = async (id: string) => {
    await resolveActionItem(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  if (!user) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Please sign in to view your action center.</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <h1 className="text-xl font-semibold text-foreground font-display mb-6">Action Center</h1>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading open issues…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No open issues — you're all caught up.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              className={`bg-surface p-4 shadow-card rounded-lg ${severityBorderClass[item.severity]}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.url.replace(/^https?:\/\//, "")}</span>
                <button
                  onClick={() => handleResolve(item.id)}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Mark Resolved
                </button>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
};

export default ActionCenter;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pages/ActionCenter.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/ActionCenter.tsx src/pages/ActionCenter.test.tsx
git commit -m "Add the Action Center page"
```

---

### Task 4: Wire up the route, nav, and analysis call sites

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/WorkspaceNav.tsx`
- Modify: `src/pages/Index.tsx`
- Modify: `src/pages/BulkAnalysis.tsx`

**Interfaces:**
- Consumes: `ActionCenter` (Task 3), `createActionItems` (Task 2)
- Produces: nothing new — this task only connects already-built pieces

- [ ] **Step 1: Replace the `/action-center` placeholder route in `src/App.tsx`**

Add the import alongside the existing page imports:

```tsx
import ActionCenter from "./pages/ActionCenter.tsx";
```

Replace:

```tsx
            <Route path="/action-center" element={<DashboardLayout><ComingSoon title="Action Center" /></DashboardLayout>} />
```

with:

```tsx
            <Route path="/action-center" element={<ActionCenter />} />
```

- [ ] **Step 2: Mark "Action Center" as real in `src/components/WorkspaceNav.tsx`**

Replace:

```tsx
  { label: "Action Center", path: "/action-center", icon: CheckSquare, real: false },
```

with:

```tsx
  { label: "Action Center", path: "/action-center", icon: CheckSquare, real: true },
```

- [ ] **Step 3: Create action items from `src/pages/Index.tsx`'s four `trackAnalysis` call sites**

Add the import:

```tsx
import { createActionItems } from "@/lib/firebase/actionItems";
```

Replace each of the four `trackAnalysis(...)` calls (immediately after each one, still inside the same `try`/`catch` block it's already in) by adding a follow-up line. For the `both`-device success branch:

```tsx
        await trackAnalysis(formatted, type, "desktop", desktopData.conversionScore ?? desktopData.benchmark.overallScore);
        if (user) await createActionItems(user.uid, formatted, type, desktopData.frictionPoints);
```

For the `both`-device fallback branch:

```tsx
        await trackAnalysis(formatted, type, "desktop", mockDesktop.conversionScore ?? mockDesktop.benchmark.overallScore);
        if (user) await createActionItems(user.uid, formatted, type, mockDesktop.frictionPoints);
```

For the single-device success branch:

```tsx
        await trackAnalysis(formatted, type, device, data.conversionScore ?? data.benchmark.overallScore);
        if (user) await createActionItems(user.uid, formatted, type, data.frictionPoints);
```

For the single-device fallback branch:

```tsx
        await trackAnalysis(formatted, type, device, mockResult.conversionScore ?? mockResult.benchmark.overallScore);
        if (user) await createActionItems(user.uid, formatted, type, mockResult.frictionPoints);
```

- [ ] **Step 4: Create action items from `src/pages/BulkAnalysis.tsx`'s `trackAnalysis` call site**

Add the import:

```tsx
import { createActionItems } from "@/lib/firebase/actionItems";
```

Replace:

```tsx
        await trackAnalysis(url, type, "desktop", result.conversionScore ?? result.benchmark.overallScore);
```

with:

```tsx
        await trackAnalysis(url, type, "desktop", result.conversionScore ?? result.benchmark.overallScore);
        if (user) await createActionItems(user.uid, url, type, result.frictionPoints);
```

- [ ] **Step 5: Run the full test suite and type-check**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.app.json
```

Expected: all tests pass, no type errors.

- [ ] **Step 6: Boot-verify with the dev server**

Using the Claude Code preview tooling (`.claude/launch.json` already configured), navigate to `/action-center` and confirm it renders the sign-in prompt (no real Firebase user in this environment) with no console errors, and that the WorkspaceNav's "Action Center" dot now shows as real (same color as "Dashboard"/"Conversion").

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/WorkspaceNav.tsx src/pages/Index.tsx src/pages/BulkAnalysis.tsx
git commit -m "Wire up the Action Center route, nav, and analysis call sites"
```

---

## What this plan does NOT cover (by design)

Cross-user task assignment, due dates, and completion attribution are Phase 7 of the roadmap (needs team accounts). This plan is single-user aggregate-and-resolve only, per the original spec. Technical, Content, the dedicated Monitoring page, Analysis/Competitor, and Reports remain "Coming soon".
