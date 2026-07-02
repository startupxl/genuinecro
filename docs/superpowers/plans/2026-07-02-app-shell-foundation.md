# App Shell Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the top `AppHeader` bar with a single universal left-sidebar shell (logo, nav, profile) used by every page in the app, and delete `AppHeader` once nothing references it.

**Architecture:** `WorkspaceNav.tsx` grows from a plain nav list into the full sidebar — logo at top, the existing 8 nav sections plus a new "Bulk" entry in the middle, and a profile row (or "Sign in" button) pinned to the bottom. `DashboardLayout.tsx` is renamed to `AppShell.tsx` and simplified to just `WorkspaceNav` + an unpadded `<main>` (padding moves to individual pages so each can keep its own layout width/spacing). Every page currently rendering `<AppHeader>` directly switches to self-wrapping with `<AppShell>`, following the same pattern `Dashboard.tsx`/`Technical.tsx`/`ActionCenter.tsx` already use.

**Tech Stack:** React + existing hooks/components (`useAuth`, `useSubscription`, shadcn `DropdownMenu`/`Avatar`) — no new dependencies.

## Global Constraints

- Reference spec: `docs/superpowers/specs/2026-07-02-app-shell-redesign-design.md`.
- Profile row sits at the **bottom** of the sidebar (not top), compact row style (avatar + name + plan tier).
- Anonymous visitors see a "Sign in" button in that same bottom slot — the sidebar itself stays visible for everyone, signed in or not.
- This shell applies to **every** page except `AuthPage` (the sign-in/signup screen stays a standalone full-screen split panel, not wrapped in the sidebar).
- `AppHeader.tsx` is deleted once no page references it.
- Plan tier text comes from the existing `useSubscription()` hook's `currentPlan` field — no new data source.
- This plan covers `AppShell`/`WorkspaceNav` plus migrating every page. Dashboard's stat-card restyle and the AuthPage preview-panel enrichment are a separate, independent plan (they don't depend on this one).

---

### Task 1: AppShell component and WorkspaceNav profile/logo/Bulk

**Files:**
- Create: `src/components/AppShell.tsx`
- Delete: `src/components/DashboardLayout.tsx`
- Modify: `src/components/WorkspaceNav.tsx`
- Modify: `src/components/WorkspaceNav.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (existing, returns `{ user, signOut, loading }`), `useSubscription()` (existing, returns `{ currentPlan, ... }`)
- Produces: `AppShell({ children, onLogoClick?, onSignIn? })` — the universal page wrapper, consumed by every task in this plan. `WorkspaceNav({ onLogoClick?, onSignIn? })` — consumed only by `AppShell` itself.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/components/WorkspaceNav.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const signOutMock = vi.fn();
let mockUser: { uid: string; email: string; displayName: string | null } | null = null;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, signOut: signOutMock, loading: false }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Growth", subscription: null }),
}));

import WorkspaceNav from "./WorkspaceNav";

describe("WorkspaceNav", () => {
  beforeEach(() => {
    mockUser = null;
    signOutMock.mockReset();
  });

  it("renders all nine sections with Dashboard, Technical, Conversion, Action Center, and Bulk marked real", () => {
    mockUser = { uid: "uid-1", email: "user@example.com", displayName: "Jane" };
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );

    ["Dashboard", "Technical", "Content", "Conversion", "Monitoring", "Analysis", "Action Center", "Reports", "Bulk"].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("highlights the active section based on the current route", () => {
    mockUser = { uid: "uid-1", email: "user@example.com", displayName: "Jane" };
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );

    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink).toHaveClass("bg-secondary");
  });

  it("shows a profile row with the user's name and plan when signed in", () => {
    mockUser = { uid: "uid-1", email: "user@example.com", displayName: "Jane" };
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );

    expect(screen.getByText("Jane")).toBeInTheDocument();
    expect(screen.getByText("Growth plan")).toBeInTheDocument();
  });

  it("shows a Sign in button instead of a profile row when signed out", () => {
    mockUser = null;
    const onSignIn = vi.fn();
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav onSignIn={onSignIn} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Jane")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Sign in"));
    expect(onSignIn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/WorkspaceNav.test.tsx`
