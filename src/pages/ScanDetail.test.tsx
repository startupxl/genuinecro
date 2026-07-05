import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

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

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Free", subscription: null }),
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

  it("renders the scan's url, score, and category scores", async () => {
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
      expect(screen.getByText("https://a.com/")).toBeInTheDocument();
    });
    expect(screen.getByText("65")).toBeInTheDocument();
    const categoryPanel = screen.getByText("Category Scores").parentElement!;
    expect(within(categoryPanel).getByText("Navigation")).toBeInTheDocument();
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
      expect(screen.getByText("In this scan")).toBeInTheDocument();
    });
    expect(screen.queryByText("In a later scan")).not.toBeInTheDocument();
  });

  it("shows the technical score alongside the overall score when present", async () => {
    getAnalysisByIdMock.mockResolvedValue({
      id: "scan-1",
      url: "https://a.com/",
      analysisType: "homepage",
      device: "desktop",
      conversionScore: 65,
      technicalScore: 40,
      createdAt: "2026-06-01T00:00:00.000Z",
      categoryScores: {},
    });

    renderAt("/audits/scan-1");

    await waitFor(() => {
      expect(screen.getByText("65")).toBeInTheDocument();
    });
    expect(screen.getByText("Technical: 40")).toBeInTheDocument();
  });

  it("filters issues by tab, defaulting to All", async () => {
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
      { id: "1", userId: "uid-1", url: "https://a.com/", analysisType: "homepage", category: "technical-seo", severity: "high", title: "Missing canonical", description: "d", fix: "f", impactScore: 90, status: "open", createdAt: "2026-06-01T01:00:00.000Z" },
      { id: "2", userId: "uid-1", url: "https://a.com/", analysisType: "homepage", category: "navigation", severity: "high", title: "Nav issue", description: "d", fix: "f", impactScore: 80, status: "open", createdAt: "2026-06-01T01:00:00.000Z" },
    ]);

    renderAt("/audits/scan-1");

    await waitFor(() => {
      expect(screen.getByText("Missing canonical")).toBeInTheDocument();
    });
    expect(screen.getByText("Nav issue")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Technical" }));

    expect(screen.getByText("Missing canonical")).toBeInTheDocument();
    expect(screen.queryByText("Nav issue")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Navigation" }));

    expect(screen.queryByText("Missing canonical")).not.toBeInTheDocument();
    expect(screen.getByText("Nav issue")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All" }));

    expect(screen.getByText("Missing canonical")).toBeInTheDocument();
    expect(screen.getByText("Nav issue")).toBeInTheDocument();
  });
});
