import { analysisTypeLabels, type AnalysisType } from "./mockData";
import { CONVERSION_GOAL_OPTIONS, type ConversionGoal, type ConversionGoalType } from "./conversionGoals";

export interface BulkRow {
  url: string;
  pageType?: AnalysisType;
  conversionGoal?: ConversionGoal;
}

const URL_LIKE = /^https?:\/\/|^[a-z0-9].*\./i;

function normalizeUrl(raw: string): string {
  return raw.startsWith("http") ? raw : `https://${raw}`;
}

const labelToType: Record<string, AnalysisType> = {};
for (const [type, label] of Object.entries(analysisTypeLabels) as [AnalysisType, string][]) {
  labelToType[label.toLowerCase()] = type;
  labelToType[type.toLowerCase()] = type;
}

function resolvePageType(raw: string | undefined | null): AnalysisType | undefined {
  const key = (raw ?? "").toString().trim().toLowerCase();
  if (!key) return undefined;
  return labelToType[key];
}

const labelToGoalType: Record<string, ConversionGoalType> = {};
for (const option of CONVERSION_GOAL_OPTIONS) {
  if (option.type === "custom") continue;
  labelToGoalType[option.label.toLowerCase()] = option.type;
  labelToGoalType[option.type.toLowerCase()] = option.type;
}

function resolveConversionGoal(raw: string | undefined | null): ConversionGoal | undefined {
  const key = (raw ?? "").toString().trim().toLowerCase();
  if (!key) return undefined;
  const type = labelToGoalType[key];
  if (!type) return undefined;
  const option = CONVERSION_GOAL_OPTIONS.find((o) => o.type === type)!;
  return { type, isMacro: option.isMacro };
}

function stripQuotes(cell: string): string {
  const trimmed = cell.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
}

/** Generates the downloadable CSV template users fill in and re-upload. */
export function generateTemplateCsv(): string {
  const pageTypeLabels = Object.values(analysisTypeLabels);
  const goalLabels = CONVERSION_GOAL_OPTIONS.filter((o) => o.type !== "custom").map((o) => o.label);
  const lines = [
    "# Fill in one URL per row. Page Type and Conversion Goal are optional per row —",
    "# leave Page Type blank to auto-detect it, and leave Conversion Goal blank to use",
    "# the default goal selected on the Bulk Analysis page for this batch.",
    `# Valid Page Type values: ${pageTypeLabels.join(" | ")}`,
    `# Valid Conversion Goal values: ${goalLabels.join(" | ")}`,
    "URL,Page Type,Conversion Goal",
    "https://example.com,Homepage,Subscription / Signup",
    "https://example.com/blog/my-post,Blog / Content,Content Download",
    "https://example.com/checkout,Checkout,Purchase / Transaction",
  ];
  return lines.join("\n");
}

/** Parses raw CSV text into rows of cells, stripping quotes and blank lines. */
export function parseCsvText(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(",").map(stripQuotes));
}

function extractUrlTokens(cell: string): string[] {
  return cell
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && URL_LIKE.test(s))
    .map(normalizeUrl);
}

/**
 * Parses spreadsheet rows into bulk URLs, supporting two formats:
 * - The downloadable template: a header row with "URL" (and optionally "Page Type") columns.
 * - A legacy plain list: any cells containing URL-like text, with no page type.
 */
export function parseBulkRows(rows: (string | number | null | undefined)[][]): BulkRow[] {
  const normalizedRows = rows
    .map((row) => row.map((c) => (c ?? "").toString()))
    .filter((row) => row.some((c) => c.trim().length > 0));

  const dataRows = normalizedRows.filter((row) => !row[0].trim().startsWith("#"));
  if (dataRows.length === 0) return [];

  const headerCells = dataRows[0].map((c) => c.trim().toLowerCase());
  const urlCol = headerCells.indexOf("url");

  if (urlCol >= 0) {
    const pageTypeCol = headerCells.findIndex((c) => c === "page type" || c === "pagetype");
    const goalCol = headerCells.findIndex((c) => c === "conversion goal" || c === "conversiongoal");
    const seen = new Set<string>();
    const result: BulkRow[] = [];

    for (let i = 1; i < dataRows.length; i++) {
      const cell = (dataRows[i][urlCol] ?? "").trim();
      if (!cell || !URL_LIKE.test(cell)) continue;
      const url = normalizeUrl(cell);
      if (seen.has(url)) continue;
      seen.add(url);

      const pageType = pageTypeCol >= 0 ? resolvePageType(dataRows[i][pageTypeCol]) : undefined;
      const conversionGoal = goalCol >= 0 ? resolveConversionGoal(dataRows[i][goalCol]) : undefined;
      result.push({ url, ...(pageType ? { pageType } : {}), ...(conversionGoal ? { conversionGoal } : {}) });
    }

    return result;
  }

  const urls: string[] = [];
  for (const row of dataRows) {
    for (const cell of row) {
      urls.push(...extractUrlTokens(cell));
    }
  }
  return [...new Set(urls)].map((url) => ({ url }));
}
