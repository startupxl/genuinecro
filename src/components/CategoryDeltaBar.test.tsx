import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CategoryDeltaBar from "./CategoryDeltaBar";
import type { CategoryScoreEntry } from "@/lib/dashboardMetrics";

function buildEntry(overrides: Partial<CategoryScoreEntry> = {}): CategoryScoreEntry {
  return {
    category: "navigation",
    label: "Navigation",
    score: 45,
    deltaVsBenchmark: -13,
    siteCount: 2,
    worstSite: { url: "https://b.com", score: 30 },
    ...overrides,
  };
}

describe("CategoryDeltaBar", () => {
  it("renders the category label, score, and a negative delta in red", () => {
    render(<CategoryDeltaBar data={[buildEntry({ deltaVsBenchmark: -13 })]} />);

    expect(screen.getByText("Navigation")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    const delta = screen.getByText("-13");
    expect(delta).toHaveClass("text-destructive");
  });

  it("renders a positive delta in the primary color", () => {
    render(<CategoryDeltaBar data={[buildEntry({ deltaVsBenchmark: 8 })]} />);

    const delta = screen.getByText("+8");
    expect(delta).toHaveClass("text-primary");
  });

  it("calls onCategoryClick with the category key when a row is clicked", () => {
    const onCategoryClick = vi.fn();
    render(<CategoryDeltaBar data={[buildEntry({ category: "navigation" })]} onCategoryClick={onCategoryClick} />);

    fireEvent.click(screen.getByText("Navigation"));
    expect(onCategoryClick).toHaveBeenCalledWith("navigation");
  });

  it("highlights the selected category", () => {
    const { container } = render(
      <CategoryDeltaBar data={[buildEntry({ category: "navigation" })]} selectedCategory="navigation" />
    );
    expect(container.querySelector("[data-testid='category-delta-row']")).toHaveClass("bg-secondary");
  });

  it("shows an empty state when there is no data", () => {
    render(<CategoryDeltaBar data={[]} />);
    expect(screen.getByText(/no category scores yet/i)).toBeInTheDocument();
  });
});
