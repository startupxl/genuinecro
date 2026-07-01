import { describe, it, expect, vi, beforeEach } from "vitest";

const docMock = vi.fn((..._args: unknown[]) => ({ __ref: true }));
const getDocMock = vi.fn();
const setDocMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => docMock(...args),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  serverTimestamp: () => "server-timestamp",
}));

vi.mock("@/integrations/firebase/client", () => ({ db: {} }));

import { ensureUserProfile, getUserProfile, updateUserProfile } from "./users";

describe("firebase users module", () => {
  beforeEach(() => {
    docMock.mockClear();
    getDocMock.mockReset();
    setDocMock.mockReset();
  });

  it("creates a profile doc when one doesn't exist yet", async () => {
    getDocMock.mockResolvedValue({ exists: () => false });
    await ensureUserProfile("uid-1", { email: "a@b.com", displayName: "A", avatarUrl: null });
    expect(setDocMock).toHaveBeenCalledWith(
      { __ref: true },
      expect.objectContaining({ email: "a@b.com", displayName: "A", avatarUrl: null, createdAt: "server-timestamp" })
    );
  });

  it("does not overwrite an existing profile doc", async () => {
    getDocMock.mockResolvedValue({ exists: () => true });
    await ensureUserProfile("uid-1", { email: "a@b.com", displayName: "A", avatarUrl: null });
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it("reads back an existing profile", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({ email: "a@b.com", displayName: "A", avatarUrl: null }),
    });
    const profile = await getUserProfile("uid-1");
    expect(profile).toEqual({ email: "a@b.com", displayName: "A", avatarUrl: null });
  });

  it("merges partial updates without overwriting other fields", async () => {
    await updateUserProfile("uid-1", { displayName: "New Name" });
    expect(setDocMock).toHaveBeenCalledWith({ __ref: true }, { displayName: "New Name" }, { merge: true });
  });
});
