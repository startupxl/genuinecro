import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { serverDb, ensureServerSignedIn } from "../firebaseServerAuth.js";
import { refreshAccessToken } from "./googleOAuth.js";

// Refresh a minute before actual expiry so a slow request never lands on a
// token that expires mid-flight.
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

export async function getConnection(userId) {
  await ensureServerSignedIn();
  const snap = await getDoc(doc(serverDb, "ga4Connections", userId));
  return snap.exists() ? snap.data() : null;
}

export async function saveConnection(userId, data) {
  await ensureServerSignedIn();
  await setDoc(doc(serverDb, "ga4Connections", userId), data, { merge: true });
}

export async function deleteConnection(userId) {
  await ensureServerSignedIn();
  await deleteDoc(doc(serverDb, "ga4Connections", userId));
}

export function normalizeDomain(input) {
  const trimmed = (input || "").trim();
  let hostname = trimmed;
  try {
    hostname = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    // not a parseable URL — fall back to the raw trimmed input
  }
  return hostname.toLowerCase().replace(/^www\./, "");
}

// Maps a domain (one of a user's own or client sites) to a specific GA4
// property. A single OAuth grant can see many properties — this is what
// lets one connected account correctly serve multiple sites' data instead
// of one globally "active" property leaking into every other site's audit.
export async function addPropertyMapping(userId, domain, propertyId, propertyDisplayName) {
  const normalizedDomain = normalizeDomain(domain);
  const connection = await getConnection(userId);
  const existing = connection?.properties || [];
  const properties = [...existing.filter((p) => p.domain !== normalizedDomain), { domain: normalizedDomain, propertyId, propertyDisplayName }];
  properties.sort((a, b) => a.domain.localeCompare(b.domain));
  await saveConnection(userId, { properties });
}

export async function removePropertyMapping(userId, domain) {
  const normalizedDomain = normalizeDomain(domain);
  const connection = await getConnection(userId);
  const properties = (connection?.properties || []).filter((p) => p.domain !== normalizedDomain);
  await saveConnection(userId, { properties });
}

export async function getPropertyForDomain(userId, url) {
  const normalizedDomain = normalizeDomain(url);
  const connection = await getConnection(userId);
  if (!connection) return null;
  return (connection.properties || []).find((p) => p.domain === normalizedDomain) || null;
}

// Returns a valid access token for the user's GA4 connection, transparently
// refreshing (and persisting) it if expired. Returns null when the user has
// no connection at all — callers treat that as "not connected", not an error.
export async function getValidAccessToken(userId) {
  const connection = await getConnection(userId);
  if (!connection) return null;

  const expiresAt = connection.accessTokenExpiresAt ? new Date(connection.accessTokenExpiresAt).getTime() : 0;
  if (expiresAt > Date.now() + EXPIRY_SAFETY_MARGIN_MS) {
    return connection.accessToken;
  }

  const { accessToken, expiresInSeconds } = await refreshAccessToken({
    refreshToken: connection.refreshToken,
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  });

  const accessTokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  await saveConnection(userId, { accessToken, accessTokenExpiresAt });

  return accessToken;
}
