import { describe, it, expect, vi, beforeEach } from "vitest";
import { subscribeToKit } from "./kit";

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

describe("subscribeToKit", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("posts the email to Kit's public form endpoint and returns true on success", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const result = await subscribeToKit("person@example.com");
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://app.kit.com/forms/9638140/subscriptions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/x-www-form-urlencoded" }),
        body: "email_address=person%40example.com",
      })
    );
  });

  it("returns false when the request fails", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const result = await subscribeToKit("person@example.com");
    expect(result).toBe(false);
  });

  it("returns false when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("network error"));
    const result = await subscribeToKit("person@example.com");
    expect(result).toBe(false);
  });
});