Expected: FAIL — current `WorkspaceNav` has 8 sections (no "Bulk") and no profile row/sign-in button.

- [ ] **Step 3: Rewrite `src/components/WorkspaceNav.tsx`**

Replace the entire file with:

```tsx
import { useNavigate, NavLink } from "react-router-dom";
import {
  LayoutDashboard, Wrench, FileText, Search, Activity, Swords, CheckSquare, FileBarChart,
  FileSpreadsheet, LogIn, LogOut, UserCog, CreditCard, HelpCircle, Settings, ChevronUp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoImg from "@/assets/logo.png";

interface NavSection {
  label: string;
  path: string;
  icon: React.ElementType;
  real: boolean;
}

const sections: NavSection[] = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, real: true },
  { label: "Technical", path: "/technical", icon: Wrench, real: true },
  { label: "Content", path: "/content", icon: FileText, real: false },
  { label: "Conversion", path: "/", icon: Search, real: true },
  { label: "Monitoring", path: "/monitoring", icon: Activity, real: false },
  { label: "Analysis", path: "/competitor-analysis", icon: Swords, real: false },
  { label: "Action Center", path: "/action-center", icon: CheckSquare, real: true },
  { label: "Reports", path: "/reports", icon: FileBarChart, real: false },
  { label: "Bulk", path: "/bulk", icon: FileSpreadsheet, real: true },
];

interface WorkspaceNavProps {
  onLogoClick?: () => void;
  onSignIn?: () => void;
}

const WorkspaceNav = ({ onLogoClick, onSignIn }: WorkspaceNavProps) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { currentPlan } = useSubscription();

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "U";
  const displayName = user?.displayName || user?.email || "User";

  return (
    <nav className="w-48 flex-shrink-0 border-r border-border bg-surface py-4 flex flex-col">
      <button
        onClick={onLogoClick || (() => navigate("/"))}
        className="flex items-center px-4 pb-4 mb-2 border-b border-border hover:opacity-80 transition-opacity"
        title="Back to home"
      >
        <img src={logoImg} alt="GenuineCRO" className="h-6 w-auto object-contain" />
      </button>

      <div className="flex-1">
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
      </div>

      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2.5 border-t border-border hover:bg-secondary/50 transition-colors">
              <Avatar className="h-6 w-6 flex-shrink-0">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{currentPlan} plan</p>
              </div>
              <ChevronUp className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuItem onClick={() => navigate("/account")} className="cursor-pointer">
              <UserCog className="mr-2 h-4 w-4" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/subscription")} className="cursor-pointer">
              <CreditCard className="mr-2 h-4 w-4" />
              Subscription
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/help")} className="cursor-pointer">
              <HelpCircle className="mr-2 h-4 w-4" />
              Help Center
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          onClick={onSignIn || (() => navigate("/"))}
          className="flex items-center gap-2 px-4 py-2.5 border-t border-border text-sm text-foreground hover:bg-secondary/50 transition-colors"
        >
          <LogIn className="h-3.5 w-3.5" />
          Sign in
        </button>
      )}
    </nav>
  );
};

export default WorkspaceNav;
```

The "Sign in" button falls back to `navigate("/")` when no `onSignIn` prop is given — matching the old `DashboardLayout`'s `AppHeader` instance, which pointed anonymous visitors back to the homepage to sign in rather than opening a modal in place. Only `LandingView` (Task 5) passes a real `onSignIn` handler, since it already owns that in-place auth flow.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/WorkspaceNav.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Create `src/components/AppShell.tsx`**

```tsx
import type { ReactNode } from "react";
import WorkspaceNav from "./WorkspaceNav";

interface AppShellProps {
  children: ReactNode;
  onLogoClick?: () => void;
  onSignIn?: () => void;
}

const AppShell = ({ children, onLogoClick, onSignIn }: AppShellProps) => {
  return (
    <div className="flex min-h-svh bg-background">
      <WorkspaceNav onLogoClick={onLogoClick} onSignIn={onSignIn} />
      <main className="flex-1 overflow-y-auto min-h-0 relative">{children}</main>
    </div>
  );
};

export default AppShell;
```

