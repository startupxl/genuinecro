import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const verifyIdTokenMock = vi.fn();
const ensureServerSignedInMock = vi.fn().mockResolvedValue(undefined);
const docMock = vi.fn((..._args) => ({ __doc: true }));
const getDocMock = vi.fn();
const setDocMock = vi.fn();
const deleteDocMock = vi.fn();

const buildAuthorizeUrlMock = vi.fn();
const exchangeCodeForTokensMock = vi.fn();
const listAccountSummariesMock = vi.fn();
const runPageReportMock = vi.fn();
const listConversionEventsMock = vi.fn();
const getConnectionMock = vi.fn();
const saveConnectionMock = vi.fn();
const deleteConnectionMock = vi.fn();
const getValidAccessTokenMock = vi.fn();
const addPropertyMappingMock = vi.fn();
const removePropertyMappingMock = vi.fn();
const getPropertyForDomainMock = vi.fn();
const detectGA4TagMock = vi.fn();

vi.mock("../firebaseServerAuth.js", () => ({
  verifyIdToken: (...args) => verifyIdTokenMock(...args),
  ensureServerSignedIn: (...args) => ensureServerSignedInMock(...args),
  serverDb: {},
}));

vi.mock("firebase/firestore", () => ({
  doc: (...args) => docMock(...args),
  getDoc: (...args) => getDocMock(...args),
  setDoc: (...args) => setDocMock(...args),
  deleteDoc: (...args) => deleteDocMock(...args),
}));

vi.mock("../lib/googleOAuth.js", () => ({
  buildAuthorizeUrl: (...args) => buildAuthorizeUrlMock(...args),
  exchangeCodeForTokens: (...args) => exchangeCodeForTokensMock(...args),
}));

vi.mock("../lib/ga4Api.js", () => ({
  listAccountSummaries: (...args) => listAccountSummariesMock(...args),
  runPageReport: (...args) => runPageReportMock(...args),
  listConversionEvents: (...args) => listConversionEventsMock(...args),
}));

vi.mock("../lib/ga4Connections.js", () => ({
  getConnection: (...args) => getConnectionMock(...args),
  saveConnection: (...args) => saveConnectionMock(...args),
  deleteConnection: (...args) => deleteConnectionMock(...args),
  getValidAccessToken: (...args) => getValidAccessTokenMock(...args),
  addPropertyMapping: (...args) => addPropertyMappingMock(...args),
  removePropertyMapping: (...args) => removePropertyMappingMock(...args),
  getPropertyForDomain: (...args) => getPropertyForDomainMock(...args),
}));

vi.mock("../lib/ga4TagDetection.js", () => ({
  detectGA4Tag: (...args) => detectGA4TagMock(...args),
}));

const fetchMock = vi.fn();
global.fetch = fetchMock;

const { default: ga4Router } = await import("./ga4.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/ga4", ga4Router);
  return app;
}

