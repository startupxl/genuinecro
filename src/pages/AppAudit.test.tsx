import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockUser = { uid: "uid-1" };
let mockCanAppAudit = true;
let mockCapabilitiesLoading = false;
let mockUsage = { used: 0, limit: 250, canAnalyze: true, requiresAuth: false, requiresPaid: false, periodStart: null, periodEnd: null };

const trackAnalysisMock = vi.fn();
const createActionItemsMock = vi.fn();
const analyzeAppScreenMock = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, profile: null, signOut: vi.fn() }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Pro", subscription: null }),
}));

vi.mock("@/hooks/usePlanCapabilities", () => ({
  usePlanCapabilities: () => ({ canAppAudit: mockCanAppAudit, isLoading: mockCapabilitiesLoading }),
  getUpgradeMessage: () => ({
    title: "App / product screen audits require Pro plan",
    description: "Upgrade to Pro.",
    requiredPlan: "Pro",
  }),
}));

vi.mock("@/hooks/useUsageTracking", () => ({
  useUsageTracking: () => ({ usage: mockUsage, trackAnalysis: (...args: unknown[]) => trackAnalysisMock(...args) }),
}));

vi.mock("@/lib/api/appAudit", () => ({
  analyzeAppScreen: (...args: unknown[]) => analyzeAppScreenMock(...args),
}));

vi.mock("@/lib/firebase/actionItems", () => ({
  createActionItems: (...args: unknown[]) => createActionItemsMock(...args),
}));

vi.mock("@/lib/firebase/siteSettings", () => ({
  getSiteSettings: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/firebase/sharedReports", () => ({
  createSharedReport: vi.fn(),
}));

import AppAudit from "./AppAudit";

function renderPage() {
  return render(
    <MemoryRouter>
      <AppAudit />
    </MemoryRouter>
  );
}

function makeImageFile(name = "screenshot.png") {
  return new File(["fake-image-bytes"], name, { type: "image/png" });
}

function auditResult() {
  return {
    url: "Dashboard",
    timestamp: "2026-07-10T00:00:00.000Z",
    device: "desktop" as const,
    analysisType: "app-screen" as const,
    conversionScore: 62,
    grade: "Needs Optimization",
    topIssues: ["Empty state gives no next step"],
    frictionPoints: [
      {
        id: "fp-1",
        category: "onboarding-friction" as const,
        severity: "high" as const,
        title: "Empty dashboard gives no next step",
        description: "d",
        selector: "main content area",
        fix: "f",
        impactScore: 85,
        screenshotUrl: "/uploads/app-audits/fixed-uuid.png",
        benchmark: { industryAvg: 50, topPerformers: 80, label: "Score" },
        abTest: { testName: "", hypothesis: "", control: "", variant: "", metric: "", duration: "" },
      },
    ],
    benchmark: { overallScore: 62, industryAvg: 55, topQuartile: 78, categoryScores: {} },
  };
}

describe("AppAudit", () => {
  beforeEach(() => {
    mockCanAppAudit = true;
    mockCapabilitiesLoading = false;
    mockUsage = { used: 0, limit: 250, canAnalyze: true, requiresAuth: false, requiresPaid: false, periodStart: null, periodEnd: null };
    trackAnalysisMock.mockReset().mockResolvedValue("analysis-1");
    createActionItemsMock.mockReset().mockResolvedValue(undefined);
    analyzeAppScreenMock.mockReset();
  });

  it("shows an upgrade message instead of the upload form on a plan without app audit access", () => {
    mockCanAppAudit = false;
    renderPage();
    expect(screen.getByText(/App \/ product screen audits require Pro plan/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Upload screenshot")).not.toBeInTheDocument();
  });

  it("does not flash the upgrade message while the real plan is still loading", () => {
    mockCanAppAudit = false;
    mockCapabilitiesLoading = true;
    renderPage();
    expect(screen.queryByText(/App \/ product screen audits require Pro plan/i)).not.toBeInTheDocument();
  });

  it("keeps Run Audit disabled until both a screenshot and a screen name are provided", () => {
    renderPage();
    const runButton = screen.getByRole("button", { name: /Run Audit/i });
    expect(runButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Upload screenshot"), { target: { files: [makeImageFile()] } });
    expect(runButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/Onboarding — Step 2/i), { target: { value: "Dashboard" } });
    return waitFor(() => expect(runButton).not.toBeDisabled());
  });

  it("runs the audit, persists the saved-file screenshot path, and shows the result", async () => {
    analyzeAppScreenMock.mockResolvedValue(auditResult());
    renderPage();

    fireEvent.change(screen.getByLabelText("Upload screenshot"), { target: { files: [makeImageFile()] } });
    fireEvent.change(screen.getByPlaceholderText(/Onboarding — Step 2/i), { target: { value: "Dashboard" } });
    await waitFor(() => expect(screen.getByRole("button", { name: /Run Audit/i })).not.toBeDisabled());

    fireEvent.click(screen.getByRole("button", { name: /Run Audit/i }));

    await waitFor(() => expect(analyzeAppScreenMock).toHaveBeenCalled());
    const call = analyzeAppScreenMock.mock.calls[0][0];
    expect(call.screenLabel).toBe("Dashboard");
    expect(call.imageDataUrl).toContain("data:");

    await waitFor(() => expect(trackAnalysisMock).toHaveBeenCalledWith(
      "Dashboard", "app-screen", "desktop", 62, expect.any(Object)
    ));

    await waitFor(() => expect(createActionItemsMock).toHaveBeenCalled());
    const persistedPoints = createActionItemsMock.mock.calls[0][3];
    expect(persistedPoints[0].screenshotUrl).toBe("/uploads/app-audits/fixed-uuid.png");
    expect(persistedPoints[0].title).toBe("Empty dashboard gives no next step");

    await waitFor(() =>
      expect(within(screen.getByTestId("friction-list")).getByText(/Empty dashboard gives no next step/)).toBeInTheDocument()
    );
  });

  it("blocks a run when the usage quota is exhausted", async () => {
    mockUsage = { ...mockUsage, used: 250, limit: 250 };
    renderPage();

    fireEvent.change(screen.getByLabelText("Upload screenshot"), { target: { files: [makeImageFile()] } });
    fireEvent.change(screen.getByPlaceholderText(/Onboarding — Step 2/i), { target: { value: "Dashboard" } });
    await waitFor(() => expect(screen.getByRole("button", { name: /Run Audit/i })).not.toBeDisabled());

    fireEvent.click(screen.getByRole("button", { name: /Run Audit/i }));

    expect(analyzeAppScreenMock).not.toHaveBeenCalled();
  });

  it("lets the user remove the selected screenshot before running", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Upload screenshot"), { target: { files: [makeImageFile()] } });
    await waitFor(() => expect(screen.getByAltText("Uploaded screenshot preview")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Remove screenshot" }));
    expect(screen.queryByAltText("Uploaded screenshot preview")).not.toBeInTheDocument();
  });
});
