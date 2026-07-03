import { describe, it, expect, vi, beforeEach } from "vitest";

const collectionMock = vi.fn((..._args: unknown[]) => ({ __collection: true }));
const addDocMock = vi.fn();
const queryMock = vi.fn((...args: unknown[]) => ({ __query: args }));
const whereMock = vi.fn((...args: unknown[]) => ({ __where: args }));
const orderByMock = vi.fn((..._args: unknown[]) => ({ __orderBy: true }));
const limitMock = vi.fn((..._args: unknown[]) => ({ __limit: true }));
const getDocsMock = vi.fn();
const getCountFromServerMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => collectionMock(...args),
  addDoc: (...args: unknown[]) => addDocMock(...args),
  query: (...args: unknown[]) => queryMock(...args),
  where: (...args: unknown[]) => whereMock(...args),
  orderBy: (...args: unknown[]) => orderByMock(...args),
  limit: (...args: unknown[]) => limitMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  getCountFromServer: (...args: unknown[]) => getCountFromServerMock(...args),
  serverTimestamp: () => "server-timestamp",
  Timestamp: { fromDate: (d: Date) => ({ __timestamp: d.toISOString() }) },
}));

vi.mock("@/integrations/firebase/client", () => ({ db: {} }));

import { recordAnalysis, countAnalysesSince, getRecentAnalyses, groupAnalysesByDomain } from "./analyses";

describe("firebase analyses module", () => {
  beforeEach(() => {
    addDocMock.mockReset();
    getCountFromServerMock.mockReset();
    getDocsMock.mockReset();
  });

  it("records an analysis with a server timestamp", async () => {
    addDocMock.mockResolvedValue(undefined);
    await recordAnalysis({ userId: "uid-1", url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 72 });
    expect(addDocMock).toHaveBeenCalledWith(
      { __collection: true },
      expect.objectContaining({
        userId: "uid-1",
        url: "https://example.com",
        analysisType: "homepage",
        device: "desktop",
        conversionScore: 72,
        createdAt: "server-timestamp",
      })
    );
  });

  it("records categoryScores when provided", async () => {
    addDocMock.mockResolvedValue(undefined);
    await recordAnalysis({
      userId: "uid-1",
      url: "https://example.com",
      analysisType: "homepage",
      device: "desktop",
      conversionScore: 72,
      categoryScores: { "content-hierarchy": 65, navigation: 60 },
    });
    expect(addDocMock).toHaveBeenCalledWith(
      { __collection: true },
      expect.objectContaining({ categoryScores: { "content-hierarchy": 65, navigation: 60 } })
    );
  });

  it("counts analyses for a user since a given date", async () => {
    getCountFromServerMock.mockResolvedValue({ data: () => ({ count: 7 }) });
    const count = await countAnalysesSince("uid-1", new Date("2026-06-01T00:00:00.000Z"));
    expect(count).toBe(7);
    expect(whereMock).toHaveBeenCalledWith("userId", "==", "uid-1");
  });
});

describe("getRecentAnalyses", () => {
  it("maps Firestore docs into AnalysisRecord objects", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        {
          data: () => ({
            url: "https://a.example.com",
            analysisType: "homepage",
            device: "desktop",
            conversionScore: 72,
            createdAt: { toDate: () => new Date("2026-06-01T00:00:00.000Z") },
          }),
        },
      ],
    });

    const records = await getRecentAnalyses("uid-1");

    expect(records).toEqual([
      {
        url: "https://a.example.com",
        analysisType: "homepage",
        device: "desktop",
        conversionScore: 72,
        createdAt: "2026-06-01T00:00:00.000Z",
        categoryScores: undefined,
      },
    ]);
  });

  it("passes through categoryScores when present on the document", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        {
          data: () => ({
            url: "https://a.example.com",
            analysisType: "homepage",
            device: "desktop",
            conversionScore: 72,
            createdAt: { toDate: () => new Date("2026-06-01T00:00:00.000Z") },
            categoryScores: { "content-hierarchy": 65, navigation: 60 },
          }),
        },
      ],
    });

    const records = await getRecentAnalyses("uid-1");

    expect(records[0].categoryScores).toEqual({ "content-hierarchy": 65, navigation: 60 });
  });
});

describe("groupAnalysesByDomain", () => {
  it("groups analyses by hostname and strips a leading www.", () => {
    const summaries = groupAnalysesByDomain([
      { url: "https://www.example.com/checkout", analysisType: "checkout", device: "desktop", conversionScore: 60, createdAt: "2026-06-01T00:00:00.000Z" },
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 50, createdAt: "2026-05-01T00:00:00.000Z" },
    ]);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].domain).toBe("example.com");
    expect(summaries[0].analysisCount).toBe(2);
  });

  it("computes the latest score, previous score, and delta from the two most recent analyses", () => {
    const summaries = groupAnalysesByDomain([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 70, createdAt: "2026-06-01T00:00:00.000Z" },
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 55, createdAt: "2026-05-01T00:00:00.000Z" },
    ]);

    expect(summaries[0].latestScore).toBe(70);
    expect(summaries[0].previousScore).toBe(55);
    expect(summaries[0].scoreDelta).toBe(15);
  });

  it("leaves previousScore and scoreDelta null when there's only one analysis for a domain", () => {
    const summaries = groupAnalysesByDomain([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 70, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    expect(summaries[0].previousScore).toBeNull();
    expect(summaries[0].scoreDelta).toBeNull();
  });

  it("sorts sites by most recently analyzed first", () => {
    const summaries = groupAnalysesByDomain([
      { url: "https://older.example.com", analysisType: "homepage", device: "desktop", conversionScore: 70, createdAt: "2026-05-01T00:00:00.000Z" },
      { url: "https://newer.example.com", analysisType: "homepage", device: "desktop", conversionScore: 70, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    expect(summaries.map((s) => s.domain)).toEqual(["newer.example.com", "older.example.com"]);
  });

  it("excludes technical audits from the domain's score trend", () => {
    const summaries = groupAnalysesByDomain([
      { url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 70, createdAt: "2026-06-01T00:00:00.000Z" },
      { url: "https://example.com", analysisType: "technical", device: "desktop", conversionScore: 40, createdAt: "2026-06-02T00:00:00.000Z" },
    ]);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].latestScore).toBe(70);
    expect(summaries[0].analysisCount).toBe(1);
  });
});
