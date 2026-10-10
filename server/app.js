import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import paypalRouter from "./routes/paypal.js";
import analyzeRouter from "./routes/analyze.js";
import technicalRouter from "./routes/technical.js";
import messageMatchRouter from "./routes/messageMatch.js";
import variantCopyRouter from "./routes/variantCopy.js";
import multivariateIdeaRouter from "./routes/multivariateIdea.js";
import testBriefRouter from "./routes/testBrief.js";
import funnelInsightsRouter from "./routes/funnelInsights.js";
import ga4Router from "./routes/ga4.js";
import appAuditRouter from "./routes/appAudit.js";
import { UPLOADS_DIR } from "./lib/screenshotStorage.js";
import { requireAuth, optionalAuth, requirePlan } from "./middleware/auth.js";
import { auditQuota } from "./middleware/quota.js";
import { auditLimiter, aiLimiter, appAuditLimiter } from "./middleware/limiters.js";
import { MAX_JSON_BODY, MAX_APP_AUDIT_BODY, LIMITS } from "./config/limits.js";
import { createRateLimiter } from "./middleware/rateLimit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ distDir = path.join(__dirname, "..", "dist") } = {}) {
  const app = express();
  app.disable("x-powered-by");

  // Hostinger terminates TLS in front of Node, so req.ip is the proxy unless we
  // trust exactly one hop. Rate limits key on req.ip — verify TRUST_PROXY_HOPS
  // matches the real number of proxies in front of the app (1 is typical).
  const hops = Number(process.env.TRUST_PROXY_HOPS ?? 1);
  if (hops > 0) app.set("trust proxy", hops);

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- Routes that cost us money or touch user data -----------------------
  // Auth + plan + rate limit run BEFORE the body is parsed, so an
  // unauthenticated client can't make us buffer a 12MB upload.

  // The 12MB image upload is the one route that needs a big body.
  app.use(
    "/api/app-audit",
    requireAuth,
    requirePlan(["pro", "agency"], "App audits"),
    appAuditLimiter,
    express.json({ limit: MAX_APP_AUDIT_BODY }),
  );

  app.use(express.json({ limit: MAX_JSON_BODY }));

  // Open to anonymous visitors for the one free scan; capped per IP/globally.
  app.use("/api/analyze", optionalAuth, auditLimiter, auditQuota());
  app.use("/api/technical", optionalAuth, auditLimiter);

  // Signed-in only.
  app.use("/api/message-match", requireAuth, aiLimiter);

  // Pro/Agency only — the same gates the UI applies.
  app.use("/api/variant-copy", requireAuth, requirePlan(["pro", "agency"], "Variant copy"), aiLimiter);
  app.use("/api/multivariate-idea", requireAuth, requirePlan(["pro", "agency"], "The Experiment Workbench"), aiLimiter);
  app.use("/api/test-brief", requireAuth, requirePlan(["pro", "agency"], "The Experiment Workbench"), aiLimiter);
  app.use("/api/funnel-insights", requireAuth, requirePlan(["pro", "agency"], "Funnel diagnostics"), aiLimiter);

  // paypal and ga4 authenticate inside their own handlers. The PayPal webhook
  // is called by PayPal, not a signed-in user: its signature is verified in the
  // handler, and each unverified call costs us two PayPal API calls, so cap it.
  app.use(
    "/api/paypal/create-subscription",
    createRateLimiter({ windowMs: LIMITS.HOUR, max: 10, key: (req) => `ip:${req.ip}`, message: "Too many checkout attempts. Try again later." }),
  );
  app.use(
    "/api/paypal/webhook",
    createRateLimiter({ windowMs: LIMITS.HOUR, max: 600, key: (req) => `ip:${req.ip}` }),
  );
  app.use("/api/paypal", paypalRouter);
  app.use("/api/analyze", analyzeRouter);
  app.use("/api/technical", technicalRouter);
  app.use("/api/message-match", messageMatchRouter);
  app.use("/api/variant-copy", variantCopyRouter);
  app.use("/api/multivariate-idea", multivariateIdeaRouter);
  app.use("/api/test-brief", testBriefRouter);
  app.use("/api/funnel-insights", funnelInsightsRouter);
  app.use("/api/ga4", ga4Router);
  app.use("/api/app-audit", appAuditRouter);

  // Screenshots saved by App Audit — local disk, not Firebase Storage.
  // UPLOADS_DIR already ends in .../uploads/app-audits, so the mount prefix
  // must match — otherwise express.static looks for a second "app-audits"
  // segment underneath it and silently falls through to the SPA route.
  //
  // Access model: a screenshot is reachable only by its exact filename — a
  // crypto.randomUUID() (122 bits, unguessable) baked into the URL string
  // itself, never a sequential id. express.static does not list directory
  // contents by default, so there is no way to enumerate other users'
  // screenshots by browsing. This does NOT check that the requester is the
  // uploading owner's logged-in session — an <img> tag can't attach a Firebase
  // ID token, so anyone who obtains the exact URL can view it. If that's not
  // tight enough, serve screenshots through an authenticated route and fetch
  // them as a blob instead of a plain <img src>.
  //
  // Hardening: nosniff + a locked-down CSP so an uploaded file can never be
  // interpreted as anything but an image.
  app.use(
    "/uploads/app-audits",
    express.static(UPLOADS_DIR, {
      index: false,
      dotfiles: "deny",
      setHeaders(res) {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; sandbox");
        res.setHeader("Cache-Control", "private, max-age=3600");
      },
    }),
  );

  app.use(express.static(distDir));

  // Unknown API routes should be a JSON 404, not the SPA shell.
  app.all(/^\/api\/.*/, (req, res) => {
    res.status(404).json({ success: false, error: "Not found" });
  });

  // SPA fallback: any non-API GET request that isn't a static file gets index.html
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });

  // Body-parser errors (too large, malformed JSON) -> clean JSON, not a stack trace.
  app.use((err, req, res, next) => {
    if (err?.type === "entity.too.large") {
      return res.status(413).json({ success: false, error: "That upload is too large." });
    }
    if (err?.type === "entity.parse.failed") {
      return res.status(400).json({ success: false, error: "Invalid JSON body." });
    }
    console.error("Unhandled error:", err);
    res.status(500).json({ success: false, error: "Something went wrong." });
  });

  return app;
}
