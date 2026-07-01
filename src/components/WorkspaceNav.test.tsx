import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WorkspaceNav from "./WorkspaceNav";

describe("WorkspaceNav", () => {
  it("renders all eight sections with Dashboard and Conversion marked real", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );

    ["Dashboard", "Technical", "Content", "Conversion", "Monitoring", "Analysis", "Action Center", "Reports"].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("highlights the active section based on the current route", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );

    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink).toHaveClass("bg-secondary");
  });
});
