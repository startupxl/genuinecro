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

  it("shows the page type as an auto-detected label, not an open dropdown, by default", () => {
    render(
      <MemoryRouter>
        <LandingView onAnalyze={vi.fn()} usage={usage} user={null} onSignIn={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Homepage")).toBeInTheDocument();
    expect(screen.getByText("Auto-detected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
  });

  it("reveals the type dropdown when Change is clicked, and lets the user pick a type", () => {
    render(
      <MemoryRouter>
        <LandingView onAnalyze={vi.fn()} usage={usage} user={null} onSignIn={vi.fn()} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "checkout" } });

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Checkout")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });

  it("shows a big headline instead of repeating the logo, since the sidebar already shows it", () => {
    render(
      <MemoryRouter>
        <LandingView onAnalyze={vi.fn()} usage={usage} user={null} onSignIn={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getAllByAltText("GenuineCRO")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Conversion Friction Checker" })).toBeInTheDocument();
  });

  it("does not make unverified claims like a specific scan duration", () => {
    render(
      <MemoryRouter>
        <LandingView onAnalyze={vi.fn()} usage={usage} user={null} onSignIn={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.queryByText(/seconds/i)).not.toBeInTheDocument();
  });
});
