import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getRecentAnalysesMock = vi.fn();

vi.mock("@/lib/firebase/analyses", () => ({
  getRecentAnalyses: (...args: unknown[]) => getRecentAnalysesMock(...args),
  groupAnalysesByDomain: vi.fn((records: Array<{ url: string; conversionScore: number; createdAt: string }>) => {
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
  }),
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
    expect(screen.getByText("68")).toBeInTheDocument();
  });
});
