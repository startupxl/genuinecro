import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getGA4AuthorizeUrl,
  getGA4Status,
  getGA4Properties,
  selectGA4Property,
  disconnectGA4,
  getGA4PageMetrics,
} from "./ga4";

const getIdTokenMock = vi.fn().mockResolvedValue("id-token-abc");
const user = { getIdToken: getIdTokenMock };

describe("ga4 client API", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    getIdTokenMock.mockClear();
  });

  it("getGA4AuthorizeUrl posts with a bearer token and returns the consent URL", async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ url: "https://accounts.google.com/mock" }) });

    const url = await getGA4AuthorizeUrl(user);

    expect(url).toBe("https://accounts.google.com/mock");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ga4/oauth/authorize-url",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer id-token-abc" }) })
    );
  });

  it("getGA4Status returns the connection status", async () => {
    const status = { connected: true, pendingPropertySelection: false, propertyId: "123", propertyDisplayName: "Acme" };
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => status });

    expect(await getGA4Status(user)).toEqual(status);
  });

  it("getGA4Properties returns the property list", async () => {
    const properties = [{ propertyId: "123", displayName: "Acme", accountName: "Acme Inc" }];
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ properties }) });

    expect(await getGA4Properties(user)).toEqual(properties);
  });

  it("selectGA4Property posts the chosen property", async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

    await selectGA4Property(user, "123", "Acme Site");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ga4/select-property",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ propertyId: "123", displayName: "Acme Site" }) })
    );
  });

  it("disconnectGA4 posts to the disconnect endpoint", async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    await disconnectGA4(user);
    expect(global.fetch).toHaveBeenCalledWith("/api/ga4/disconnect", expect.objectContaining({ method: "POST" }));
  });

  it("getGA4PageMetrics posts the url and returns the metrics payload", async () => {
    const payload = { tagDetection: { hasGA4Tag: true, measurementId: "G-ABC", hasGTM: false, gtmContainerId: null }, connected: false };
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => payload });

    const result = await getGA4PageMetrics(user, "https://example.com/pricing");

    expect(result).toEqual(payload);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ga4/page-metrics",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ url: "https://example.com/pricing" }) })
    );
  });

  it("throws with the server's error message on failure", async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, json: async () => ({ error: "Google Analytics is not connected" }) });
    await expect(getGA4Properties(user)).rejects.toThrow("Google Analytics is not connected");
  });
});
