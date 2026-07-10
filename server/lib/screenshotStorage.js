import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/lib/ -> project root/uploads/app-audits. Deliberately local disk,
// not Firebase Storage — this project decided against that dependency.
export const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads", "app-audits");

const EXT_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/;

// Persists an uploaded screenshot to local disk and returns a small relative
// URL path — a base64 data URL can be several MB, far past what's safe to
// store directly in a Firestore document (1MiB cap), so this is what
// actually gets saved alongside a friction point instead.
export function saveScreenshot(imageDataUrl) {
  const match = DATA_URL_PATTERN.exec(imageDataUrl || "");
  if (!match) {
    throw new Error("Invalid image data URL");
  }

  const [, mimeType, base64Data] = match;
  const ext = EXT_BY_MIME[mimeType.toLowerCase()] || "png";
  const filename = `${crypto.randomUUID()}.${ext}`;

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), Buffer.from(base64Data, "base64"));

  return `/uploads/app-audits/${filename}`;
}
