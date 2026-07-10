import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const expandMultivariateIdeaMock = vi.fn();
vi.mock("@/lib/api/multivariateIdea", () => ({
  expandMultivariateIdea: (...args: unknown[]) => expandMultivariateIdeaMock(...args),
}));

let mockPlan = "Pro";
let mockPlanStatus = "ready";
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: mockPlan, subscription: null, planStatus: mockPlanStatus }),
}));

import MultivariateIdeaExpander from "./MultivariateIdeaExpander";

function renderPage() {
  return render(
    <MemoryRouter>
      <MultivariateIdeaExpander />
    </MemoryRouter>
  );
}

describe("MultivariateIdeaExpander", () => {
  beforeEach(() => {
    mockPlan = "Pro";
    mockPlanStatus = "ready";
    expandMultivariateIdeaMock.mockReset();
  });

  it("shows an upgrade message and no form on a plan without workbench access", () => {
    mockPlan = "Free";
    renderPage();
    expect(screen.getByText(/Experiment Workbench requires Pro plan/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Make the CTA button more prominent/i)).not.toBeInTheDocument();
  });

  it("does not flash the upgrade message while the real plan is still loading", () => {
    mockPlan = "Free";
    mockPlanStatus = "loading";
    renderPage();
    expect(screen.queryByText(/Experiment Workbench requires Pro plan/i)).not.toBeInTheDocument();
  });

  it("disables Expand Idea until all three fields are filled", () => {
    renderPage();
    const button = screen.getByRole("button", { name: /Expand Idea/i });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/Homepage hero section/i), { target: { value: "Homepage hero" } });
    fireEvent.change(screen.getByPlaceholderText(/Make the CTA button more prominent/i), { target: { value: "Make the CTA more prominent" } });
    fireEvent.change(screen.getByPlaceholderText(/Signups/i), { target: { value: "Signups" } });

    expect(button).not.toBeDisabled();
  });

  it("runs the expansion and renders factors, combinations, and the testing note", async () => {
    expandMultivariateIdeaMock.mockResolvedValue({
      factors: [{ name: "CTA Color", levels: ["Control: teal", "Alternative: orange"] }],
      suggestedCombinations: [
        { label: "Combination 1", description: "Orange button + urgency copy", rationale: "High contrast plus urgency" },
      ],
      testingNote: "Consider a fractional design if traffic is limited.",
    });

    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/Homepage hero section/i), { target: { value: "Homepage hero" } });
    fireEvent.change(screen.getByPlaceholderText(/Make the CTA button more prominent/i), { target: { value: "Make the CTA more prominent" } });
    fireEvent.change(screen.getByPlaceholderText(/Signups/i), { target: { value: "Signups" } });
    fireEvent.click(screen.getByRole("button", { name: /Expand Idea/i }));

    await waitFor(() => {
      expect(screen.getByText("CTA Color")).toBeInTheDocument();
    });
    expect(screen.getByText("Control: teal")).toBeInTheDocument();
    expect(screen.getByText("Combination 1")).toBeInTheDocument();
    expect(screen.getByText("Orange button + urgency copy")).toBeInTheDocument();
    expect(screen.getByText(/Consider a fractional design/)).toBeInTheDocument();
    expect(expandMultivariateIdeaMock).toHaveBeenCalledWith({
      baseIdea: "Make the CTA more prominent",
      pageContext: "Homepage hero",
      goal: "Signups",
    });
  });
});
