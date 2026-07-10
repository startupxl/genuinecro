import express from "express";
import crypto from "crypto";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { serverDb, ensureServerSignedIn, verifyIdToken } from "../firebaseServerAuth.js";
import { buildAuthorizeUrl, exchangeCodeForTokens } from "../lib/googleOAuth.js";
import { listAccountSummaries, runPageReport, listConversionEvents } from "../lib/ga4Api.js";
import {
  getConnection,
  saveConnection,
  deleteConnection,
  getValidAccessToken,
  addPropertyMapping,
  removePropertyMapping,
  getPropertyForDomain,
} from "../lib/ga4Connections.js";
import { detectGA4Tag } from "../lib/ga4TagDetection.js";

const router = express.Router();

function oauthConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth is not configured");
  }
  return { clientId, clientSecret, redirectUri };
}

function frontendUrl() {
  return process.env.FRONTEND_URL || "http://localhost:8080";
}

function handleAuthError(res, err) {
  if (err.message === "Missing Authorization header" || err.message === "Invalid or expired token") {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return null;
}

router.post("/oauth/authorize-url", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req.headers.authorization);
    const { clientId, redirectUri } = oauthConfig();

    const state = crypto.randomUUID();
    await ensureServerSignedIn();
    await setDoc(doc(serverDb, "ga4OAuthStates", state), { uid: decoded.uid, createdAt: new Date().toISOString() });

    const url = buildAuthorizeUrl({ clientId, redirectUri, state });
    res.json({ url });
  } catch (err) {
    if (handleAuthError(res, err)) return;
    console.error("GA4 authorize-url error:", err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

router.get("/oauth/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error || !code || !state) {
    return res.redirect(`${frontendUrl()}/settings?ga4=error`);
  }

  try {
    await ensureServerSignedIn();
    const stateSnap = await getDoc(doc(serverDb, "ga4OAuthStates", state));
    if (!stateSnap.exists()) {
      return res.redirect(`${frontendUrl()}/settings?ga4=error`);
    }
    const { uid } = stateSnap.data();
    await deleteDoc(doc(serverDb, "ga4OAuthStates", state));

    const { clientId, clientSecret, redirectUri } = oauthConfig();
    const { accessToken, refreshToken, expiresInSeconds } = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });

    const accessTokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    const existing = await getConnection(uid);
    await saveConnection(uid, {
      accessToken,
      accessTokenExpiresAt,
      connectedAt: new Date().toISOString(),
      properties: existing?.properties || [],
      ...(refreshToken ? { refreshToken } : {}),
    });

    return res.redirect(`${frontendUrl()}/settings?ga4=connected`);
  } catch (err) {
    console.error("GA4 oauth callback error:", err);
    return res.redirect(`${frontendUrl()}/settings?ga4=error`);
  }
});

router.get("/status", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req.headers.authorization);
    const connection = await getConnection(decoded.uid);

    res.json({
      connected: !!connection?.accessToken,
      properties: connection?.properties || [],
    });
  } catch (err) {
    if (handleAuthError(res, err)) return;
    console.error("GA4 status error:", err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

router.get("/properties", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req.headers.authorization);
    const accessToken = await getValidAccessToken(decoded.uid);
    if (!accessToken) {
      return res.status(400).json({ error: "Google Analytics is not connected" });
    }

    const properties = await listAccountSummaries(accessToken);
    res.json({ properties });
  } catch (err) {
    if (handleAuthError(res, err)) return;
    console.error("GA4 properties error:", err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

router.post("/add-property", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req.headers.authorization);
    const { domain, propertyId, displayName } = req.body;
    if (!domain || !propertyId) {
      return res.status(400).json({ error: "domain and propertyId are required" });
    }

    await addPropertyMapping(decoded.uid, domain, propertyId, displayName || propertyId);
    res.json({ success: true });
  } catch (err) {
    if (handleAuthError(res, err)) return;
    console.error("GA4 add-property error:", err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

router.post("/remove-property", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req.headers.authorization);
    const { domain } = req.body;
    if (!domain) {
      return res.status(400).json({ error: "domain is required" });
    }

    await removePropertyMapping(decoded.uid, domain);
    res.json({ success: true });
  } catch (err) {
    if (handleAuthError(res, err)) return;
    console.error("GA4 remove-property error:", err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

router.post("/disconnect", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req.headers.authorization);
    await deleteConnection(decoded.uid);
    res.json({ success: true });
  } catch (err) {
    if (handleAuthError(res, err)) return;
    console.error("GA4 disconnect error:", err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

router.post("/page-metrics", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req.headers.authorization);
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "url is required" });
    }

    let tagDetection;
    try {
      const pageRes = await fetch(url);
      const html = await pageRes.text();
      tagDetection = detectGA4Tag(html);
    } catch {
      tagDetection = { hasGA4Tag: false, measurementId: null, hasGTM: false, gtmContainerId: null };
    }

    const property = await getPropertyForDomain(decoded.uid, url);
    if (!property) {
      return res.json({ tagDetection, connected: false });
    }

    try {
      const accessToken = await getValidAccessToken(decoded.uid);
      const pagePath = new URL(url).pathname || "/";
      const [behavioral, conversionEventNames] = await Promise.all([
        runPageReport({ accessToken, propertyId: property.propertyId, pagePath }),
        listConversionEvents({ accessToken, propertyId: property.propertyId }),
      ]);

      res.json({
        tagDetection,
        connected: true,
        propertyDisplayName: property.propertyDisplayName,
        behavioral,
        conversionEventNames,
      });
    } catch (metricsErr) {
      console.error("GA4 page-metrics fetch error:", metricsErr);
      res.json({
        tagDetection,
        connected: true,
        propertyDisplayName: property.propertyDisplayName,
        behavioral: null,
        conversionEventNames: [],
        metricsError: "Failed to fetch Google Analytics data for this page",
      });
    }
  } catch (err) {
    if (handleAuthError(res, err)) return;
    console.error("GA4 page-metrics error:", err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

export default router;
