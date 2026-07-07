import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AnalysisResult } from "@/lib/mockData";

const getAnalysisByIdMock = vi.fn();
const getRecentAnalysesMock = vi.fn();
const getAllActionItemsMock = vi.fn();
const getLiveBenchmarksMock = vi.fn();

vi.mock("@/lib/firebase/analyses", () => ({
  getAnalysisById: (...args: unknown[]) => getAnalysisByIdMock(...args),
  getRecentAnalyses: (...args: unknown[]) => getRecentAnalysesMock(...args),
}));

vi.mock("@/lib/firebase/actionItems", () => ({
  getAllActionItems: (...args: unknown[]) => getAllActionItemsMock(...args),
}));

vi.mock("@/lib/firebase/benchmarks", () => ({
  getLiveBenchmarks: (...args: unknown[]) => getLiveBenchmarksMock(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));

let capturedResult: AnalysisResult | null = null;
let capturedAnalysisId: string | undefined;
vi.mock("@/components/AnalysisView", () => ({
  default: ({ result, analysisId }: { result: AnalysisResult; analysisId?: string }) => {
    capturedResult = result;
    capturedAnalysisId = analysisId;
    return (
      <div data-testid="analysis-view">
        <span data-testid="av-url">{result.url}</span>
        <span data-testid="av-score">{result.conversionScore}</span>
        {result.frictionPoints.map((p) => (
          <span key={p.id} data-testid="av-issue">{p.title}</span>
        ))}
      </div>
    );
  },
}));

import ScanDetail from "./ScanDetail";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/audits/:id" element={<ScanDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ScanDetail", () => {
  beforeEach(() => {
    capturedResult = null;
    getAnalysisByIdMock.mockReset();
    getRecentAnalysesMock.mockReset().mockResolvedValue([]);
    getAllActionItemsMock.mockReset().mockResolvedValue([]);
    getLiveBenchmarksMock.mockReset().mockResolvedValue({});
  });

  it("shows a not-found message when the scan doesn't exist", async () => {
    getAnalysisByIdMock.mockResolvedValue(null);

    renderAt("/audits/missing-id");

    await waitFor(() => {
      expect(screen.getByText("Scan not found.")).toBeInTheDocument();
    });
  });

  it("reconstructs and renders the full AnalysisView report for a past scan", async () => {
    getAnalysisByIdMock.mockResolvedValue({
      id: "scan-1",
      url: "https://a.com/",
      analysisType: "homepage",
      device: "desktop",
      conversionScore: 65,
      createdAt: "2026-06-01T00:00:00.000Z",
      categoryScores: { navigation: 70 },
    });

    renderAt("/audits/scan-1");

    await waitFor(() => {
      expect(screen.getByTestId("av-url")).toHaveTextContent("https://a.com/");
    });
    expect(screen.getByTestId("av-score")).toHaveTextContent("65");
    expect(capturedAnalysisId).toBe("scan-1");
  });

  it("shows only the action items created within this scan's time window", async () => {
    getAnalysisByIdMock.mockResolvedValue({
      id: "scan-1",
      url: "https://a.com/",
      analysisType: "homepage",
      device: "desktop",
      conversionScore: 65,
      createdAt: "2026-06-01T00:00:00.000Z",
      categoryScores: {},
    });
    getRecentAnalysesMock.mockResolvedValue([
      { id: "scan-1", url: "https://a.com/", analysisType: "homepage", device: "desktop", conversionScore: 65, createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "scan-2", url: "https://a.com/", analysisType: "homepage", device: "desktop", conversionScore: 80, createdAt: "2026-06-10T00:00:00.000Z" },
    ]);
    getAllActionItemsMock.mockResolvedValue([
      { id: "1", userId: "uid-1", url: "https://a.com/", analysisType: "homepage", category: "navigation", severity: "high", title: "In this scan", description: "d", fix: "f", impactScore: 90, status: "open", createdAt: "2026-06-02T00:00:00.000Z" },
      { id: "2", userId: "uid-1", url: "https://a.com/", analysisType: "homepage", category: "navigation", severity: "high", title: "In a later scan", description: "d", fix: "f", impactScore: 80, status: "open", createdAt: "2026-06-11T00:00:00.000Z" },
    ]);

    renderAt("/audits/scan-1");

    await waitFor(() => {
      expect(screen.getByTestId("av-url")).toBeInTheDocument();
    });
    expect(capturedResult?.frictionPoints.map((p) => p.title)).toEqual(["In this scan"]);
  });

  it("reconstructs full evidence (selector/benchmark/abTest) for a matched action item", async () => {
    getAnalysisByIdMock.mockResolvedValue({
      id: "scan-1",
      url: "https://a.com/",
      analysisType: "homepage",
      device: "desktop",
      conversionScore: 65,
      createdAt: "2026-06-01T00:00:00.000Z",
      categoryScores: {},
    });
    getAllActionItemsMock.mockResolvedValue([
      {
        id: "1",
        userId: "uid-1",
        url: "https://a.com/",
        analysisType: "homepage",
        category: "ux-clarity",
        severity: "high",
        title: "Weak headline",
        description: "d",
        fix: "f",
        impactScore: 90,
        status: "open",
        createdAt: "2026-06-01T01:00:00.000Z",
        selector: "header > h1",
        benchmark: { industryAvg: 55, topPerformers: 80, label: "Headline clarity" },
        abTest: {
          testName: "Headline Test",
          hypothesis: "h",
          control: "c",
          variant: "v",
          metric: "m",
          duration: "2 weeks",
        },
      },
    ]);

    renderAt("/audits/scan-1");

    await waitFor(() => {
      expect(screen.getByTestId("av-url")).toBeInTheDocument();
    });
    const point = capturedResult?.frictionPoints[0];
    expect(point?.selector).toBe("header > h1");
    expect(point?.benchmark).toEqual({ industryAvg: 55, topPerformers: 80, label: "Headline clarity" });
    expect(point?.abTest.testName).toBe("Headline Test");
  });
});