`min-h-0` on `<main>` lets flex children that need their own fixed-height internal scroll regions (AnalysisView/ComparisonView, migrated in Task 5) shrink correctly instead of being forced to their content's natural height. `relative` gives those pages' `absolute`-positioned children (like LandingView's footer, also in Task 5) a positioning frame scoped to the content area instead of the whole viewport — without it, `absolute bottom-4 left-0 right-0` would span underneath the sidebar too.

- [ ] **Step 6: Delete `src/components/DashboardLayout.tsx`**

Run: `rm src/components/DashboardLayout.tsx`

(Its three consumers — `Dashboard.tsx`, `Technical.tsx`, `ActionCenter.tsx` — are migrated in Task 2. Leaving the delete here means Task 2 starts from a state where those three files have a broken import; that's expected and gets fixed immediately in Task 2's first step.)

- [ ] **Step 7: Commit**

```bash
git add src/components/AppShell.tsx src/components/WorkspaceNav.tsx src/components/WorkspaceNav.test.tsx
git rm src/components/DashboardLayout.tsx
git commit -m "Add AppShell and the sidebar profile/logo/Bulk nav entry"
```

---

### Task 2: Migrate Dashboard, Technical, Action Center, and the App.tsx placeholder routes

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/Dashboard.test.tsx`
- Modify: `src/pages/Technical.tsx`
- Modify: `src/pages/Technical.test.tsx`
- Modify: `src/pages/ActionCenter.tsx`
- Modify: `src/pages/ActionCenter.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AppShell` (Task 1)
- Produces: nothing new

**Context:** `AppShell`'s `<main>` has no padding (Task 1) — each page that used to rely on `DashboardLayout`'s built-in `p-6` needs its own padding wrapper now, so these three pages don't lose their spacing. Also: `WorkspaceNav` now calls `useSubscription()` directly (Task 1), and since these three pages' tests render the *real* `WorkspaceNav` as a child (they don't mock it out), their existing `useAuth` mock alone isn't enough anymore — `useSubscription()`'s real implementation would call `user.getIdToken()` on the mocked user object (which doesn't have that method) and crash. Each test file needs a `useSubscription` mock added.

- [ ] **Step 1: Add a `useSubscription` mock to the three test files**

In `src/pages/Dashboard.test.tsx`, add this alongside the existing `vi.mock("@/hooks/useAuth", ...)` block:

```ts
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Free", subscription: null }),
}));
```

In `src/pages/Technical.test.tsx`, add the same block alongside its existing mocks:

```ts
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Free", subscription: null }),
}));
```

In `src/pages/ActionCenter.test.tsx`, add the same block alongside its existing mocks:

```ts
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Free", subscription: null }),
}));
```

- [ ] **Step 2: Run the three test files to confirm they fail on the broken `DashboardLayout` import**

Run: `npx vitest run src/pages/Dashboard.test.tsx src/pages/Technical.test.tsx src/pages/ActionCenter.test.tsx`
Expected: FAIL — `Cannot find module '@/components/DashboardLayout'` (it was deleted in Task 1, and these pages still import it).

- [ ] **Step 3: Migrate `src/pages/Dashboard.tsx`**

Replace:

```tsx
import DashboardLayout from "@/components/DashboardLayout";
```

with:

```tsx
import AppShell from "@/components/AppShell";
```

Replace:

```tsx
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
```

with:

```tsx
  if (!user) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-muted-foreground">Please sign in to view your dashboard.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6">
      <div className="flex items-center justify-between mb-6">
```

(the rest of the file's JSX between this line and its closing tags is unchanged)

Then replace the closing of the file:

```tsx
        </>
      )}
    </DashboardLayout>
  );
};

export default Dashboard;
```

with:

```tsx
        </>
      )}
      </div>
    </AppShell>
  );
};

