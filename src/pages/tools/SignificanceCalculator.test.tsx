import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SignificanceCalculator from "./SignificanceCalculator";

function renderPage() {
  return render(
    <MemoryRouter>
      <SignificanceCalculator />
    </MemoryRouter>
  );
}

function fillAndSubmit(values: { controlVisitors: string; controlConversions: string; variantVisitors: string; variantConversions: string }) {
  fireEvent.change(screen.getByLabelText(/Control visitors/i), { target: { value: values.controlVisitors } });
  fireEvent.change(screen.getByLabelText(/Control conversions/i), { target: { value: values.controlConversions } });
  fireEvent.change(screen.getByLabelText(/Variant visitors/i), { target: { value: values.variantVisitors } });
  fireEvent.change(screen.getByLabelText(/Variant conversions/i), { target: { value: values.variantConversions } });
  fireEvent.click(screen.getByRole("button", { name: /Calculate/i }));
}

describe("SignificanceCalculator", () => {
  it("declares a clear win as significant", () => {
    renderPage();
    fillAndSubmit({ controlVisitors: "10000", controlConversions: "300", variantVisitors: "10000", variantConversions: "400" });

    expect(screen.getByText(/Significant/i)).toBeInTheDocument();
    expect(screen.getByText("3.00%")).toBeInTheDocument();
    expect(screen.getByText("4.00%")).toBeInTheDocument();
  });

  it("declares a noisy small-sample difference as not significant", () => {
    renderPage();
    fillAndSubmit({ controlVisitors: "50", controlConversions: "5", variantVisitors: "50", variantConversions: "6" });

    expect(screen.getByText(/Not significant/i)).toBeInTheDocument();
  });

  it("does not require sign-in or show any gated app navigation", () => {
    renderPage();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });
});
