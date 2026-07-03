import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TopIssuesList from "./TopIssuesList";
import type { ActionItem } from "@/lib/firebase/actionItems";

function buildItem(overrides: Partial<ActionItem> = {}): ActionItem {
  return {
    id: "item-1",
    userId: "uid-1",
    url: "https://example.com",
    analysisType: "homepage",
    category: "ux-clarity",
    severity: "high",
    title: "Weak headline",
    description: "d",
    fix: "Rewrite the hero headline to state the value prop.",
    impactScore: 80,
    status: "open",
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("TopIssuesList", () => {
  it("renders each issue with title, category, fix, and impact score", () => {
    render(<TopIssuesList items={[buildItem()]} />);
    expect(screen.getByText("Weak headline")).toBeInTheDocument();
    expect(screen.getByText("UX Clarity")).toBeInTheDocument();
    expect(screen.getByText("Rewrite the hero headline to state the value prop.")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
  });

  it("applies the severity border color per item", () => {
    const { container } = render(<TopIssuesList items={[buildItem({ severity: "low" })]} />);
    expect(container.querySelector(".border-l-friction-low")).not.toBeNull();
  });

  it("shows an empty state when there are no issues", () => {
    render(<TopIssuesList items={[]} />);
    expect(screen.getByText(/no issues found/i)).toBeInTheDocument();
  });
});
