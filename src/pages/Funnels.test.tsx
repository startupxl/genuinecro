import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const createFunnelMock = vi.fn();
const getFunnelsMock = vi.fn();
const deleteFunnelMock = vi.fn();
const createFunnelRunMock = vi.fn();
const getFunnelRunsMock = vi.fn();
const runMergedAuditMock = vi.fn();
const trackAnalysisMock = vi.fn();
const createActionItemsMock = vi.fn();
const analyzeFunnelMock = vi.fn();
const getGA4PageMetricsMock = vi.fn();

const getIdTokenMock = vi.fn().mockResolvedValue("id-token-abc");
const mockUser = { uid: "uid-1", getIdToken: getIdTokenMock };
let mockCanFunnels = true;
let mockCanGA4 = false;
let mockCapabilitiesLoading = false;
let mockUsage = { used: 0, limit: 250, canAnalyze: true, requiresAuth: false, requiresPaid: false, periodStart: null, periodEnd: null };

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, profile: null, signOut: vi.fn() }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Pro", subscription: null }),
}));

vi.mock("@/hooks/usePlanCapabilities", () => ({
  usePlanCapabilities: () => ({ canFunnelAnalysis: mockCanFunnels, canGA4Integration: mockCanGA4, isLoading: mockCapabilitiesLoading }),
  getUpgradeMessage: () => ({
    title: "Funnel diagnostics requires Pro plan",
    description: "Upgrade to Pro.",
    requiredPlan: "Pro",
  }),
}));

vi.mock("@/lib/api/ga4", () => ({
  getGA4PageMetrics: (...args: unknown[]) => getGA4PageMetricsMock(...args),
}));

vi.mock("@/hooks/useUsageTracking", () => ({
  useUsageTracking: () => ({ usage: mockUsage, trackAnalysis: (...args: unknown[]) => trackAnalysisMock(...args) }),
}));

vi.mock("@/lib/firebase/funnels", () => ({
  createFunnel: (...args: unknown[]) => createFunnelMock(...args),
  getFunnels: (...args: unknown[]) => getFunnelsMock(...args),
  deleteFunnel: (...args: unknown[]) => deleteFunnelMock(...args),
  createFunnelRun: (...args: unknown[]) => createFunnelRunMock(...args),
  getFunnelRuns: (...args: unknown[]) => getFunnelRunsMock(...args),
}));

vi.mock("@/lib/mergedAudit", () => ({
  runMergedAudit: (...args: unknown[]) => runMergedAuditMock(...args),
}));

vi.mock("@/lib/firebase/actionItems", () => ({
  createActionItems: (...args: unknown[]) => createActionItemsMock(...args),
}));

vi.mock("@/lib/api/funnelInsights", () => ({
  analyzeFunnel: (...args: unknown[]) => analyzeFunnelMock(...args),
}));

import Funnels from "./Funnels";

function renderPage() {
  return render(
    <MemoryRouter>
      <Funnels />
    </MemoryRouter>
  );
}

const savedFunnel = {
  id: "funnel-1",
  userId: "uid-1",
  name: "Signup funnel",
  steps: [
    { label: "Landing", url: "https://example.com" },
    { label: "Checkout", url: "https://example.com/checkout" },
  ],
  createdAt: "2026-07-01T00:00:00.000Z",
};

function auditResultFor(score: number) {
  return {
    url: "https://example.com",
    analysisType: "homepage",
    device: "desktop",
    conversionScore: score,
    technicalScore: null,
    benchmark: { overallScore: score, industryAvg: 55, topQuartile: 78, categoryScores: {} },
    frictionPoints: [
      { category: "cta-effectiveness", severity: "high", title: "Weak CTA", description: "d", fix: "f", impactScore: 90 },
      { category: "performance", severity: "med", title: "Slow load", description: "d", fix: "f", impactScore: 60 },
    ],
    conversionGoal: null,
  };
}

