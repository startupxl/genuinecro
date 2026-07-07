import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AnalysisResult, FrictionPoint } from "./mockData";

const textMock = vi.fn();
const setFontSizeMock = vi.fn();
const setFontMock = vi.fn();
const addPageMock = vi.fn();
const saveMock = vi.fn();
const splitTextToSizeMock = vi.fn((text: string) => [text]);

vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(() => ({
    text: textMock,
    setFontSize: setFontSizeMock,
    setFont: setFontMock,
    addPage: addPageMock,
    save: saveMock,
    splitTextToSize: splitTextToSizeMock,
    internal: { pageSize: { getHeight: () => 297 } },
  })),
}));

const { copyAsJiraTickets, exportPDF } = await import("./exportUtils");

const baseResult: AnalysisResult = {
  url: "https://a.com/",
  timestamp: "2026-06-01T00:00:00.000Z",
  device: "desktop",
  analysisType: "homepage",
  conversionScore: 65,
  frictionPoints: [],
  benchmark: { overallScore: 65, industryAvg: 55, topQuartile: 80, categoryScores: {} },
};

function buildPoint(overrides: Partial<FrictionPoint> = {}): FrictionPoint {
  return {
    id: "fp-1",
    category: "ux-clarity",
    severity: "high",
    title: "Weak headline",
    description: "d",
    selector: ".hero",
    fix: "f",
    impactScore: 80,
    benchmark: { industryAvg: 50, topPerformers: 80, label: "Score" },
    abTest: { testName: "Test", hypothesis: "H", control: "C", variant: "V", metric: "M", duration: "2 weeks" },
    ...overrides,
  };
}

describe("copyAsJiraTickets", () => {
  it("includes a Duration line for the A/B test recommendation", () => {
    const text = copyAsJiraTickets(baseResult, [buildPoint()]);
    expect(text).toContain("*Duration:* 2 weeks");
  });

  it("includes a Why this duration line when durationRationale is present", () => {
    const point = buildPoint({
      abTest: {
        testName: "Test", hypothesis: "H", control: "C", variant: "V", metric: "M", duration: "2 weeks",
        durationRationale: "Assumes ~1,000 weekly visitors and the baseline conversion rate.",
      },
    });
    const text = copyAsJiraTickets(baseResult, [point]);
    expect(text).toContain("*Why this duration:* Assumes ~1,000 weekly visitors and the baseline conversion rate.");
  });

  it("omits the Why this duration line when durationRationale is absent", () => {
    const text = copyAsJiraTickets(baseResult, [buildPoint()]);
    expect(text).not.toContain("Why this duration");
  });
});

describe("exportPDF", () => {
  beforeEach(() => {
    textMock.mockClear();
    setFontSizeMock.mockClear();
    setFontMock.mockClear();
    addPageMock.mockClear();
    saveMock.mockClear();
    splitTextToSizeMock.mockClear();
  });

  it("saves a PDF named after the domain and analysis type", () => {
    exportPDF(baseResult, [buildPoint()]);
    expect(saveMock).toHaveBeenCalledWith("genuinecro-a.com-homepage.pdf");
  });

  it("writes the friction point's title and fix into the document", () => {
    exportPDF(baseResult, [buildPoint({ title: "Weak headline", fix: "Make the headline bigger" })]);
    const allText = textMock.mock.calls.map((call) => call[0]).join(" ");
    expect(allText).toContain("Weak headline");
    expect(allText).toContain("Make the headline bigger");
  });

  it("writes the conversion score into the document", () => {
    exportPDF(baseResult, []);
    const allText = textMock.mock.calls.map((call) => call[0]).join(" ");
    expect(allText).toContain("65");
  });
});
