import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SiteHistoryTable from "./SiteHistoryTable";
import type { ScanHistoryEntry } from "@/lib/dashboardMetrics";

const entries: ScanHistoryEntry[] = [
  { id: "scan-1", url: "https://a.com/", analysisType: "homepage", device: "desktop", score: 55, createdAt: "2026-06-05T00:00:00.000Z" },
  { id: "scan-2", url: "https://a.com/", analysisType: "homepage", device: "desktop", score: 40, createdAt: "2026-06-01T00:00:00.000Z" },
];

describe("SiteHistoryTable", () => {
  it("shows an empty state when there is no scan history yet", () => {
    render(<SiteHistoryTable data={[]} onSelect={vi.fn()} />);
    expect(screen.getByText("No scan history yet.")).toBeInTheDocument();
  });

  it("renders one row per scan with its score", () => {
    render(<SiteHistoryTable data={entries} onSelect={vi.fn()} />);
    expect(screen.getByText("55")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
  });

  it("calls onSelect with the scan's id when a row is clicked", () => {
    const onSelect = vi.fn();
    render(<SiteHistoryTable data={entries} onSelect={onSelect} />);

    fireEvent.click(screen.getByText("55"));

    expect(onSelect).toHaveBeenCalledWith("scan-1");
  });
});
