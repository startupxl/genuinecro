import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyIdTokenMock = vi.fn();

vi.mock("firebase-admin", () => ({
  default: {
    initializeApp: vi.fn(() => ({})),
    credential: { cert: vi.fn((sa) => sa) },
    auth: vi.fn(() => ({ verifyIdToken: verifyIdTokenMock })),
    firestore: vi.fn(() => ({})),
  },
}));

process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: "test-project" });

describe("firebaseAdmin", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
  });

  it("verifies a bearer token from the Authorization header", async () => {
    const { verifyIdToken } = await import("./firebaseAdmin.js");
    verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });

    const decoded = await verifyIdToken("Bearer abc123");

    expect(verifyIdTokenMock).toHaveBeenCalledWith("abc123");
    expect(decoded).toEqual({ uid: "uid-1" });
  });

  it("rejects when the Authorization header is missing or malformed", async () => {
    const { verifyIdToken } = await import("./firebaseAdmin.js");
    await expect(verifyIdToken(undefined)).rejects.toThrow("Missing Authorization header");
    await expect(verifyIdToken("Basic abc123")).rejects.toThrow("Missing Authorization header");
  });
});
