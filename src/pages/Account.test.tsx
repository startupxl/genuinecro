import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getUserProfileMock = vi.fn();

vi.mock("@/lib/firebase/users", () => ({
  getUserProfile: (...args: unknown[]) => getUserProfileMock(...args),
  updateUserProfile: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  updateEmail: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1", email: "person@example.com" } }),
}));

vi.mock("@/hooks/useUsageTracking", () => ({
  useUsageTracking: () => ({ usage: { used: 2, limit: 10, canAnalyze: true, requiresAuth: false, requiresPaid: false, periodStart: null, periodEnd: null } }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Free", subscription: null }),
}));

import Account from "./Account";

describe("Account page", () => {
  beforeEach(() => {
    getUserProfileMock.mockReset();
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
});
