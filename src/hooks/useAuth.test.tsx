import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const mockUnsubscribe = vi.fn();
let authStateCallback: ((user: unknown) => void) | null = null;
const ensureUserProfileMock = vi.fn().mockResolvedValue(undefined);
const getUserProfileMock = vi.fn();

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
  getUserProfile: (...args: unknown[]) => getUserProfileMock(...args),
}));

import { AuthProvider, useAuth } from "./useAuth";

function TestConsumer() {
  const { user, loading, profile } = useAuth();
  if (loading) return <div>loading</div>;
  if (!user) return <div>signed out</div>;
  return (
    <div>
      signed in as {(user as { email: string }).email}
      {" "}— profile name: {profile?.displayName ?? "none"}
    </div>
  );
}

describe("useAuth", () => {
  beforeEach(() => {
    authStateCallback = null;
    mockUnsubscribe.mockClear();
    ensureUserProfileMock.mockClear();
    getUserProfileMock.mockReset();
    getUserProfileMock.mockResolvedValue(null);
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
      expect(screen.getByText(/signed in as person@example.com/)).toBeInTheDocument();
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

  it("loads the Firestore profile (the real, editable display name) on sign-in", async () => {
    getUserProfileMock.mockResolvedValue({ displayName: "Real Name", email: "person@example.com", avatarUrl: null });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    authStateCallback!({ uid: "uid-1", email: "person@example.com", displayName: null, photoURL: null });

    await waitFor(() => {
      expect(screen.getByText(/profile name: Real Name/)).toBeInTheDocument();
    });
    expect(getUserProfileMock).toHaveBeenCalledWith("uid-1");
  });

  it("exposes refreshProfile to re-fetch the Firestore profile after an edit", async () => {
    getUserProfileMock.mockResolvedValue({ displayName: "Old Name", email: "person@example.com", avatarUrl: null });

    function RefreshConsumer() {
      const { profile, refreshProfile } = useAuth();
      return (
        <div>
          <span>name: {profile?.displayName ?? "none"}</span>
          <button onClick={() => refreshProfile()}>refresh</button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <RefreshConsumer />
      </AuthProvider>
    );
    authStateCallback!({ uid: "uid-1", email: "person@example.com", displayName: null, photoURL: null });
    await waitFor(() => expect(screen.getByText("name: Old Name")).toBeInTheDocument());

    getUserProfileMock.mockResolvedValue({ displayName: "New Name", email: "person@example.com", avatarUrl: null });
    screen.getByText("refresh").click();

    await waitFor(() => expect(screen.getByText("name: New Name")).toBeInTheDocument());
  });
});
