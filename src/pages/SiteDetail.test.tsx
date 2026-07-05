import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AnalysisResult } from "@/lib/mockData";

const getRecentAnalysesMock = vi.fn();
const getAllActionItemsMock = vi.fn();
const getLiveBenchmarksMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/lib/firebase/analyses", () => ({
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
let capturedOnNewAnalysis: (() => void) | null = null;
let capturedOnGoHome: (() => void) | null = null;
vi.mock("@/components/AnalysisView", () => ({
  default: ({
    result,
    onNewAnalysis,
    onGoHome,
  }: {
    result: AnalysisResult;
    onNewAnalysis: (url: string) => void;
    onGoHome: () => void;
  }) => {
    capturedResult = result;
    capturedOnNewAnalysis = () => onNewAnalysis("https://example.com");
    capturedOnGoHome = onGoHome;
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

import SiteDetail from "./SiteDetail";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/sites/:domain" element={<SiteDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("SiteDetail", () => {
  beforeEach(() => {
    capturedResult = null;
    capturedOnNewAnalysis = null;
    capturedOnGoHome = null;
    getRecentAnalysesMock.mockReset();
    getAllActionItemsMock.mockReset().mockResolvedValue([]);
    getLiveBenchmarksMock.mockReset().mockResolvedValue({});
    navigateMock.mockReset();
  });

  it("shows a not-found message when no audits exist for the domain", async () => {
    getRecentAnalysesMock.mockResolvedValue([]);

    renderAt("/sites/a.com");

    await waitFor(() => {
      expect(screen.getByText(/No audits found for a\.com/)).toBeInTheDocument();
    });
  });

  it("reconstructs and renders the full AnalysisView report for a domain", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { id: "1", url: "https://a.com/", analysisType: "homepage", device: "desktop", conversionScore: 60, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    renderAt("/sites/a.com");

    await waitFor(() => {
      expect(screen.getByTestId("av-url")).toHaveTextContent("https://a.com");
    });
    expect(screen.getByTestId("av-score")).toHaveTextContent("60");
  });

  it("merges friction points across every page of the domain", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { id: "1", url: "https://a.com/", analysisType: "homepage", device: "desktop", conversionScore: 60, createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "2", url: "https://a.com/pricing", analysisType: "landing-marketing", device: "desktop", conversionScore: 70, createdAt: "2026-06-02T00:00:00.000Z" },
    ]);
    getAllActionItemsMock.mockResolvedValue([
      { id: "i1", userId: "uid-1", url: "https://a.com/", analysisType: "homepage", category: "technical-seo", severity: "high", title: "Missing canonical", description: "d", fix: "f", impactScore: 80, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "i2", userId: "uid-1", url: "https://a.com/pricing", analysisType: "landing-marketing", category: "technical-seo", severity: "high", title: "Missing canonical", description: "d", fix: "f", impactScore: 60, status: "open", createdAt: "2026-06-02T00:00:00.000Z" },
    ]);

    renderAt("/sites/a.com");

    await waitFor(() => {
      expect(screen.getByText("Missing canonical")).toBeInTheDocument();
    });
    expect(capturedResult?.frictionPoints).toHaveLength(1);
    expect(capturedResult?.frictionPoints[0].affectedUrls).toEqual(["https://a.com/", "https://a.com/pricing"]);
  });

  it("excludes issues belonging to other domains", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { id: "1", url: "https://a.com/", analysisType: "homepage", device: "desktop", conversionScore: 60, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);
    getAllActionItemsMock.mockResolvedValue([
      { id: "i1", userId: "uid-1", url: "https://a.com/", analysisType: "homepage", category: "navigation", severity: "high", title: "On a.com", description: "d", fix: "f", impactScore: 80, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "i2", userId: "uid-1", url: "https://b.com/", analysisType: "homepage", category: "navigation", severity: "high", title: "On b.com", description: "d", fix: "f", impactScore: 80, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    renderAt("/sites/a.com");

    await waitFor(() => {
      expect(screen.getByText("On a.com")).toBeInTheDocument();
    });
    expect(screen.queryByText("On b.com")).not.toBeInTheDocument();
  });

  it("navigates to the dashboard via onGoHome", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { id: "1", url: "https://a.com/", analysisType: "homepage", device: "desktop", conversionScore: 60, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    renderAt("/sites/a.com");

    await waitFor(() => {
      expect(screen.getByTestId("analysis-view")).toBeInTheDocument();
    });

    capturedOnGoHome?.();
    expect(navigateMock).toHaveBeenCalledWith("/dashboard");
  });

  it("navigates home via onNewAnalysis", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { id: "1", url: "https://a.com/", analysisType: "homepage", device: "desktop", conversionScore: 60, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    renderAt("/sites/a.com");

    await waitFor(() => {
      expect(screen.getByTestId("analysis-view")).toBeInTheDocument();
    });

    capturedOnNewAnalysis?.();
    expect(navigateMock).toHaveBeenCalledWith("/");
  });
});
