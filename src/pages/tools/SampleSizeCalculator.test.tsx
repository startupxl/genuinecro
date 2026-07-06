import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SampleSizeCalculator from "./SampleSizeCalculator";

function renderPage() {
  return render(
    <MemoryRouter>
      <SampleSizeCalculator />
    </MemoryRouter>
  );
}

describe("SampleSizeCalculator", () => {
  it("renders with sensible defaults already filled in", () => {
    renderPage();
    expect(screen.getByLabelText(/Baseline conversion rate/i)).toHaveValue(3);
    expect(screen.getByLabelText(/Minimum detectable effect/i)).toHaveValue(10);
  });

  it("computes and displays the required sample size per variant", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Calculate/i }));

    expect(screen.getByText(/Sample size per variant/i)).toBeInTheDocument();
    // 3% baseline, 10% relative MDE, 95%/80% defaults → ~53,208 per variant (hand-verified).
    expect(screen.getByText("53,208")).toBeInTheDocument();
  });

  it("recomputes a smaller sample size for a larger minimum detectable effect", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/Minimum detectable effect/i), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /Calculate/i }));

    expect(screen.getByText("6,452")).toBeInTheDocument();
  });

  it("does not require sign-in or show any gated app navigation", () => {
    renderPage();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  });
});
