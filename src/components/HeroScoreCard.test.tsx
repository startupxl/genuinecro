import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HeroScoreCard from "./HeroScoreCard";
import type { HeroScoreSummary } from "@/lib/dashboardMetrics";

function buildSummary(overrides: Partial<HeroScoreSummary> = {}): HeroScoreSummary {
  return {
    overallScore: 72,
    trendDelta: 5,
    band: "Good",
    pagesAudited: 12,
    lastAuditAt: "2026-06-05T00:00:00.000Z",
    ...overrides,
  };
}

describe("HeroScoreCard", () => {
  it("shows the overall score and grade band", () => {
    render(<HeroScoreCard summary={buildSummary({ overallScore: 72, band: "Good" })} />);
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("Good")).toBeInTheDocument();
  });

  it("shows a positive trend with an up arrow", () => {
    const { container } = render(<HeroScoreCard summary={buildSummary({ trendDelta: 5 })} />);
    expect(screen.getByText("+5")).toBeInTheDocument();
    expect(container.querySelector(".lucide-trending-up")).not.toBeNull();
  });

  it("shows a negative trend with a down arrow", () => {
    const { container } = render(<HeroScoreCard summary={buildSummary({ trendDelta: -8 })} />);
    expect(screen.getByText("-8")).toBeInTheDocument();
    expect(container.querySelector(".lucide-trending-down")).not.toBeNull();
  });

  it("shows no trend indicator when there is no delta yet", () => {
    render(<HeroScoreCard summary={buildSummary({ trendDelta: null })} />);
    expect(screen.queryByText(/vs last audit/i)).not.toBeInTheDocument();
  });

  it("shows pages audited count and a formatted last audit date", () => {
    render(<HeroScoreCard summary={buildSummary({ pagesAudited: 12, lastAuditAt: "2026-06-05T00:00:00.000Z" })} />);
    expect(screen.getByText(/12 pages audited/i)).toBeInTheDocument();
    expect(screen.getByText(/Jun 5, 2026/)).toBeInTheDocument();
  });
});
