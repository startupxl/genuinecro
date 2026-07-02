import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const subscribeToKitMock = vi.fn();

vi.mock("@/lib/api/kit", () => ({
  subscribeToKit: (...args: unknown[]) => subscribeToKitMock(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1", email: "person@example.com" } }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Free", subscription: null }),
}));

import Settings from "./Settings";

describe("Settings", () => {
  beforeEach(() => {
    localStorage.clear();
    subscribeToKitMock.mockReset().mockResolvedValue(true);
  });

  it("subscribes to Kit when Weekly Digest is turned on and saved", async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("switch", { name: "Weekly Digest" }));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(subscribeToKitMock).toHaveBeenCalledWith("person@example.com");
    });
  });

  it("does not call Kit when saving with both digest toggles off", async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("switch", { name: "Auto-detect Page Type" }));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.queryByText("Save")).not.toBeInTheDocument();
    });
    expect(subscribeToKitMock).not.toHaveBeenCalled();
  });
});
