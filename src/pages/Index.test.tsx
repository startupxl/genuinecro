import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

let mockUser: { uid: string } | null = null;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, signOut: vi.fn(), loading: false }),
}));

const trackAnalysisMock = vi.fn();
const usageMock = { used: 0, limit: 1, canAnalyze: true, requiresAuth: false, requiresPaid: false, periodStart: null, periodEnd: null };

vi.mock("@/hooks/useUsageTracking", () => ({
  useUsageTracking: () => ({ usage: usageMock, trackAnalysis: (...args: unknown[]) => trackAnalysisMock(...args) }),
}));

const analyzeUrlMock = vi.fn();
vi.mock("@/lib/api/analyze", () => ({
  analyzeUrl: (...args: unknown[]) => analyzeUrlMock(...args),
}));

const createActionItemsMock = vi.fn();
vi.mock("@/lib/firebase/actionItems", () => ({
  createActionItems: (...args: unknown[]) => createActionItemsMock(...args),
}));

vi.mock("@/components/LandingView", () => ({
  default: ({ onAnalyze }: { onAnalyze: (url: string, type?: string, device?: string) => void }) => (
    <div>
      <button onClick={() => onAnalyze("example.com", "homepage", "desktop")}>Analyze</button>
      <button onClick={() => onAnalyze("example.com", "homepage", "both")}>Analyze Both</button>
    </div>
  ),
}));

vi.mock("@/components/AnalysisView", () => ({
  default: ({ result }: { result: { url: string } }) => <div data-testid="analysis-view">{result.url}</div>,
}));

vi.mock("@/components/ComparisonView", () => ({
  default: () => <div data-testid="comparison-view" />,
}));

vi.mock("@/components/AuthPage", () => ({
  default: ({ message }: { message?: string }) => <div data-testid="auth-page">{message}</div>,
}));

vi.mock("@/components/UpgradeWall", () => ({
  default: () => <div data-testid="upgrade-wall" />,
}));

import Index from "./Index";

const mockAnalysisResult = {
  url: "https://example.com",
  analysisType: "homepage",
  device: "desktop",
  conversionScore: 72,
  benchmark: { overallScore: 72 },
  frictionPoints: [{ category: "ux-clarity", severity: "high", title: "Issue", description: "d", fix: "f", impactScore: 80 }],
};

describe("Index — login-gated results", () => {
  beforeEach(() => {
    mockUser = null;
    trackAnalysisMock.mockReset().mockResolvedValue(undefined);
    analyzeUrlMock.mockReset();
    createActionItemsMock.mockReset().mockResolvedValue(undefined);
    usageMock.requiresAuth = false;
    usageMock.requiresPaid = false;
  });

  it("shows the sign-in gate instead of the report when an anonymous scan completes", async () => {
    analyzeUrlMock.mockResolvedValue(mockAnalysisResult);

    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Analyze"));

    await waitFor(() => {
      expect(screen.getByTestId("auth-page")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("analysis-view")).not.toBeInTheDocument();
    expect(createActionItemsMock).not.toHaveBeenCalled();
  });

  it("reveals the held result and saves it retroactively once the visitor logs in", async () => {
    analyzeUrlMock.mockResolvedValue(mockAnalysisResult);

    const { rerender } = render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Analyze"));

    await waitFor(() => {
      expect(screen.getByTestId("auth-page")).toBeInTheDocument();
    });

    mockUser = { uid: "uid-1" };
    rerender(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("analysis-view")).toBeInTheDocument();
    });
    expect(trackAnalysisMock).toHaveBeenCalledWith("https://example.com", "homepage", "desktop", 72, {});
    expect(createActionItemsMock).toHaveBeenCalledWith("uid-1", "https://example.com", "homepage", mockAnalysisResult.frictionPoints);
  });

  it("shows the report directly when already signed in at scan time", async () => {
    mockUser = { uid: "uid-1" };
    analyzeUrlMock.mockResolvedValue(mockAnalysisResult);

    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Analyze"));

    await waitFor(() => {
      expect(screen.getByTestId("analysis-view")).toBeInTheDocument();
    });
    expect(trackAnalysisMock).toHaveBeenCalledTimes(1);
    expect(createActionItemsMock).toHaveBeenCalledTimes(1);
  });

  it("gates the comparison view behind login too", async () => {
    analyzeUrlMock.mockResolvedValue(mockAnalysisResult);

    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Analyze Both"));

    await waitFor(() => {
      expect(screen.getByTestId("auth-page")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("comparison-view")).not.toBeInTheDocument();
  });
});
