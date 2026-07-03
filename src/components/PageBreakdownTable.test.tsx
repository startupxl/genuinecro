import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PageBreakdownTable from "./PageBreakdownTable";
import type { PageBreakdownEntry } from "@/lib/dashboardMetrics";

function buildEntry(overrides: Partial<PageBreakdownEntry> = {}): PageBreakdownEntry {
  return {
    url: "https://example.com/checkout",
    domain: "example.com",
    analysisType: "checkout",
    score: 55,
    issueCount: 4,
    lastCrawled: "2026-06-05T00:00:00.000Z",
    ...overrides,
  };
}

describe("PageBreakdownTable", () => {
  it("renders a row per page with url, type, score, issue count, and date", () => {
    render(<PageBreakdownTable data={[buildEntry()]} />);
    expect(screen.getByText("https://example.com/checkout")).toBeInTheDocument();
    expect(screen.getByText("checkout")).toBeInTheDocument();
    expect(screen.getByText("55")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText(/Jun 5, 2026/)).toBeInTheDocument();
  });

  it("shows an empty state with no pages", () => {
    render(<PageBreakdownTable data={[]} />);
    expect(screen.getByText(/no pages audited yet/i)).toBeInTheDocument();
  });
});
