import { describe, it, expect, vi, beforeEach } from "vitest";

const collectionMock = vi.fn((..._args: unknown[]) => ({ __collection: true }));
const getDocsMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => collectionMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
}));

vi.mock("@/integrations/firebase/client", () => ({ db: {} }));

import { getLiveBenchmarks } from "./benchmarks";

describe("getLiveBenchmarks", () => {
  beforeEach(() => {
    getDocsMock.mockReset();
  });

  it("maps each benchmarks doc to its category's live stats", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        { id: "navigation", data: () => ({ samples: [40, 50, 60, 70, 80, 90] }) },
        { id: "performance", data: () => ({ samples: [30, 40] }) },
      ],
    });

    const result = await getLiveBenchmarks();

    expect(result.navigation).toEqual({ accountAvg: 65, topQuartile: 80, sampleCount: 6 });
    expect(result.performance).toEqual({ accountAvg: 35, topQuartile: 40, sampleCount: 2 });
  });

  it("returns an empty object when there are no benchmark docs yet", async () => {
    getDocsMock.mockResolvedValue({ docs: [] });

    const result = await getLiveBenchmarks();

    expect(result).toEqual({});
  });
});
