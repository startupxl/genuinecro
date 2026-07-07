import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getSharedReportsForUserMock = vi.fn();
const revokeSharedReportMock = vi.fn();

const mockUser = { uid: "uid-1" };
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Pro", subscription: null }),
}));

vi.mock("@/lib/firebase/sharedReports", () => ({
  getSharedReportsForUser: (...args: unknown[]) => getSharedReportsForUserMock(...args),
  revokeSharedReport: (...args: unknown[]) => revokeSharedReportMock(...args),
}));

import Reports from "./Reports";

function renderPage() {
  return render(
    <MemoryRouter>
      <Reports />
    </MemoryRouter>
  );
}

const shareRecord = {
  id: "share-1",
  userId: "uid-1",
  analysisId: "analysis-1",
  reportData: {
    url: "https://example.com",
    analysisType: "homepage",
    device: "desktop" as const,
    conversionScore: 72,
    frictionPoints: [],
  },
  createdAt: "2026-07-01T00:00:00.000Z",
};

describe("Reports", () => {
  beforeEach(() => {
    getSharedReportsForUserMock.mockReset();
    revokeSharedReportMock.mockReset();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("stops showing the loading state and surfaces an error instead of hanging forever when the fetch fails", async () => {
    getSharedReportsForUserMock.mockRejectedValue(new Error("Missing or insufficient permissions."));
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    });
    expect(screen.getByText(/couldn't load your reports/i)).toBeInTheDocument();
  });

  it("shows an empty state when no reports have been shared yet", async () => {
    getSharedReportsForUserMock.mockResolvedValue([]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/haven't shared any reports yet/i)).toBeInTheDocument();
    });
  });

  it("lists shared reports with a copy-link and revoke action", async () => {
    getSharedReportsForUserMock.mockResolvedValue([shareRecord]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("https://example.com")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Copy Link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Revoke/i })).toBeInTheDocument();
  });

  it("copies the share link to the clipboard", async () => {
    getSharedReportsForUserMock.mockResolvedValue([shareRecord]);
    renderPage();
    await waitFor(() => expect(screen.getByText("https://example.com")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Copy Link/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("/reports/shared/share-1"));
    });
  });

  it("revokes a share and removes it from the list", async () => {
    getSharedReportsForUserMock.mockResolvedValue([shareRecord]);
    revokeSharedReportMock.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => expect(screen.getByText("https://example.com")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Revoke/i }));

    await waitFor(() => {
      expect(revokeSharedReportMock).toHaveBeenCalledWith("share-1");
    });
    await waitFor(() => {
      expect(screen.queryByText("https://example.com")).not.toBeInTheDocument();
    });
  });
});
