import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAccountSummaries, runPageReport, listConversionEvents } from "./ga4Api.js";

const fetchMock = vi.fn();
global.fetch = fetchMock;

beforeEach(() => fetchMock.mockReset());

describe("listAccountSummaries", () => {
  it("flattens accounts/properties into a single list with the properties/ prefix stripped", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        accountSummaries: [
          {
            displayName: "Acme Inc",
            propertySummaries: [{ property: "properties/123456789", displayName: "Acme Website" }],
          },
        ],
      }),
    });

    const result = await listAccountSummaries("access-token");

    expect(result).toEqual([{ propertyId: "123456789", displayName: "Acme Website", accountName: "Acme Inc" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
      expect.objectContaining({ headers: { Authorization: "Bearer access-token" } })
    );
  });

  it("throws with the response body when the request fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => "invalid token" });
    await expect(listAccountSummaries("bad-token")).rejects.toThrow(
      "GA4 account summaries failed [401]: invalid token"
    );
  });
});

describe("runPageReport", () => {
  it("converts GA4's fractional rates to percentages and averages engagement time per session", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        rows: [
          {
            dimensionValues: [{ value: "/pricing" }],
            metricValues: [
              { value: "200" }, // sessions
              { value: "0.4523" }, // bounceRate
              { value: "0.5477" }, // engagementRate
              { value: "12000" }, // userEngagementDuration (seconds, summed)
              { value: "18" }, // conversions
              { value: "350" }, // screenPageViews
            ],
          },
        ],
      }),
    });

    const result = await runPageReport({ accessToken: "tok", propertyId: "123", pagePath: "/pricing" });

    expect(result).toEqual({
      hasData: true,
      sessions: 200,
      bounceRate: 45.2,
      engagementRate: 54.8,
      avgEngagementTimeSeconds: 60,
      conversions: 18,
      pageViews: 350,
    });
  });

  it("returns a zeroed hasData:false result when GA4 has no rows for the page", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const result = await runPageReport({ accessToken: "tok", propertyId: "123", pagePath: "/nonexistent" });

    expect(result).toEqual({
      hasData: false,
      sessions: 0,
      bounceRate: 0,
      engagementRate: 0,
      avgEngagementTimeSeconds: 0,
      conversions: 0,
      pageViews: 0,
    });
  });

  it("filters the report to the exact page path", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    await runPageReport({ accessToken: "tok", propertyId: "123", pagePath: "/pricing" });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.dimensionFilter.filter.stringFilter.value).toBe("/pricing");
  });
});

describe("listConversionEvents", () => {
  it("returns just the event names", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ conversionEvents: [{ eventName: "purchase" }, { eventName: "generate_lead" }] }),
    });

    const result = await listConversionEvents({ accessToken: "tok", propertyId: "123" });
    expect(result).toEqual(["purchase", "generate_lead"]);
  });

  it("returns an empty array when no conversion events are configured", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const result = await listConversionEvents({ accessToken: "tok", propertyId: "123" });
    expect(result).toEqual([]);
  });
});
