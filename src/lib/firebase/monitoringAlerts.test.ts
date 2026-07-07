import { describe, it, expect, vi, beforeEach } from "vitest";

const addDocMock = vi.fn();
const collectionMock = vi.fn((..._args: unknown[]) => ({ __col: true }));
const queryMock = vi.fn((..._args: unknown[]) => ({ __query: true }));
const whereMock = vi.fn((..._args: unknown[]) => ({ __where: true }));
const orderByMock = vi.fn((..._args: unknown[]) => ({ __orderBy: true }));
const getDocsMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => collectionMock(...args),
  addDoc: (...args: unknown[]) => addDocMock(...args),
  query: (...args: unknown[]) => queryMock(...args),
  where: (...args: unknown[]) => whereMock(...args),
  orderBy: (...args: unknown[]) => orderByMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  serverTimestamp: () => "server-timestamp",
}));

vi.mock("@/integrations/firebase/client", () => ({ db: {} }));

import { createMonitoringAlert, getMonitoringAlerts } from "./monitoringAlerts";

describe("createMonitoringAlert", () => {
  beforeEach(() => {
    addDocMock.mockReset();
  });

  it("writes the alert with a server timestamp", async () => {
    await createMonitoringAlert({
      userId: "uid-1",
      domain: "example.com",
      previousScore: 70,
      newScore: 60,
      scoreDelta: -10,
      newCriticalIssueTitles: ["Slow page load"],
    });

    expect(addDocMock).toHaveBeenCalledWith(
      { __col: true },
      {
        userId: "uid-1",
        domain: "example.com",
        previousScore: 70,
        newScore: 60,
        scoreDelta: -10,
        newCriticalIssueTitles: ["Slow page load"],
        createdAt: "server-timestamp",
      }
    );
  });
});

describe("getMonitoringAlerts", () => {
  beforeEach(() => {
    getDocsMock.mockReset();
  });

  it("maps alert docs sorted newest-first", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: "alert-1",
          data: () => ({
            userId: "uid-1",
            domain: "example.com",
            previousScore: 70,
            newScore: 60,
            scoreDelta: -10,
            newCriticalIssueTitles: ["Slow page load"],
            createdAt: { toDate: () => new Date("2026-07-01T00:00:00.000Z") },
          }),
        },
      ],
    });

    const result = await getMonitoringAlerts("uid-1");
    expect(result).toEqual([
      {
        id: "alert-1",
        userId: "uid-1",
        domain: "example.com",
        previousScore: 70,
        newScore: 60,
        scoreDelta: -10,
        newCriticalIssueTitles: ["Slow page load"],
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ]);
    expect(whereMock).toHaveBeenCalledWith("userId", "==", "uid-1");
    expect(orderByMock).toHaveBeenCalledWith("createdAt", "desc");
  });
});
