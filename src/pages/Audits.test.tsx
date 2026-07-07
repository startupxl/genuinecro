import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getRecentAnalysesMock = vi.fn();
const getAllActionItemsMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/lib/firebase/analyses", () => ({
  getRecentAnalyses: (...args: unknown[]) => getRecentAnalysesMock(...args),
}));

vi.mock("@/lib/firebase/actionItems", () => ({
  getAllActionItems: (...args: unknown[]) => getAllActionItemsMock(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Free", subscription: null }),
}));

vi.mock("@/components/NewAuditModal", () => ({
  default: ({ open }: { open: boolean }) => <div data-testid="new-audit-modal">{open ? "open" : "closed"}</div>,
}));

import Audits from "./Audits";

describe("Audits", () => {
  beforeEach(() => {
    getRecentAnalysesMock.mockReset();
    getAllActionItemsMock.mockReset().mockResolvedValue([]);
    navigateMock.mockReset();
  });

  it("shows an empty state when there are no audits yet", async () => {
    getRecentAnalysesMock.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <Audits />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("No audits yet.")).toBeInTheDocument();
    });
  });

  it("renders every past audit once loaded", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { id: "a1", url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 65, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    render(
      <MemoryRouter>
        <Audits />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("https://example.com")).toBeInTheDocument();
    });
  });

  it("navigates to the audit detail page when a row is clicked", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { id: "a1", url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 65, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    render(
      <MemoryRouter>
        <Audits />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("https://example.com")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("https://example.com"));

    expect(navigateMock).toHaveBeenCalledWith("/audits/a1");
  });

  it("navigates home with a prefilled url when Re-scan is clicked", async () => {
    getRecentAnalysesMock.mockResolvedValue([
      { id: "a1", url: "https://example.com", analysisType: "homepage", device: "desktop", conversionScore: 65, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);

    render(
      <MemoryRouter>
        <Audits />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Re-scan")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Re-scan"));

    expect(navigateMock).toHaveBeenCalledWith("/", { state: { prefillUrl: "https://example.com" } });
  });

  it("opens the New Audit modal when the button is clicked, instead of navigating away", async () => {
    getRecentAnalysesMock.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <Audits />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("new-audit-modal")).toHaveTextContent("closed");
    });

    fireEvent.click(screen.getByText("New Audit"));

    expect(screen.getByTestId("new-audit-modal")).toHaveTextContent("open");
    expect(navigateMock).not.toHaveBeenCalledWith("/");
  });
});
