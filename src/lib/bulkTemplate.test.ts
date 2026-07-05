import { describe, it, expect } from "vitest";
import { generateTemplateCsv, parseCsvText, parseBulkRows } from "./bulkTemplate";

describe("generateTemplateCsv", () => {
  it("includes a URL,Page Type,Conversion Goal header row", () => {
    const csv = generateTemplateCsv();
    expect(csv).toContain("URL,Page Type,Conversion Goal");
  });

  it("lists every valid conversion goal label as guidance", () => {
    const csv = generateTemplateCsv();
    expect(csv).toContain("Purchase / Transaction");
    expect(csv).toContain("Lead Form Submission");
  });

  it("lists every valid page type label as guidance", () => {
    const csv = generateTemplateCsv();
    expect(csv).toContain("Homepage");
    expect(csv).toContain("Checkout");
    expect(csv).toContain("Landing Page — Marketing");
  });

  it("includes at least one example row with a real URL", () => {
    const csv = generateTemplateCsv();
    expect(csv).toMatch(/https?:\/\//);
  });
});

describe("parseCsvText", () => {
  it("splits text into rows of cells, trimming quotes", () => {
    const rows = parseCsvText('URL,Page Type\nhttps://a.com,"Homepage"\nhttps://b.com,Checkout');
    expect(rows).toEqual([
      ["URL", "Page Type"],
      ["https://a.com", "Homepage"],
      ["https://b.com", "Checkout"],
    ]);
  });

  it("drops blank lines", () => {
    const rows = parseCsvText("https://a.com\n\n\nhttps://b.com");
    expect(rows).toHaveLength(2);
  });
});

describe("parseBulkRows — structured template with a header row", () => {
  it("parses URL and Page Type columns, resolving the label to an AnalysisType", () => {
    const rows = [
      ["URL", "Page Type"],
      ["https://a.com", "Homepage"],
      ["https://a.com/checkout", "Checkout"],
    ];
    expect(parseBulkRows(rows)).toEqual([
      { url: "https://a.com", pageType: "homepage" },
      { url: "https://a.com/checkout", pageType: "checkout" },
    ]);
  });

  it("resolves a raw AnalysisType key (not just the display label)", () => {
    const rows = [
      ["URL", "Page Type"],
      ["https://a.com", "lead-form"],
    ];
    expect(parseBulkRows(rows)).toEqual([{ url: "https://a.com", pageType: "lead-form" }]);
  });

  it("is case-insensitive when matching page type labels", () => {
    const rows = [
      ["URL", "Page Type"],
      ["https://a.com", "hOmEpAgE"],
    ];
    expect(parseBulkRows(rows)[0].pageType).toBe("homepage");
  });

  it("leaves pageType undefined when the cell is blank, so callers can auto-detect", () => {
    const rows = [
      ["URL", "Page Type"],
      ["https://a.com", ""],
    ];
    expect(parseBulkRows(rows)[0].pageType).toBeUndefined();
  });

  it("leaves pageType undefined when the cell doesn't match any known type", () => {
    const rows = [
      ["URL", "Page Type"],
      ["https://a.com", "not-a-real-type"],
    ];
    expect(parseBulkRows(rows)[0].pageType).toBeUndefined();
  });

  it("skips rows with no URL cell and de-duplicates repeated URLs", () => {
    const rows = [
      ["URL", "Page Type"],
      ["https://a.com", "Homepage"],
      ["", "Checkout"],
      ["https://a.com", "Homepage"],
    ];
    expect(parseBulkRows(rows)).toEqual([{ url: "https://a.com", pageType: "homepage" }]);
  });

  it("normalizes bare domains to https://", () => {
    const rows = [
      ["URL", "Page Type"],
      ["b.com/pricing", "Homepage"],
    ];
    expect(parseBulkRows(rows)[0].url).toBe("https://b.com/pricing");
  });

  it("skips comment lines starting with #", () => {
    const rows = [
      ["# Fill in one URL per row"],
      ["URL", "Page Type"],
      ["https://a.com", "Homepage"],
    ];
    expect(parseBulkRows(rows)).toEqual([{ url: "https://a.com", pageType: "homepage" }]);
  });

  it("parses a Conversion Goal column, resolving the label to a ConversionGoalType", () => {
    const rows = [
      ["URL", "Page Type", "Conversion Goal"],
      ["https://a.com", "Homepage", "Lead Form Submission"],
    ];
    expect(parseBulkRows(rows)[0].conversionGoal).toEqual({ type: "lead_form", isMacro: false });
  });

  it("resolves a raw ConversionGoalType key for the Conversion Goal column", () => {
    const rows = [
      ["URL", "Page Type", "Conversion Goal"],
      ["https://a.com", "Homepage", "purchase"],
    ];
    expect(parseBulkRows(rows)[0].conversionGoal).toEqual({ type: "purchase", isMacro: true });
  });

  it("leaves conversionGoal undefined when the column is blank or unrecognized", () => {
    const rows = [
      ["URL", "Page Type", "Conversion Goal"],
      ["https://a.com", "Homepage", ""],
      ["https://b.com", "Homepage", "not-a-real-goal"],
    ];
    expect(parseBulkRows(rows)[0].conversionGoal).toBeUndefined();
    expect(parseBulkRows(rows)[1].conversionGoal).toBeUndefined();
  });
});

describe("parseBulkRows — legacy plain URL list (no header row)", () => {
  it("extracts URLs from cells with no page type", () => {
    const rows = [["https://a.com"], ["https://b.com"]];
    expect(parseBulkRows(rows)).toEqual([{ url: "https://a.com" }, { url: "https://b.com" }]);
  });

  it("splits comma-separated URLs within a single cell", () => {
    const rows = [["https://a.com, https://b.com"]];
    expect(parseBulkRows(rows)).toEqual([{ url: "https://a.com" }, { url: "https://b.com" }]);
  });

  it("de-duplicates and ignores non-URL text", () => {
    const rows = [["notes"], ["https://a.com"], ["https://a.com"]];
    expect(parseBulkRows(rows)).toEqual([{ url: "https://a.com" }]);
  });

  it("returns an empty array when no rows contain a URL", () => {
    expect(parseBulkRows([["just some notes"], ["more notes"]])).toEqual([]);
  });
});
