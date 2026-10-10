// Small in-memory fixed-window limiter. Deliberately dependency-free.
// State is per Node process: fine for a single Hostinger app; if you ever run
// multiple instances, swap the Map for a shared store (Redis/Firestore).

export function createRateLimiter({ windowMs, max, key, message = "Too many requests. Please try again later." }) {
  const hits = new Map(); // key -> { count, resetAt }

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, Math.min(windowMs, 60_000));
  sweep.unref?.();

  const middleware = (req, res, next) => {
    const limit = typeof max === "function" ? max(req) : max;
    const id = key(req);
    const now = Date.now();
    let entry = hits.get(id);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(id, entry);
    }
    entry.count += 1;

    res.setHeader("RateLimit-Limit", String(limit));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - entry.count)));
    if (entry.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ success: false, error: message, code: "rate_limited", retryAfterSeconds: retryAfter });
    }
    next();
  };
  middleware.reset = () => hits.clear();
  return middleware;
}
