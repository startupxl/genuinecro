import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getRecentAnalysesMock = vi.fn();
const groupAnalysesByDomainMock = vi.fn();
const getAllActionItemsMock = vi.fn();

function defaultGroupByDomain(records: Array<{ url: string; conversionScore: number; createdAt: string }>) {
  if (records.length === 0) return [];
  return [
    {
      domain: "example.com",
      latestScore: records[0].conversionScore,
      previousScore: null,
      scoreDelta: null,
      lastAnalyzedAt: records[0].createdAt,
      analysisCount: records.length,
    },
  ];
}

vi.mock("@/lib/firebase/analyses", () => ({
  getRecentAnalyses: (...args: unknown[]) => getRecentAnalysesMock(...args),
  groupAnalysesByDomain: (...args: unknown[]) => groupAnalysesByDomainMock(...args),
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

import Dashboard from "./Dashboard";

describe("Dashboard", () => {
  beforeEach(() => {
    getRecentAnalysesMock.mockReset();
    groupAnalysesByDomainMock.mockReset().mockImplementation(defaultGroupByDomain);
    getAllActionItemsMock.mockReset().mockResolvedValue([]);
  });

  it("shows an empty state when there are no audits yet", async () => {
    getRecentAnalysesMock.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("No audits yet — run your first analysis to see it here.")).toBeInTheDocument();
    });
  });

  it("renders site summaries once analyses load", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 68, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("example.com")).toBeInTheDocument();
    });
    const siteRow = screen.getByText("example.com").closest("[data-testid='site-row']")!;
    expect(within(siteRow).getByText("68")).toBeInTheDocument();
  });

  it("gives the Overall CRO Score card the highlighted hero treatment, and Sites Tracked a plain card", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 68, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Overall CRO Score")).toBeInTheDocument();
    });
    const heroCard = screen.getByText("Overall CRO Score").closest("div.bg-primary");
    expect(heroCard).not.toBeNull();

    const sitesTrackedCard = screen.getByText("Sites Tracked").closest("div");
    expect(sitesTrackedCard).not.toHaveClass("bg-primary");
  });

  it("selects a site when its row is clicked, and deselects on a second click", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://a.com", analysisType: "homepage", device: "desktop", conversionScore: 60, createdAt: "2026-06-01T00:00:00.000Z" },
      { url: "https://b.com", analysisType: "homepage", device: "desktop", conversionScore: 70, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);
    groupAnalysesByDomainMock.mockReturnValue([
      { domain: "a.com", latestScore: 60, previousScore: null, scoreDelta: null, lastAnalyzedAt: "2026-06-01T00:00:00.000Z", analysisCount: 1 },
      { domain: "b.com", latestScore: 70, previousScore: null, scoreDelta: null, lastAnalyzedAt: "2026-06-01T00:00:00.000Z", analysisCount: 1 },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("a.com")).toBeInTheDocument();
    });

    const row = screen.getByText("a.com").closest("[data-testid='site-row']");
    expect(row).not.toHaveClass("bg-secondary");

    fireEvent.click(row!);
    expect(row).toHaveClass("bg-secondary");

    fireEvent.click(row!);
    expect(row).not.toHaveClass("bg-secondary");
  });

  it("filters the site list to critical sites when the Critical card is clicked", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://critical.com", analysisType: "homepage", device: "desktop", conversionScore: 30, createdAt: "2026-06-01T00:00:00.000Z" },
      { url: "https://healthy.com", analysisType: "homepage", device: "desktop", conversionScore: 80, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);
    groupAnalysesByDomainMock.mockReturnValue([
      { domain: "critical.com", latestScore: 30, previousScore: null, scoreDelta: null, lastAnalyzedAt: "2026-06-01T00:00:00.000Z", analysisCount: 1 },
      { domain: "healthy.com", latestScore: 80, previousScore: null, scoreDelta: null, lastAnalyzedAt: "2026-06-01T00:00:00.000Z", analysisCount: 1 },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("healthy.com")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Critical (Score < 50)"));
    expect(screen.queryByText("healthy.com")).not.toBeInTheDocument();
    expect(screen.getByText("critical.com")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Critical (Score < 50)"));
    expect(screen.getByText("healthy.com")).toBeInTheDocument();
  });

  it("renders the score trend and friction-by-category widgets", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 50, createdAt: "2026-06-01T00:00:00.000Z" },
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 65, createdAt: "2026-06-02T00:00:00.000Z" },
    ]);
    getAllActionItemsMock.mockResolvedValue([
      { id: "1", userId: "uid-1", url: "https://example.com", analysisType: "homepage", category: "ux-clarity", severity: "high", title: "t", description: "d", fix: "f", impactScore: 80, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Score Trend")).toBeInTheDocument();
    });
    expect(screen.getByText("Friction by Category")).toBeInTheDocument();
    expect(screen.getAllByText("UX Clarity").length).toBeGreaterThan(0);
  });

  it("shows the pages audited count in the hero card", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 68, createdAt: "2026-06-01T00:00:00.000Z" },
      { url: "https://example.com/checkout", analysisType: "checkout", device: "desktop", conversionScore: 55, createdAt: "2026-06-02T00:00:00.000Z" },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/2 pages audited/i)).toBeInTheDocument();
    });
  });

  it("renders the severity breakdown and top issues widgets", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 50, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);
    getAllActionItemsMock.mockResolvedValue([
      { id: "1", userId: "uid-1", url: "https://example.com", analysisType: "homepage", category: "ux-clarity", severity: "high", title: "Weak headline", description: "d", fix: "Rewrite it", impactScore: 90, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Issues by Severity")).toBeInTheDocument();
    });
    expect(screen.getByText("Top Issues")).toBeInTheDocument();
    expect(screen.getByText("Weak headline")).toBeInTheDocument();
  });

  it("renders the page breakdown table", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://example.com/checkout", analysisType: "checkout", device: "desktop", conversionScore: 55, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Page Breakdown")).toBeInTheDocument();
    });
    expect(screen.getByText("https://example.com/checkout")).toBeInTheDocument();
  });
});
