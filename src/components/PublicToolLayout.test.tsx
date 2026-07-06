import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PublicToolLayout from "./PublicToolLayout";

function renderLayout(props: Partial<React.ComponentProps<typeof PublicToolLayout>> = {}) {
  return render(
    <MemoryRouter>
      <PublicToolLayout title="Sample Size Calculator" description="Figure out how many visitors you need." {...props}>
        <p>Tool content</p>
      </PublicToolLayout>
    </MemoryRouter>
  );
}

describe("PublicToolLayout", () => {
  it("renders the GenuineCRO logo linking home", () => {
    renderLayout();
    const homeLink = screen.getByRole("link", { name: "GenuineCRO" });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("renders the title, description, and children", () => {
    renderLayout();
    expect(screen.getByText("Sample Size Calculator")).toBeInTheDocument();
    expect(screen.getByText("Figure out how many visitors you need.")).toBeInTheDocument();
    expect(screen.getByText("Tool content")).toBeInTheDocument();
  });

  it("does not render the logged-in app navigation (Dashboard, Audits, etc.)", () => {
    renderLayout();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Action Center")).not.toBeInTheDocument();
  });

  it("shows a CTA linking back to GenuineCRO's homepage", () => {
    renderLayout();
    const ctaLink = screen.getByRole("link", { name: /Try GenuineCRO free/i });
    expect(ctaLink).toHaveAttribute("href", "/");
  });
});
