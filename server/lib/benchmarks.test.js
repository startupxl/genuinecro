import { describe, it, expect, vi, beforeEach } from "vitest";

const ensureServerSignedInMock = vi.fn().mockResolvedValue(undefined);
const docMock = vi.fn((...args) => ({ __doc: args[args.length - 1] }));
const runTransactionMock = vi.fn();

vi.mock("../firebaseServerAuth.js", () => ({
  serverDb: {},
  ensureServerSignedIn: (...args) => ensureServerSignedInMock(...args),
}));

vi.mock("firebase/firestore", () => ({
  doc: (...args) => docMock(...args),
  runTransaction: (...args) => runTransactionMock(...args),
}));

const { computeBenchmarkStats, recordCategoryScores } = await import("./benchmarks.js");

describe("computeBenchmarkStats", () => {
  it("returns null for an empty sample list", () => {
    expect(computeBenchmarkStats([])).toBeNull();
  });

  it("computes the rounded average and sample count", () => {
    const stats = computeBenchmarkStats([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(stats.sampleCount).toBe(10);
    expect(stats.accountAvg).toBe(55);
  });

  it("computes an approximate 75th-percentile top score", () => {
    const stats = computeBenchmarkStats([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(stats.topQuartile).toBe(80);
  });
});

describe("recordCategoryScores", () => {
  beforeEach(() => {
    ensureServerSignedInMock.mockClear();
    runTransactionMock.mockReset();
    docMock.mockClear();
  });

  it("signs in and runs one transaction per category", async () => {
    runTransactionMock.mockImplementation(async (_db, updateFn) => {
      const tx = {
        get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ samples: [40, 50] }) }),
        set: vi.fn(),
      };
      await updateFn(tx);
    });

    await recordCategoryScores({ navigation: 60, performance: 70 });

    expect(ensureServerSignedInMock).toHaveBeenCalledTimes(1);
    expect(runTransactionMock).toHaveBeenCalledTimes(2);
  });

  it("appends the new score onto the existing samples for that category", async () => {
    let capturedData;
    runTransactionMock.mockImplementation(async (_db, updateFn) => {
      const tx = {
        get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ samples: [40, 50] }) }),
        set: vi.fn((_ref, data) => { capturedData = data; }),
      };
      await updateFn(tx);
    });

    await recordCategoryScores({ navigation: 60 });

    expect(capturedData.samples).toEqual([40, 50, 60]);
  });

  it("starts a fresh samples array when no benchmark doc exists yet", async () => {
    let capturedData;
    runTransactionMock.mockImplementation(async (_db, updateFn) => {
      const tx = {
        get: vi.fn().mockResolvedValue({ exists: () => false, data: () => undefined }),
        set: vi.fn((_ref, data) => { capturedData = data; }),
      };
      await updateFn(tx);
    });

    await recordCategoryScores({ navigation: 60 });

    expect(capturedData.samples).toEqual([60]);
  });

  it("caps stored samples at 200, dropping the oldest first", async () => {
    const existingSamples = Array.from({ length: 200 }, (_, i) => i);
    let capturedData;
    runTransactionMock.mockImplementation(async (_db, updateFn) => {
      const tx = {
        get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ samples: existingSamples }) }),
        set: vi.fn((_ref, data) => { capturedData = data; }),
      };
      await updateFn(tx);
    });

    await recordCategoryScores({ navigation: 999 });

    expect(capturedData.samples).toHaveLength(200);
    expect(capturedData.samples[0]).toBe(1);
    expect(capturedData.samples[199]).toBe(999);
  });
});
