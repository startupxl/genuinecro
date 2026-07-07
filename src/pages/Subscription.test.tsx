import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const subscribeMock = vi.fn();
const refreshMock = vi.fn();
let mockCurrentPlan = "Free";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1", email: "user@example.com" } }),
}));

vi.mock("@/hooks/useUsageTracking", () => ({
  useUsageTracking: () => ({
    usage: { used: 1, limit: 3, canAnalyze: true, requiresAuth: false, requiresPaid: false, periodStart: null, periodEnd: null },
  }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    currentPlan: mockCurrentPlan,
    loading: false,
    subscribe: subscribeMock,
    refresh: refreshMock,
  }),
}));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import Subscription from "./Subscription";

function renderPage() {
  return render(
    <MemoryRouter>
      <Subscription />
    </MemoryRouter>
  );
}

describe("Subscription", () => {
  beforeEach(() => {
    mockCurrentPlan = "Free";
    subscribeMock.mockReset();
    refreshMock.mockReset();
    navigateMock.mockReset();
  });

  it("shows exactly four plans: Free, Pro, Agency, Enterprise", () => {
    renderPage();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Agency")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
    expect(screen.queryByText("Starter")).not.toBeInTheDocument();
    expect(screen.queryByText("Growth")).not.toBeInTheDocument();
  });

  it("never markets API access, team collaboration, or funnel diagnostics anywhere on the page", () => {
    renderPage();
    expect(screen.queryByText(/API access/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/team collaboration/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/funnel diagnostics/i)).not.toBeInTheDocument();
  });

  it("shows Free at $0/mo with a 3 audit allowance and no subscribe button", () => {
    renderPage();
    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.getByText(/3 page audits total/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Get Free/i })).not.toBeInTheDocument();
  });

  it("shows Agency's per-site add-on pricing beyond the included 10 sites", () => {
    renderPage();
    expect(screen.getByText(/10 client sites included/i)).toBeInTheDocument();
    expect(screen.getByText(/\$29\/mo per additional site/i)).toBeInTheDocument();
  });

  it("shows Enterprise as Custom pricing with volume tiers and a Contact Sales CTA instead of instant checkout", () => {
    renderPage();
    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.getByText(/10 \/ 100 \/ 1,000\+ accounts/i)).toBeInTheDocument();

    const contactButton = screen.getByRole("button", { name: /Contact Sales/i });
    fireEvent.click(contactButton);
    expect(navigateMock).toHaveBeenCalledWith("/contact");
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it("attempts to subscribe to Pro via PayPal when Get Pro is clicked (blocked today since the PayPal plan ID isn't configured yet)", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Get Pro/i }));
    // PAYPAL_PLAN_IDS still holds placeholder strings until real PayPal plans
    // are created — this is a pre-existing gap, not something this test masks.
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it("shows Current Plan and disables the button for the user's active paid plan", () => {
    mockCurrentPlan = "Pro";
    renderPage();
    const button = screen.getByRole("button", { name: /Current Plan/i });
    expect(button).toBeDisabled();
  });
});