export default Dashboard;
```

- [ ] **Step 4: Migrate `src/pages/Technical.tsx`**

Replace:

```tsx
import DashboardLayout from "@/components/DashboardLayout";
```

with:

```tsx
import AppShell from "@/components/AppShell";
```

Replace:

```tsx
  return (
    <DashboardLayout>
      <h1 className="text-xl font-semibold text-foreground font-display mb-6">Technical</h1>
```

with:

```tsx
  return (
    <AppShell>
      <div className="p-6">
      <h1 className="text-xl font-semibold text-foreground font-display mb-6">Technical</h1>
```

Replace the file's closing:

```tsx
        </>
      )}
    </DashboardLayout>
  );
};

export default Technical;
```

with:

```tsx
        </>
      )}
      </div>
    </AppShell>
  );
};

export default Technical;
```

- [ ] **Step 5: Migrate `src/pages/ActionCenter.tsx`**

Replace:

```tsx
import DashboardLayout from "@/components/DashboardLayout";
```

with:

```tsx
import AppShell from "@/components/AppShell";
```

Replace:

```tsx
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
```

with:

```tsx
  if (!user) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-muted-foreground">Please sign in to view your action center.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6">
      <h1 className="text-xl font-semibold text-foreground font-display mb-6">Action Center</h1>
```

Replace the file's closing:

```tsx
        </>
      )}
    </DashboardLayout>
  );
};

export default ActionCenter;
```

with:

```tsx
        </>
      )}
      </div>
    </AppShell>
  );
};

export default ActionCenter;
```

- [ ] **Step 6: Migrate the placeholder routes and import in `src/App.tsx`**

Replace:

```tsx
import DashboardLayout from "@/components/DashboardLayout";
```

with:

```tsx
import AppShell from "@/components/AppShell";
```

Replace:

```tsx
            <Route path="/content" element={<DashboardLayout><ComingSoon title="Content" /></DashboardLayout>} />
            <Route path="/monitoring" element={<DashboardLayout><ComingSoon title="Monitoring" /></DashboardLayout>} />
            <Route path="/competitor-analysis" element={<DashboardLayout><ComingSoon title="Analysis" /></DashboardLayout>} />
            <Route path="/action-center" element={<ActionCenter />} />
            <Route path="/reports" element={<DashboardLayout><ComingSoon title="Reports" /></DashboardLayout>} />
```

with:

```tsx
            <Route path="/content" element={<AppShell><ComingSoon title="Content" /></AppShell>} />
            <Route path="/monitoring" element={<AppShell><ComingSoon title="Monitoring" /></AppShell>} />
            <Route path="/competitor-analysis" element={<AppShell><ComingSoon title="Analysis" /></AppShell>} />
            <Route path="/action-center" element={<ActionCenter />} />
            <Route path="/reports" element={<AppShell><ComingSoon title="Reports" /></AppShell>} />
```

- [ ] **Step 7: Run the three test files plus a type-check to verify everything passes**

```bash
npx vitest run src/pages/Dashboard.test.tsx src/pages/Technical.test.tsx src/pages/ActionCenter.test.tsx
npx tsc --noEmit -p tsconfig.app.json
```

Expected: all tests pass, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/Dashboard.test.tsx src/pages/Technical.tsx src/pages/Technical.test.tsx src/pages/ActionCenter.tsx src/pages/ActionCenter.test.tsx src/App.tsx
git commit -m "Migrate Dashboard, Technical, and Action Center to AppShell"
```

---

### Task 3: Delete AppHeader and migrate the legal/help pages

**Files:**
- Modify: `src/pages/PrivacyPolicy.tsx`
- Modify: `src/pages/TermsConditions.tsx`
- Modify: `src/pages/CancellationRefunds.tsx`
- Modify: `src/pages/DeliveryPolicy.tsx`
- Modify: `src/pages/ContactUs.tsx`
- Modify: `src/pages/HelpCenter.tsx`

**Interfaces:**
- Consumes: `AppShell` (Task 1)
- Produces: nothing new

**Context:** These six pages share an identical structure: `<div className="flex flex-col min-h-svh bg-background"><AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} /><main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">...</main></div>`. In every one of them, `navigate` is used *only* for those two `AppHeader` props — once `AppHeader` is removed, `useNavigate` becomes fully unused and should be deleted too, not left as dead code. `AppHeader.tsx` itself has no other consumers after this task (Task 2 already removed the only other three), so it gets deleted here.

