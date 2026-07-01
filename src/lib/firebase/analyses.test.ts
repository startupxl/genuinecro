import { describe, it, expect, vi, beforeEach } from "vitest";

const collectionMock = vi.fn(() => ({ __collection: true }));
const addDocMock = vi.fn();
const queryMock = vi.fn((...args: unknown[]) => ({ __query: args }));
const whereMock = vi.fn((...args: unknown[]) => ({ __where: args }));
const getCountFromServerMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => collectionMock(...args),
  addDoc: (...args: unknown[]) => addDocMock(...args),
  query: (...args: unknown[]) => queryMock(...args),
  where: (...args: unknown[]) => whereMock(...args),
  getCountFromServer: (...args: unknown[]) => getCountFromServerMock(...args),
  serverTimestamp: () => "server-timestamp",
  Timestamp: { fromDate: (d: Date) => ({ __timestamp: d.toISOString() }) },
}));

vi.mock("@/integrations/firebase/client", () => ({ db: {} }));

import { recordAnalysis, countAnalysesSince } from "./analyses";

describe("firebase analyses module", () => {
  beforeEach(() => {
    addDocMock.mockReset();
    getCountFromServerMock.mockReset();
  });

  it("records an analysis with a server timestamp", async () => {
    addDocMock.mockResolvedValue(undefined);
    await recordAnalysis({ userId: "uid-1", url: "https://example.com", analysisType: "homepage", device: "desktop" });
    expect(addDocMock).toHaveBeenCalledWith(
      { __collection: true },
      expect.objectContaining({
        userId: "uid-1",
        url: "https://example.com",
        analysisType: "homepage",
        device: "desktop",
        createdAt: "server-timestamp",
      })
    );
  });

  it("counts analyses for a user since a given date", async () => {
    getCountFromServerMock.mockResolvedValue({ data: () => ({ count: 7 }) });
    const count = await countAnalysesSince("uid-1", new Date("2026-06-01T00:00:00.000Z"));
    expect(count).toBe(7);
    expect(whereMock).toHaveBeenCalledWith("userId", "==", "uid-1");
  });
});