describe("Funnels", () => {
  beforeEach(() => {
    createFunnelMock.mockReset();
    getFunnelsMock.mockReset().mockResolvedValue([]);
    deleteFunnelMock.mockReset();
    createFunnelRunMock.mockReset().mockResolvedValue("run-1");
    getFunnelRunsMock.mockReset().mockResolvedValue([]);
    runMergedAuditMock.mockReset();
    trackAnalysisMock.mockReset().mockResolvedValue("analysis-1");
    createActionItemsMock.mockReset().mockResolvedValue(undefined);
    analyzeFunnelMock.mockReset();
    getGA4PageMetricsMock.mockReset();
    mockCanFunnels = true;
    mockCanGA4 = false;
    mockCapabilitiesLoading = false;
    mockUsage = { used: 0, limit: 250, canAnalyze: true, requiresAuth: false, requiresPaid: false, periodStart: null, periodEnd: null };
  });

  it("shows an upgrade message instead of the funnel builder on a plan without funnel access", async () => {
    mockCanFunnels = false;
    renderPage();

    expect(screen.getByText(/Funnel diagnostics requires Pro plan/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New Funnel/i })).not.toBeInTheDocument();
  });

  it("does not flash the upgrade message while the real plan is still loading", async () => {
    mockCanFunnels = false;
    mockCapabilitiesLoading = true;
    renderPage();

    expect(screen.queryByText(/Funnel diagnostics requires Pro plan/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New Funnel/i })).not.toBeInTheDocument();
  });

  it("creates a funnel from the builder with the entered name and steps", async () => {
    createFunnelMock.mockResolvedValue("funnel-1");
    renderPage();
    await waitFor(() => expect(getFunnelsMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /New Funnel/i }));
    fireEvent.change(screen.getByPlaceholderText(/e.g. Signup funnel/i), { target: { value: "Signup funnel" } });

    const labelInputs = screen.getAllByPlaceholderText(/Step label/i);
    const urlInputs = screen.getAllByPlaceholderText(/https:\/\//i);
    fireEvent.change(labelInputs[0], { target: { value: "Landing" } });
    fireEvent.change(urlInputs[0], { target: { value: "example.com" } });
    fireEvent.change(labelInputs[1], { target: { value: "Checkout" } });
    fireEvent.change(urlInputs[1], { target: { value: "example.com/checkout" } });

    fireEvent.click(screen.getByRole("button", { name: /Create Funnel/i }));

    await waitFor(() => {
      expect(createFunnelMock).toHaveBeenCalledWith("uid-1", "Signup funnel", [
        { label: "Landing", url: "https://example.com" },
        { label: "Checkout", url: "https://example.com/checkout" },
      ]);
    });
  });

  it("runs every step in order, saves the run, and renders scores plus funnel insights", async () => {
    getFunnelsMock.mockResolvedValue([savedFunnel]);
    runMergedAuditMock
      .mockResolvedValueOnce(auditResultFor(72))
      .mockResolvedValueOnce(auditResultFor(55));
    analyzeFunnelMock.mockResolvedValue({
      weakestStepIndex: 1,
      summary: "Checkout leaks the most buyers.",
      transitionIssues: ["Trial promise broken at checkout"],
      recommendations: ["Cut form fields"],
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Signup funnel")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Run analysis/i }));

    await waitFor(() => {
      expect(screen.getByText("Checkout leaks the most buyers.")).toBeInTheDocument();
    });

    expect(runMergedAuditMock).toHaveBeenNthCalledWith(1, "https://example.com", expect.any(String), "desktop", null, undefined);
    expect(runMergedAuditMock).toHaveBeenNthCalledWith(2, "https://example.com/checkout", expect.any(String), "desktop", null, undefined);
    expect(trackAnalysisMock).toHaveBeenCalledTimes(2);
    expect(createActionItemsMock).toHaveBeenCalledTimes(2);
    expect(analyzeFunnelMock).toHaveBeenCalledWith([
      expect.objectContaining({ label: "Landing", score: 72, topIssues: ["Weak CTA", "Slow load"] }),
      expect.objectContaining({ label: "Checkout", score: 55 }),
    ]);
    expect(createFunnelRunMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "uid-1", funnelId: "funnel-1", insights: expect.objectContaining({ weakestStepIndex: 1 }) })
    );
    expect(screen.getByText(/Trial promise broken at checkout/)).toBeInTheDocument();
    expect(screen.getByText(/Weakest step/i)).toBeInTheDocument();
  });

  it("fetches real GA4 behavioral data per step during a run, when the plan includes GA4 integration", async () => {
    mockCanGA4 = true;
    getFunnelsMock.mockResolvedValue([savedFunnel]);
    runMergedAuditMock
      .mockResolvedValueOnce(auditResultFor(72))
      .mockResolvedValueOnce(auditResultFor(55));
    getGA4PageMetricsMock
      .mockResolvedValueOnce({
        tagDetection: { hasGA4Tag: true, measurementId: "G-A", hasGTM: false, gtmContainerId: null },
        connected: true,
        propertyDisplayName: "Acme Site",
        behavioral: { hasData: true, sessions: 200, bounceRate: 30, engagementRate: 70, avgEngagementTimeSeconds: 40, conversions: 10, pageViews: 250 },
        conversionEventNames: ["purchase"],
      })
      .mockResolvedValueOnce({
        tagDetection: { hasGA4Tag: true, measurementId: "G-A", hasGTM: false, gtmContainerId: null },
        connected: true,
        propertyDisplayName: "Acme Site",
        behavioral: { hasData: true, sessions: 90, bounceRate: 65, engagementRate: 35, avgEngagementTimeSeconds: 15, conversions: 1, pageViews: 95 },
        conversionEventNames: ["purchase"],
      });
    analyzeFunnelMock.mockResolvedValue({
      weakestStepIndex: 1,
      summary: "Checkout leaks the most buyers.",
      transitionIssues: [],
      recommendations: [],
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Signup funnel")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Run analysis/i }));

    await waitFor(() => expect(screen.getByText("Checkout leaks the most buyers.")).toBeInTheDocument());

    expect(getGA4PageMetricsMock).toHaveBeenCalledWith(mockUser, "https://example.com");
    expect(getGA4PageMetricsMock).toHaveBeenCalledWith(mockUser, "https://example.com/checkout");
    expect(createFunnelRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: [
          expect.objectContaining({ ga4: { bounceRate: 30, engagementRate: 70, sessions: 200 } }),
          expect.objectContaining({ ga4: { bounceRate: 65, engagementRate: 35, sessions: 90 } }),
        ],
      })
    );
    expect(screen.getByText(/30% bounce/)).toBeInTheDocument();
    expect(screen.getByText(/65% bounce/)).toBeInTheDocument();

    // The AI insights call must also see the real GA4 numbers, not just the score/topIssues —
    // that's what lets it ground the funnel verdict in real behavior instead of guessing.
    expect(analyzeFunnelMock).toHaveBeenCalledWith([
      expect.objectContaining({ label: "Landing", ga4: { bounceRate: 30, engagementRate: 70, sessions: 200 } }),
      expect.objectContaining({ label: "Checkout", ga4: { bounceRate: 65, engagementRate: 35, sessions: 90 } }),
    ]);
  });

  it("does not fetch GA4 data during a run when the plan lacks GA4 integration", async () => {
    getFunnelsMock.mockResolvedValue([savedFunnel]);
    runMergedAuditMock
      .mockResolvedValueOnce(auditResultFor(72))
      .mockResolvedValueOnce(auditResultFor(55));

    renderPage();
    await waitFor(() => expect(screen.getByText("Signup funnel")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Run analysis/i }));

    await waitFor(() => expect(createFunnelRunMock).toHaveBeenCalled());
    expect(getGA4PageMetricsMock).not.toHaveBeenCalled();
  });

  it("blocks a run when the remaining quota can't cover every step", async () => {
    mockUsage = { ...mockUsage, used: 249, limit: 250 };
    getFunnelsMock.mockResolvedValue([savedFunnel]);
    renderPage();
    await waitFor(() => expect(screen.getByText("Signup funnel")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Run analysis/i }));

    expect(runMergedAuditMock).not.toHaveBeenCalled();
  });

  it("shows the latest saved run's results on load", async () => {
    getFunnelsMock.mockResolvedValue([savedFunnel]);
    getFunnelRunsMock.mockResolvedValue([
      {
        id: "run-1",
        userId: "uid-1",
        funnelId: "funnel-1",
        steps: [
          { label: "Landing", url: "https://example.com", score: 72, analysisId: "a1", topIssues: [] },
          { label: "Checkout", url: "https://example.com/checkout", score: 55, analysisId: "a2", topIssues: [] },
        ],
        insights: { weakestStepIndex: 1, summary: "Past run summary.", transitionIssues: [], recommendations: [] },
        createdAt: "2026-07-06T00:00:00.000Z",
      },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Past run summary.")).toBeInTheDocument();
    });
    const funnelCard = screen.getByText("Signup funnel").closest("div[data-testid='funnel-card']") as HTMLElement;
    expect(within(funnelCard).getByText("72")).toBeInTheDocument();
    expect(within(funnelCard).getByText("55")).toBeInTheDocument();
  });
});
