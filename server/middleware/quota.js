import { doc, runTransaction, updateDoc, increment } from "firebase/firestore";
import { serverDb, ensureServerSignedIn } from "../firebaseServerAuth.js";
import { PLAN_AUDIT_LIMITS, QUOTA_WINDOW_MS } from "../config/limits.js";

// Server-side enforcement of each plan's audit allowance. The UI already shows
// and checks this, but it counts documents the browser writes — a user who
// calls the API directly (or just doesn't write the record) would never hit it.
//
// One "audit" = one desktop analyze call. The mobile pass of a "both" audit is
// part of the same audit: it needs a paid plan (same gate as the UI) but isn't
// counted again; the per-day limiter bounds it.
//
// Counter: usage/{uid} = { windowStart, count }, a 30-day window that starts at
// the first audit. A slot is reserved atomically BEFORE the work (so parallel
// requests can't all squeeze past the check) and refunded if the request fails.
//
// If the counter can't be read or written (Firestore outage, rules not yet
// deployed) this fails OPEN and logs, so a bookkeeping problem never takes the
// product down; the daily limiter still caps spend.

const PAID = new Set(["pro", "agency", "enterprise"]);

async function reserveSlot(uid, limit, now = Date.now()) {
  await ensureServerSignedIn();
  const ref = doc(serverDb, "usage", uid);
  const outcome = await runTransaction(serverDb, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : null;
    const started = data?.windowStart ? Date.parse(data.windowStart) : NaN;
    const fresh = Number.isNaN(started) || now - started >= QUOTA_WINDOW_MS;
    const windowStart = fresh ? new Date(now).toISOString() : data.windowStart;
    const count = fresh ? 0 : Number(data.count) || 0;

    if (count >= limit) {
      return { ok: false, resetsAt: new Date(Date.parse(windowStart) + QUOTA_WINDOW_MS).toISOString() };
    }
    tx.set(ref, { windowStart, count: count + 1, updatedAt: new Date(now).toISOString() });
    return { ok: true };
  });
  return { ...outcome, ref };
}

export function auditQuota() {
  return async (req, res, next) => {
    if (!req.user) return next(); // anonymous visitors are bounded by the per-IP limits

    const plan = req.plan ?? "free";

    if (req.body?.device === "mobile") {
      if (!PAID.has(plan)) {
        return res.status(403).json({ success: false, code: "plan_required", error: "Mobile analysis requires the Pro plan." });
      }
      return next();
    }

    const limit = PLAN_AUDIT_LIMITS[plan] ?? PLAN_AUDIT_LIMITS.free;
    let reservation;
    try {
      reservation = await reserveSlot(req.user.uid, limit);
    } catch (err) {
      console.error("Audit quota check failed (allowing request):", err);
      return next();
    }

    if (!reservation.ok) {
      return res.status(429).json({
        success: false,
        code: "quota_exceeded",
        error: `You've used all ${limit} audits included in your plan for this period.`,
        resetsAt: reservation.resetsAt,
      });
    }

    res.on("finish", () => {
      if (res.statusCode >= 400) {
        updateDoc(reservation.ref, { count: increment(-1) }).catch((err) => console.error("Quota refund failed:", err));
      }
    });
    next();
  };
}
