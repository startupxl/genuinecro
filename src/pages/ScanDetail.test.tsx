import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
        <Route path="/dashboard/scan/:id" element={<ScanDetail />} />
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

    renderAt("/dashboard/scan/missing-id");

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

    renderAt("/dashboard/scan/scan-1");

    await waitFor(() => {
      expect(screen.getByText("https://a.com/")).toBeInTheDocument();
    });
    expect(screen.getByText("65")).toBeInTheDocument();
    expect(screen.getByText("Navigation")).toBeInTheDocument();
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

    renderAt("/dashboard/scan/scan-1");

    await waitFor(() => {
      expect(screen.getByText("In this scan")).toBeInTheDocument();
    });
    expect(screen.queryByText("In a later scan")).not.toBeInTheDocument();
  });
});
