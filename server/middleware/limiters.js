import { LIMITS } from "../config/limits.js";
import { createRateLimiter } from "./rateLimit.js";
import { getPlanForUid } from "./auth.js";

const ipKey = (req) => `ip:${req.ip}`;

// analyze / technical: open to anonymous visitors (the free first scan) but
// capped per IP and globally; signed-in users are capped per account by plan.
const anonPerIp = createRateLimiter({
  windowMs: LIMITS.DAY,
  max: LIMITS.anonPerIpPerDay,
  key: ipKey,
  message: "You've reached the free scan limit for today. Create an account to keep going.",
});
const anonGlobal = createRateLimiter({
  windowMs: LIMITS.DAY,
  max: LIMITS.anonGlobalPerDay,
  key: () => "anon:global",
  message: "Free scans are temporarily at capacity. Create an account or try again tomorrow.",
});
const perUserDaily = createRateLimiter({
  windowMs: LIMITS.DAY,
  max: (req) => LIMITS.userPerDay[req.plan] ?? LIMITS.userPerDay.free,
  key: (req) => `uid:${req.user.uid}`,
  message: "You've reached today's audit limit for your plan.",
});

export async function auditLimiter(req, res, next) {
  if (!req.user) return anonPerIp(req, res, () => anonGlobal(req, res, next));
  try {
    req.plan = req.plan ?? (await getPlanForUid(req.user.uid));
  } catch (err) {
    console.error("Plan lookup failed:", err);
    req.plan = "free"; // fail closed to the tightest cap
  }
  perUserDaily(req, res, next);
}

export const aiLimiter = createRateLimiter({
  windowMs: LIMITS.HOUR,
  max: LIMITS.aiPerUserPerHour,
  key: (req) => `uid:${req.user.uid}`,
});

export const appAuditLimiter = createRateLimiter({
  windowMs: LIMITS.HOUR,
  max: LIMITS.appAuditPerUserPerHour,
  key: (req) => `uid:${req.user.uid}`,
});

export const resetAllLimiters = () => {
  anonPerIp.reset();
  anonGlobal.reset();
  perUserDaily.reset();
  aiLimiter.reset();
  appAuditLimiter.reset();
};
