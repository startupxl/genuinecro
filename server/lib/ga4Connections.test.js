import { describe, it, expect, vi, beforeEach } from "vitest";

const ensureServerSignedInMock = vi.fn().mockResolvedValue(undefined);
const docMock = vi.fn((..._args) => ({ __doc: true }));
const getDocMock = vi.fn();
const setDocMock = vi.fn();
const deleteDocMock = vi.fn();
const refreshAccessTokenMock = vi.fn();

vi.mock("../firebaseServerAuth.js", () => ({
  ensureServerSignedIn: (...args) => ensureServerSignedInMock(...args),
  serverDb: {},
}));

vi.mock("firebase/firestore", () => ({
  doc: (...args) => docMock(...args),
  getDoc: (...args) => getDocMock(...args),
  setDoc: (...args) => setDocMock(...args),
  deleteDoc: (...args) => deleteDocMock(...args),
}));

vi.mock("./googleOAuth.js", () => ({
  refreshAccessToken: (...args) => refreshAccessTokenMock(...args),
}));

const { getConnection, saveConnection, deleteConnection, getValidAccessToken } = await import("./ga4Connections.js");

describe("ga4Connections", () => {
  beforeEach(() => {
    getDocMock.mockReset();
    setDocMock.mockReset();
    deleteDocMock.mockReset();
    refreshAccessTokenMock.mockReset();
  });

  it("getConnection returns null when no doc exists", async () => {
    getDocMock.mockResolvedValue({ exists: () => false });
    expect(await getConnection("uid-1")).toBeNull();
  });

  it("getConnection returns the stored data", async () => {
    const data = { propertyId: "123", accessToken: "tok" };
    getDocMock.mockResolvedValue({ exists: () => true, data: () => data });
    expect(await getConnection("uid-1")).toEqual(data);
  });

  it("saveConnection merges data into the user's doc", async () => {
    await saveConnection("uid-1", { propertyId: "123" });
    expect(setDocMock).toHaveBeenCalledWith(expect.anything(), { propertyId: "123" }, { merge: true });
  });

  it("deleteConnection removes the user's doc", async () => {
    await deleteConnection("uid-1");
    expect(deleteDocMock).toHaveBeenCalled();
  });

  describe("getValidAccessToken", () => {
    it("returns null when the user has no connection", async () => {
      getDocMock.mockResolvedValue({ exists: () => false });
      expect(await getValidAccessToken("uid-1")).toBeNull();
      expect(refreshAccessTokenMock).not.toHaveBeenCalled();
    });

    it("returns the stored access token without refreshing when it's still valid", async () => {
      getDocMock.mockResolvedValue({
        exists: () => true,
        data: () => ({
          accessToken: "still-valid",
          accessTokenExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
          refreshToken: "refresh-1",
        }),
      });

      const token = await getValidAccessToken("uid-1");
      expect(token).toBe("still-valid");
      expect(refreshAccessTokenMock).not.toHaveBeenCalled();
    });

    it("refreshes and persists a new access token when the stored one has expired", async () => {
      getDocMock.mockResolvedValue({
        exists: () => true,
        data: () => ({
          accessToken: "expired",
          accessTokenExpiresAt: new Date(Date.now() - 60_000).toISOString(),
          refreshToken: "refresh-1",
        }),
      });
      refreshAccessTokenMock.mockResolvedValue({ accessToken: "fresh-token", expiresInSeconds: 3599 });

      const token = await getValidAccessToken("uid-1");

      expect(token).toBe("fresh-token");
      expect(refreshAccessTokenMock).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: "refresh-1" }));
      expect(setDocMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ accessToken: "fresh-token" }),
        { merge: true }
      );
    });
  });
});
