import { describe, it, expect, vi, beforeEach } from "vitest";

const initializeAppMock = vi.fn(() => ({}));
const getAuthMock = vi.fn(() => ({}));
const signInWithEmailAndPasswordMock = vi.fn();
const getFirestoreMock = vi.fn(() => ({}));

vi.mock("firebase/app", () => ({
  initializeApp: (...args) => initializeAppMock(...args),
}));
vi.mock("firebase/auth", () => ({
  getAuth: (...args) => getAuthMock(...args),
  signInWithEmailAndPassword: (...args) => signInWithEmailAndPasswordMock(...args),
}));
vi.mock("firebase/firestore", () => ({
  getFirestore: (...args) => getFirestoreMock(...args),
}));

const fetchMock = vi.fn();
global.fetch = fetchMock;

process.env.VITE_FIREBASE_API_KEY = "test-web-api-key";
process.env.FIREBASE_SERVICE_EMAIL = "server@internal.genuinecro.app";
process.env.FIREBASE_SERVICE_PASSWORD = "test-password";

describe("firebaseServerAuth", () => {
  beforeEach(() => {
    signInWithEmailAndPasswordMock.mockReset();
    fetchMock.mockReset();
  });

  it("signs in once and reuses the same promise on subsequent calls", async () => {
    const { ensureServerSignedIn } = await import("./firebaseServerAuth.js");
    signInWithEmailAndPasswordMock.mockResolvedValue({ user: { uid: "server-uid" } });

    const first = ensureServerSignedIn();
    const second = ensureServerSignedIn();

    expect(first).toBe(second);
    await first;
    expect(signInWithEmailAndPasswordMock).toHaveBeenCalledTimes(1);
    expect(signInWithEmailAndPasswordMock).toHaveBeenCalledWith(
      {},
      "server@internal.genuinecro.app",
      "test-password"
    );
  });

  it("verifies a bearer token via the accounts:lookup REST endpoint", async () => {
    const { verifyIdToken } = await import("./firebaseServerAuth.js");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ users: [{ localId: "uid-1" }] }),
    });

    const decoded = await verifyIdToken("Bearer abc123");

    expect(decoded).toEqual({ uid: "uid-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=test-web-api-key",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("rejects when the Authorization header is missing or malformed", async () => {
    const { verifyIdToken } = await import("./firebaseServerAuth.js");
    await expect(verifyIdToken(undefined)).rejects.toThrow("Missing Authorization header");
    await expect(verifyIdToken("Basic abc123")).rejects.toThrow("Missing Authorization header");
  });

  it("rejects when the REST endpoint returns no matching user", async () => {
    const { verifyIdToken } = await import("./firebaseServerAuth.js");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ users: [] }) });
    await expect(verifyIdToken("Bearer abc123")).rejects.toThrow("Invalid or expired token");
  });
});