- [ ] **Step 1: Delete `src/components/AppHeader.tsx`**

Run: `rm src/components/AppHeader.tsx`

- [ ] **Step 2: Migrate `src/pages/PrivacyPolicy.tsx`**

Replace:

```tsx
import AppHeader from "@/components/AppHeader";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
```

with:

```tsx
import AppShell from "@/components/AppShell";

const PrivacyPolicy = () => {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
```

Replace the file's closing:

```tsx
      </main>
    </div>
  );
};

export default PrivacyPolicy;
```

with:

```tsx
      </div>
    </AppShell>
  );
};

export default PrivacyPolicy;
```

- [ ] **Step 3: Migrate `src/pages/TermsConditions.tsx`**

Replace:

```tsx
import AppHeader from "@/components/AppHeader";
import { useNavigate } from "react-router-dom";

const TermsConditions = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
```

with:

```tsx
import AppShell from "@/components/AppShell";

const TermsConditions = () => {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
```

Replace the file's closing:

```tsx
      </main>
    </div>
  );
};

export default TermsConditions;
```

with:

```tsx
      </div>
    </AppShell>
  );
};

export default TermsConditions;
```

- [ ] **Step 4: Migrate `src/pages/CancellationRefunds.tsx`**

Replace:

```tsx
import AppHeader from "@/components/AppHeader";
import { useNavigate } from "react-router-dom";

const CancellationRefunds = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
```

with:

```tsx
import AppShell from "@/components/AppShell";

const CancellationRefunds = () => {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
```

Replace the file's closing:

```tsx
      </main>
    </div>
  );
};

export default CancellationRefunds;
```

with:

```tsx
      </div>
    </AppShell>
  );
};

export default CancellationRefunds;
```

- [ ] **Step 5: Migrate `src/pages/DeliveryPolicy.tsx`**

Replace:

```tsx
import AppHeader from "@/components/AppHeader";
import { useNavigate } from "react-router-dom";

const DeliveryPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
```

with:

```tsx
import AppShell from "@/components/AppShell";

const DeliveryPolicy = () => {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
```

Replace the file's closing:

```tsx
      </main>
    </div>
  );
};

export default DeliveryPolicy;
```

with:

```tsx
      </div>
    </AppShell>
  );
};

export default DeliveryPolicy;
```

- [ ] **Step 6: Migrate `src/pages/ContactUs.tsx`**

Replace:

```tsx
import AppHeader from "@/components/AppHeader";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const ContactUs = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
```

with:

```tsx
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const ContactUs = () => {
  const { user } = useAuth();
```

Replace:

```tsx
  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
```

with:

```tsx
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
```

Replace the file's closing:

```tsx
      </main>
    </div>
  );
};

export default ContactUs;
```

with:

```tsx
      </div>
    </AppShell>
  );
};

export default ContactUs;
```

- [ ] **Step 7: Migrate `src/pages/HelpCenter.tsx`, and fix its stale usage-limit copy**

Replace:

```tsx
import AppHeader from "@/components/AppHeader";
import { useNavigate } from "react-router-dom";
```

with:

```tsx
import AppShell from "@/components/AppShell";
```

Find the `const HelpCenter = () => {` line and remove the `const navigate = useNavigate();` line directly below it (it's no longer used once `AppHeader` is removed).

Replace:

```tsx
  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
```

with:

```tsx
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
```

Replace the file's closing:

```tsx
      </main>
    </div>
  );
};

export default HelpCenter;
```

with:

```tsx
      </div>
    </AppShell>
  );
};

export default HelpCenter;
```

Also fix this file's stale FAQ copy, which still references the old scan limits (before the login-gated-results plan changed them):

Replace:

```tsx
        answer: "You can run up to 3 analyses without an account. Sign up for a free account to get 10 analyses. Upgrade to a paid plan for unlimited access.",
```

with:

```tsx
        answer: "You get 1 free scan before you need to sign up. A free account includes 3 total analyses. Upgrade to a paid plan for more.",
```

- [ ] **Step 8: Run the full test suite and a type-check**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.app.json
```

Expected: all tests pass, no type errors. (None of these six pages have their own test files, so this step is what verifies the migration didn't break anything — including confirming nothing else in the codebase still imports the now-deleted `AppHeader.tsx`.)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Delete AppHeader and migrate the legal/help pages to AppShell"
```

---

### Task 4: Migrate Settings, Subscription, Account, and Bulk Analysis

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/Subscription.tsx`
- Modify: `src/pages/Account.tsx`
- Modify: `src/pages/BulkAnalysis.tsx`

**Interfaces:**
- Consumes: `AppShell` (Task 1)
- Produces: nothing new

- [ ] **Step 1: Migrate `src/pages/Settings.tsx`**

Replace:

```tsx
import { useAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/AppHeader";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
```

with:

```tsx
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { toast } from "sonner";
```

Replace:

```tsx
const Settings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
```

with:

```tsx
const Settings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
```

Replace:

```tsx
  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
```

with:

```tsx
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
```

Replace the file's closing:

```tsx
      </main>
    </div>
  );
};

