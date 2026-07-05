import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const checkMessageMatchMock = vi.fn();
vi.mock("@/lib/api/messageMatch", () => ({
  checkMessageMatch: (...args: unknown[]) => checkMessageMatchMock(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Free", subscription: null }),
}));

import MessageMatchChecker from "./MessageMatchChecker";

function renderPage() {
  return render(
    <MemoryRouter>
      <MessageMatchChecker />
    </MemoryRouter>
  );
}

describe("MessageMatchChecker", () => {
  beforeEach(() => {
    checkMessageMatchMock.mockReset();
  });

  it("disables Check Match until both the URL and source message are filled", () => {
    renderPage();
    const button = screen.getByRole("button", { name: /Check Match/i });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/example.com/i), { target: { value: "example.com" } });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/Get 50% off/i), { target: { value: "Get 50% off your first order" } });
    expect(button).not.toBeDisabled();
  });

  it("runs a check and renders the match score, verdict, and headline", async () => {
    checkMessageMatchMock.mockResolvedValue({
      url: "https://example.com",
      sourceMessage: "Get 50% off your first order",
      matchScore: 85,
      verdict: "Strong Match",
      pageHeadline: "50% Off Everything Today",
      alignedElements: ["Headline restates the 50% off offer"],
      misalignedElements: [],
      recommendations: [],
    });

    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/example.com/i), { target: { value: "example.com" } });
    fireEvent.change(screen.getByPlaceholderText(/Get 50% off/i), { target: { value: "Get 50% off your first order" } });
    fireEvent.click(screen.getByRole("button", { name: /Check Match/i }));

    await waitFor(() => {
      expect(screen.getByText("85/100")).toBeInTheDocument();
    });
    expect(screen.getByText("Strong Match")).toBeInTheDocument();
    expect(screen.getByText("50% Off Everything Today")).toBeInTheDocument();
    expect(screen.getByText("Headline restates the 50% off offer")).toBeInTheDocument();
    expect(checkMessageMatchMock).toHaveBeenCalledWith("https://example.com", "Get 50% off your first order");
  });

  it("shows misaligned elements and recommendations when the match is weak", async () => {
    checkMessageMatchMock.mockResolvedValue({
      url: "https://example.com",
      sourceMessage: "Get 50% off",
      matchScore: 30,
      verdict: "Mismatch",
      pageHeadline: "Enterprise Cloud Security",
      alignedElements: [],
      misalignedElements: ["Page never mentions any discount or offer"],
      recommendations: ["Add the 50% off offer prominently in the hero"],
    });

    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/example.com/i), { target: { value: "example.com" } });
    fireEvent.change(screen.getByPlaceholderText(/Get 50% off/i), { target: { value: "Get 50% off" } });
    fireEvent.click(screen.getByRole("button", { name: /Check Match/i }));

    await waitFor(() => {
      expect(screen.getByText("Mismatch")).toBeInTheDocument();
    });
    expect(screen.getByText("Page never mentions any discount or offer")).toBeInTheDocument();
    expect(screen.getByText(/Add the 50% off offer prominently/)).toBeInTheDocument();
  });
});
