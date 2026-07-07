import { describe, it, expect, vi, beforeEach } from "vitest";

const addDocMock = vi.fn();
const collectionMock = vi.fn((..._args: unknown[]) => ({ __col: true }));
const docMock = vi.fn((..._args: unknown[]) => ({ __ref: true }));
const getDocMock = vi.fn();
const deleteDocMock = vi.fn();
const queryMock = vi.fn((..._args: unknown[]) => ({ __query: true }));
const whereMock = vi.fn((..._args: unknown[]) => ({ __where: true }));
const orderByMock = vi.fn((..._args: unknown[]) => ({ __orderBy: true }));
const getDocsMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => collectionMock(...args),
  addDoc: (...args: unknown[]) => addDocMock(...args),
  doc: (...args: unknown[]) => docMock(...args),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  deleteDoc: (...args: unknown[]) => deleteDocMock(...args),
  query: (...args: unknown[]) => queryMock(...args),
  where: (...args: unknown[]) => whereMock(...args),
  orderBy: (...args: unknown[]) => orderByMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  serverTimestamp: () => "server-timestamp",
}));

vi.mock("@/integrations/firebase/client", () => ({ db: {} }));

import { createSharedReport, getSharedReport, getSharedReportsForUser, revokeSharedReport } from "./sharedReports";

const reportData = {
  url: "https://example.com",
  analysisType: "homepage",
  device: "desktop" as const,
  conversionScore: 72,
  categoryScores: { "cta-effectiveness": 65 },
  frictionPoints: [
    { category: "cta-effectiveness", severity: "high" as const, title: "Weak CTA", description: "d", fix: "f", impactScore: 80 },
  ],
};

describe("createSharedReport", () => {
  beforeEach(() => {
    addDocMock.mockReset();
  });

  it("writes the report snapshot with the owning user id and a server timestamp", async () => {
    addDocMock.mockResolvedValue({ id: "share-1" });
    const shareId = await createSharedReport("uid-1", "analysis-1", reportData);

    expect(addDocMock).toHaveBeenCalledWith(
      { __col: true },
      { userId: "uid-1", analysisId: "analysis-1", reportData, createdAt: "server-timestamp" }
    );
    expect(shareId).toBe("share-1");
  });
});

describe("getSharedReport", () => {
  beforeEach(() => {
    getDocMock.mockReset();
  });

  it("returns null when the share doesn't exist", async () => {
    getDocMock.mockResolvedValue({ exists: () => false });
    const result = await getSharedReport("share-1");
    expect(result).toBeNull();
  });

  it("returns the report snapshot when it exists", async () => {
    getDocMock.mockResolvedValue({
      id: "share-1",
      exists: () => true,
      data: () => ({ userId: "uid-1", analysisId: "analysis-1", reportData, createdAt: { toDate: () => new Date("2026-07-01T00:00:00.000Z") } }),
    });
    const result = await getSharedReport("share-1");
    expect(result).toEqual({
      id: "share-1",
      userId: "uid-1",
      analysisId: "analysis-1",
      reportData,
      createdAt: "2026-07-01T00:00:00.000Z",
    });
  });
});

describe("getSharedReportsForUser", () => {
  beforeEach(() => {
    getDocsMock.mockReset();
  });

  it("maps the user's shared reports sorted newest-first", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: "share-1",
          data: () => ({ userId: "uid-1", analysisId: "analysis-1", reportData, createdAt: { toDate: () => new Date("2026-07-01T00:00:00.000Z") } }),
        },
      ],
    });
    const result = await getSharedReportsForUser("uid-1");
    expect(result).toEqual([
      { id: "share-1", userId: "uid-1", analysisId: "analysis-1", reportData, createdAt: "2026-07-01T00:00:00.000Z" },
    ]);
    expect(whereMock).toHaveBeenCalledWith("userId", "==", "uid-1");
    expect(orderByMock).toHaveBeenCalledWith("createdAt", "desc");
  });
});

describe("revokeSharedReport", () => {
  beforeEach(() => {
    deleteDocMock.mockReset();
  });

  it("deletes the shared report doc", async () => {
    await revokeSharedReport("share-1");
    expect(deleteDocMock).toHaveBeenCalledWith({ __ref: true });
    expect(docMock).toHaveBeenCalledWith({}, "sharedReports", "share-1");
  });
});
