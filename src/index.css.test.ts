import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const css = readFileSync(resolve(__dirname, "./index.css"), "utf-8");

describe("index.css design tokens", () => {
  it("uses the Indigo Tint palette values", () => {
    expect(css).toContain("--background: 225 100% 98%;");
    expect(css).toContain("--foreground: 244 47% 20%;");
    expect(css).toContain("--primary: 243 75% 59%;");
    expect(css).toContain("--muted-foreground: 248 24% 63%;");
    expect(css).toContain("--border: 230 47% 92%;");
    expect(css).toContain("--destructive: 0 84% 60%;");
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
