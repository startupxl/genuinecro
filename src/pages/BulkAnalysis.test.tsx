import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));

const usageMock = { used: 0, limit: 20, canAnalyze: true, requiresAuth: false, requiresPaid: false, periodStart: null, periodEnd: null };
const trackAnalysisMock = vi.fn().mockResolvedValue("analysis-1");
vi.mock("@/hooks/useUsageTracking", () => ({
  useUsageTracking: () => ({ usage: usageMock, trackAnalysis: (...args: unknown[]) => trackAnalysisMock(...args) }),
}));

vi.mock("@/hooks/usePlanCapabilities", () => ({
  usePlanCapabilities: () => ({ auditLimit: 20, canExport: true }),
}));

const analyzeUrlMock = vi.fn();
vi.mock("@/lib/api/analyze", () => ({
  analyzeUrl: (...args: unknown[]) => analyzeUrlMock(...args),
}));

const createActionItemsMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/firebase/actionItems", () => ({
  createActionItems: (...args: unknown[]) => createActionItemsMock(...args),
}));

vi.mock("@/lib/firebase/scanJobs", () => ({
  createScanJob: vi.fn().mockResolvedValue("job-1"),
  completeScanJob: vi.fn().mockResolvedValue(undefined),
}));

import BulkAnalysis from "./BulkAnalysis";

function renderPage() {
  return render(
    <MemoryRouter>
      <BulkAnalysis />
    </MemoryRouter>
  );
}

function uploadCsv(text: string) {
  const file = new File([text], "audits.csv", { type: "text/csv" });
  if (typeof file.text !== "function") {
    Object.defineProperty(file, "text", { value: () => Promise.resolve(text) });
  }
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe("BulkAnalysis — template-driven upload", () => {
  beforeEach(() => {
    analyzeUrlMock.mockReset();
    createActionItemsMock.mockClear();
    trackAnalysisMock.mockClear();
  });

  it("shows a Download Template button", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /Download Template/i })).toBeInTheDocument();
  });

  it("loads rows from an uploaded template, showing each row's page type", async () => {
    renderPage();

    uploadCsv("URL,Page Type\nhttps://a.com,Homepage\nhttps://a.com/checkout,Checkout\nhttps://a.com/blog,");

    await waitFor(() => {
      expect(screen.getByText("https://a.com")).toBeInTheDocument();
    });
    expect(screen.getByText("Homepage")).toBeInTheDocument();
    expect(screen.getByText("Checkout")).toBeInTheDocument();
    expect(screen.getByText("Auto-detect")).toBeInTheDocument();
  });

  it("analyzes each row using its own page type from the template, not the global setting", async () => {
    analyzeUrlMock.mockResolvedValue({
      url: "https://a.com/checkout",
      analysisType: "checkout",
      device: "desktop",
      conversionScore: 70,
      benchmark: { overallScore: 70, industryAvg: 55, topQuartile: 80, categoryScores: {} },
      frictionPoints: [],
    });

    renderPage();
    uploadCsv("URL,Page Type\nhttps://a.com/checkout,Checkout");

    await waitFor(() => {
      expect(screen.getByText("https://a.com/checkout")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Start Analysis/i }));

    await waitFor(() => {
      expect(analyzeUrlMock).toHaveBeenCalledWith("https://a.com/checkout", "checkout", "desktop");
    });
  });

  it("falls back to auto-detected page type for rows without one in the template", async () => {
    analyzeUrlMock.mockResolvedValue({
      url: "https://a.com/checkout",
      analysisType: "checkout",
      device: "desktop",
      conversionScore: 70,
      benchmark: { overallScore: 70, industryAvg: 55, topQuartile: 80, categoryScores: {} },
      frictionPoints: [],
    });

    renderPage();
    uploadCsv("URL,Page Type\nhttps://a.com/checkout,");

    await waitFor(() => {
      expect(screen.getByText("https://a.com/checkout")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Start Analysis/i }));

    await waitFor(() => {
      expect(analyzeUrlMock).toHaveBeenCalledWith("https://a.com/checkout", "checkout", "desktop");
    });
  });
});
