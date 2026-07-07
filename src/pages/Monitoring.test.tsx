import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getRecentAnalysesMock = vi.fn();
const getSiteSettingsMock = vi.fn();
const saveSiteSettingsMock = vi.fn();
const runMergedAuditMock = vi.fn();
const trackAnalysisMock = vi.fn();
const createActionItemsMock = vi.fn();
const getActiveActionItemsMock = vi.fn();
const createMonitoringAlertMock = vi.fn();
const getMonitoringAlertsMock = vi.fn();

const mockUser = { uid: "uid-1" };

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, profile: null, signOut: vi.fn() }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Pro", subscription: null }),
}));

vi.mock("@/hooks/useUsageTracking", () => ({
  useUsageTracking: () => ({
    usage: { used: 1, limit: 250, canAnalyze: true, requiresAuth: false, requiresPaid: false, periodStart: null, periodEnd: null },
    trackAnalysis: (...args: unknown[]) => trackAnalysisMock(...args),
  }),
}));

vi.mock("@/lib/firebase/analyses", () => ({
  getRecentAnalyses: (...args: unknown[]) => getRecentAnalysesMock(...args),
  groupAnalysesByDomain: (records: any[]) => {
    const byDomain = new Map<string, any[]>();
    for (const r of records) {
      const domain = new URL(r.url).hostname.replace(/^www\./, "");
      if (!byDomain.has(domain)) byDomain.set(domain, []);
      byDomain.get(domain)!.push(r);
    }
    return Array.from(byDomain.entries()).map(([domain, recs]) => {
      const sorted = [...recs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return {
        domain,
        latestScore: sorted[0].conversionScore,
        previousScore: sorted[1]?.conversionScore ?? null,
        scoreDelta: null,
        lastAnalyzedAt: sorted[0].createdAt,
        analysisCount: sorted.length,
      };
    });
  },
}));

vi.mock("@/lib/firebase/siteSettings", () => ({
  getSiteSettings: (...args: unknown[]) => getSiteSettingsMock(...args),
  saveSiteSettings: (...args: unknown[]) => saveSiteSettingsMock(...args),
}));

vi.mock("@/lib/mergedAudit", () => ({
  runMergedAudit: (...args: unknown[]) => runMergedAuditMock(...args),
}));

vi.mock("@/lib/firebase/actionItems", () => ({
  createActionItems: (...args: unknown[]) => createActionItemsMock(...args),
  getActiveActionItems: (...args: unknown[]) => getActiveActionItemsMock(...args),
}));

vi.mock("@/lib/firebase/monitoringAlerts", () => ({
  createMonitoringAlert: (...args: unknown[]) => createMonitoringAlertMock(...args),
  getMonitoringAlerts: (...args: unknown[]) => getMonitoringAlertsMock(...args),
}));

import Monitoring from "./Monitoring";

function renderPage() {
  return render(
    <MemoryRouter>
      <Monitoring />
    </MemoryRouter>
  );
}

const baseRecord = {
  url: "https://example.com",
  analysisType: "homepage",
  device: "desktop",
  conversionScore: 70,
  createdAt: "2026-07-01T00:00:00.000Z",
};

describe("Monitoring", () => {
  beforeEach(() => {
    getRecentAnalysesMock.mockReset();
    getSiteSettingsMock.mockReset();
    saveSiteSettingsMock.mockReset();
    runMergedAuditMock.mockReset();
    trackAnalysisMock.mockReset();
    createActionItemsMock.mockReset();
    getActiveActionItemsMock.mockReset();
    createMonitoringAlertMock.mockReset();
    getMonitoringAlertsMock.mockReset();

    getRecentAnalysesMock.mockResolvedValue([baseRecord]);
    getSiteSettingsMock.mockResolvedValue(null);
    getActiveActionItemsMock.mockResolvedValue([]);
    getMonitoringAlertsMock.mockResolvedValue([]);
  });

  it("stops showing the loading state and surfaces an error instead of hanging forever when a Firestore read fails", async () => {
    getMonitoringAlertsMock.mockRejectedValue(new Error("Missing or insufficient permissions."));

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText("Loading sites…")).not.toBeInTheDocument();
    });
    expect(screen.getByText(/couldn't load monitoring data/i)).toBeInTheDocument();
  });

  it("lists tracked sites with a monitoring toggle and a Check now button", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("example.com")).toBeInTheDocument();
    });
    expect(screen.getByRole("switch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Check now/i })).toBeInTheDocument();
  });

  it("saves monitoringEnabled when the toggle is flipped", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("example.com")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(saveSiteSettingsMock).toHaveBeenCalledWith("uid-1", "example.com", { monitoringEnabled: true });
    });
  });

  it("runs a check, records the scan, and shows no alert banner when nothing changed", async () => {
    runMergedAuditMock.mockResolvedValue({
      url: "https://example.com",
      analysisType: "homepage",
      device: "desktop",
      conversionScore: 71,
      technicalScore: null,
      benchmark: { overallScore: 71, industryAvg: 55, topQuartile: 78, categoryScores: {} },
      frictionPoints: [],
      conversionGoal: null,
    });
    trackAnalysisMock.mockResolvedValue("analysis-2");

    renderPage();
    await waitFor(() => expect(screen.getByText("example.com")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Check now/i }));

    await waitFor(() => {
      expect(runMergedAuditMock).toHaveBeenCalledWith("https://example.com", "homepage", "desktop", null, undefined);
    });
    expect(createActionItemsMock).toHaveBeenCalledWith("uid-1", "https://example.com", "homepage", []);
    expect(createMonitoringAlertMock).not.toHaveBeenCalled();
  });

  it("shows an alert banner and logs it when the score drops significantly", async () => {
    getActiveActionItemsMock.mockResolvedValue([]);
    runMergedAuditMock.mockResolvedValue({
      url: "https://example.com",
      analysisType: "homepage",
      device: "desktop",
      conversionScore: 55,
      technicalScore: null,
      benchmark: { overallScore: 55, industryAvg: 55, topQuartile: 78, categoryScores: {} },
      frictionPoints: [],
      conversionGoal: null,
    });
    trackAnalysisMock.mockResolvedValue("analysis-2");

    renderPage();
    await waitFor(() => expect(screen.getByText("example.com")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Check now/i }));

    await waitFor(() => {
      expect(createMonitoringAlertMock).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "uid-1", domain: "example.com", previousScore: 70, newScore: 55, scoreDelta: -15 })
      );
    });
    expect(screen.getByText(/score dropped/i)).toBeInTheDocument();
  });

  it("shows past alerts in the alert history", async () => {
    getMonitoringAlertsMock.mockResolvedValue([
      {
        id: "alert-1",
        userId: "uid-1",
        domain: "example.com",
        previousScore: 70,
        newScore: 55,
        scoreDelta: -15,
        newCriticalIssueTitles: ["Slow page load"],
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Slow page load")).toBeInTheDocument();
    });
  });
});
