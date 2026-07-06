import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AATestChecker from "./AATestChecker";

function renderPage() {
  return render(
    <MemoryRouter>
      <AATestChecker />
    </MemoryRouter>
  );
}

function fillAndSubmit(values: { aVisitors: string; aConversions: string; bVisitors: string; bConversions: string }) {
  fireEvent.change(screen.getByLabelText(/Variant A visitors/i), { target: { value: values.aVisitors } });
  fireEvent.change(screen.getByLabelText(/Variant A conversions/i), { target: { value: values.aConversions } });
  fireEvent.change(screen.getByLabelText(/Variant B visitors/i), { target: { value: values.bVisitors } });
  fireEvent.change(screen.getByLabelText(/Variant B conversions/i), { target: { value: values.bConversions } });
  fireEvent.click(screen.getByRole("button", { name: /Check/i }));
}

describe("AATestChecker", () => {
  it("flags a suspicious significant difference between two identical variants as a setup problem", () => {
    renderPage();
    fillAndSubmit({ aVisitors: "10000", aConversions: "300", bVisitors: "10000", bConversions: "400" });

    expect(screen.getByText(/setup problem/i)).toBeInTheDocument();
  });

  it("gives a clean bill of health when there's no significant difference", () => {
    renderPage();
    fillAndSubmit({ aVisitors: "1000", aConversions: "100", bVisitors: "1000", bConversions: "100" });

    expect(screen.getByText(/No issues detected/i)).toBeInTheDocument();
  });

  it("does not require sign-in or show any gated app navigation", () => {
    renderPage();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });
});
