import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getUserProfileMock = vi.fn();
const updateUserProfileMock = vi.fn();
const refreshProfileMock = vi.fn();
let mockCurrentPlan = "Free";

vi.mock("@/lib/firebase/users", () => ({
  getUserProfile: (...args: unknown[]) => getUserProfileMock(...args),
  updateUserProfile: (...args: unknown[]) => updateUserProfileMock(...args),
}));

vi.mock("firebase/auth", () => ({
  updateEmail: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1", email: "person@example.com" }, refreshProfile: refreshProfileMock }),
}));

vi.mock("@/hooks/useUsageTracking", () => ({
  useUsageTracking: () => ({ usage: { used: 2, limit: 10, canAnalyze: true, requiresAuth: false, requiresPaid: false, periodStart: null, periodEnd: null } }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: mockCurrentPlan, subscription: null }),
}));

import Account from "./Account";

describe("Account page", () => {
  beforeEach(() => {
    getUserProfileMock.mockReset();
    updateUserProfileMock.mockReset();
    refreshProfileMock.mockReset();
    mockCurrentPlan = "Free";
  });

  it("shows the real plan from useSubscription, not a hardcoded Free badge", async () => {
    mockCurrentPlan = "Agency";
    getUserProfileMock.mockResolvedValue({ displayName: "Person Name", email: "person@example.com", avatarUrl: null });

    render(
      <MemoryRouter>
        <Account />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Agency Plan")).toBeInTheDocument();
    });
    expect(screen.queryByText("Free Plan")).not.toBeInTheDocument();
  });

  it("loads the Firestore profile into the form fields", async () => {
    getUserProfileMock.mockResolvedValue({ displayName: "Person Name", email: "person@example.com", avatarUrl: null });

    render(
      <MemoryRouter>
        <Account />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Person Name")).toBeInTheDocument();
    });
    expect(getUserProfileMock).toHaveBeenCalledWith("uid-1");
  });

  it("refreshes the shared auth profile after saving, so the sidebar picks up the new name immediately", async () => {
    getUserProfileMock.mockResolvedValue({ displayName: "Old Name", email: "person@example.com", avatarUrl: null });
    updateUserProfileMock.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <Account />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByDisplayValue("Old Name")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Display Name"), { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateUserProfileMock).toHaveBeenCalledWith("uid-1", { displayName: "New Name", avatarUrl: "" });
    });
    expect(refreshProfileMock).toHaveBeenCalled();
  });
});
