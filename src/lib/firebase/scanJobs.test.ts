import { describe, it, expect, vi, beforeEach } from "vitest";

const collectionMock = vi.fn((..._args: unknown[]) => ({ __collection: true }));
const addDocMock = vi.fn();
const queryMock = vi.fn((..._args: unknown[]) => ({ __query: true }));
const whereMock = vi.fn((..._args: unknown[]) => ({ __where: true }));
const getDocsMock = vi.fn();
const docMock = vi.fn((..._args: unknown[]) => ({ __doc: true }));
const updateDocMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => collectionMock(...args),
  addDoc: (...args: unknown[]) => addDocMock(...args),
  query: (...args: unknown[]) => queryMock(...args),
  where: (...args: unknown[]) => whereMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  doc: (...args: unknown[]) => docMock(...args),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  serverTimestamp: () => "server-timestamp",
}));

vi.mock("@/integrations/firebase/client", () => ({ db: {} }));

import { createScanJob, completeScanJob, getActiveScanJobs } from "./scanJobs";

describe("createScanJob", () => {
  beforeEach(() => {
    addDocMock.mockReset();
  });

  it("writes a scanJobs doc with status scanning and returns its id", async () => {
    addDocMock.mockResolvedValue({ id: "job-1" });

    const jobId = await createScanJob("uid-1", "https://example.com", "homepage", "desktop");

    expect(jobId).toBe("job-1");
    expect(addDocMock).toHaveBeenCalledWith(
      { __collection: true },
      expect.objectContaining({
        userId: "uid-1",
        url: "https://example.com",
        analysisType: "homepage",
        device: "desktop",
        status: "scanning",
        createdAt: "server-timestamp",
      })
    );
  });

  it("resolves to null instead of throwing when the write fails (must never break the actual scan)", async () => {
    addDocMock.mockRejectedValue(new Error("permission-denied"));

    const jobId = await createScanJob("uid-1", "https://example.com", "homepage", "desktop");

    expect(jobId).toBeNull();
  });

  it("resolves to null instead of hanging when the write never settles (must never block the actual scan)", async () => {
    addDocMock.mockReturnValue(new Promise(() => {})); // never resolves

    const jobId = await createScanJob("uid-1", "https://example.com", "homepage", "desktop", 50);

    expect(jobId).toBeNull();
  });
});

describe("completeScanJob", () => {
  beforeEach(() => {
    updateDocMock.mockReset();
  });

  it("marks the job as complete", async () => {
    updateDocMock.mockResolvedValue(undefined);
    await completeScanJob("job-1");
    expect(updateDocMock).toHaveBeenCalledWith({ __doc: true }, { status: "complete" });
  });

  it("does nothing when jobId is null (job was never created)", async () => {
    await completeScanJob(null);
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it("swallows errors instead of throwing", async () => {
    updateDocMock.mockRejectedValue(new Error("permission-denied"));
    await expect(completeScanJob("job-1")).resolves.toBeUndefined();
  });
});

describe("getActiveScanJobs", () => {
  beforeEach(() => {
    getDocsMock.mockReset();
  });

  it("returns scanning jobs belonging to the user", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: "job-1",
          data: () => ({
            userId: "uid-1",
            url: "https://example.com",
            analysisType: "homepage",
            device: "desktop",
            status: "scanning",
            createdAt: { toDate: () => new Date() },
          }),
        },
      ],
    });

    const jobs = await getActiveScanJobs("uid-1");

    expect(whereMock).toHaveBeenCalledWith("userId", "==", "uid-1");
    expect(whereMock).toHaveBeenCalledWith("status", "==", "scanning");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: "job-1", url: "https://example.com" });
  });

  it("filters out jobs older than 5 minutes (abandoned tab)", async () => {
    const staleDate = new Date(Date.now() - 6 * 60 * 1000);
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: "stale-job",
          data: () => ({
            userId: "uid-1",
            url: "https://stale.com",
            analysisType: "homepage",
            device: "desktop",
            status: "scanning",
            createdAt: { toDate: () => staleDate },
          }),
        },
      ],
    });

    const jobs = await getActiveScanJobs("uid-1");

    expect(jobs).toHaveLength(0);
  });

  it("returns an empty array instead of throwing when the read fails (e.g. rules not yet deployed) — must never break the Dashboard", async () => {
    getDocsMock.mockRejectedValue(new Error("Missing or insufficient permissions"));

    const jobs = await getActiveScanJobs("uid-1");

    expect(jobs).toEqual([]);
  });
});
