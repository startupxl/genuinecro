import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getOpenActionItemsMock = vi.fn();
const resolveActionItemMock = vi.fn();

vi.mock("@/lib/firebase/actionItems", () => ({
  getOpenActionItems: (...args: unknown[]) => getOpenActionItemsMock(...args),
  resolveActionItem: (...args: unknown[]) => resolveActionItemMock(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Free", subscription: null }),
}));

import ActionCenter from "./ActionCenter";

describe("ActionCenter", () => {
  beforeEach(() => {
    getOpenActionItemsMock.mockReset();
    resolveActionItemMock.mockReset();
  });

  it("shows an empty state when there are no open issues", async () => {
    getOpenActionItemsMock.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <ActionCenter />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("No open issues — you're all caught up.")).toBeInTheDocument();
    });
  });

  it("renders open issues and removes one from the list when resolved", async () => {
    getOpenActionItemsMock.mockResolvedValue([
      {
        id: "item-1",
        userId: "uid-1",
        url: "https://example.com",
        analysisType: "homepage",
        category: "ux-clarity",
        severity: "high",
        title: "Weak headline",
        description: "Fix this",
        fix: "Do this",
        impactScore: 80,
        status: "open",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
    resolveActionItemMock.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ActionCenter />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Weak headline")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Mark Resolved"));

    await waitFor(() => {
      expect(resolveActionItemMock).toHaveBeenCalledWith("item-1");
      expect(screen.queryByText("Weak headline")).not.toBeInTheDocument();
    });
  });
});
