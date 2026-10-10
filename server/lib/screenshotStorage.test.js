import { describe, it, expect, vi, beforeEach } from "vitest";

const mkdirSyncMock = vi.fn();
const writeFileSyncMock = vi.fn();

vi.mock("fs", () => ({
  default: {
    mkdirSync: (...args) => mkdirSyncMock(...args),
    writeFileSync: (...args) => writeFileSyncMock(...args),
  },
  mkdirSync: (...args) => mkdirSyncMock(...args),
  writeFileSync: (...args) => writeFileSyncMock(...args),
}));

vi.mock("crypto", () => ({
  default: { randomUUID: () => "fixed-uuid" },
  randomUUID: () => "fixed-uuid",
}));

const { saveScreenshot, InvalidImageError, MAX_SCREENSHOT_BYTES } = await import("./screenshotStorage.js");

const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = b64([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const WEBP = b64([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), 0, 0]);
const GIF = b64([...Buffer.from("GIF89a"), 0, 0]);

describe("saveScreenshot", () => {
  beforeEach(() => {
    mkdirSyncMock.mockReset();
    writeFileSyncMock.mockReset();
  });

  it("decodes a PNG data URL, writes it to disk, and returns a small relative URL path", () => {
    const url = saveScreenshot(`data:image/png;base64,${PNG}`);

    expect(url).toBe("/uploads/app-audits/fixed-uuid.png");
    expect(mkdirSyncMock).toHaveBeenCalledWith(expect.stringContaining("uploads"), { recursive: true });
    const [writtenPath, writtenBuffer] = writeFileSyncMock.mock.calls[0];
    expect(writtenPath).toContain("fixed-uuid.png");
    expect(Buffer.isBuffer(writtenBuffer)).toBe(true);
    expect(writtenBuffer[1]).toBe(0x50);
  });

  it.each([
    ["image/jpeg", JPG, "jpg"],
    ["image/webp", WEBP, "webp"],
    ["image/gif", GIF, "gif"],
  ])("maps %s to a .%s extension", (mime, data, ext) => {
    expect(saveScreenshot(`data:${mime};base64,${data}`)).toBe(`/uploads/app-audits/fixed-uuid.${ext}`);
  });

  it("rejects bytes that don't match the declared image type (no disk write)", () => {
    expect(() => saveScreenshot(`data:image/png;base64,${b64(Buffer.from("<script>alert(1)</script>"))}`)).toThrow(InvalidImageError);
    expect(() => saveScreenshot(`data:image/png;base64,${JPG}`)).toThrow("isn't a valid image");
    expect(writeFileSyncMock).not.toHaveBeenCalled();
  });

  it("rejects SVG and other unsupported image types", () => {
    expect(() => saveScreenshot(`data:image/svg+xml;base64,${b64(Buffer.from("<svg/>"))}`)).toThrow("Unsupported image type");
    expect(() => saveScreenshot(`data:image/bmp;base64,${PNG}`)).toThrow("Unsupported image type");
  });

  it("rejects an image over the size cap", () => {
    const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(MAX_SCREENSHOT_BYTES)]);
    expect(() => saveScreenshot(`data:image/png;base64,${big.toString("base64")}`)).toThrow(/too large/);
  });

  it("throws for input that isn't a data URL", () => {
    expect(() => saveScreenshot("not-a-data-url")).toThrow("Invalid image data URL");
  });

  it("throws for a data URL that isn't an image", () => {
    expect(() => saveScreenshot("data:text/plain;base64,aGVsbG8=")).toThrow("Invalid image data URL");
  });
});
