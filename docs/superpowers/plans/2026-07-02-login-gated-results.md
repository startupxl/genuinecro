# Login-Gated Results & Auth Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the homepage's URL-scan flow, require a signed-in account to view any scan result (anonymous visitors get exactly one scan attempt before a hard sign-up wall), and redesign the shared login/signup screen into a split-screen layout matching the provided reference designs.

**Architecture:** `useUsageTracking.ts`'s two limit constants change to enforce the new thresholds. `Index.tsx`'s render logic gains an `!user` check before showing `AnalysisView`/`ComparisonView`, falling back to `AuthPage` instead; a new effect watches for `user` becoming truthy while a not-yet-recorded result is held, and retroactively persists it via the existing `trackAnalysis`/`createActionItems` functions (no new backend/Firestore work — this reuses what Action Center and the Technical audit already built). `AuthPage.tsx` gets a new split-screen layout and an `initialMode` prop, with no changes to its existing auth logic.

**Tech Stack:** React + existing hooks/components (no new dependencies).

## Global Constraints

- Reference spec: `docs/superpowers/specs/2026-07-02-login-gated-results-design.md`.
- Scope: only the homepage single-URL scan flow (`src/pages/Index.tsx`, both the single-device and desktop+mobile comparison paths). Technical audit and Bulk Analysis are unchanged.
- Anonymous visitors: exactly 1 free scan submission, then a hard sign-up wall with no way to submit another URL without an account.
- Signed-in free-tier limit: 3 total audits (was 10/month).
- The scan that triggered the sign-up gate must be retroactively saved (Dashboard history + Action Center) the moment signup/login completes, using the existing `trackAnalysis`/`createActionItems` functions — no new Firestore collections or rules.
- `AuthPage`'s existing auth logic (email/password, Google, forgot-password, mode switching) is unchanged — only its layout and an added `initialMode` prop change.
- The new right-side panel reuses existing color tokens (`--primary`/`--primary-foreground`) and the existing `friction-high`/`friction-med`/`friction-low` severity classes — no new design tokens.

---

### Task 1: Update usage limits

