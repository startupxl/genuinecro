import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const generateTestBriefMock = vi.fn();
vi.mock("@/lib/api/testBrief", () => ({
  generateTestBrief: (...args: unknown[]) => generateTestBriefMock(...args),
}));

let mockPlan = "Pro";
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: mockPlan, subscription: null }),
}));

import TestBriefWriter from "./TestBriefWriter";

function renderPage() {
  return render(
    <MemoryRouter>
      <TestBriefWriter />
    </MemoryRouter>
  );
}

describe("TestBriefWriter", () => {
  beforeEach(() => {
    mockPlan = "Pro";
    generateTestBriefMock.mockReset();
  });

  it("shows an upgrade message and no form on a plan without workbench access", () => {
    mockPlan = "Growth";
    renderPage();
    expect(screen.getByText(/Experiment Workbench requires Pro plan/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/A single, high-contrast CTA/i)).not.toBeInTheDocument();
  });

  it("disables Generate Brief until hypothesis, page, and goal are filled", () => {
    renderPage();
    const button = screen.getByRole("button", { name: /Generate Brief/i });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/startupxl.com\/pricing/i), { target: { value: "startupxl.com/pricing" } });
    fireEvent.change(screen.getByPlaceholderText(/A single, high-contrast CTA/i), { target: { value: "A single CTA will outperform three" } });
    fireEvent.change(screen.getByPlaceholderText(/^Signups$/i), { target: { value: "Signups" } });

    expect(button).not.toBeDisabled();
  });

  it("runs the generation and renders the full brief", async () => {
    generateTestBriefMock.mockResolvedValue({
      problemStatement: "Multiple CTAs compete for attention in the hero.",
      hypothesis: "A single CTA will outperform three.",
      successMetric: "Signup conversion rate",
      secondaryMetrics: ["Bounce rate"],
      variants: [
        { name: "Control", description: "Three CTAs of equal visual weight" },
        { name: "Variant A", description: "One primary CTA, others de-emphasized" },
      ],
      audienceAndSplit: "All visitors, 50/50 split",
      estimatedDuration: "3 weeks, based on current traffic",
      risks: ["Seasonal traffic dip could skew results"],
    });

    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/startupxl.com\/pricing/i), { target: { value: "startupxl.com/pricing" } });
    fireEvent.change(screen.getByPlaceholderText(/A single, high-contrast CTA/i), { target: { value: "A single CTA will outperform three" } });
    fireEvent.change(screen.getByPlaceholderText(/^Signups$/i), { target: { value: "Signups" } });
    fireEvent.click(screen.getByRole("button", { name: /Generate Brief/i }));

    await waitFor(() => {
      expect(screen.getByText("Signup conversion rate")).toBeInTheDocument();
    });
    expect(screen.getByText("Multiple CTAs compete for attention in the hero.")).toBeInTheDocument();
    expect(screen.getByText("Control")).toBeInTheDocument();
    expect(screen.getByText("One primary CTA, others de-emphasized")).toBeInTheDocument();
    expect(screen.getByText("3 weeks, based on current traffic")).toBeInTheDocument();
    expect(screen.getByText(/Seasonal traffic dip could skew results/)).toBeInTheDocument();
    expect(generateTestBriefMock).toHaveBeenCalledWith({
      hypothesis: "A single CTA will outperform three",
      page: "startupxl.com/pricing",
      goal: "Signups",
      context: "",
    });
  });
});
