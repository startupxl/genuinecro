import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/lib/ -> project root/uploads/app-audits. Deliberately local disk,
// not Firebase Storage — this project decided against that dependency.
export const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads", "app-audits");

// Raster formats only (no SVG — it can carry script). Each entry also lists the
// magic bytes the decoded file must start with, so a mislabelled data URL can't
// smuggle arbitrary bytes onto disk under an image extension.
const FORMATS = {
  "image/png": { ext: "png", magic: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/jpeg": { ext: "jpg", magic: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/jpg": { ext: "jpg", magic: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/webp": { ext: "webp", magic: (b) => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
  "image/gif": { ext: "gif", magic: (b) => b.length > 6 && ["GIF87a", "GIF89a"].includes(b.toString("ascii", 0, 6)) },
};

export const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;

const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=\s]+)$/;

export class InvalidImageError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidImageError";
  }
}

// Validates a base64 image data URL and returns { ext, buffer }. Throws
// InvalidImageError for anything that isn't a real, reasonably sized raster image.
export function parseImageDataUrl(imageDataUrl) {
  if (typeof imageDataUrl !== "string" || imageDataUrl.length > MAX_SCREENSHOT_BYTES * 1.4) {
    throw new InvalidImageError("Screenshot is missing or too large");
  }
  const match = DATA_URL_PATTERN.exec(imageDataUrl);
  if (!match) throw new InvalidImageError("Invalid image data URL");

  const format = FORMATS[match[1].toLowerCase()];
  if (!format) throw new InvalidImageError("Unsupported image type. Use PNG, JPEG, WebP or GIF.");

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_SCREENSHOT_BYTES) throw new InvalidImageError("Screenshot is too large (8MB max)");
  if (!format.magic(buffer)) throw new InvalidImageError("That file isn't a valid image");

  return { ext: format.ext, buffer };
}

// Persists an uploaded screenshot to local disk and returns a small relative
// URL path — a base64 data URL can be several MB, far past what's safe to
// store directly in a Firestore document (1MiB cap), so this is what
// actually gets saved alongside a friction point instead.
export function saveScreenshot(imageDataUrl) {
  const { ext, buffer } = parseImageDataUrl(imageDataUrl);
  const filename = `${crypto.randomUUID()}.${ext}`;

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);

  return `/uploads/app-audits/${filename}`;
}
