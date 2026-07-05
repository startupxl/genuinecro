import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import type { AnalysisResult } from "@/lib/mockData";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

import AnalysisView from "./AnalysisView";

const DEFAULT_BENCHMARK = { industryAvg: 50, topPerformers: 80, label: "" };
const DEFAULT_ABTEST = { testName: "", hypothesis: "", control: "", variant: "", metric: "", duration: "" };

function point(id: string, category: string, title: string) {
  return {
    id,
    category,
    severity: "high" as const,
    title,
    description: "d",
    selector: "body",
    fix: "f",
    impactScore: 80,
    benchmark: DEFAULT_BENCHMARK,
    abTest: DEFAULT_ABTEST,
  };
}

const result: AnalysisResult = {
  url: "https://example.com",
  timestamp: "2026-06-01T00:00:00.000Z",
  device: "desktop",
  analysisType: "homepage",
  conversionScore: 65,
  frictionPoints: [
    point("1", "technical-seo", "Missing canonical"),
    point("2", "content-hierarchy", "Weak content structure"),
    point("3", "navigation", "Confusing nav"),
    point("4", "ux-clarity", "Vague CTA"),
  ] as AnalysisResult["frictionPoints"],
  benchmark: { overallScore: 65, industryAvg: 55, topQuartile: 80, categoryScores: {} },
};

function renderView() {
  return render(
    <MemoryRouter>
      <AnalysisView result={result} onNewAnalysis={() => {}} />
    </MemoryRouter>
  );
}

describe("AnalysisView category tab filter", () => {
  it("shows all issues under the All tab by default", () => {
    renderView();
    const list = within(screen.getByTestId("friction-list"));
    expect(list.getByText("Missing canonical")).toBeInTheDocument();
    expect(list.getByText("Weak content structure")).toBeInTheDocument();
    expect(list.getByText("Confusing nav")).toBeInTheDocument();
    expect(list.getByText("Vague CTA")).toBeInTheDocument();
  });

  it("filters to only Technical-tab issues when the Technical tab is clicked", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Technical" }));
    const list = within(screen.getByTestId("friction-list"));
    expect(list.getByText("Missing canonical")).toBeInTheDocument();
    expect(list.queryByText("Weak content structure")).not.toBeInTheDocument();
    expect(list.queryByText("Confusing nav")).not.toBeInTheDocument();
    expect(list.queryByText("Vague CTA")).not.toBeInTheDocument();
  });

  it("buckets an unmapped category (e.g. ux-clarity) under the Conversion tab", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Conversion" }));
    const list = within(screen.getByTestId("friction-list"));
    expect(list.getByText("Vague CTA")).toBeInTheDocument();
    expect(list.queryByText("Missing canonical")).not.toBeInTheDocument();
  });

  it("returns to showing all issues when All is clicked again", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Navigation" }));
    expect(within(screen.getByTestId("friction-list")).queryByText("Missing canonical")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    const list = within(screen.getByTestId("friction-list"));
    expect(list.getByText("Missing canonical")).toBeInTheDocument();
    expect(list.getByText("Confusing nav")).toBeInTheDocument();
  });
});
