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

describe("createActionItems — rich evidence fields", () => {
  beforeEach(() => {
    addDocMock.mockReset();
  });

  it("persists selector, benchmark, and abTest when present on the friction point", async () => {
    addDocMock.mockResolvedValue(undefined);
    await createActionItems("uid-1", "https://example.com", "homepage", [
      {
        category: "ux-clarity",
        severity: "high",
        title: "Weak headline",
        description: "d1",
        fix: "f1",
        impactScore: 80,
        selector: "header > h1",
        roiEstimate: "+3% conversion",
        insightCluster: "Clarity Gap",
        screenshotUrl: "https://cdn.example.com/shot.png",
        sourceCitation: "NNGroup heuristic #4",
        benchmark: { industryAvg: 55, topPerformers: 80, label: "Headline clarity across sites" },
        abTest: {
          testName: "Headline Clarity Test",
          hypothesis: "A clearer headline increases signups",
          control: "Current headline",
          variant: "Benefit-led headline",
          metric: "Signup rate",
          duration: "2 weeks",
        },
      },
    ]);

    expect(addDocMock).toHaveBeenCalledWith(
      { __collection: true },
      expect.objectContaining({
        selector: "header > h1",
        roiEstimate: "+3% conversion",
        insightCluster: "Clarity Gap",
        screenshotUrl: "https://cdn.example.com/shot.png",
        sourceCitation: "NNGroup heuristic #4",
        benchmark: { industryAvg: 55, topPerformers: 80, label: "Headline clarity across sites" },
        abTest: {
          testName: "Headline Clarity Test",
          hypothesis: "A clearer headline increases signups",
          control: "Current headline",
          variant: "Benefit-led headline",
          metric: "Signup rate",
          duration: "2 weeks",
        },
      })
    );
  });

  it("never writes explicit undefined fields when optional evidence fields are absent (a Technical issue)", async () => {
    addDocMock.mockResolvedValue(undefined);
    await createActionItems("uid-1", "https://example.com", "homepage", [
      { category: "technical-seo", severity: "high", title: "Missing canonical", description: "d1", fix: "f1", impactScore: 80 },
    ]);

    const writtenData = addDocMock.mock.calls[0][1];
    expect("selector" in writtenData).toBe(false);
    expect("roiEstimate" in writtenData).toBe(false);
    expect("insightCluster" in writtenData).toBe(false);
    expect("screenshotUrl" in writtenData).toBe(false);
    expect("sourceCitation" in writtenData).toBe(false);
    expect("benchmark" in writtenData).toBe(false);
    expect("abTest" in writtenData).toBe(false);
    expect("effort" in writtenData).toBe(false);
    expect("confidence" in writtenData).toBe(false);
  });

  it("persists effort and confidence when present on the friction point", async () => {
    addDocMock.mockResolvedValue(undefined);
    await createActionItems("uid-1", "https://example.com", "homepage", [
      { category: "ux-clarity", severity: "high", title: "Weak headline", description: "d1", fix: "f1", impactScore: 80, effort: "low", confidence: "high" },
    ]);

    expect(addDocMock).toHaveBeenCalledWith(
      { __collection: true },
      expect.objectContaining({ effort: "low", confidence: "high" })
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

describe("getAllActionItems — rich evidence fields", () => {
  it("passes through selector, benchmark, and abTest when present on the document", async () => {
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
            status: "open",
            createdAt: { toDate: () => new Date("2026-06-01T00:00:00.000Z") },
            selector: "header > h1",
            benchmark: { industryAvg: 55, topPerformers: 80, label: "Headline clarity across sites" },
            abTest: {
              testName: "Headline Clarity Test",
              hypothesis: "A clearer headline increases signups",
              control: "Current headline",
              variant: "Benefit-led headline",
              metric: "Signup rate",
              duration: "2 weeks",
            },
          }),
        },
      ],
    });

    const items = await getAllActionItems("uid-1");

    expect(items[0].selector).toBe("header > h1");
    expect(items[0].benchmark).toEqual({ industryAvg: 55, topPerformers: 80, label: "Headline clarity across sites" });
    expect(items[0].abTest?.testName).toBe("Headline Clarity Test");
  });

  it("passes through effort and confidence when present on the document", async () => {
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
            status: "open",
            createdAt: { toDate: () => new Date("2026-06-01T00:00:00.000Z") },
            effort: "low",
            confidence: "high",
          }),
        },
      ],
    });

    const items = await getAllActionItems("uid-1");

    expect(items[0].effort).toBe("low");
    expect(items[0].confidence).toBe("high");
  });

  it("leaves the rich evidence fields undefined for older items that predate this schema", async () => {
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
            status: "open",
            createdAt: { toDate: () => new Date("2026-06-01T00:00:00.000Z") },
          }),
        },
      ],
    });

    const items = await getAllActionItems("uid-1");

    expect(items[0].selector).toBeUndefined();
    expect(items[0].benchmark).toBeUndefined();
    expect(items[0].abTest).toBeUndefined();
    expect(items[0].effort).toBeUndefined();
    expect(items[0].confidence).toBeUndefined();
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
