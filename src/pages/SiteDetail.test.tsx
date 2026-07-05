import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const getRecentAnalysesMock = vi.fn();
const getAllActionItemsMock = vi.fn();
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

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Free", subscription: null }),
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
    getRecentAnalysesMock.mockReset();
    getAllActionItemsMock.mockReset().mockResolvedValue([]);
    navigateMock.mockReset();
  });

  it("shows a not-found message when no audits exist for the domain", async () => {
    getRecentAnalysesMock.mockResolvedValue([]);

    renderAt("/sites/a.com");

    await waitFor(() => {
      expect(screen.getByText(/No audits found for a\.com/)).toBeInTheDocument();
    });
  });

  it("shows how many pages were audited for the domain", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { id: "1", url: "https://a.com/", analysisType: "homepage", device: "desktop", conversionScore: 60, createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "2", url: "https://a.com/pricing", analysisType: "landing-marketing", device: "desktop", conversionScore: 70, createdAt: "2026-06-02T00:00:00.000Z" },
    ]);

    renderAt("/sites/a.com");

    await waitFor(() => {
      expect(screen.getByText(/2 pages audited/)).toBeInTheDocument();
    });
  });

  it("shows a congratulatory empty state when there are no open issues for the domain", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { id: "1", url: "https://a.com/", analysisType: "homepage", device: "desktop", conversionScore: 90, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);
    getAllActionItemsMock.mockResolvedValue([]);

    renderAt("/sites/a.com");

    await waitFor(() => {
      expect(screen.getByText(/No open issues/)).toBeInTheDocument();
    });
  });

  it("merges friction points across pages and renders them", async () => {
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
    expect(screen.getAllByText(/2 pages/)).toHaveLength(2);
  });

  it("excludes issues belonging to other domains", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { id: "1", url: "https://a.com/", analysisType: "homepage", device: "desktop", conversionScore: 60, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);
    getAllActionItemsMock.mockResolvedValue([
      { id: "i1", userId: "uid-1", url: "https://a.com/", analysisType: "homepage", category: "navigation", severity: "high", title: "Nav issue on a.com", description: "d", fix: "f", impactScore: 80, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "i2", userId: "uid-1", url: "https://b.com/", analysisType: "homepage", category: "navigation", severity: "high", title: "Nav issue on b.com", description: "d", fix: "f", impactScore: 80, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    renderAt("/sites/a.com");

    await waitFor(() => {
      expect(screen.getByText("Nav issue on a.com")).toBeInTheDocument();
    });
    expect(screen.queryByText("Nav issue on b.com")).not.toBeInTheDocument();
  });

  it("filters the list by category tab", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { id: "1", url: "https://a.com/", analysisType: "homepage", device: "desktop", conversionScore: 60, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);
    getAllActionItemsMock.mockResolvedValue([
      { id: "i1", userId: "uid-1", url: "https://a.com/", analysisType: "homepage", category: "technical-seo", severity: "high", title: "Missing canonical", description: "d", fix: "f", impactScore: 80, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "i2", userId: "uid-1", url: "https://a.com/", analysisType: "homepage", category: "navigation", severity: "high", title: "Nav issue", description: "d", fix: "f", impactScore: 70, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    renderAt("/sites/a.com");

    await waitFor(() => {
      expect(screen.getByText("Missing canonical")).toBeInTheDocument();
    });
    expect(screen.getByText("Nav issue")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Technical" }));

    expect(screen.getByText("Missing canonical")).toBeInTheDocument();
    expect(screen.queryByText("Nav issue")).not.toBeInTheDocument();
  });

  it("navigates back to the dashboard", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { id: "1", url: "https://a.com/", analysisType: "homepage", device: "desktop", conversionScore: 60, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    renderAt("/sites/a.com");

    await waitFor(() => {
      expect(screen.getByText(/audited/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Back to Dashboard/i }));

    expect(navigateMock).toHaveBeenCalledWith("/dashboard");
  });
});
