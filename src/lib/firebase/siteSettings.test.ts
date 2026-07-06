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

import { getSiteSettings, saveSiteSettings } from "./siteSettings";

describe("getSiteSettings", () => {
  beforeEach(() => {
    docMock.mockClear();
    getDocMock.mockReset();
  });

  it("returns null when no settings doc exists for the domain", async () => {
    getDocMock.mockResolvedValue({ exists: () => false });
    const result = await getSiteSettings("uid-1", "example.com");
    expect(result).toBeNull();
  });

  it("reads back monthlyTraffic, averageOrderValue, and baselineConversionRate", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        userId: "uid-1",
        domain: "example.com",
        monthlyTraffic: 50000,
        averageOrderValue: 80,
        baselineConversionRate: 2.5,
      }),
    });
    const result = await getSiteSettings("uid-1", "example.com");
    expect(result).toEqual({ monthlyTraffic: 50000, averageOrderValue: 80, baselineConversionRate: 2.5 });
  });

  it("scopes the lookup to a deterministic doc keyed by user and domain", async () => {
    getDocMock.mockResolvedValue({ exists: () => false });
    await getSiteSettings("uid-1", "example.com");
    expect(docMock).toHaveBeenCalledWith({}, "siteSettings", "uid-1_example.com");
  });

  it("reads back siteType when present", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({ userId: "uid-1", domain: "example.com", siteType: "ecommerce" }),
    });
    const result = await getSiteSettings("uid-1", "example.com");
    expect(result?.siteType).toBe("ecommerce");
  });
});

describe("saveSiteSettings", () => {
  beforeEach(() => {
    docMock.mockClear();
    setDocMock.mockReset();
  });

  it("writes the settings merged with userId, domain, and an updatedAt timestamp", async () => {
    await saveSiteSettings("uid-1", "example.com", { monthlyTraffic: 50000, averageOrderValue: 80, baselineConversionRate: 2.5 });
    expect(setDocMock).toHaveBeenCalledWith(
      { __ref: true },
      { userId: "uid-1", domain: "example.com", monthlyTraffic: 50000, averageOrderValue: 80, baselineConversionRate: 2.5, updatedAt: "server-timestamp" },
      { merge: true }
    );
  });

  it("writes siteType when provided", async () => {
    await saveSiteSettings("uid-1", "example.com", { siteType: "saas" });
    expect(setDocMock).toHaveBeenCalledWith(
      { __ref: true },
      { userId: "uid-1", domain: "example.com", siteType: "saas", updatedAt: "server-timestamp" },
      { merge: true }
    );
  });
});
