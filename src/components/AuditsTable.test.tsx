import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import AuditsTable from "./AuditsTable";
import type { AuditListEntry } from "@/lib/dashboardMetrics";

const entries: AuditListEntry[] = [
  { id: "a1", url: "https://a.com/", analysisType: "homepage", device: "desktop", score: 65, scoreDelta: 10, issueCount: 3, isCritical: false, createdAt: "2026-06-05T00:00:00.000Z" },
  { id: "a2", url: "https://b.com/", analysisType: "homepage", device: "desktop", score: 40, scoreDelta: null, issueCount: 5, isCritical: true, createdAt: "2026-06-01T00:00:00.000Z" },
];

describe("AuditsTable", () => {
  it("shows an empty state when there are no audits yet", () => {
    render(<AuditsTable data={[]} onSelect={vi.fn()} onRescan={vi.fn()} />);
    expect(screen.getByText("No audits yet.")).toBeInTheDocument();
  });

  it("renders one row per audit with score, trend, and issue count", () => {
    render(<AuditsTable data={entries} onSelect={vi.fn()} onRescan={vi.fn()} />);

    expect(screen.getByText("https://a.com/")).toBeInTheDocument();
    expect(screen.getByText("65")).toBeInTheDocument();
    expect(screen.getByText("+10")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows a critical badge only for scores under 50", () => {
    render(<AuditsTable data={entries} onSelect={vi.fn()} onRescan={vi.fn()} />);

    const criticalRow = screen.getByText("https://b.com/").closest("tr")!;
    expect(within(criticalRow).getByText("Critical")).toBeInTheDocument();

    const healthyRow = screen.getByText("https://a.com/").closest("tr")!;
    expect(within(healthyRow).queryByText("Critical")).not.toBeInTheDocument();
  });

  it("calls onSelect with the audit's id when a row is clicked", () => {
    const onSelect = vi.fn();
    render(<AuditsTable data={entries} onSelect={onSelect} onRescan={vi.fn()} />);

    fireEvent.click(screen.getByText("https://a.com/"));

    expect(onSelect).toHaveBeenCalledWith("a1");
  });

  it("calls onRescan with the url when Re-scan is clicked, without triggering onSelect", () => {
    const onSelect = vi.fn();
    const onRescan = vi.fn();
    render(<AuditsTable data={entries} onSelect={onSelect} onRescan={onRescan} />);

    const row = screen.getByText("https://a.com/").closest("tr")!;
    fireEvent.click(within(row).getByText("Re-scan"));

    expect(onRescan).toHaveBeenCalledWith("https://a.com/");
    expect(onSelect).not.toHaveBeenCalled();
  });
});