export default Settings;
```

with:

```tsx
      </div>
    </AppShell>
  );
};

export default Settings;
```

- [ ] **Step 2: Migrate `src/pages/Subscription.tsx`**

Replace:

```tsx
import AppHeader from "@/components/AppHeader";
import { useNavigate, useSearchParams } from "react-router-dom";
```

with:

```tsx
import AppShell from "@/components/AppShell";
import { useSearchParams } from "react-router-dom";
```

Replace:

```tsx
const Subscription = () => {
  const { user } = useAuth();
  const { usage } = useUsageTracking();
  const { currentPlan, loading, subscribe, refresh } = useSubscription();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
```

with:

```tsx
const Subscription = () => {
  const { user } = useAuth();
  const { usage } = useUsageTracking();
  const { currentPlan, loading, subscribe, refresh } = useSubscription();
  const [searchParams] = useSearchParams();
```

Replace:

```tsx
  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 space-y-8">
```

with:

```tsx
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto w-full px-4 py-8 space-y-8">
```

Replace the file's closing:

```tsx
      </main>
    </div>
  );
};

export default Subscription;
```

with:

```tsx
      </div>
    </AppShell>
  );
};

export default Subscription;
```

- [ ] **Step 3: Migrate `src/pages/Account.tsx`**

Replace:

```tsx
import AppHeader from "@/components/AppHeader";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
```

with:

```tsx
import AppShell from "@/components/AppShell";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
```

Replace:

```tsx
  if (!user) {
    return (
      <div className="flex flex-col min-h-svh bg-background">
        <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Please sign in to view your account.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
```

with:

```tsx
  if (!user) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-muted-foreground">Please sign in to view your account.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
```

Replace the file's closing:

```tsx
      </main>
    </div>
  );
};

export default Account;
```

with:

```tsx
      </div>
    </AppShell>
  );
};

export default Account;
```

- [ ] **Step 4: Migrate `src/pages/BulkAnalysis.tsx`**

Replace:

```tsx
import AppHeader from "@/components/AppHeader";
import { useNavigate } from "react-router-dom";
```

with:

```tsx
import AppShell from "@/components/AppShell";
import { useNavigate } from "react-router-dom";
```

Replace:

```tsx
  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-6">
```

with:

```tsx
  return (
    <AppShell>
      <div className="max-w-5xl mx-auto w-full px-4 py-8 space-y-6">
```

Replace the file's closing:

```tsx
      </main>
    </div>
  );
};

export default BulkAnalysis;
```

with:

```tsx
      </div>
    </AppShell>
  );
};

export default BulkAnalysis;
```

- [ ] **Step 5: Run the full test suite and a type-check**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.app.json
```

