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

const runMergedAuditMock = vi.fn();
vi.mock("@/lib/mergedAudit", () => ({
  runMergedAudit: (...args: unknown[]) => runMergedAuditMock(...args),
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

const mockMergedResult = {
  url: "https://example.com",
  analysisType: "homepage",
  device: "desktop",
  conversionScore: 68,
  technicalScore: 50,
  benchmark: { overallScore: 72 },
  frictionPoints: [{ category: "ux-clarity", severity: "high", title: "Issue", description: "d", fix: "f", impactScore: 80 }],
};

describe("NewAuditModal", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    trackAnalysisMock.mockReset().mockResolvedValue("new-audit-id");
    runMergedAuditMock.mockReset();
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

  it("runs a merged scan and navigates to the new audit's detail page on success", async () => {
    runMergedAuditMock.mockResolvedValue(mockMergedResult);
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
    expect(runMergedAuditMock).toHaveBeenCalledWith("https://example.com", "homepage", "desktop");
    expect(createScanJobMock).toHaveBeenCalledWith("uid-1", "https://example.com", "homepage", "desktop");
    expect(trackAnalysisMock).toHaveBeenCalledWith(
      "https://example.com", "homepage", "desktop", 68, expect.anything(), 50
    );
    expect(completeScanJobMock).toHaveBeenCalledWith("job-1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows an error and re-enables the form when the scan fails, without navigating away", async () => {
    runMergedAuditMock.mockRejectedValue(new Error("Analysis failed"));
    const onOpenChange = vi.fn();

    render(
      <MemoryRouter>
        <NewAuditModal open={true} onOpenChange={onOpenChange} />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("https://example.com"), { target: { value: "example.com" } });
    fireEvent.click(screen.getByText("Analyze"));

    await waitFor(() => {
      expect(completeScanJobMock).toHaveBeenCalledWith("job-1");
    });
    expect(screen.getByText("Analyze")).not.toBeDisabled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(navigateMock).not.toHaveBeenCalled();
    expect(trackAnalysisMock).not.toHaveBeenCalled();
    expect(createActionItemsMock).not.toHaveBeenCalled();
  });

  it("disables the Analyze button while a scan is running", async () => {
    let resolveAudit: (value: unknown) => void;
    runMergedAuditMock.mockReturnValue(new Promise((resolve) => { resolveAudit = resolve; }));

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

    resolveAudit!(mockMergedResult);
  });
});
