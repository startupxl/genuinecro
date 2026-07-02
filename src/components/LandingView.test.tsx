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
