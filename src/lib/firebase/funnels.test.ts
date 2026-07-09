import { describe, it, expect, vi, beforeEach } from "vitest";

const addDocMock = vi.fn();
const collectionMock = vi.fn((..._args: unknown[]) => ({ __col: true }));
const docMock = vi.fn((..._args: unknown[]) => ({ __ref: true }));
const deleteDocMock = vi.fn();
const queryMock = vi.fn((..._args: unknown[]) => ({ __query: true }));
const whereMock = vi.fn((..._args: unknown[]) => ({ __where: true }));
const getDocsMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => collectionMock(...args),
  addDoc: (...args: unknown[]) => addDocMock(...args),
  doc: (...args: unknown[]) => docMock(...args),
  deleteDoc: (...args: unknown[]) => deleteDocMock(...args),
  query: (...args: unknown[]) => queryMock(...args),
  where: (...args: unknown[]) => whereMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  serverTimestamp: () => "server-timestamp",
}));

vi.mock("@/integrations/firebase/client", () => ({ db: {} }));

import { createFunnel, getFunnels, deleteFunnel, createFunnelRun, getFunnelRuns } from "./funnels";

const steps = [
  { label: "Landing", url: "https://example.com" },
  { label: "Pricing", url: "https://example.com/pricing" },
];

describe("createFunnel", () => {
  beforeEach(() => addDocMock.mockReset());

  it("writes the funnel with the owning user id and a server timestamp", async () => {
    addDocMock.mockResolvedValue({ id: "funnel-1" });
    const id = await createFunnel("uid-1", "Signup funnel", steps);

    expect(addDocMock).toHaveBeenCalledWith(
      { __col: true },
      { userId: "uid-1", name: "Signup funnel", steps, createdAt: "server-timestamp" }
    );
    expect(id).toBe("funnel-1");
  });
});

describe("getFunnels", () => {
  beforeEach(() => getDocsMock.mockReset());

  it("returns the user's funnels sorted newest-first without needing a composite index (client-side sort)", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        { id: "old", data: () => ({ userId: "uid-1", name: "Old", steps, createdAt: { toDate: () => new Date("2026-07-01T00:00:00.000Z") } }) },
        { id: "new", data: () => ({ userId: "uid-1", name: "New", steps, createdAt: { toDate: () => new Date("2026-07-05T00:00:00.000Z") } }) },
      ],
    });

    const result = await getFunnels("uid-1");
    expect(result.map((f) => f.id)).toEqual(["new", "old"]);
    expect(whereMock).toHaveBeenCalledWith("userId", "==", "uid-1");
  });
});

describe("deleteFunnel", () => {
  beforeEach(() => deleteDocMock.mockReset());

  it("deletes the funnel doc", async () => {
    await deleteFunnel("funnel-1");
    expect(docMock).toHaveBeenCalledWith({}, "funnels", "funnel-1");
    expect(deleteDocMock).toHaveBeenCalledWith({ __ref: true });
  });
});

describe("createFunnelRun", () => {
  beforeEach(() => addDocMock.mockReset());

  it("writes the run snapshot with a server timestamp", async () => {
    addDocMock.mockResolvedValue({ id: "run-1" });
    const run = {
      userId: "uid-1",
      funnelId: "funnel-1",
      steps: [{ label: "Landing", url: "https://example.com", score: 70, analysisId: "a1", topIssues: ["Weak CTA"] }],
      insights: { weakestStepIndex: 0, summary: "s", transitionIssues: [], recommendations: [] },
    };
    const id = await createFunnelRun(run);

    expect(addDocMock).toHaveBeenCalledWith({ __col: true }, { ...run, createdAt: "server-timestamp" });
    expect(id).toBe("run-1");
  });
});

describe("getFunnelRuns", () => {
  beforeEach(() => getDocsMock.mockReset());

  it("returns runs for a funnel sorted newest-first, filtered by owner and funnel (equality-only, no composite index)", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        { id: "r1", data: () => ({ userId: "uid-1", funnelId: "funnel-1", steps: [], insights: null, createdAt: { toDate: () => new Date("2026-07-01T00:00:00.000Z") } }) },
        { id: "r2", data: () => ({ userId: "uid-1", funnelId: "funnel-1", steps: [], insights: null, createdAt: { toDate: () => new Date("2026-07-06T00:00:00.000Z") } }) },
      ],
    });

    const result = await getFunnelRuns("uid-1", "funnel-1");
    expect(result.map((r) => r.id)).toEqual(["r2", "r1"]);
    expect(whereMock).toHaveBeenCalledWith("userId", "==", "uid-1");
    expect(whereMock).toHaveBeenCalledWith("funnelId", "==", "funnel-1");
  });
});
