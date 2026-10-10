import { doc, getDoc } from "firebase/firestore";
import { serverDb, ensureServerSignedIn, verifyIdToken } from "../firebaseServerAuth.js";

const TOKEN_TTL_MS = 60_000;
const PLAN_TTL_MS = 60_000;
const MAX_CACHE = 2000;

const tokenCache = new Map(); // bearer token -> { uid, exp }
const planCache = new Map(); // uid -> { plan, exp }

function remember(cache, key, value, ttl) {
  if (cache.size >= MAX_CACHE) {
    const now = Date.now();
    for (const [k, v] of cache) if (v.exp <= now) cache.delete(k);
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  }
  cache.set(key, { ...value, exp: Date.now() + ttl });
}

export function clearAuthCaches() {
  tokenCache.clear();
  planCache.clear();
}

const AUTH_ERRORS = new Set(["Missing Authorization header", "Invalid or expired token"]);

// Resolves { uid } for a valid Firebase ID token. Throws the same two errors
// verifyIdToken does for bad/missing tokens; anything else is an upstream failure.
async function authenticate(req) {
  const header = req.headers.authorization;
  if (header && tokenCache.has(header)) {
    const hit = tokenCache.get(header);
    if (hit.exp > Date.now()) return { uid: hit.uid };
    tokenCache.delete(header);
  }
  const user = await verifyIdToken(header);
  if (header) remember(tokenCache, header, { uid: user.uid }, TOKEN_TTL_MS);
  return user;
}

function sendAuthFailure(res, err) {
  if (AUTH_ERRORS.has(err.message)) {
    return res.status(401).json({ success: false, error: "Please sign in to use this feature." });
  }
  console.error("Auth service error:", err);
  return res.status(503).json({ success: false, error: "Authentication is temporarily unavailable. Try again shortly." });
}

export async function requireAuth(req, res, next) {
  try {
    req.user = await authenticate(req);
    next();
  } catch (err) {
    sendAuthFailure(res, err);
  }
}

// For the anonymous free scan: attaches req.user when a valid token is sent,
// otherwise continues as anonymous. A token that is present but invalid is
// treated as anonymous (not an error) so a stale session can't block the scan.
export async function optionalAuth(req, res, next) {
  req.user = null;
  if (!req.headers.authorization) return next();
  try {
    req.user = await authenticate(req);
  } catch (err) {
    if (!AUTH_ERRORS.has(err.message)) console.error("Auth service error (continuing anonymous):", err);
  }
  next();
}

export async function getPlanForUid(uid) {
  const hit = planCache.get(uid);
  if (hit && hit.exp > Date.now()) return hit.plan;
  await ensureServerSignedIn();
  const snap = await getDoc(doc(serverDb, "subscriptions", uid));
  const data = snap.exists() ? snap.data() : null;
  const plan = data?.status === "active" && data.plan_name ? String(data.plan_name).toLowerCase() : "free";
  remember(planCache, uid, { plan }, PLAN_TTL_MS);
  return plan;
}

// Must run after requireAuth. Mirrors the plan gates the UI already applies
// (usePlanCapabilities) so a free account can't call paid endpoints directly.
export function requirePlan(allowed = ["pro", "agency"], featureName = "This feature") {
  return async (req, res, next) => {
    try {
      req.plan = await getPlanForUid(req.user.uid);
      if (!allowed.includes(req.plan)) {
        return res.status(403).json({
          success: false,
          code: "plan_required",
          error: `${featureName} requires the Pro plan.`,
        });
      }
      next();
    } catch (err) {
      console.error("Plan lookup failed:", err);
      res.status(503).json({ success: false, error: "Could not verify your plan. Try again shortly." });
    }
  };
}
