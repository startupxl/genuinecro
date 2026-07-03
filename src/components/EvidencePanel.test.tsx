import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EvidencePanel from "./EvidencePanel";
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
    benchmark: { industryAvg: 50, topPerformers: 80, label: "Score" },
    abTest: { testName: "Test", hypothesis: "H", control: "C", variant: "V", metric: "M", duration: "2 weeks" },
    ...overrides,
  };
}

describe("EvidencePanel", () => {
  it("shows the Evidence Base section and citation text when sourceCitation is present", () => {
    render(
      <EvidencePanel
        point={buildPoint({ sourceCitation: "Baymard Institute's publicly published checkout usability research" })}
      />
    );
    expect(screen.getByText("Evidence Base")).toBeInTheDocument();
    expect(
      screen.getByText("Baymard Institute's publicly published checkout usability research")
    ).toBeInTheDocument();
  });

  it("does not show the Evidence Base section when sourceCitation is absent", () => {
    render(<EvidencePanel point={buildPoint({ sourceCitation: undefined })} />);
    expect(screen.queryByText("Evidence Base")).not.toBeInTheDocument();
  });

  it("shows the empty-state prompt when no point is selected", () => {
    render(<EvidencePanel point={null} />);
    expect(
      screen.getByText("Select a friction point to view evidence and fix recommendations.")
    ).toBeInTheDocument();
  });
});
