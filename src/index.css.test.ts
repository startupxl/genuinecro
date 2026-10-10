import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const css = readFileSync(resolve(__dirname, "./index.css"), "utf-8");

describe("index.css design tokens", () => {
  it("uses the GenuineCRO evidence-on-paper palette (shared with genuinecro.com)", () => {
    expect(css).toContain("--background: 45 44% 96%;");
    expect(css).toContain("--foreground: 53 23% 8%;");
    expect(css).toContain("--primary: 160 59% 30%;");
    expect(css).toContain("--muted-foreground: 51 10% 38%;");
    expect(css).toContain("--border: 44 25% 85%;");
    expect(css).toContain("--destructive: 9 61% 45%;");
  });

  it("imports Fraunces and the correctly-named Geist family", () => {
    expect(css).toMatch(/@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Fraunces[^']*'\)/);
    expect(css).toContain("family=Geist:");
  });

  it("sets the body font-family to the correctly-named Geist family (not 'Geist Sans')", () => {
    expect(css).toContain("font-family: 'Geist', -apple-system");
  });

  it("defines a font-display utility using Fraunces", () => {
    expect(css).toMatch(/\.font-display\s*{[^}]*font-family:\s*'Fraunces'/);
  });
});
