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
