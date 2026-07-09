import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildAuthorizeUrl, exchangeCodeForTokens, refreshAccessToken } from "./googleOAuth.js";

const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("buildAuthorizeUrl", () => {
  it("builds a Google consent URL requesting offline access and the analytics.readonly scope", () => {
    const url = buildAuthorizeUrl({
      clientId: "client-123",
      redirectUri: "https://example.com/api/ga4/oauth/callback",
      state: "state-abc",
    });

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(parsed.searchParams.get("client_id")).toBe("client-123");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://example.com/api/ga4/oauth/callback");
    expect(parsed.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/analytics.readonly");
    expect(parsed.searchParams.get("access_type")).toBe("offline");
    expect(parsed.searchParams.get("prompt")).toBe("consent");
    expect(parsed.searchParams.get("state")).toBe("state-abc");
  });
});

describe("exchangeCodeForTokens", () => {
  beforeEach(() => fetchMock.mockReset());

  it("posts the authorization code and returns the access/refresh tokens", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "access-1", refresh_token: "refresh-1", expires_in: 3599 }),
    });

    const result = await exchangeCodeForTokens({
      code: "auth-code",
      clientId: "client-123",
      clientSecret: "secret-xyz",
      redirectUri: "https://example.com/callback",
    });

    expect(result).toEqual({ accessToken: "access-1", refreshToken: "refresh-1", expiresInSeconds: 3599 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(options.body).toContain("grant_type=authorization_code");
    expect(options.body).toContain("code=auth-code");
  });

  it("throws when Google rejects the exchange", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => "invalid_grant" });

    await expect(
      exchangeCodeForTokens({ code: "bad", clientId: "c", clientSecret: "s", redirectUri: "r" })
    ).rejects.toThrow("Google token exchange failed [400]: invalid_grant");
  });
});

describe("refreshAccessToken", () => {
  beforeEach(() => fetchMock.mockReset());

  it("posts the refresh token and returns a new access token", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "access-2", expires_in: 3599 }),
    });

    const result = await refreshAccessToken({ refreshToken: "refresh-1", clientId: "c", clientSecret: "s" });

    expect(result).toEqual({ accessToken: "access-2", expiresInSeconds: 3599 });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.body).toContain("grant_type=refresh_token");
    expect(options.body).toContain("refresh_token=refresh-1");
  });

  it("throws when the refresh token is invalid or revoked", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => "invalid_grant" });

    await expect(refreshAccessToken({ refreshToken: "bad", clientId: "c", clientSecret: "s" })).rejects.toThrow(
      "Google token refresh failed [400]: invalid_grant"
    );
  });
});
