import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getRecentAnalysesMock = vi.fn();
const groupAnalysesByDomainMock = vi.fn();
const getAllActionItemsMock = vi.fn();
const getLiveBenchmarksMock = vi.fn();
const getActiveScanJobsMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

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

vi.mock("@/lib/firebase/benchmarks", () => ({
  getLiveBenchmarks: (...args: unknown[]) => getLiveBenchmarksMock(...args),
}));

vi.mock("@/lib/firebase/scanJobs", () => ({
  getActiveScanJobs: (...args: unknown[]) => getActiveScanJobsMock(...args),
}));

vi.mock("@/components/NewAuditModal", () => ({
  default: ({ open }: { open: boolean }) => <div data-testid="new-audit-modal">{open ? "open" : "closed"}</div>,
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
    getLiveBenchmarksMock.mockReset().mockResolvedValue({});
    getActiveScanJobsMock.mockReset().mockResolvedValue([]);
    navigateMock.mockReset();
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

  it("opens the New Audit modal when the button is clicked, instead of navigating away", async () => {
    getRecentAnalysesMock.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("new-audit-modal")).toHaveTextContent("closed");
    });

    fireEvent.click(screen.getByText("New Audit"));

    expect(screen.getByTestId("new-audit-modal")).toHaveTextContent("open");
    expect(navigateMock).not.toHaveBeenCalledWith("/");
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

  it("navigates to the site's aggregated detail page when its row is clicked", async () => {
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
    fireEvent.click(row!);

    expect(navigateMock).toHaveBeenCalledWith("/sites/a.com");
  });

  it("shows a 'Due for re-audit' badge for a site last audited over 30 days ago", async () => {
    const overdueDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://overdue.com", analysisType: "homepage", device: "desktop", conversionScore: 60, createdAt: overdueDate },
      { url: "https://fresh.com", analysisType: "homepage", device: "desktop", conversionScore: 70, createdAt: recentDate },
    ]);
    groupAnalysesByDomainMock.mockReturnValue([
      { domain: "overdue.com", latestScore: 60, previousScore: null, scoreDelta: null, lastAnalyzedAt: overdueDate, analysisCount: 1 },
      { domain: "fresh.com", latestScore: 70, previousScore: null, scoreDelta: null, lastAnalyzedAt: recentDate, analysisCount: 1 },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("overdue.com")).toBeInTheDocument();
    });

    const overdueRow = within(screen.getByText("overdue.com").closest("[data-testid='site-row']")!);
    expect(overdueRow.getByText("Due for re-audit")).toBeInTheDocument();

    const freshRow = within(screen.getByText("fresh.com").closest("[data-testid='site-row']")!);
    expect(freshRow.queryByText("Due for re-audit")).not.toBeInTheDocument();
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

  it("renders the score trend and category scores widgets", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 50, createdAt: "2026-06-01T00:00:00.000Z", categoryScores: { navigation: 40 } },
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 65, createdAt: "2026-06-02T00:00:00.000Z", categoryScores: { navigation: 60 } },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Score Trend")).toBeInTheDocument();
    });
    expect(screen.getByText("Category Scores")).toBeInTheDocument();
    expect(screen.getByText("Navigation")).toBeInTheDocument();
  });

  it("uses live cross-account benchmarks once a category has enough samples", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 70, createdAt: "2026-06-01T00:00:00.000Z", categoryScores: { navigation: 70 } },
    ]);
    getLiveBenchmarksMock.mockResolvedValue({
      navigation: { accountAvg: 20, topQuartile: 90, sampleCount: 12 },
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Category Scores")).toBeInTheDocument();
    });
    expect(screen.getByText("+50")).toBeInTheDocument();
  });

  it("shows all-time friction points identified, A/B tests recommended, and issues resolved", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 50, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);
    getAllActionItemsMock.mockResolvedValue([
      { id: "1", userId: "uid-1", url: "https://example.com", analysisType: "homepage", category: "navigation", severity: "high", title: "Issue 1", description: "d", fix: "f", impactScore: 90, status: "open", createdAt: "2026-06-01T00:00:00.000Z", abTest: { testName: "Nav Test", hypothesis: "h", control: "c", variant: "v", metric: "m", duration: "2 weeks" } },
      { id: "2", userId: "uid-1", url: "https://example.com", analysisType: "homepage", category: "navigation", severity: "med", title: "Issue 2", description: "d", fix: "f", impactScore: 60, status: "resolved", createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "3", userId: "uid-1", url: "https://example.com", analysisType: "homepage", category: "navigation", severity: "low", title: "Issue 3", description: "d", fix: "f", impactScore: 40, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Friction Points Identified")).toBeInTheDocument();
    });

    const frictionCard = screen.getByText("Friction Points Identified").closest("div.bg-surface")!;
    expect(within(frictionCard).getByText("3")).toBeInTheDocument();

    const abTestCard = screen.getByText("A/B Tests Recommended").closest("div.bg-surface")!;
    expect(within(abTestCard).getByText("1")).toBeInTheDocument();

    const resolvedCard = screen.getByText("Issues Resolved").closest("div.bg-surface")!;
    expect(within(resolvedCard).getByText("1")).toBeInTheDocument();
  });

  it("filters Top Issues when a category bar is clicked", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 50, createdAt: "2026-06-01T00:00:00.000Z", categoryScores: { navigation: 40, "trust-credibility": 70 } },
    ]);
    getAllActionItemsMock.mockResolvedValue([
      { id: "1", userId: "uid-1", url: "https://example.com", analysisType: "homepage", category: "navigation", severity: "high", title: "Nav issue", description: "d", fix: "f", impactScore: 90, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "2", userId: "uid-1", url: "https://example.com", analysisType: "homepage", category: "trust-credibility", severity: "high", title: "Trust issue", description: "d", fix: "f", impactScore: 80, status: "open", createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Nav issue")).toBeInTheDocument();
    });
    expect(screen.getByText("Trust issue")).toBeInTheDocument();

    const categoryRow = screen.getByText("Category Scores").parentElement!
      .querySelector("[data-testid='category-delta-row']")!;
    fireEvent.click(within(categoryRow).getByText("Navigation"));

    expect(screen.getByText("Nav issue")).toBeInTheDocument();
    expect(screen.queryByText("Trust issue")).not.toBeInTheDocument();
  });

  it("shows in-progress issues in Top Issues alongside open ones, but not resolved ones", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 50, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);
    getAllActionItemsMock.mockResolvedValue([
      { id: "1", userId: "uid-1", url: "https://example.com", analysisType: "homepage", category: "navigation", severity: "high", title: "In progress issue", description: "d", fix: "f", impactScore: 90, status: "in_progress", createdAt: "2026-06-01T00:00:00.000Z" },
      { id: "2", userId: "uid-1", url: "https://example.com", analysisType: "homepage", category: "navigation", severity: "high", title: "Done issue", description: "d", fix: "f", impactScore: 80, status: "resolved", createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("In progress issue")).toBeInTheDocument();
    });
    expect(screen.queryByText("Done issue")).not.toBeInTheDocument();
  });

  it("shows the worst category and a Re-scan button on each site row, and Re-scan navigates with a prefilled URL", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 50, createdAt: "2026-06-01T00:00:00.000Z", categoryScores: { navigation: 20, "trust-credibility": 90 } },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Worst: Navigation/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Re-scan"));
    expect(navigateMock).toHaveBeenCalledWith("/", { state: { prefillUrl: "https://example.com" } });
  });

  it("shows a Scanning indicator instead of the score when a site has an active scan job", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 50, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);
    getActiveScanJobsMock.mockResolvedValue([
      { id: "job-1", userId: "uid-1", url: "https://example.com", analysisType: "homepage", device: "desktop", status: "scanning", createdAt: "2026-07-03T00:00:00.000Z" },
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
    expect(within(siteRow).getByText("Scanning…")).toBeInTheDocument();
    expect(within(siteRow).getByText("Re-scan").closest("button")).toBeDisabled();
  });

  it("shows issue momentum since the last scan", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 50, createdAt: "2026-06-01T00:00:00.000Z" },
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 60, createdAt: "2026-06-05T00:00:00.000Z" },
    ]);
    getAllActionItemsMock.mockResolvedValue([
      { id: "1", userId: "uid-1", url: "https://example.com", analysisType: "homepage", category: "navigation", severity: "high", title: "New one", description: "d", fix: "f", impactScore: 90, status: "open", createdAt: "2026-06-06T00:00:00.000Z" },
    ]);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/new/)).toBeInTheDocument();
    });
    expect(screen.getByText(/resolved/)).toBeInTheDocument();
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
    const pageBreakdownPanel = screen.getByText("Page Breakdown").parentElement!;
    expect(within(pageBreakdownPanel).getByText("https://example.com/checkout")).toBeInTheDocument();
  });
});
