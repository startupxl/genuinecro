import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import type { AnalysisResult } from "@/lib/mockData";

let mockUser: { uid: string } | null = null;
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

let mockCanExport = false;
vi.mock("@/hooks/usePlanCapabilities", () => ({
  usePlanCapabilities: () => ({ canExport: mockCanExport, canGenerateVariants: false, canExperimentWorkbench: false }),
  getUpgradeMessage: (feature: string) => ({ title: `${feature} requires Pro plan`, description: "Upgrade to Pro.", requiredPlan: "Pro" }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Pro", subscription: null }),
}));

const exportPDFMock = vi.fn();
vi.mock("@/lib/exportUtils", () => ({
  exportCSV: vi.fn(),
  copyAsJiraTickets: vi.fn(() => "jira text"),
  exportPDF: (...args: unknown[]) => exportPDFMock(...args),
}));

const createSharedReportMock = vi.fn();
vi.mock("@/lib/firebase/sharedReports", () => ({
  createSharedReport: (...args: unknown[]) => createSharedReportMock(...args),
}));

vi.mock("@/lib/firebase/siteSettings", () => ({
  getSiteSettings: vi.fn().mockResolvedValue(null),
}));

import AnalysisView from "./AnalysisView";

const DEFAULT_BENCHMARK = { industryAvg: 50, topPerformers: 80, label: "" };
const DEFAULT_ABTEST = { testName: "", hypothesis: "", control: "", variant: "", metric: "", duration: "" };

function point(id: string, category: string, title: string) {
  return {
    id,
    category,
    severity: "high" as const,
    title,
    description: "d",
    selector: "body",
    fix: "f",
    impactScore: 80,
    benchmark: DEFAULT_BENCHMARK,
    abTest: DEFAULT_ABTEST,
  };
}

const result: AnalysisResult = {
  url: "https://example.com",
  timestamp: "2026-06-01T00:00:00.000Z",
  device: "desktop",
  analysisType: "homepage",
  conversionScore: 65,
  frictionPoints: [
    point("1", "technical-seo", "Missing canonical"),
    point("2", "content-hierarchy", "Weak content structure"),
    point("3", "navigation", "Confusing nav"),
    point("4", "ux-clarity", "Vague CTA"),
  ] as AnalysisResult["frictionPoints"],
  benchmark: { overallScore: 65, industryAvg: 55, topQuartile: 80, categoryScores: {} },
};

function renderView(analysisId?: string) {
  return render(
    <MemoryRouter>
      <AnalysisView result={result} onNewAnalysis={() => {}} analysisId={analysisId} />
    </MemoryRouter>
  );
}

describe("AnalysisView category tab filter", () => {
  it("shows all issues under the All tab by default", () => {
    renderView();
    const list = within(screen.getByTestId("friction-list"));
    expect(list.getByText("Missing canonical")).toBeInTheDocument();
    expect(list.getByText("Weak content structure")).toBeInTheDocument();
    expect(list.getByText("Confusing nav")).toBeInTheDocument();
    expect(list.getByText("Vague CTA")).toBeInTheDocument();
  });

  it("filters to only Technical-tab issues when the Technical tab is clicked", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Technical" }));
    const list = within(screen.getByTestId("friction-list"));
    expect(list.getByText("Missing canonical")).toBeInTheDocument();
    expect(list.queryByText("Weak content structure")).not.toBeInTheDocument();
    expect(list.queryByText("Confusing nav")).not.toBeInTheDocument();
    expect(list.queryByText("Vague CTA")).not.toBeInTheDocument();
  });

  it("buckets an unmapped category (e.g. ux-clarity) under the Conversion tab", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Conversion" }));
    const list = within(screen.getByTestId("friction-list"));
    expect(list.getByText("Vague CTA")).toBeInTheDocument();
    expect(list.queryByText("Missing canonical")).not.toBeInTheDocument();
  });

  it("returns to showing all issues when All is clicked again", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Navigation" }));
    expect(within(screen.getByTestId("friction-list")).queryByText("Missing canonical")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    const list = within(screen.getByTestId("friction-list"));
    expect(list.getByText("Missing canonical")).toBeInTheDocument();
    expect(list.getByText("Confusing nav")).toBeInTheDocument();
  });
});

describe("AnalysisView — PDF export and Share", () => {
  beforeEach(() => {
    mockUser = null;
    mockCanExport = false;
    exportPDFMock.mockClear();
    createSharedReportMock.mockClear();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("does not render the Share button when there's no signed-in user or no analysisId", () => {
    renderView();
    expect(screen.queryByRole("button", { name: /Share/i })).not.toBeInTheDocument();
  });

  it("shows the Share button for a signed-in user viewing a saved scan, and copies a share link when clicked", async () => {
    mockUser = { uid: "uid-1" };
    createSharedReportMock.mockResolvedValue("share-1");
    renderView("analysis-1");

    fireEvent.click(screen.getByRole("button", { name: /Share/i }));

    await waitFor(() => {
      expect(createSharedReportMock).toHaveBeenCalledWith(
        "uid-1",
        "analysis-1",
        expect.objectContaining({ url: result.url, conversionScore: result.conversionScore })
      );
    });
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("/reports/shared/share-1"));
    });
  });

  it("shows an upgrade prompt instead of exporting a PDF when the plan lacks canExport", () => {
    mockCanExport = false;
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /PDF/i }));
    expect(exportPDFMock).not.toHaveBeenCalled();
  });

  it("exports a PDF when canExport is true", () => {
    mockCanExport = true;
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /PDF/i }));
    expect(exportPDFMock).toHaveBeenCalledWith(result, expect.any(Array));
  });
});
