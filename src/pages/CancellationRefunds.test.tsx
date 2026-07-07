import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CancellationRefunds from "./CancellationRefunds";

describe("CancellationRefunds", () => {
  it("never displays the internal support email address in plain text, to avoid scraping/spam", () => {
    render(
      <MemoryRouter>
        <CancellationRefunds />
      </MemoryRouter>
    );

    expect(screen.queryByText(/experiments@genuinecro\.com/i)).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("experiments@genuinecro.com");
  });

  it("links to the Contact Us page for refund requests instead", () => {
    render(
      <MemoryRouter>
        <CancellationRefunds />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /contact us/i })).toHaveAttribute("href", "/contact");
  });
});