**Files:**
- Modify: `src/hooks/useUsageTracking.ts`
- Modify: `src/hooks/useUsageTracking.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: no signature changes — `FREE_LIMIT_ANON` becomes `1`, `PLAN_LIMITS.free` becomes `3`. Consumed by Task 3 via the existing `useUsageTracking()` hook.

- [ ] **Step 1: Update the test file's mocks to be overridable per-test**

In `src/hooks/useUsageTracking.test.ts`, replace:

```ts
vi.mock("./useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));

vi.mock("./useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Growth", subscription: null }),
}));
```

with:

```ts
const useAuthMock = vi.fn(() => ({ user: { uid: "uid-1" } }));
vi.mock("./useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

const useSubscriptionMock = vi.fn(() => ({ currentPlan: "Growth", subscription: null }));
vi.mock("./useSubscription", () => ({
  useSubscription: () => useSubscriptionMock(),
}));
```

And replace the `beforeEach` block:

```ts
  beforeEach(() => {
    countAnalysesSinceMock.mockReset();
    recordAnalysisMock.mockReset();
    localStorage.clear();
  });
```

with:

```ts
  beforeEach(() => {
    countAnalysesSinceMock.mockReset();
    recordAnalysisMock.mockReset();
    useAuthMock.mockReturnValue({ user: { uid: "uid-1" } });
    useSubscriptionMock.mockReturnValue({ currentPlan: "Growth", subscription: null });
    localStorage.clear();
  });
```

- [ ] **Step 2: Add the two new failing tests**

Add these two tests inside the existing `describe("useUsageTracking", ...)` block, after the existing two tests:

```ts
  it("limits the free signed-in plan to 3 audits", async () => {
    useSubscriptionMock.mockReturnValue({ currentPlan: "Free", subscription: null });
    countAnalysesSinceMock.mockResolvedValue(0);
    const { result } = renderHook(() => useUsageTracking());

    await waitFor(() => {
      expect(result.current.usage.limit).toBe(3);
    });
  });

  it("limits anonymous visitors to 1 free scan before requiring auth", async () => {
    useAuthMock.mockReturnValue({ user: null });
    const { result } = renderHook(() => useUsageTracking());

    await waitFor(() => {
      expect(result.current.usage.limit).toBe(1);
      expect(result.current.usage.requiresAuth).toBe(false);
    });

    await result.current.trackAnalysis("https://example.com", "homepage", "desktop", 72);

    await waitFor(() => {
      expect(result.current.usage.used).toBe(1);
      expect(result.current.usage.requiresAuth).toBe(true);
    });
  });
```

- [ ] **Step 3: Run tests to verify the new ones fail**

Run: `npx vitest run src/hooks/useUsageTracking.test.ts`
Expected: the two new tests FAIL (limit is still 10 and 3 respectively), the two existing tests still PASS.

- [ ] **Step 4: Update the limits in `src/hooks/useUsageTracking.ts`**

Replace:

```ts
const FREE_LIMIT_ANON = 3;

const PLAN_LIMITS: Record<string, number> = {
  free: 10,
```

with:

```ts
const FREE_LIMIT_ANON = 1;

const PLAN_LIMITS: Record<string, number> = {
  free: 3,
```

- [ ] **Step 5: Run tests to verify they all pass**

Run: `npx vitest run src/hooks/useUsageTracking.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useUsageTracking.ts src/hooks/useUsageTracking.test.ts
git commit -m "Lower the anonymous and free-tier scan limits"
```

---

### Task 2: Split-screen AuthPage redesign

**Files:**
- Modify: `src/components/AuthPage.tsx`
- Create: `src/components/AuthPage.test.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: `AuthPageProps` gains `initialMode?: "login" | "signup"` (default `"login"`) — consumed by Task 3's new results-gate call sites in `Index.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/AuthPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  updateProfile: vi.fn(),
  sendEmailVerification: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(() => ({})),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("@/integrations/firebase/client", () => ({ auth: {} }));

import AuthPage from "./AuthPage";

describe("AuthPage", () => {
  it("defaults to login mode when no initialMode is given", () => {
    render(<AuthPage onBack={() => {}} />);
    expect(screen.getByText("Sign in to your account.")).toBeInTheDocument();
  });

  it("starts in signup mode when initialMode is 'signup'", () => {
    render(<AuthPage onBack={() => {}} initialMode="signup" />);
    expect(screen.getByText("Create your account.")).toBeInTheDocument();
  });

  it("renders the right-side preview panel", () => {
    render(<AuthPage onBack={() => {}} />);
    expect(screen.getByTestId("auth-preview-panel")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/AuthPage.test.tsx`
Expected: FAIL — `initialMode` isn't a recognized prop yet (mode still always starts as `"login"`, so the signup test fails) and there is no element with `data-testid="auth-preview-panel"`.

- [ ] **Step 3: Add the `initialMode` prop**

In `src/components/AuthPage.tsx`, replace:

```tsx
interface AuthPageProps {
  onBack: () => void;
  message?: string;
}

const googleProvider = new GoogleAuthProvider();

const AuthPage = ({ onBack, message }: AuthPageProps) => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
```

with:

```tsx
interface AuthPageProps {
  onBack: () => void;
  message?: string;
  initialMode?: "login" | "signup";
}

const googleProvider = new GoogleAuthProvider();

const AuthPage = ({ onBack, message, initialMode = "login" }: AuthPageProps) => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initialMode);
```

- [ ] **Step 4: Replace the layout wrapper with a split-screen layout**

Replace:

```tsx
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-svh items-center justify-center bg-background px-4"
    >
      <div className="w-full max-w-sm">
```

with:

```tsx
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-svh bg-background"
    >
      <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
```

Then, replace the closing of that same wrapper — find:

```tsx
        </>
        )}
      </div>
    </motion.div>
  );
};

export default AuthPage;
```

with:

```tsx
        </>
        )}
      </div>
      </div>

      <div
        data-testid="auth-preview-panel"
        className="hidden md:flex flex-1 items-center justify-center bg-gradient-to-br from-primary to-primary/80 p-10"
      >
        <div className="max-w-sm text-center">
          <p className="text-2xl font-semibold text-primary-foreground font-display mb-8">
            See exactly where visitors drop off.
          </p>
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
        </div>
      </div>
    </motion.div>
  );
};

