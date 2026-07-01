import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComingSoon from "./ComingSoon";

describe("ComingSoon", () => {
  it("renders the given section title", () => {
    render(<ComingSoon title="Technical" />);
    expect(screen.getByText("Technical")).toBeInTheDocument();
    expect(screen.getByText("This section is coming soon.")).toBeInTheDocument();
  });
});
