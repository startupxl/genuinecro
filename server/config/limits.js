// Central place for abuse limits. Windows in ms.
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const LIMITS = {
  // Anonymous visitors get one free scan client-side; the server backstops it.
  anonPerIpPerDay: Number(process.env.LIMIT_ANON_PER_IP_PER_DAY ?? 12),
  // Hard ceiling on ALL anonymous traffic combined — caps worst-case API spend.
  anonGlobalPerDay: Number(process.env.LIMIT_ANON_GLOBAL_PER_DAY ?? 400),
  // Signed-in analyze/technical calls, per user per day, by plan.
  userPerDay: {
    free: Number(process.env.LIMIT_FREE_PER_DAY ?? 12),
    pro: Number(process.env.LIMIT_PRO_PER_DAY ?? 80),
    agency: Number(process.env.LIMIT_AGENCY_PER_DAY ?? 200),
  },
  // Pro-gated AI routes (variants, workbench, funnels, app audit), per user per hour.
  aiPerUserPerHour: Number(process.env.LIMIT_AI_PER_USER_PER_HOUR ?? 60),
  // App Audit uploads are heavy (images), keep them tighter.
  appAuditPerUserPerHour: Number(process.env.LIMIT_APP_AUDIT_PER_USER_PER_HOUR ?? 30),
  HOUR,
  DAY,
};

// Audits included per plan per QUOTA_WINDOW_MS. Keep in sync with PLAN_LIMITS in
// src/hooks/useUsageTracking.ts (what the UI shows); THIS is what is enforced.
export const PLAN_AUDIT_LIMITS = { free: 3, pro: 250, agency: 800, enterprise: 800 };
export const QUOTA_WINDOW_MS = 30 * DAY;

export const MAX_JSON_BODY = "100kb";
export const MAX_APP_AUDIT_BODY = "12mb";
export const MAX_AUDIT_LINKS = 100;