export default AuthPage;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/AuthPage.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/AuthPage.tsx src/components/AuthPage.test.tsx
git commit -m "Redesign AuthPage into a split-screen layout with an initialMode prop"
```

---

### Task 3: Gate homepage results behind login and record retroactively

**Files:**
- Modify: `src/pages/Index.tsx`
- Create: `src/pages/Index.test.tsx`

**Interfaces:**
- Consumes: `AuthPage` with `initialMode` (Task 2), `createActionItems` (`src/lib/firebase/actionItems.ts`, already exists), existing `trackAnalysis`/`useUsageTracking`/`useAuth`
- Produces: nothing new — this is the top-level page component

- [ ] **Step 1: Write the failing tests**

Create `src/pages/Index.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

let mockUser: { uid: string } | null = null;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, signOut: vi.fn(), loading: false }),
}));

const trackAnalysisMock = vi.fn();
const usageMock = { used: 0, limit: 1, canAnalyze: true, requiresAuth: false, requiresPaid: false, periodStart: null, periodEnd: null };

vi.mock("@/hooks/useUsageTracking", () => ({
  useUsageTracking: () => ({ usage: usageMock, trackAnalysis: (...args: unknown[]) => trackAnalysisMock(...args) }),
}));

const analyzeUrlMock = vi.fn();
vi.mock("@/lib/api/analyze", () => ({
  analyzeUrl: (...args: unknown[]) => analyzeUrlMock(...args),
}));

const createActionItemsMock = vi.fn();
vi.mock("@/lib/firebase/actionItems", () => ({
  createActionItems: (...args: unknown[]) => createActionItemsMock(...args),
}));

vi.mock("@/components/LandingView", () => ({
  default: ({ onAnalyze }: { onAnalyze: (url: string, type?: string, device?: string) => void }) => (
    <div>
      <button onClick={() => onAnalyze("example.com", "homepage", "desktop")}>Analyze</button>
      <button onClick={() => onAnalyze("example.com", "homepage", "both")}>Analyze Both</button>
    </div>
  ),
}));

vi.mock("@/components/AnalysisView", () => ({
  default: ({ result }: { result: { url: string } }) => <div data-testid="analysis-view">{result.url}</div>,
}));

vi.mock("@/components/ComparisonView", () => ({
  default: () => <div data-testid="comparison-view" />,
}));

vi.mock("@/components/AuthPage", () => ({
  default: ({ message }: { message?: string }) => <div data-testid="auth-page">{message}</div>,
}));

vi.mock("@/components/UpgradeWall", () => ({
  default: () => <div data-testid="upgrade-wall" />,
}));

import Index from "./Index";

const mockAnalysisResult = {
  url: "https://example.com",
  analysisType: "homepage",
  device: "desktop",
  conversionScore: 72,
  benchmark: { overallScore: 72 },
  frictionPoints: [{ category: "ux-clarity", severity: "high", title: "Issue", description: "d", fix: "f", impactScore: 80 }],
};

