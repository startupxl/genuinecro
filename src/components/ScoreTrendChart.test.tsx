import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ScoreTrendChart from "./ScoreTrendChart";
import type { ScoreTrendPoint } from "@/lib/dashboardMetrics";

describe("ScoreTrendChart", () => {
  it("shows an empty state with fewer than two points", () => {
    render(<ScoreTrendChart data={[]} />);
    expect(screen.getByText(/run a few more audits/i)).toBeInTheDocument();
  });

  it("shows an empty state with exactly one point", () => {
    const data: ScoreTrendPoint[] = [{ date: "2026-06-01T00:00:00.000Z", score: 60 }];
    render(<ScoreTrendChart data={data} />);
    expect(screen.getByText(/run a few more audits/i)).toBeInTheDocument();
  });

  it("renders the chart container without crashing when there are at least two points", () => {
    const data: ScoreTrendPoint[] = [
      { date: "2026-06-01T00:00:00.000Z", score: 50 },
      { date: "2026-06-02T00:00:00.000Z", score: 65 },
    ];
    const { container } = render(<ScoreTrendChart data={data} />);
    expect(container.querySelector("[data-testid='score-trend-chart']")).toBeInTheDocument();
    expect(screen.queryByText(/run a few more audits/i)).not.toBeInTheDocument();
  });
});
