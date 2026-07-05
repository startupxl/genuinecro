import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Sidebar from "./Sidebar";
import type { AnalysisResult } from "@/lib/mockData";

const baseResult: AnalysisResult = {
  url: "https://example.com",
  timestamp: "2026-06-01T00:00:00.000Z",
  device: "desktop",
  analysisType: "homepage",
  conversionScore: 65,
  frictionPoints: [],
  benchmark: { overallScore: 65, industryAvg: 55, topQuartile: 80, categoryScores: {} },
};

describe("Sidebar — revenue impact settings entry point", () => {
  it("shows a 'Set up' prompt and calls onEditRevenueSettings when no site settings exist yet", () => {
    const onEdit = vi.fn();
    render(<Sidebar result={baseResult} onEditRevenueSettings={onEdit} hasSiteSettings={false} />);
    const button = screen.getByRole("button", { name: /Set up/i });
    fireEvent.click(button);
    expect(onEdit).toHaveBeenCalled();
  });

  it("shows an 'Edit' label once site settings already exist", () => {
    render(<Sidebar result={baseResult} onEditRevenueSettings={() => {}} hasSiteSettings={true} />);
    expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
  });

  it("omits the entry point when onEditRevenueSettings isn't provided", () => {
    render(<Sidebar result={baseResult} />);
    expect(screen.queryByRole("button", { name: /Set up|Edit/i })).not.toBeInTheDocument();
  });
});
