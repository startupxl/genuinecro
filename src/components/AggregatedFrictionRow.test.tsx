import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AggregatedFrictionRow from "./AggregatedFrictionRow";
import type { AggregatedFrictionPoint } from "@/lib/siteAggregation";

const basePoint: AggregatedFrictionPoint = {
  key: "navigation::Confusing nav",
  category: "navigation",
  severity: "high",
  title: "Confusing nav",
  description: "The nav is confusing",
  fix: "Simplify the nav",
  avgImpactScore: 82,
  affectedUrls: ["https://a.com/", "https://a.com/pricing"],
};

describe("AggregatedFrictionRow", () => {
  it("shows the title, category label, severity, impact score, and affected page count while collapsed", () => {
    render(<AggregatedFrictionRow point={basePoint} />);

    expect(screen.getByText("Confusing nav")).toBeInTheDocument();
    expect(screen.getByText("Navigation")).toBeInTheDocument();
    expect(screen.getByText("82")).toBeInTheDocument();
    expect(screen.getByText(/2 pages/)).toBeInTheDocument();

    expect(screen.queryByText("The nav is confusing")).not.toBeInTheDocument();
  });

  it("expands to show the description, fix, and affected URLs when clicked", () => {
    render(<AggregatedFrictionRow point={basePoint} />);

    fireEvent.click(screen.getByText("Confusing nav"));

    expect(screen.getByText("The nav is confusing")).toBeInTheDocument();
    expect(screen.getByText("Simplify the nav")).toBeInTheDocument();
    expect(screen.getByText("https://a.com/")).toBeInTheDocument();
    expect(screen.getByText("https://a.com/pricing")).toBeInTheDocument();
  });

  it("collapses again on a second click", () => {
    render(<AggregatedFrictionRow point={basePoint} />);

    fireEvent.click(screen.getByText("Confusing nav"));
    expect(screen.getByText("The nav is confusing")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Confusing nav"));
    expect(screen.queryByText("The nav is confusing")).not.toBeInTheDocument();
  });

  it("shows an A/B Test Recommendation section when abTest data is present", () => {
    const withTest: AggregatedFrictionPoint = {
      ...basePoint,
      abTest: {
        testName: "Nav Simplification Test",
        hypothesis: "Fewer nav items reduce bounce",
        control: "Current 11-item nav",
        variant: "5-item grouped nav",
        metric: "Bounce rate",
        duration: "2 weeks",
      },
    };
    render(<AggregatedFrictionRow point={withTest} />);
    fireEvent.click(screen.getByText("Confusing nav"));

    expect(screen.getByText("A/B Test Recommendation")).toBeInTheDocument();
    expect(screen.getByText("Nav Simplification Test")).toBeInTheDocument();
  });

  it("omits the A/B Test Recommendation section when abTest data is absent", () => {
    render(<AggregatedFrictionRow point={basePoint} />);
    fireEvent.click(screen.getByText("Confusing nav"));

    expect(screen.queryByText("A/B Test Recommendation")).not.toBeInTheDocument();
  });

  it("copies the fix to the clipboard when Copy Fix is clicked", () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });

    render(<AggregatedFrictionRow point={basePoint} />);
    fireEvent.click(screen.getByText("Confusing nav"));
    fireEvent.click(screen.getByText("Copy Fix"));

    expect(writeText).toHaveBeenCalledWith("Simplify the nav");
  });
});
