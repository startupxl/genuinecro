import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const getSharedReportMock = vi.fn();

vi.mock("@/lib/firebase/sharedReports", () => ({
  getSharedReport: (...args: unknown[]) => getSharedReportMock(...args),
}));

import SharedReport from "./SharedReport";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reports/shared/:shareId" element={<SharedReport />} />
      </Routes>
    </MemoryRouter>
  );
}

const baseShare = {
  id: "share-1",
  userId: "uid-1",
  analysisId: "analysis-1",
  reportData: {
    url: "https://example.com",
    analysisType: "homepage",
    device: "desktop" as const,
    conversionScore: 72,
    categoryScores: { "cta-effectiveness": 65 },
    frictionPoints: [
      {
        category: "cta-effectiveness",
        severity: "high" as const,
        title: "Weak call-to-action",
        description: "The CTA blends into the page.",
        fix: "Increase contrast and size.",
        impactScore: 80,
      },
    ],
  },
  createdAt: "2026-07-01T00:00:00.000Z",
};

describe("SharedReport", () => {
  beforeEach(() => {
    getSharedReportMock.mockReset();
  });

  it("shows the not-found message instead of hanging on 'Loading...' forever when the fetch fails", async () => {
    getSharedReportMock.mockRejectedValue(new Error("Missing or insufficient permissions."));
    renderAt("/reports/shared/broken");

    await waitFor(() => {
      expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
    });
  });

  it("shows a not-found message when the share doesn't exist or was revoked", async () => {
    getSharedReportMock.mockResolvedValue(null);
    renderAt("/reports/shared/missing");

    await waitFor(() => {
      expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
    });
  });

  it("renders the score, url, and friction points from the shared snapshot", async () => {
    getSharedReportMock.mockResolvedValue(baseShare);
    renderAt("/reports/shared/share-1");

    await waitFor(() => {
      expect(screen.getByText("72")).toBeInTheDocument();
    });
    expect(screen.getByText("https://example.com")).toBeInTheDocument();
    expect(screen.getByText("Weak call-to-action")).toBeInTheDocument();
    expect(screen.getByText("Increase contrast and size.")).toBeInTheDocument();
    expect(getSharedReportMock).toHaveBeenCalledWith("share-1");
  });

  it("does not render any gated app navigation (public, no login required)", async () => {
    getSharedReportMock.mockResolvedValue(baseShare);
    renderAt("/reports/shared/share-1");

    await waitFor(() => {
      expect(screen.getByText("72")).toBeInTheDocument();
    });
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });
});
