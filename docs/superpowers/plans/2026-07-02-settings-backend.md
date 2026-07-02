# Settings Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make three of Settings' toggles do something real: Weekly Digest and Marketing Emails actually subscribe the signed-in user to the Kit mailing list, and Default Device / Auto-detect Page Type actually change the homepage scan form's behavior.

**Architecture:** A shared `src/lib/userSettings.ts` module becomes the single source of truth for reading/writing the `localStorage`-backed settings (previously duplicated inline in `Settings.tsx`), so `LandingView.tsx` can read the same values. A small `src/lib/api/kit.ts` client posts directly to Kit's public, unauthenticated form-submission endpoint (the same one the embedded signup form on the marketing site posts to) — no API key needed for subscribing.

**Tech Stack:** No new dependencies — plain `fetch` and `localStorage`, matching existing patterns in the codebase.

## Global Constraints

- Kit form endpoint: `https://app.kit.com/forms/9638140/subscriptions` (same form used for the existing public newsletter signup) — both Weekly Digest and Marketing Emails subscribe to this one form.
- Turning a digest/marketing toggle **off** does not unsubscribe anyone — Kit's unsubscribe requires an authenticated API call, which we don't have a key for. Removal happens through the standard unsubscribe link Kit includes in every email it sends. This was an explicit, agreed simplification — don't build a fake "unsubscribe" call.
- Email Notifications and Analysis Alerts stay inert in this pass — there's no real event in the app today to trigger them from (deferred until scheduled/background scans exist).
- Language/report localization is explicitly out of scope for this plan — it's its own separate future project.
- `subscribeToKit` posts as `application/x-www-form-urlencoded` (matching the real HTML form's default submission encoding), not JSON.

---

### Task 1: Shared settings module and Kit client

**Files:**
- Create: `src/lib/userSettings.ts`
- Create: `src/lib/userSettings.test.ts`
- Create: `src/lib/api/kit.ts`
- Create: `src/lib/api/kit.test.ts`

**Interfaces:**
- Produces: `UserSettings` interface, `defaultSettings` constant, `getUserSettings(): UserSettings`, `saveUserSettings(settings: UserSettings): void` — consumed by Task 2 (`Settings.tsx`) and Task 3 (`LandingView.tsx`). `subscribeToKit(email: string): Promise<boolean>` — consumed by Task 2.

- [ ] **Step 1: Write the failing tests for `userSettings`**

Create `src/lib/userSettings.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { getUserSettings, saveUserSettings, defaultSettings } from "./userSettings";

describe("userSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns defaults when nothing is stored", () => {
    expect(getUserSettings()).toEqual(defaultSettings);
  });

  it("returns stored settings merged over defaults", () => {
    localStorage.setItem("genuinecro_settings", JSON.stringify({ defaultDevice: "both" }));
    expect(getUserSettings()).toEqual({ ...defaultSettings, defaultDevice: "both" });
  });

  it("returns defaults when storage is malformed", () => {
    localStorage.setItem("genuinecro_settings", "not json");
    expect(getUserSettings()).toEqual(defaultSettings);
  });

  it("persists settings to localStorage", () => {
    const custom = { ...defaultSettings, weeklyDigest: true };
    saveUserSettings(custom);
    expect(JSON.parse(localStorage.getItem("genuinecro_settings")!)).toEqual(custom);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/userSettings.test.ts`
Expected: FAIL — `Cannot find module './userSettings'`

- [ ] **Step 3: Write `src/lib/userSettings.ts`**

```ts
const SETTINGS_KEY = "genuinecro_settings";

export interface UserSettings {
  emailNotifications: boolean;
  analysisAlerts: boolean;
  weeklyDigest: boolean;
  marketingEmails: boolean;
  defaultDevice: "desktop" | "mobile" | "both";
  autoDetectPageType: boolean;
  language: string;
}

export const defaultSettings: UserSettings = {
  emailNotifications: true,
  analysisAlerts: true,
  weeklyDigest: false,
  marketingEmails: false,
  defaultDevice: "desktop",
  autoDetectPageType: true,
  language: "en",
};

export function getUserSettings(): UserSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
  } catch {
    // ignore malformed storage, fall through to defaults
  }
  return defaultSettings;
}

export function saveUserSettings(settings: UserSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/userSettings.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing tests for `kit`**

Create `src/lib/api/kit.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { subscribeToKit } from "./kit";

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

describe("subscribeToKit", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("posts the email to Kit's public form endpoint and returns true on success", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const result = await subscribeToKit("person@example.com");
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://app.kit.com/forms/9638140/subscriptions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/x-www-form-urlencoded" }),
        body: "email_address=person%40example.com",
      })
    );
  });

  it("returns false when the request fails", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const result = await subscribeToKit("person@example.com");
    expect(result).toBe(false);
  });

  it("returns false when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("network error"));
    const result = await subscribeToKit("person@example.com");
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run src/lib/api/kit.test.ts`
Expected: FAIL — `Cannot find module './kit'`

- [ ] **Step 7: Write `src/lib/api/kit.ts`**

```ts
const KIT_FORM_ENDPOINT = "https://app.kit.com/forms/9638140/subscriptions";

export async function subscribeToKit(email: string): Promise<boolean> {
  try {
    const res = await fetch(KIT_FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ email_address: email }).toString(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/lib/api/kit.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
git add src/lib/userSettings.ts src/lib/userSettings.test.ts src/lib/api/kit.ts src/lib/api/kit.test.ts
git commit -m "Add the shared user settings module and Kit subscribe client"
```

---

### Task 2: Wire Settings to the shared module and Kit

**Files:**
- Modify: `src/pages/Settings.tsx`
- Create: `src/pages/Settings.test.tsx`

**Interfaces:**
- Consumes: `getUserSettings`, `saveUserSettings`, `defaultSettings`, `UserSettings` (Task 1, from `@/lib/userSettings`), `subscribeToKit` (Task 1, from `@/lib/api/kit`)
- Produces: nothing new

- [ ] **Step 1: Write the failing tests**

Create `src/pages/Settings.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const subscribeToKitMock = vi.fn();

vi.mock("@/lib/api/kit", () => ({
  subscribeToKit: (...args: unknown[]) => subscribeToKitMock(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1", email: "person@example.com" } }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Free", subscription: null }),
}));

import Settings from "./Settings";

describe("Settings", () => {
  beforeEach(() => {
    localStorage.clear();
    subscribeToKitMock.mockReset().mockResolvedValue(true);
  });

  it("subscribes to Kit when Weekly Digest is turned on and saved", async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("switch", { name: "Weekly Digest" }));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(subscribeToKitMock).toHaveBeenCalledWith("person@example.com");
    });
  });

  it("does not call Kit when saving with both digest toggles off", async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("switch", { name: "Auto-detect Page Type" }));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.queryByText("Save")).not.toBeInTheDocument();
    });
    expect(subscribeToKitMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/Settings.test.tsx`
Expected: FAIL — the switches have no accessible names yet (`getByRole("switch", { name: ... })` won't find them), and `subscribeToKit` is never called.

- [ ] **Step 3: Add `aria-label` to the five Settings switches**

In `src/pages/Settings.tsx`, add an `aria-label` matching each switch's adjacent `<Label>` text. Replace each of these five blocks:

```tsx
              <Switch
                checked={settings.emailNotifications}
                onCheckedChange={(v) => update("emailNotifications", v)}
              />
```

with:

```tsx
              <Switch
                aria-label="Email Notifications"
                checked={settings.emailNotifications}
                onCheckedChange={(v) => update("emailNotifications", v)}
              />
```

```tsx
              <Switch
                checked={settings.analysisAlerts}
                onCheckedChange={(v) => update("analysisAlerts", v)}
              />
```

with:

```tsx
              <Switch
                aria-label="Analysis Alerts"
                checked={settings.analysisAlerts}
                onCheckedChange={(v) => update("analysisAlerts", v)}
              />
```

```tsx
              <Switch
                checked={settings.weeklyDigest}
                onCheckedChange={(v) => update("weeklyDigest", v)}
              />
```

with:

```tsx
              <Switch
                aria-label="Weekly Digest"
                checked={settings.weeklyDigest}
                onCheckedChange={(v) => update("weeklyDigest", v)}
              />
```

```tsx
              <Switch
                checked={settings.marketingEmails}
                onCheckedChange={(v) => update("marketingEmails", v)}
              />
```

with:

```tsx
              <Switch
                aria-label="Marketing Emails"
                checked={settings.marketingEmails}
                onCheckedChange={(v) => update("marketingEmails", v)}
              />
```

```tsx
              <Switch
                checked={settings.autoDetectPageType}
                onCheckedChange={(v) => update("autoDetectPageType", v)}
              />
```

with:

```tsx
              <Switch
                aria-label="Auto-detect Page Type"
                checked={settings.autoDetectPageType}
                onCheckedChange={(v) => update("autoDetectPageType", v)}
              />
```

- [ ] **Step 4: Replace the inline settings storage with the shared module, and subscribe to Kit on save**

Replace:

```tsx
import { useState, useEffect } from "react";
import { Bell, BellOff, Mail, MailX, Palette, Globe, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { toast } from "sonner";

const SETTINGS_KEY = "genuinecro_settings";

interface UserSettings {
  emailNotifications: boolean;
  analysisAlerts: boolean;
  weeklyDigest: boolean;
  marketingEmails: boolean;
  defaultDevice: "desktop" | "mobile" | "both";
  autoDetectPageType: boolean;
  language: string;
}

const defaultSettings: UserSettings = {
  emailNotifications: true,
  analysisAlerts: true,
  weeklyDigest: false,
  marketingEmails: false,
  defaultDevice: "desktop",
  autoDetectPageType: true,
  language: "en",
};

const Settings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) setSettings(JSON.parse(stored));
    } catch {}
  }, []);

  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      setSaving(false);
      setDirty(false);
      toast.success("Settings saved");
    }, 400);
  };