Expected: all tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Settings.tsx src/pages/Subscription.tsx src/pages/Account.tsx src/pages/BulkAnalysis.tsx
git commit -m "Migrate Settings, Subscription, Account, and Bulk Analysis to AppShell"
```

---

### Task 5: Migrate the core scan flow (LandingView, AnalysisView, ComparisonView, Index)

**Files:**
- Modify: `src/components/LandingView.tsx`
- Modify: `src/components/AnalysisView.tsx`
- Modify: `src/components/ComparisonView.tsx`
- Modify: `src/pages/Index.tsx`

**Interfaces:**
- Consumes: `AppShell` (Task 1)
- Produces: nothing new

**Context:** `AnalysisView`/`ComparisonView` only ever render once someone is signed in (results are login-gated — see `docs/superpowers/specs/2026-07-02-login-gated-results-design.md`), so their `onSignIn` prop has been dead code since that change landed; this task removes it while migrating. Both components' outer `motion.div` currently sets `h-svh` (a fixed full-viewport height, needed for their internal independently-scrolling panels) — since `AppShell` now wraps them and already establishes the full-height frame, that becomes `h-full` so the motion.div fills `AppShell`'s `<main>` instead of re-claiming the whole viewport (which would push the height past the visible area, since `AppShell`'s sidebar sits alongside it, not above it). `LandingView`'s `onSignOut` prop was already dead before this task (`AppHeader` never accepted it, and nothing in `LandingView` calls it) — removed here since this task is already touching every line that references it.

- [ ] **Step 1: Migrate `src/components/LandingView.tsx`**

Replace:

```tsx
import AppHeader from "@/components/AppHeader";
```

with:

```tsx
import AppShell from "@/components/AppShell";
```

Replace:

```tsx
interface LandingViewProps {
  onAnalyze: (url: string, type: AnalysisType, device: "desktop" | "mobile" | "both") => void;
  usage: { used: number; limit: number; canAnalyze: boolean; requiresAuth: boolean; requiresPaid: boolean };
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
}
```

with:

```tsx
interface LandingViewProps {
  onAnalyze: (url: string, type: AnalysisType, device: "desktop" | "mobile" | "both") => void;
  usage: { used: number; limit: number; canAnalyze: boolean; requiresAuth: boolean; requiresPaid: boolean };
  user: User | null;
  onSignIn: () => void;
}
```

Replace:

```tsx
const LandingView = ({ onAnalyze, usage, user, onSignIn, onSignOut }: LandingViewProps) => {
```

with:

```tsx
const LandingView = ({ onAnalyze, usage, user, onSignIn }: LandingViewProps) => {
```

Replace:

```tsx
  return (
    <motion.div
      className="flex flex-col min-h-svh bg-background"
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <AppHeader onGoHome={() => {}} onSignIn={onSignIn} />

      <div className="flex-1 flex items-center justify-center px-4">
```

with:

```tsx
  return (
    <motion.div
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <AppShell onSignIn={onSignIn}>
      <div className="flex-1 flex items-center justify-center px-4">
```

Replace the file's closing:

```tsx
      </div>
    </motion.div>
  );
};

export default LandingView;
```

with:

```tsx
      </div>
      </AppShell>
    </motion.div>
  );
};

export default LandingView;
```

- [ ] **Step 2: Migrate `src/components/AnalysisView.tsx`**

Replace:

```tsx
import AppHeader from "./AppHeader";
```

with:

```tsx
import AppShell from "./AppShell";
```

Replace:

```tsx
interface AnalysisViewProps {
  result: AnalysisResult;
  onNewAnalysis: (url: string) => void;
  onGoHome?: () => void;
  onSignIn?: () => void;
}

const AnalysisView = ({ result, onNewAnalysis, onGoHome, onSignIn }: AnalysisViewProps) => {
```

with:

```tsx
interface AnalysisViewProps {
  result: AnalysisResult;
  onNewAnalysis: (url: string) => void;
  onGoHome?: () => void;
}

const AnalysisView = ({ result, onNewAnalysis, onGoHome }: AnalysisViewProps) => {
```

Replace:

```tsx
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col h-svh bg-background"
    >
      <AppHeader onGoHome={onGoHome} onSignIn={onSignIn} compact />
      <div className="flex flex-1 min-h-0">
```

with:

```tsx
  return (
    <AppShell onLogoClick={onGoHome}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col h-full bg-background"
      >
      <div className="flex flex-1 min-h-0">
```

Replace the file's closing:

```tsx
      )}
      </div>
    </motion.div>
  );
};

export default AnalysisView;
```

with:

```tsx
      )}
      </div>
      </motion.div>
    </AppShell>
  );
};

