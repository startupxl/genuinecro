import { describe, it, expect, vi, beforeEach } from "vitest";
import { isPrivateAddress, assertPublicUrl, validateTargetUrl, safeFetch, readTextCapped, UnsafeUrlError } from "./ssrf.js";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1",
    "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:169.254.169.254", "64:ff9b::7f00:1", "2001:db8::1",
  ])("treats %s as private", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "treats %s as public",
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );

  it("refuses anything that isn't a valid IP", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
  });
});

describe("assertPublicUrl", () => {
  it("accepts a normal public https URL", async () => {
    const url = await assertPublicUrl("https://example.com/pricing", { lookup: publicLookup });
    expect(url.hostname).toBe("example.com");
  });

  it.each([
    ["file:///etc/passwd", "Only http"],
    ["ftp://example.com", "Only http"],
    ["javascript:alert(1)", "Only http"],
    ["https://user:pass@example.com", "credentials"],
    ["http://localhost/admin", "not allowed"],
    ["http://app.localhost/", "not allowed"],
    ["http://db.internal/", "not allowed"],
    ["http://127.0.0.1/", "not allowed"],
    ["http://2130706433/", "not allowed"], // decimal form of 127.0.0.1
    ["http://0x7f.0.0.1/", "not allowed"], // hex form
    ["http://[::1]/", "not allowed"],
    ["http://169.254.169.254/latest/meta-data/", "not allowed"],
    ["http://[::ffff:169.254.169.254]/", "not allowed"],
    ["https://example.com:22/", "port"],
    ["https://example.com:6379/", "port"],
    ["not a url", "Invalid"],
  ])("rejects %s", async (input, why) => {
    await expect(assertPublicUrl(input, { lookup: publicLookup })).rejects.toThrow(UnsafeUrlError);
    await expect(assertPublicUrl(input, { lookup: publicLookup })).rejects.toThrow(new RegExp(why, "i"));
  });

  it("rejects a public-looking hostname that resolves to a private address", async () => {
    const lookup = async () => [{ address: "10.0.0.5", family: 4 }];
    await expect(assertPublicUrl("https://evil.example.com", { lookup })).rejects.toThrow(/non-public/);
  });

  it("rejects when ANY resolved address is private (mixed A records)", async () => {
    const lookup = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ];
    await expect(assertPublicUrl("https://mixed.example.com", { lookup })).rejects.toThrow(/non-public/);
  });

  it("rejects hosts that don't resolve", async () => {
    const lookup = async () => {
      throw new Error("ENOTFOUND");
    };
    await expect(assertPublicUrl("https://nope.example.com", { lookup })).rejects.toThrow(/resolve/);
  });
});

describe("validateTargetUrl (no-DNS check for third-party scraping)", () => {
  it("accepts public URLs", () => {
    expect(validateTargetUrl("https://example.com/a").hostname).toBe("example.com");
  });
  it.each(["http://localhost:3000", "http://10.0.0.1", "https://intranet", "file:///etc/hosts", "https://u:p@example.com", "x".repeat(3000)])(
    "rejects %s",
    (input) => {
      expect(() => validateTargetUrl(input)).toThrow(UnsafeUrlError);
    },
  );
});

describe("safeFetch", () => {
  beforeEach(() => fetchMock.mockReset());

  it("returns the response when there is no redirect", async () => {
    fetchMock.mockResolvedValue({ status: 200, headers: { get: () => null } });
    const res = await safeFetch("https://example.com", { lookup: publicLookup });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/", expect.objectContaining({ redirect: "manual" }));
  });

  it("follows a redirect to another public host", async () => {
    fetchMock
      .mockResolvedValueOnce({ status: 301, headers: { get: () => "https://www.example.com/" } })
      .mockResolvedValueOnce({ status: 200, headers: { get: () => null } });
    const res = await safeFetch("https://example.com", { lookup: publicLookup });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("blocks a redirect that points at an internal address (cloud metadata)", async () => {
    fetchMock.mockResolvedValueOnce({ status: 302, headers: { get: () => "http://169.254.169.254/latest/meta-data/" } });
    await expect(safeFetch("https://example.com", { lookup: publicLookup })).rejects.toThrow(UnsafeUrlError);
    expect(fetchMock).toHaveBeenCalledTimes(1); // the internal URL was never fetched
  });

  it("gives up after too many redirects", async () => {
    fetchMock.mockResolvedValue({ status: 302, headers: { get: () => "https://example.com/loop" } });
    await expect(safeFetch("https://example.com", { lookup: publicLookup, maxRedirects: 3 })).rejects.toThrow(/Too many redirects/);
  });

  it("never fetches a blocked URL in the first place", async () => {
    await expect(safeFetch("http://127.0.0.1:8080/", { lookup: publicLookup })).rejects.toThrow(UnsafeUrlError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("readTextCapped", () => {
  const streamOf = (chunks) =>
    new Response(
      new ReadableStream({
        start(controller) {
          chunks.forEach((c) => controller.enqueue(new TextEncoder().encode(c)));
          controller.close();
        },
      }),
    );

  it("reads a small body", async () => {
    expect(await readTextCapped(streamOf(["hello ", "world"]), 100)).toBe("hello world");
  });

  it("throws once the body exceeds the cap", async () => {
    await expect(readTextCapped(streamOf(["x".repeat(60), "y".repeat(60)]), 100)).rejects.toThrow(/too large/);
  });

  it("falls back to .text() for non-streaming responses", async () => {
    expect(await readTextCapped({ text: async () => "plain" }, 100)).toBe("plain");
  });
});
