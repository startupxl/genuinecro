import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import paypalRouter from "./server/routes/paypal.js";
import analyzeRouter from "./server/routes/analyze.js";
import technicalRouter from "./server/routes/technical.js";
import messageMatchRouter from "./server/routes/messageMatch.js";
import variantCopyRouter from "./server/routes/variantCopy.js";
import multivariateIdeaRouter from "./server/routes/multivariateIdea.js";
import testBriefRouter from "./server/routes/testBrief.js";
import funnelInsightsRouter from "./server/routes/funnelInsights.js";
import ga4Router from "./server/routes/ga4.js";
import appAuditRouter from "./server/routes/appAudit.js";
import { UPLOADS_DIR } from "./server/lib/screenshotStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, "dist");

// Raised from Express's 100kb default to fit a base64-encoded screenshot upload.
app.use(express.json({ limit: "12mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

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
// contents by default (verified: GET /uploads/app-audits/ falls through
// to the SPA route, not a file listing), so there is no way to enumerate
// other users' screenshots by browsing. This does NOT check that the
// requester is actually the uploading owner's logged-in session — an
// <img> tag can't attach a Firebase ID token, so anyone who obtains the
// exact URL (e.g. it leaks via a shared link) can view it. If that's not
// tight enough, the alternative is serving screenshots through an
// authenticated route and fetching them as a blob instead of a plain
// <img src>, which is a larger change.
app.use("/uploads/app-audits", express.static(UPLOADS_DIR));

app.use(express.static(DIST_DIR));

// SPA fallback: any non-API GET request that isn't a static file gets index.html
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`GenuineCRO server listening on port ${PORT}`);
});
