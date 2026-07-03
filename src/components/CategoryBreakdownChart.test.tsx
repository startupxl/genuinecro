import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoryBreakdownChart from "./CategoryBreakdownChart";
import type { CategoryBreakdownEntry } from "@/lib/dashboardMetrics";

describe("CategoryBreakdownChart", () => {
  it("renders each category with its label and count", () => {
    const data: CategoryBreakdownEntry[] = [
      { category: "ux-clarity", label: "UX Clarity", count: 5 },
      { category: "trust-credibility", label: "Trust & Credibility", count: 2 },
    ];

    render(<CategoryBreakdownChart data={data} />);

    expect(screen.getByText("UX Clarity")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Trust & Credibility")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders bars sized proportionally to the largest count", () => {
    const data: CategoryBreakdownEntry[] = [
      { category: "ux-clarity", label: "UX Clarity", count: 10 },
      { category: "trust-credibility", label: "Trust & Credibility", count: 5 },
    ];

    const { container } = render(<CategoryBreakdownChart data={data} />);
    const bars = container.querySelectorAll("[data-testid='category-bar-fill']");

    expect(bars[0]).toHaveStyle({ width: "100%" });
    expect(bars[1]).toHaveStyle({ width: "50%" });
  });

  it("shows an empty state when there is no data", () => {
    render(<CategoryBreakdownChart data={[]} />);

    expect(screen.getByText(/no friction found yet/i)).toBeInTheDocument();
  });
});