describe("GA4 Express routes", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
    getDocMock.mockReset();
    setDocMock.mockReset();
    deleteDocMock.mockReset();
    buildAuthorizeUrlMock.mockReset();
    exchangeCodeForTokensMock.mockReset();
    listAccountSummariesMock.mockReset();
    runPageReportMock.mockReset();
    listConversionEventsMock.mockReset();
    getConnectionMock.mockReset();
    saveConnectionMock.mockReset();
    deleteConnectionMock.mockReset();
    getValidAccessTokenMock.mockReset();
    addPropertyMappingMock.mockReset();
    removePropertyMappingMock.mockReset();
    getPropertyForDomainMock.mockReset();
    detectGA4TagMock.mockReset();
    fetchMock.mockReset();
    process.env.GOOGLE_OAUTH_CLIENT_ID = "client-123";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "secret-xyz";
    process.env.GOOGLE_OAUTH_REDIRECT_URI = "https://example.com/api/ga4/oauth/callback";
    process.env.FRONTEND_URL = "https://app.example.com";
  });

  describe("POST /oauth/authorize-url", () => {
    it("returns a Google consent URL and stores the CSRF state", async () => {
      verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
      buildAuthorizeUrlMock.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?mock=1");

      const res = await request(buildApp())
        .post("/api/ga4/oauth/authorize-url")
        .set("Authorization", "Bearer tok");

      expect(res.status).toBe(200);
      expect(res.body.url).toBe("https://accounts.google.com/o/oauth2/v2/auth?mock=1");
      expect(setDocMock).toHaveBeenCalled();
    });

    it("returns 401 when the caller isn't authenticated", async () => {
      verifyIdTokenMock.mockRejectedValue(new Error("Invalid or expired token"));
      const res = await request(buildApp()).post("/api/ga4/oauth/authorize-url");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /oauth/callback", () => {
    it("saves the OAuth tokens and redirects to settings?ga4=connected, without picking any property yet", async () => {
      getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ uid: "uid-1" }) });
      exchangeCodeForTokensMock.mockResolvedValue({
        accessToken: "at",
        refreshToken: "rt",
        expiresInSeconds: 3599,
      });
      getConnectionMock.mockResolvedValue(null);

      const res = await request(buildApp()).get("/api/ga4/oauth/callback?code=abc&state=state-1");

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("https://app.example.com/settings?ga4=connected");
      expect(saveConnectionMock).toHaveBeenCalledWith(
        "uid-1",
        expect.objectContaining({ accessToken: "at", refreshToken: "rt", properties: [] })
      );
      expect(listAccountSummariesMock).not.toHaveBeenCalled();
    });

    it("preserves any property mappings the account already had when reconnecting", async () => {
      getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ uid: "uid-1" }) });
      exchangeCodeForTokensMock.mockResolvedValue({ accessToken: "at", refreshToken: "rt", expiresInSeconds: 3599 });
      getConnectionMock.mockResolvedValue({
        properties: [{ domain: "example.com", propertyId: "123", propertyDisplayName: "Acme Site" }],
      });

      await request(buildApp()).get("/api/ga4/oauth/callback?code=abc&state=state-1");

      expect(saveConnectionMock).toHaveBeenCalledWith(
        "uid-1",
        expect.objectContaining({
          properties: [{ domain: "example.com", propertyId: "123", propertyDisplayName: "Acme Site" }],
        })
      );
    });

    it("redirects to error when Google reports a consent denial", async () => {
      const res = await request(buildApp()).get("/api/ga4/oauth/callback?error=access_denied");
      expect(res.headers.location).toBe("https://app.example.com/settings?ga4=error");
    });

    it("redirects to error when the state doesn't match a stored request", async () => {
      getDocMock.mockResolvedValue({ exists: () => false });
      const res = await request(buildApp()).get("/api/ga4/oauth/callback?code=abc&state=unknown");
      expect(res.headers.location).toBe("https://app.example.com/settings?ga4=error");
    });
  });

  describe("GET /status", () => {
    it("reports connected:true once OAuth tokens exist, and lists every mapped site", async () => {
      verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
      getConnectionMock.mockResolvedValue({
        accessToken: "at",
        properties: [
          { domain: "example.com", propertyId: "123", propertyDisplayName: "Acme Site" },
          { domain: "client.com", propertyId: "456", propertyDisplayName: "Client Site" },
        ],
      });

      const res = await request(buildApp()).get("/api/ga4/status").set("Authorization", "Bearer tok");

      expect(res.body).toEqual({
        connected: true,
        properties: [
          { domain: "example.com", propertyId: "123", propertyDisplayName: "Acme Site" },
          { domain: "client.com", propertyId: "456", propertyDisplayName: "Client Site" },
        ],
      });
    });

    it("reports connected:true with no properties yet right after OAuth, before any site is mapped", async () => {
      verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
      getConnectionMock.mockResolvedValue({ accessToken: "at", properties: [] });

      const res = await request(buildApp()).get("/api/ga4/status").set("Authorization", "Bearer tok");

      expect(res.body).toEqual({ connected: true, properties: [] });
    });

    it("reports disconnected when there's no connection at all", async () => {
      verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
      getConnectionMock.mockResolvedValue(null);

      const res = await request(buildApp()).get("/api/ga4/status").set("Authorization", "Bearer tok");

      expect(res.body).toEqual({ connected: false, properties: [] });
    });
  });

  describe("POST /add-property", () => {
    it("requires a domain and a propertyId", async () => {
      verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
      const res = await request(buildApp())
        .post("/api/ga4/add-property")
        .set("Authorization", "Bearer tok")
        .send({ domain: "example.com" });
      expect(res.status).toBe(400);
    });

    it("maps a domain to a property", async () => {
      verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
      const res = await request(buildApp())
        .post("/api/ga4/add-property")
        .set("Authorization", "Bearer tok")
        .send({ domain: "example.com", propertyId: "123", displayName: "Acme Site" });

      expect(res.body).toEqual({ success: true });
      expect(addPropertyMappingMock).toHaveBeenCalledWith("uid-1", "example.com", "123", "Acme Site");
    });
  });

  describe("POST /remove-property", () => {
    it("requires a domain", async () => {
      verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
      const res = await request(buildApp())
        .post("/api/ga4/remove-property")
        .set("Authorization", "Bearer tok")
        .send({});
      expect(res.status).toBe(400);
    });

    it("removes the mapping for that domain", async () => {
      verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
      const res = await request(buildApp())
        .post("/api/ga4/remove-property")
        .set("Authorization", "Bearer tok")
        .send({ domain: "example.com" });

      expect(res.body).toEqual({ success: true });
      expect(removePropertyMappingMock).toHaveBeenCalledWith("uid-1", "example.com");
    });
  });

  describe("POST /disconnect", () => {
    it("deletes the user's connection", async () => {
      verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
      const res = await request(buildApp()).post("/api/ga4/disconnect").set("Authorization", "Bearer tok");
      expect(res.body).toEqual({ success: true });
      expect(deleteConnectionMock).toHaveBeenCalledWith("uid-1");
    });
  });

  describe("POST /page-metrics", () => {
    it("returns tag detection only when the audited URL's domain has no mapped property", async () => {
      verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
      fetchMock.mockResolvedValue({ text: async () => "<html>no tag</html>" });
      detectGA4TagMock.mockReturnValue({ hasGA4Tag: false, measurementId: null, hasGTM: false, gtmContainerId: null });
      getPropertyForDomainMock.mockResolvedValue(null);

      const res = await request(buildApp())
        .post("/api/ga4/page-metrics")
        .set("Authorization", "Bearer tok")
        .send({ url: "https://example.com/pricing" });

      expect(res.body.connected).toBe(false);
      expect(res.body.tagDetection.hasGA4Tag).toBe(false);
      expect(runPageReportMock).not.toHaveBeenCalled();
    });

    it("returns behavioral data and conversion events for the property mapped to that URL's domain", async () => {
      verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
      fetchMock.mockResolvedValue({ text: async () => "<html>has tag</html>" });
      detectGA4TagMock.mockReturnValue({ hasGA4Tag: true, measurementId: "G-ABC", hasGTM: false, gtmContainerId: null });
      getPropertyForDomainMock.mockResolvedValue({ domain: "example.com", propertyId: "123", propertyDisplayName: "Acme Site" });
      getValidAccessTokenMock.mockResolvedValue("access-token");
      runPageReportMock.mockResolvedValue({ hasData: true, sessions: 100, bounceRate: 40, engagementRate: 60, avgEngagementTimeSeconds: 30, conversions: 5, pageViews: 120 });
      listConversionEventsMock.mockResolvedValue(["purchase"]);

      const res = await request(buildApp())
        .post("/api/ga4/page-metrics")
        .set("Authorization", "Bearer tok")
        .send({ url: "https://example.com/pricing" });

      expect(res.body.connected).toBe(true);
      expect(res.body.behavioral.sessions).toBe(100);
      expect(res.body.conversionEventNames).toEqual(["purchase"]);
      expect(getPropertyForDomainMock).toHaveBeenCalledWith("uid-1", "https://example.com/pricing");
      expect(runPageReportMock).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: "access-token", propertyId: "123", pagePath: "/pricing" })
      );
    });

    it("uses the client site's own property, not another connected site's, when auditing a client's domain", async () => {
      verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
      fetchMock.mockResolvedValue({ text: async () => "<html></html>" });
      detectGA4TagMock.mockReturnValue({ hasGA4Tag: false, measurementId: null, hasGTM: false, gtmContainerId: null });
      getPropertyForDomainMock.mockResolvedValue({ domain: "client.com", propertyId: "456", propertyDisplayName: "Client Site" });
      getValidAccessTokenMock.mockResolvedValue("access-token");
      runPageReportMock.mockResolvedValue({ hasData: true, sessions: 5, bounceRate: 10, engagementRate: 90, avgEngagementTimeSeconds: 10, conversions: 0, pageViews: 5 });
      listConversionEventsMock.mockResolvedValue([]);

      const res = await request(buildApp())
        .post("/api/ga4/page-metrics")
        .set("Authorization", "Bearer tok")
        .send({ url: "https://client.com/checkout" });

      expect(res.body.propertyDisplayName).toBe("Client Site");
      expect(runPageReportMock).toHaveBeenCalledWith(expect.objectContaining({ propertyId: "456" }));
    });

    it("returns a metricsError instead of failing the whole request when the GA4 API call errors", async () => {
      verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
      fetchMock.mockResolvedValue({ text: async () => "<html></html>" });
      detectGA4TagMock.mockReturnValue({ hasGA4Tag: false, measurementId: null, hasGTM: false, gtmContainerId: null });
      getPropertyForDomainMock.mockResolvedValue({ domain: "example.com", propertyId: "123", propertyDisplayName: "Acme Site" });
      getValidAccessTokenMock.mockRejectedValue(new Error("refresh token revoked"));

      const res = await request(buildApp())
        .post("/api/ga4/page-metrics")
        .set("Authorization", "Bearer tok")
        .send({ url: "https://example.com/pricing" });

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
      expect(res.body.behavioral).toBeNull();
      expect(res.body.metricsError).toBeTruthy();
    });

    it("requires a url", async () => {
      verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
      const res = await request(buildApp())
        .post("/api/ga4/page-metrics")
        .set("Authorization", "Bearer tok")
        .send({});
      expect(res.status).toBe(400);
    });
  });
});
