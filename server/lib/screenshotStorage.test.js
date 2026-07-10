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

const { saveScreenshot } = await import("./screenshotStorage.js");

describe("saveScreenshot", () => {
  beforeEach(() => {
    mkdirSyncMock.mockReset();
    writeFileSyncMock.mockReset();
  });

  it("decodes a PNG data URL, writes it to disk, and returns a small relative URL path", () => {
    const url = saveScreenshot("data:image/png;base64,aGVsbG8=");

    expect(url).toBe("/uploads/app-audits/fixed-uuid.png");
    expect(mkdirSyncMock).toHaveBeenCalledWith(expect.stringContaining("uploads"), { recursive: true });
    const [writtenPath, writtenBuffer] = writeFileSyncMock.mock.calls[0];
    expect(writtenPath).toContain("fixed-uuid.png");
    expect(Buffer.isBuffer(writtenBuffer)).toBe(true);
    expect(writtenBuffer.toString()).toBe("hello");
  });

  it("maps image/jpeg to a .jpg extension", () => {
    expect(saveScreenshot("data:image/jpeg;base64,aGVsbG8=")).toBe("/uploads/app-audits/fixed-uuid.jpg");
  });

  it("maps image/webp to a .webp extension", () => {
    expect(saveScreenshot("data:image/webp;base64,aGVsbG8=")).toBe("/uploads/app-audits/fixed-uuid.webp");
  });

  it("defaults to .png for an unrecognized (but valid) image mime type", () => {
    expect(saveScreenshot("data:image/bmp;base64,aGVsbG8=")).toBe("/uploads/app-audits/fixed-uuid.png");
  });

  it("throws for input that isn't a data URL", () => {
    expect(() => saveScreenshot("not-a-data-url")).toThrow("Invalid image data URL");
  });

  it("throws for a data URL that isn't an image", () => {
    expect(() => saveScreenshot("data:text/plain;base64,aGVsbG8=")).toThrow("Invalid image data URL");
  });
});
