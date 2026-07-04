import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));

const trackAnalysisMock = vi.fn();
vi.mock("@/hooks/useUsageTracking", () => ({
  useUsageTracking: () => ({
    usage: { used: 0, limit: 3, canAnalyze: true, requiresAuth: false, requiresPaid: false },
    trackAnalysis: (...args: unknown[]) => trackAnalysisMock(...args),
  }),
}));

const analyzeUrlMock = vi.fn();
vi.mock("@/lib/api/analyze", () => ({
  analyzeUrl: (...args: unknown[]) => analyzeUrlMock(...args),
}));

const createActionItemsMock = vi.fn();
vi.mock("@/lib/firebase/actionItems", () => ({
  createActionItems: (...args: unknown[]) => createActionItemsMock(...args),
}));

const createScanJobMock = vi.fn();
const completeScanJobMock = vi.fn();
vi.mock("@/lib/firebase/scanJobs", () => ({
  createScanJob: (...args: unknown[]) => createScanJobMock(...args),
  completeScanJob: (...args: unknown[]) => completeScanJobMock(...args),
}));

import NewAuditModal from "./NewAuditModal";

const mockAnalysisResult = {
  url: "https://example.com",
  analysisType: "homepage",
  device: "desktop",
  conversionScore: 72,
  benchmark: { overallScore: 72 },
  frictionPoints: [{ category: "ux-clarity", severity: "high", title: "Issue", description: "d", fix: "f", impactScore: 80 }],
};

describe("NewAuditModal", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    trackAnalysisMock.mockReset().mockResolvedValue("new-audit-id");
    analyzeUrlMock.mockReset();
    createActionItemsMock.mockReset().mockResolvedValue(undefined);
    createScanJobMock.mockReset().mockResolvedValue("job-1");
    completeScanJobMock.mockReset().mockResolvedValue(undefined);
  });

  it("does not render its content when closed", () => {
    render(
      <MemoryRouter>
        <NewAuditModal open={false} onOpenChange={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.queryByText("New Audit")).not.toBeInTheDocument();
  });

  it("runs a scan and navigates to the new audit's detail page on success", async () => {
    analyzeUrlMock.mockResolvedValue(mockAnalysisResult);
    const onOpenChange = vi.fn();

    render(
      <MemoryRouter>
        <NewAuditModal open={true} onOpenChange={onOpenChange} />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("https://example.com"), { target: { value: "example.com" } });
    fireEvent.click(screen.getByText("Analyze"));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/audits/new-audit-id");
    });
    expect(createScanJobMock).toHaveBeenCalledWith("uid-1", "https://example.com", "homepage", "desktop");
    expect(completeScanJobMock).toHaveBeenCalledWith("job-1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("falls back to mock data and still completes when the real analysis fails", async () => {
    analyzeUrlMock.mockRejectedValue(new Error("boom"));
    const onOpenChange = vi.fn();

    render(
      <MemoryRouter>
        <NewAuditModal open={true} onOpenChange={onOpenChange} />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("https://example.com"), { target: { value: "example.com" } });
    fireEvent.click(screen.getByText("Analyze"));

    await waitFor(() => {
      expect(trackAnalysisMock).toHaveBeenCalled();
    });
    expect(completeScanJobMock).toHaveBeenCalledWith("job-1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables the Analyze button while a scan is running", async () => {
    let resolveAnalyze: (value: unknown) => void;
    analyzeUrlMock.mockReturnValue(new Promise((resolve) => { resolveAnalyze = resolve; }));

    render(
      <MemoryRouter>
        <NewAuditModal open={true} onOpenChange={vi.fn()} />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("https://example.com"), { target: { value: "example.com" } });
    fireEvent.click(screen.getByText("Analyze"));

    await waitFor(() => {
      expect(screen.getByText("Analyzing…")).toBeInTheDocument();
    });

    resolveAnalyze!(mockAnalysisResult);
  });
});
