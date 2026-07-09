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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, "dist");

app.use(express.json());

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

app.use(express.static(DIST_DIR));

// SPA fallback: any non-API GET request that isn't a static file gets index.html
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`GenuineCRO server listening on port ${PORT}`);
});
