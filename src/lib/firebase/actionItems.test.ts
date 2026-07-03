import { describe, it, expect, vi, beforeEach } from "vitest";

const collectionMock = vi.fn((..._args: unknown[]) => ({ __collection: true }));
const addDocMock = vi.fn();
const queryMock = vi.fn((..._args: unknown[]) => ({ __query: true }));
const whereMock = vi.fn((..._args: unknown[]) => ({ __where: true }));
const orderByMock = vi.fn((..._args: unknown[]) => ({ __orderBy: true }));
const getDocsMock = vi.fn();
const docMock = vi.fn((..._args: unknown[]) => ({ __doc: true }));
const updateDocMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => collectionMock(...args),
  addDoc: (...args: unknown[]) => addDocMock(...args),
  query: (...args: unknown[]) => queryMock(...args),
  where: (...args: unknown[]) => whereMock(...args),
  orderBy: (...args: unknown[]) => orderByMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  doc: (...args: unknown[]) => docMock(...args),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  serverTimestamp: () => "server-timestamp",
}));

vi.mock("@/integrations/firebase/client", () => ({ db: {} }));

import { createActionItems, getActiveActionItems, getAllActionItems, updateActionItemStatus } from "./actionItems";

describe("createActionItems", () => {
  beforeEach(() => {
    addDocMock.mockReset();
  });

  it("writes one actionItems doc per friction point", async () => {
    addDocMock.mockResolvedValue(undefined);
    await createActionItems("uid-1", "https://example.com", "homepage", [
      { category: "ux-clarity", severity: "high", title: "Weak headline", description: "d1", fix: "f1", impactScore: 80 },
      { category: "trust-credibility", severity: "med", title: "No reviews", description: "d2", fix: "f2", impactScore: 60 },
    ]);

    expect(addDocMock).toHaveBeenCalledTimes(2);
    expect(addDocMock).toHaveBeenCalledWith(
      { __collection: true },
      expect.objectContaining({
        userId: "uid-1",
        url: "https://example.com",
        analysisType: "homepage",
        category: "ux-clarity",
        severity: "high",
        title: "Weak headline",
        status: "open",
        createdAt: "server-timestamp",
      })
    );
  });
});

describe("getActiveActionItems", () => {
  beforeEach(() => {
    getDocsMock.mockReset();
    whereMock.mockClear();
  });

  it("queries for open and in-progress items belonging to the user, ordered by impact", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: "item-1",
          data: () => ({
            userId: "uid-1",
            url: "https://example.com",
            analysisType: "homepage",
            category: "ux-clarity",
            severity: "high",
            title: "Weak headline",
            description: "d1",
            fix: "f1",
            impactScore: 80,
            status: "open",
            createdAt: { toDate: () => new Date("2026-06-01T00:00:00.000Z") },
          }),
        },
      ],
    });

    const items = await getActiveActionItems("uid-1");

    expect(whereMock).toHaveBeenCalledWith("userId", "==", "uid-1");
    expect(whereMock).toHaveBeenCalledWith("status", "in", ["open", "in_progress"]);
    expect(items).toEqual([
      {
        id: "item-1",
        userId: "uid-1",
        url: "https://example.com",
        analysisType: "homepage",
        category: "ux-clarity",
        severity: "high",
        title: "Weak headline",
        description: "d1",
        fix: "f1",
        impactScore: 80,
        status: "open",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("getAllActionItems", () => {
  beforeEach(() => {
    getDocsMock.mockReset();
    whereMock.mockClear();
  });

  it("queries for all items belonging to the user, regardless of status", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: "item-1",
          data: () => ({
            userId: "uid-1",
            url: "https://example.com",
            analysisType: "homepage",
            category: "ux-clarity",
            severity: "high",
            title: "Weak headline",
            description: "d1",
            fix: "f1",
            impactScore: 80,
            status: "resolved",
            createdAt: { toDate: () => new Date("2026-06-01T00:00:00.000Z") },
          }),
        },
      ],
    });

    const items = await getAllActionItems("uid-1");

    expect(whereMock).toHaveBeenCalledWith("userId", "==", "uid-1");
    expect(whereMock).not.toHaveBeenCalledWith("status", "==", "open");
    expect(items).toEqual([
      {
        id: "item-1",
        userId: "uid-1",
        url: "https://example.com",
        analysisType: "homepage",
        category: "ux-clarity",
        severity: "high",
        title: "Weak headline",
        description: "d1",
        fix: "f1",
        impactScore: 80,
        status: "resolved",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("updateActionItemStatus", () => {
  beforeEach(() => {
    updateDocMock.mockReset();
  });

  it("stamps resolvedAt when moving an item to resolved", async () => {
    updateDocMock.mockResolvedValue(undefined);
    await updateActionItemStatus("item-1", "resolved");
    expect(updateDocMock).toHaveBeenCalledWith({ __doc: true }, { status: "resolved", resolvedAt: "server-timestamp" });
  });

  it("updates status without touching resolvedAt for a non-resolved transition", async () => {
    updateDocMock.mockResolvedValue(undefined);
    await updateActionItemStatus("item-1", "in_progress");
    expect(updateDocMock).toHaveBeenCalledWith({ __doc: true }, { status: "in_progress" });
  });
});

describe("resolvedAt mapping", () => {
  it("includes resolvedAt on a resolved item when present", async () => {
    getDocsMock.mockReset();
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: "item-1",
          data: () => ({
            userId: "uid-1",
            url: "https://example.com",
            analysisType: "homepage",
            category: "ux-clarity",
            severity: "high",
            title: "Weak headline",
            description: "d1",
            fix: "f1",
            impactScore: 80,
            status: "resolved",
            createdAt: { toDate: () => new Date("2026-06-01T00:00:00.000Z") },
            resolvedAt: { toDate: () => new Date("2026-06-05T00:00:00.000Z") },
          }),
        },
      ],
    });

    const items = await getAllActionItems("uid-1");

    expect(items[0].resolvedAt).toBe("2026-06-05T00:00:00.000Z");
  });
});
