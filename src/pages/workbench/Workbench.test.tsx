import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

let mockPlan = "Free";
let mockPlanStatus = "ready";
const mockUser: { uid: string } | null = { uid: "uid-1" };

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: mockPlan, subscription: null, planStatus: mockPlanStatus }),
}));

import Workbench from "./Workbench";

function renderPage() {
  return render(
    <MemoryRouter>
      <Workbench />
    </MemoryRouter>
  );
}

describe("Workbench", () => {
  beforeEach(() => {
    mockPlan = "Free";
    mockPlanStatus = "ready";
  });

  it("shows an upgrade message instead of the tool list on a plan without workbench access", () => {
    renderPage();
    expect(screen.getByText(/Experiment Workbench requires Pro plan/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Multivariate Idea Expander/i })).not.toBeInTheDocument();
  });

  it("does not flash the upgrade message while the real plan is still loading", () => {
    mockPlanStatus = "loading";
    renderPage();
    expect(screen.queryByText(/Experiment Workbench requires Pro plan/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Multivariate Idea Expander/i })).not.toBeInTheDocument();
  });

  it("links to both tools when the plan has workbench access", () => {
    mockPlan = "Pro";
    renderPage();
    expect(screen.getByRole("link", { name: /Multivariate Idea Expander/i })).toHaveAttribute(
      "href",
      "/workbench/multivariate-idea-expander"
    );
    expect(screen.getByRole("link", { name: /Test Brief Writer/i })).toHaveAttribute(
      "href",
      "/workbench/test-brief-writer"
    );
  });
});
