import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const css = readFileSync(resolve(__dirname, "./index.css"), "utf-8");

describe("index.css design tokens", () => {
  it("uses the GenuineCRO evidence-on-paper palette (shared with genuinecro.com)", () => {
    expect(css).toContain("--background: 150 12% 97%;");
    expect(css).toContain("--foreground: 160 30% 8%;");
    expect(css).toContain("--primary: 160 59% 30%;");
    expect(css).toContain("--muted-foreground: 152 6% 38%;");
    expect(css).toContain("--border: 146 12% 89%;");
    expect(css).toContain("--destructive: 9 61% 45%;");
  });

  it("self-hosts Instrument Serif and Hanken Grotesk (no third-party font CDN)", () => {
    expect(css).not.toContain("fonts.googleapis.com");
    expect(css).toMatch(/@font-face\s*{[^}]*font-family:\s*'Instrument Serif'/);
    expect(css).toMatch(/@font-face\s*{[^}]*font-family:\s*'Hanken Grotesk'/);
  });

  it("sets the body font-family to Hanken Grotesk", () => {
    expect(css).toContain("font-family: 'Hanken Grotesk', -apple-system");
  });

  it("defines a font-display utility using Instrument Serif", () => {
    expect(css).toMatch(/\.font-display\s*{[^}]*font-family:\s*'Instrument Serif'/);
  });
});
