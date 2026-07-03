import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getActiveActionItemsMock = vi.fn();
const updateActionItemStatusMock = vi.fn();

vi.mock("@/lib/firebase/actionItems", () => ({
  getActiveActionItems: (...args: unknown[]) => getActiveActionItemsMock(...args),
  updateActionItemStatus: (...args: unknown[]) => updateActionItemStatusMock(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Free", subscription: null }),
}));

import ActionCenter from "./ActionCenter";

const baseItem = {
  id: "item-1",
  userId: "uid-1",
  url: "https://example.com",
  analysisType: "homepage",
  category: "ux-clarity",
  severity: "high" as const,
  title: "Weak headline",
  description: "Fix this",
  fix: "Do this",
  impactScore: 80,
  createdAt: "2026-06-01T00:00:00.000Z",
};

describe("ActionCenter", () => {
  beforeEach(() => {
    getActiveActionItemsMock.mockReset();
    updateActionItemStatusMock.mockReset().mockResolvedValue(undefined);
  });

  it("shows an empty state when there are no active issues", async () => {
    getActiveActionItemsMock.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <ActionCenter />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("No open issues — you're all caught up.")).toBeInTheDocument();
    });
  });

  it("moves an item to In Progress without removing it from the list", async () => {
    getActiveActionItemsMock.mockResolvedValue([{ ...baseItem, status: "open" }]);

    render(
      <MemoryRouter>
        <ActionCenter />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Weak headline")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("In Progress"));

    await waitFor(() => {
      expect(updateActionItemStatusMock).toHaveBeenCalledWith("item-1", "in_progress");
    });
    expect(screen.getByText("Weak headline")).toBeInTheDocument();
  });

  it("removes an item from the list once marked Done", async () => {
    getActiveActionItemsMock.mockResolvedValue([{ ...baseItem, status: "open" }]);

    render(
      <MemoryRouter>
        <ActionCenter />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Weak headline")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Done"));

    await waitFor(() => {
      expect(updateActionItemStatusMock).toHaveBeenCalledWith("item-1", "resolved");
      expect(screen.queryByText("Weak headline")).not.toBeInTheDocument();
    });
  });

  it("highlights the item's current status", async () => {
    getActiveActionItemsMock.mockResolvedValue([{ ...baseItem, status: "in_progress" }]);

    render(
      <MemoryRouter>
        <ActionCenter />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Weak headline")).toBeInTheDocument();
    });

    expect(screen.getByText("In Progress")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("To Do")).toHaveAttribute("aria-pressed", "false");
  });
});
