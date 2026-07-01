import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const mockUnsubscribe = vi.fn();
let authStateCallback: ((user: unknown) => void) | null = null;
const ensureUserProfileMock = vi.fn().mockResolvedValue(undefined);

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn((_auth: unknown, callback: (user: unknown) => void) => {
    authStateCallback = callback;
    return mockUnsubscribe;
  }),
  signOut: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/integrations/firebase/client", () => ({ auth: {} }));

vi.mock("@/lib/firebase/users", () => ({
  ensureUserProfile: (...args: unknown[]) => ensureUserProfileMock(...args),
}));

import { AuthProvider, useAuth } from "./useAuth";

function TestConsumer() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{user ? `signed in as ${(user as { email: string }).email}` : "signed out"}</div>;
}

describe("useAuth", () => {
  beforeEach(() => {
    authStateCallback = null;
    mockUnsubscribe.mockClear();
    ensureUserProfileMock.mockClear();
  });

  it("starts loading, then reflects the signed-in user and ensures a profile doc exists", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(screen.getByText("loading")).toBeInTheDocument();

    authStateCallback!({ uid: "uid-1", email: "person@example.com", displayName: "Person", photoURL: null });

    await waitFor(() => {
      expect(screen.getByText("signed in as person@example.com")).toBeInTheDocument();
    });
    expect(ensureUserProfileMock).toHaveBeenCalledWith("uid-1", {
      email: "person@example.com",
      displayName: "Person",
      avatarUrl: null,
    });
  });

  it("reflects signed-out state and skips profile creation when there is no user", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    authStateCallback!(null);
    await waitFor(() => {
      expect(screen.getByText("signed out")).toBeInTheDocument();
    });
    expect(ensureUserProfileMock).not.toHaveBeenCalled();
  });
});
