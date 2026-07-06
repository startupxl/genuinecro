import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FreeTools from "./FreeTools";

function renderPage() {
  return render(
    <MemoryRouter>
      <FreeTools />
    </MemoryRouter>
  );
}

describe("FreeTools", () => {
  it("links to all three free tools", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /Sample Size Calculator/i })).toHaveAttribute(
      "href",
      "/free-cro-tools/sample-size-calculator"
    );
    expect(screen.getByRole("link", { name: /Significance Calculator/i })).toHaveAttribute(
      "href",
      "/free-cro-tools/significance-calculator"
    );
    expect(screen.getByRole("link", { name: /A\/A Test Checker/i })).toHaveAttribute(
      "href",
      "/free-cro-tools/aa-test-checker"
    );
  });

  it("does not require sign-in or show any gated app navigation", () => {
    renderPage();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });
});