```

with:

```tsx
import { useState, useEffect } from "react";
import { Bell, BellOff, Mail, MailX, Palette, Globe, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { getUserSettings, saveUserSettings, defaultSettings, type UserSettings } from "@/lib/userSettings";
import { subscribeToKit } from "@/lib/api/kit";
import { toast } from "sonner";

const Settings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSettings(getUserSettings());
  }, []);

  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    saveUserSettings(settings);
    if ((settings.weeklyDigest || settings.marketingEmails) && user?.email) {
      await subscribeToKit(user.email);
    }
    setSaving(false);
    setDirty(false);
    toast.success("Settings saved");
  };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/pages/Settings.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/pages/Settings.tsx src/pages/Settings.test.tsx
git commit -m "Wire Settings to the shared settings module and subscribe to Kit on save"
```

---

### Task 3: Wire the homepage scan form to saved settings

**Files:**
- Modify: `src/components/LandingView.tsx`
- Create: `src/components/LandingView.test.tsx`

**Interfaces:**
- Consumes: `getUserSettings` (Task 1, from `@/lib/userSettings`)
- Produces: nothing new

- [ ] **Step 1: Write the failing tests**

Create `src/components/LandingView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getUserSettingsMock = vi.fn();

vi.mock("@/lib/userSettings", () => ({
  getUserSettings: (...args: unknown[]) => getUserSettingsMock(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, signOut: vi.fn(), loading: false }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Free", subscription: null }),
}));