describe("Index — login-gated results", () => {
  beforeEach(() => {
    mockUser = null;
    trackAnalysisMock.mockReset().mockResolvedValue(undefined);
    analyzeUrlMock.mockReset();
    createActionItemsMock.mockReset().mockResolvedValue(undefined);
    usageMock.requiresAuth = false;
    usageMock.requiresPaid = false;
  });

  it("shows the sign-in gate instead of the report when an anonymous scan completes", async () => {
    analyzeUrlMock.mockResolvedValue(mockAnalysisResult);

    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Analyze"));

    await waitFor(() => {
      expect(screen.getByTestId("auth-page")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("analysis-view")).not.toBeInTheDocument();
    expect(createActionItemsMock).not.toHaveBeenCalled();
  });

  it("reveals the held result and saves it retroactively once the visitor logs in", async () => {
    analyzeUrlMock.mockResolvedValue(mockAnalysisResult);

    const { rerender } = render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Analyze"));

    await waitFor(() => {
      expect(screen.getByTestId("auth-page")).toBeInTheDocument();
    });

    mockUser = { uid: "uid-1" };
    rerender(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("analysis-view")).toBeInTheDocument();
    });
    expect(trackAnalysisMock).toHaveBeenCalledWith("https://example.com", "homepage", "desktop", 72);
    expect(createActionItemsMock).toHaveBeenCalledWith("uid-1", "https://example.com", "homepage", mockAnalysisResult.frictionPoints);
  });

  it("shows the report directly when already signed in at scan time", async () => {
    mockUser = { uid: "uid-1" };
    analyzeUrlMock.mockResolvedValue(mockAnalysisResult);

    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Analyze"));

    await waitFor(() => {
      expect(screen.getByTestId("analysis-view")).toBeInTheDocument();
    });
    expect(trackAnalysisMock).toHaveBeenCalledTimes(1);
    expect(createActionItemsMock).toHaveBeenCalledTimes(1);
  });

  it("gates the comparison view behind login too", async () => {
    analyzeUrlMock.mockResolvedValue(mockAnalysisResult);

    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Analyze Both"));

    await waitFor(() => {
      expect(screen.getByTestId("auth-page")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("comparison-view")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/Index.test.tsx`
Expected: FAIL — `Index` currently renders `AnalysisView`/`ComparisonView` directly regardless of `user`, so the gate tests fail (no `auth-page` testid appears), and the retroactive-save test fails (`trackAnalysisMock`/`createActionItemsMock` aren't called a second time after login).

- [ ] **Step 3: Rewrite `src/pages/Index.tsx`**

Replace the entire file with:

```tsx
import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import LandingView from "@/components/LandingView";
import AnalysisView from "@/components/AnalysisView";
import ComparisonView from "@/components/ComparisonView";
import AuthPage from "@/components/AuthPage";
import UpgradeWall from "@/components/UpgradeWall";
import { generateMockAnalysis, type AnalysisResult, type AnalysisType } from "@/lib/mockData";
import { analyzeUrl } from "@/lib/api/analyze";
import { useAuth } from "@/hooks/useAuth";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { createActionItems } from "@/lib/firebase/actionItems";
import { toast } from "sonner";

const Index = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { usage, trackAnalysis } = useUsageTracking();
  const location = useLocation();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [comparisonResults, setComparisonResults] = useState<{ desktop: AnalysisResult; mobile: AnalysisResult } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [showUpgradeWall, setShowUpgradeWall] = useState(false);
  const recordedResultRef = useRef<AnalysisResult | null>(null);

  useEffect(() => {
    if (location.state?.analysisResult) {
      setResult(location.state.analysisResult);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const pending = result ?? comparisonResults?.desktop ?? null;
    if (!user || !pending || recordedResultRef.current === pending) return;
    recordedResultRef.current = pending;
    (async () => {
      await trackAnalysis(pending.url, pending.analysisType, pending.device, pending.conversionScore ?? pending.benchmark.overallScore);
      await createActionItems(user.uid, pending.url, pending.analysisType, pending.frictionPoints);
    })();
  }, [user, result, comparisonResults, trackAnalysis]);

  const handleAnalyze = useCallback(async (url: string, type: AnalysisType = "homepage", device: "desktop" | "mobile" | "both" = "desktop") => {
    if (usage.requiresAuth) {
      setAuthMessage("You've used your free scan. Create an account to keep going!");
      setShowAuth(true);
      return;
    }
    if (usage.requiresPaid) {
      setShowUpgradeWall(true);
      return;
    }

    let formatted = url;
    if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
      formatted = `https://${formatted}`;
    }
    setIsAnalyzing(true);
    setResult(null);
    setComparisonResults(null);

    if (device === "both") {
      setProgress("Analyzing desktop & mobile experiences…");
      try {
        const [desktopData, mobileData] = await Promise.all([
          analyzeUrl(formatted, type, "desktop"),
          analyzeUrl(formatted, type, "mobile"),
        ]);
        setComparisonResults({ desktop: desktopData, mobile: mobileData });
        if (user) recordedResultRef.current = desktopData;
        await trackAnalysis(formatted, type, "desktop", desktopData.conversionScore ?? desktopData.benchmark.overallScore);
        if (user) await createActionItems(user.uid, formatted, type, desktopData.frictionPoints);
        toast.success(`Found ${desktopData.frictionPoints.length} desktop + ${mobileData.frictionPoints.length} mobile friction points`);
      } catch (err) {
        console.error("Comparison analysis failed, falling back to mock:", err);
        toast.warning("Live analysis unavailable — showing demo results");
        const mockDesktop = generateMockAnalysis(formatted, type);
        const mockMobile = { ...generateMockAnalysis(formatted, type), device: "mobile" as const };
        setComparisonResults({ desktop: mockDesktop, mobile: mockMobile });
        if (user) recordedResultRef.current = mockDesktop;
        await trackAnalysis(formatted, type, "desktop", mockDesktop.conversionScore ?? mockDesktop.benchmark.overallScore);
        if (user) await createActionItems(user.uid, formatted, type, mockDesktop.frictionPoints);
      }
    } else {
      setProgress(`Analyzing ${device} experience…`);
      try {
        setProgress(`Analyzing ${device} view for conversion friction…`);
        const data = await analyzeUrl(formatted, type, device);
        setResult(data);
        if (user) recordedResultRef.current = data;
        await trackAnalysis(formatted, type, device, data.conversionScore ?? data.benchmark.overallScore);
        if (user) await createActionItems(user.uid, formatted, type, data.frictionPoints);
        toast.success(`Found ${data.frictionPoints.length} friction points (${device})`);
      } catch (err) {
        console.error("Real analysis failed, falling back to mock:", err);
        toast.warning("Live analysis unavailable — showing demo results", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
        const mockResult = generateMockAnalysis(formatted, type);
        setResult(mockResult);
        if (user) recordedResultRef.current = mockResult;
        await trackAnalysis(formatted, type, device, mockResult.conversionScore ?? mockResult.benchmark.overallScore);
        if (user) await createActionItems(user.uid, formatted, type, mockResult.frictionPoints);
      }
    }

    setIsAnalyzing(false);
    setProgress("");
  }, [usage, trackAnalysis, user]);

  const goHome = () => {
    setResult(null);
    setComparisonResults(null);
  };

  const openSignIn = () => {
    setAuthMessage("");
    setShowAuth(true);
  };

  if (showAuth && !user) {
    return <AuthPage onBack={() => setShowAuth(false)} message={authMessage} />;
  }

  if (comparisonResults && !isAnalyzing) {
    if (!user) {
      return (
        <AuthPage
          onBack={goHome}
          message="Your results are ready — sign in to view them."
          initialMode="signup"
        />
      );
    }
    return (
      <ComparisonView
        desktopResult={comparisonResults.desktop}
        mobileResult={comparisonResults.mobile}
        onBack={goHome}
        onGoHome={goHome}
        onSignIn={openSignIn}
      />
    );
  }

  if (result && !isAnalyzing) {
    if (!user) {
      return (
        <AuthPage
          onBack={goHome}
          message="Your results are ready — sign in to view them."
          initialMode="signup"
        />
      );
    }
    return (
      <AnalysisView
        result={result}
        onNewAnalysis={(url) => handleAnalyze(url, result.analysisType, result.device)}
        onGoHome={goHome}
        onSignIn={openSignIn}
      />
    );
  }

  if (isAnalyzing) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-sm font-medium text-foreground mb-2">Analyzing…</h2>
          <div className="w-48 h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full animate-pulse"
              style={{ width: "60%", transition: "width 1s cubic-bezier(0.25, 0.1, 0.25, 1)" }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3 font-mono">{progress}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showUpgradeWall && (
        <UpgradeWall
          used={usage.used}
          limit={usage.limit}
          isAnon={!user}
          onSignIn={() => {
            setShowUpgradeWall(false);
            openSignIn();
          }}
        />
      )}
      <AnimatePresence mode="wait">
        <LandingView
          onAnalyze={handleAnalyze}
          usage={usage}
          user={user}
          onSignIn={openSignIn}
          onSignOut={signOut}
        />
      </AnimatePresence>
    </>
  );
};

export default Index;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pages/Index.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full test suite and type-check**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.app.json
```

Expected: all tests pass, no type errors.

- [ ] **Step 6: Boot-verify with the dev server**

Using the Claude Code preview tooling: navigate to `/`, submit a URL as an anonymous visitor, and confirm the split-screen sign-up screen appears (with the right-side preview panel) instead of a report. Confirm no console errors. A full end-to-end "sign up and see the retroactively-saved result" pass isn't verifiable without real Firebase credentials in this environment, but that path is already covered by Task 3's automated test.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Index.tsx src/pages/Index.test.tsx
git commit -m "Gate homepage scan results behind login with retroactive save on signup"
```

---

## What This Plan Does NOT Cover (by design)

Technical audit page and Bulk Analysis keep today's anonymous-allowed behavior. No changes to scan/scoring logic, Dashboard, or Action Center beyond the retroactive-save call, which reuses existing functions. No new Firestore collections or rules.