export default AnalysisView;
```

- [ ] **Step 3: Migrate `src/components/ComparisonView.tsx`**

Replace:

```tsx
import AppHeader from "./AppHeader";
```

with:

```tsx
import AppShell from "./AppShell";
```

Replace:

```tsx
interface ComparisonViewProps {
  desktopResult: AnalysisResult;
  mobileResult: AnalysisResult;
  onBack: () => void;
  onGoHome?: () => void;
  onSignIn?: () => void;
}
```

with:

```tsx
interface ComparisonViewProps {
  desktopResult: AnalysisResult;
  mobileResult: AnalysisResult;
  onBack: () => void;
  onGoHome?: () => void;
}
```

Replace:

```tsx
const ComparisonView = ({ desktopResult, mobileResult, onBack, onGoHome, onSignIn }: ComparisonViewProps) => {
```

with:

```tsx
const ComparisonView = ({ desktopResult, mobileResult, onBack, onGoHome }: ComparisonViewProps) => {
```

Replace:

```tsx
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col h-svh bg-background"
    >
      <AppHeader onGoHome={onGoHome} onSignIn={onSignIn} compact />
      {/* Secondary bar */}
```

with:

```tsx
  return (
    <AppShell onLogoClick={onGoHome}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col h-full bg-background"
      >
      {/* Secondary bar */}
```

Replace the file's closing:

```tsx
      )}
    </motion.div>
  );
};

export default ComparisonView;
```

with:

```tsx
      )}
    </motion.div>
    </AppShell>
  );
};

export default ComparisonView;
```

- [ ] **Step 4: Drop the now-unused `signOut` from `src/pages/Index.tsx`**

Replace:

```tsx
  const { user, signOut, loading: authLoading } = useAuth();
```

with:

```tsx
  const { user, loading: authLoading } = useAuth();
```

Replace:

```tsx
      <AnimatePresence mode="wait">
        <LandingView
          onAnalyze={handleAnalyze}
          usage={usage}
          user={user}
          onSignIn={openSignIn}
          onSignOut={signOut}
        />
      </AnimatePresence>
```

with:

```tsx
      <AnimatePresence mode="wait">
        <LandingView
          onAnalyze={handleAnalyze}
          usage={usage}
          user={user}
          onSignIn={openSignIn}
        />
      </AnimatePresence>
```

- [ ] **Step 5: Run the full test suite and a type-check**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.app.json
```

Expected: all tests pass, no type errors.

- [ ] **Step 6: Boot-verify with the dev server**

Using the Claude Code preview tooling, check each of these visually (screenshot each):
- `/` as an anonymous visitor — sidebar shows a "Sign in" button in the bottom slot instead of a profile row, the footer legal links still sit at the bottom of the content area (not overlapping the sidebar).
- `/dashboard`, `/technical`, `/action-center` — confirm the `p-6` padding added in Task 2 still looks right (no cramped-against-the-sidebar content).
- `/privacy` (or any migrated legal page) — confirm it renders inside the sidebar shell with its content still readable.
- If a signed-in session is available in this environment, check the sidebar's profile row renders a name/plan and its dropdown opens with Account/Subscription/Help Center/Settings/Sign out. If not (no real Firebase credentials in this environment), note that as a known verification gap for the user to check themselves, the same way prior tasks in this session have handled it.

This task carries the most layout risk in the whole plan (nested flex heights, `absolute`-positioned footer, mobile sheets in `AnalysisView`/`ComparisonView`) — if anything looks visually broken, stop and fix it before moving to Task 6 rather than proceeding on faith.

- [ ] **Step 7: Commit**

```bash
git add src/components/LandingView.tsx src/components/AnalysisView.tsx src/components/ComparisonView.tsx src/pages/Index.tsx
git commit -m "Migrate the homepage scan flow to AppShell"
```

---

## What This Plan Does NOT Cover (by design)

Dashboard's stat-card restyle and the AuthPage preview-panel enrichment are a separate, independent plan — see the design spec. No changes to the actual nav section routing beyond adding the Bulk entry. Doesn't address the still-open Hostinger `/api/*` CDN routing issue.