vi.mock("@/hooks/usePlanCapabilities", () => ({
  usePlanCapabilities: () => ({ canMobileAnalysis: true, canComparisonAnalysis: true }),
  getUpgradeMessage: () => ({ title: "", description: "" }),
}));

import LandingView from "./LandingView";

const usage = { used: 0, limit: 1, canAnalyze: true, requiresAuth: false, requiresPaid: false };

describe("LandingView", () => {
  beforeEach(() => {
    getUserSettingsMock.mockReset().mockReturnValue({
      emailNotifications: true,
      analysisAlerts: true,
      weeklyDigest: false,
      marketingEmails: false,
      defaultDevice: "desktop",
      autoDetectPageType: true,
      language: "en",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with the device from saved settings", () => {
    getUserSettingsMock.mockReturnValue({
      emailNotifications: true,
      analysisAlerts: true,
      weeklyDigest: false,
      marketingEmails: false,
      defaultDevice: "both",
      autoDetectPageType: true,
      language: "en",
    });

    render(
      <MemoryRouter>
        <LandingView onAnalyze={vi.fn()} usage={usage} user={null} onSignIn={vi.fn()} />
      </MemoryRouter>
    );

    const compareButton = screen.getByText("Compare").closest("button");
    expect(compareButton).toHaveClass("bg-background");
  });

  it("does not auto-detect the page type when autoDetectPageType is off", () => {
    vi.useFakeTimers();
    getUserSettingsMock.mockReturnValue({
      emailNotifications: true,
      analysisAlerts: true,
      weeklyDigest: false,
      marketingEmails: false,
      defaultDevice: "desktop",
      autoDetectPageType: false,
      language: "en",
    });

    render(
      <MemoryRouter>
        <LandingView onAnalyze={vi.fn()} usage={usage} user={null} onSignIn={vi.fn()} />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("https://example.com"), { target: { value: "https://example.com/checkout" } });
    vi.advanceTimersByTime(600);

    expect(screen.getByText(/Navigation clarity/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/LandingView.test.tsx`
Expected: FAIL — `device` always starts at `"desktop"` regardless of settings, and the auto-detect effect always runs regardless of `autoDetectPageType`.

- [ ] **Step 3: Wire `src/components/LandingView.tsx` to `getUserSettings`**

Replace:

```tsx
import { usePlanCapabilities, getUpgradeMessage } from "@/hooks/usePlanCapabilities";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
```

with:

```tsx
import { usePlanCapabilities, getUpgradeMessage } from "@/hooks/usePlanCapabilities";
import { getUserSettings } from "@/lib/userSettings";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
```

Replace:

```tsx
  const [url, setUrl] = useState("");
  const [analysisType, setAnalysisType] = useState<AnalysisType>("homepage");
  const [device, setDevice] = useState<"desktop" | "mobile" | "both">("desktop");
  const [userOverridden, setUserOverridden] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const capabilities = usePlanCapabilities();
  const navigate = useNavigate();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!url.trim()) return;
    if (userOverridden) return;
    debounceRef.current = setTimeout(() => {
      const detected = detectPageType(url.trim());
      setAnalysisType(detected);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [url, userOverridden]);
```

with:

```tsx
  const [url, setUrl] = useState("");
  const [analysisType, setAnalysisType] = useState<AnalysisType>("homepage");
  const [device, setDevice] = useState<"desktop" | "mobile" | "both">(() => getUserSettings().defaultDevice);
  const [userOverridden, setUserOverridden] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const capabilities = usePlanCapabilities();
  const navigate = useNavigate();

  useEffect(() => {
    if (!getUserSettings().autoDetectPageType) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!url.trim()) return;
    if (userOverridden) return;
    debounceRef.current = setTimeout(() => {
      const detected = detectPageType(url.trim());
      setAnalysisType(detected);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [url, userOverridden]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/LandingView.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full test suite and a type-check**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.app.json
```

Expected: all tests pass, no type errors.

- [ ] **Step 6: Boot-verify with the dev server**

Using the Claude Code preview tooling: go to `/settings`, change Default Device to "Compare" and Auto-detect Page Type off, save, then navigate to `/`. Confirm the device toggle shows "Compare" selected by default and that typing a checkout-style URL doesn't auto-switch the page type dropdown away from "Homepage". A real Kit subscription can't be verified end-to-end in this environment (no real network access to Kit, and a live test would actually subscribe a real address to your list) — flag this as needing the user's own live test.

- [ ] **Step 7: Commit**

```bash
git add src/components/LandingView.tsx src/components/LandingView.test.tsx
git commit -m "Make Default Device and Auto-detect Page Type settings actually take effect"
```

---

## What This Plan Does NOT Cover (by design)

Email Notifications and Analysis Alerts stay inert (no real trigger point exists yet). Kit unsubscribe on toggle-off is not implemented (relies on Kit's own email footer link). Language/report localization is out of scope — its own future project.
