import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import FrictionCard from "./FrictionCard";
import type { FrictionPoint } from "@/lib/mockData";

function buildPoint(overrides: Partial<FrictionPoint> = {}): FrictionPoint {
  return {
    id: "fp-1",
    category: "ux-clarity",
    severity: "high",
    title: "Test friction point",
    description: "A description of the issue.",
    selector: ".hero",
    fix: "Do the fix.",
    impactScore: 80,
    roiEstimate: "Could increase conversion by 10%",
    insightCluster: "Clarity Gap",
    benchmark: { industryAvg: 50, topPerformers: 80, label: "Score" },
    abTest: { testName: "Test", hypothesis: "H", control: "C", variant: "V", metric: "M", duration: "2 weeks" },
    ...overrides,
  };
}

describe("FrictionCard", () => {
  it("applies a red left-border stripe and 'Critical' label for high severity", () => {
    const { container } = render(
      <FrictionCard point={buildPoint({ severity: "high" })} index={0} isSelected={false} onClick={() => {}} />
    );
    expect(container.firstChild).toHaveClass("border-l-friction-high");
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("applies the medium-severity border and 'Warning' label", () => {
    const { container } = render(
      <FrictionCard point={buildPoint({ severity: "med" })} index={0} isSelected={false} onClick={() => {}} />
    );
    expect(container.firstChild).toHaveClass("border-l-friction-med");
    expect(screen.getByText("Warning")).toBeInTheDocument();
  });

  it("applies the low-severity border and 'Info' label", () => {
    const { container } = render(
      <FrictionCard point={buildPoint({ severity: "low" })} index={0} isSelected={false} onClick={() => {}} />
    );
    expect(container.firstChild).toHaveClass("border-l-friction-low");
    expect(screen.getByText("Info")).toBeInTheDocument();
  });

  it("no longer renders a pill-shaped severity badge", () => {
    const { container } = render(
      <FrictionCard point={buildPoint({ severity: "high" })} index={0} isSelected={false} onClick={() => {}} />
    );
    expect(container.querySelector(".badge-high")).toBeNull();
  });

  it("shows an 'Evidence-based' badge when sourceCitation is present", () => {
    render(
      <FrictionCard
        point={buildPoint({ sourceCitation: "Baymard Institute's publicly published checkout usability research" })}
        index={0}
        isSelected={false}
        onClick={() => {}}
      />
    );
    expect(screen.getByText("Evidence-based")).toBeInTheDocument();
  });

  it("does not show the 'Evidence-based' badge when sourceCitation is absent", () => {
    render(
      <FrictionCard point={buildPoint({ sourceCitation: undefined })} index={0} isSelected={false} onClick={() => {}} />
    );
    expect(screen.queryByText("Evidence-based")).not.toBeInTheDocument();
  });
});
