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

const {
  getConnection,
  saveConnection,
  deleteConnection,
  getValidAccessToken,
  addPropertyMapping,
  removePropertyMapping,
  getPropertyForDomain,
  normalizeDomain,
} = await import("./ga4Connections.js");

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

  describe("normalizeDomain", () => {
    it("lowercases and strips a leading www.", () => {
      expect(normalizeDomain("WWW.Example.com")).toBe("example.com");
    });

    it("extracts the hostname from a full URL", () => {
      expect(normalizeDomain("https://www.example.com/pricing?x=1")).toBe("example.com");
    });

    it("leaves an already-bare domain alone", () => {
      expect(normalizeDomain("example.com")).toBe("example.com");
    });
  });

  describe("multi-site property mappings", () => {
    it("addPropertyMapping appends a new domain mapping to an account with no properties yet", async () => {
      getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ accessToken: "at", properties: [] }) });

      await addPropertyMapping("uid-1", "Example.com", "123", "Acme Site");

      expect(setDocMock).toHaveBeenCalledWith(
        expect.anything(),
        { properties: [{ domain: "example.com", propertyId: "123", propertyDisplayName: "Acme Site" }] },
        { merge: true }
      );
    });

    it("addPropertyMapping replaces an existing mapping for the same domain instead of duplicating it", async () => {
      getDocMock.mockResolvedValue({
        exists: () => true,
        data: () => ({
          accessToken: "at",
          properties: [
            { domain: "example.com", propertyId: "111", propertyDisplayName: "Old Property" },
            { domain: "client.com", propertyId: "222", propertyDisplayName: "Client Site" },
          ],
        }),
      });

      await addPropertyMapping("uid-1", "example.com", "999", "New Property");

      expect(setDocMock).toHaveBeenCalledWith(
        expect.anything(),
        {
          properties: [
            { domain: "client.com", propertyId: "222", propertyDisplayName: "Client Site" },
            { domain: "example.com", propertyId: "999", propertyDisplayName: "New Property" },
          ],
        },
        { merge: true }
      );
    });

    it("removePropertyMapping removes only the matching domain", async () => {
      getDocMock.mockResolvedValue({
        exists: () => true,
        data: () => ({
          properties: [
            { domain: "example.com", propertyId: "111", propertyDisplayName: "Acme" },
            { domain: "client.com", propertyId: "222", propertyDisplayName: "Client Site" },
          ],
        }),
      });

      await removePropertyMapping("uid-1", "example.com");

      expect(setDocMock).toHaveBeenCalledWith(
        expect.anything(),
        { properties: [{ domain: "client.com", propertyId: "222", propertyDisplayName: "Client Site" }] },
        { merge: true }
      );
    });

    it("getPropertyForDomain finds the mapping matching a given URL's domain", async () => {
      getDocMock.mockResolvedValue({
        exists: () => true,
        data: () => ({
          properties: [
            { domain: "example.com", propertyId: "111", propertyDisplayName: "Acme" },
            { domain: "client.com", propertyId: "222", propertyDisplayName: "Client Site" },
          ],
        }),
      });

      const result = await getPropertyForDomain("uid-1", "https://www.client.com/pricing");
      expect(result).toEqual({ domain: "client.com", propertyId: "222", propertyDisplayName: "Client Site" });
    });

    it("getPropertyForDomain returns null when no connection exists or no mapping matches", async () => {
      getDocMock.mockResolvedValue({ exists: () => false });
      expect(await getPropertyForDomain("uid-1", "https://example.com")).toBeNull();

      getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ properties: [] }) });
      expect(await getPropertyForDomain("uid-1", "https://example.com")).toBeNull();
    });
  });
});
