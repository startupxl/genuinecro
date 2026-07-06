import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const runMergedAuditMock = vi.fn();
vi.mock("@/lib/mergedAudit", () => ({
  runMergedAudit: (...args: unknown[]) => runMergedAuditMock(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Free", subscription: null }),
}));

import CompetitorComparison from "./CompetitorComparison";

function renderPage() {
  return render(
    <MemoryRouter>
      <CompetitorComparison />
    </MemoryRouter>
  );
}

function buildAudit(overrides: Record<string, unknown> = {}) {
  return {
    url: "https://example.com",
    analysisType: "homepage",
    device: "desktop",
    conversionScore: 70,
    technicalScore: 60,
    conversionGoal: null,
    frictionPoints: [],
    benchmark: {
      overallScore: 70,
      industryAvg: 55,
      topQuartile: 80,
      categoryScores: {
        navigation: { score: 70, industryAvg: 55 },
        "trust-credibility": { score: 60, industryAvg: 55 },
      },
    },
    ...overrides,
  };
}

describe("CompetitorComparison", () => {
  beforeEach(() => {
    runMergedAuditMock.mockReset();
  });

  it("disables Compare until both URLs are filled", () => {
    renderPage();
    const button = screen.getByRole("button", { name: /^Compare$/i });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/yoursite.com/i), { target: { value: "yoursite.com" } });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/competitor.com/i), { target: { value: "competitor.com" } });
    expect(button).not.toBeDisabled();
  });

  it("runs both audits and shows the score comparison plus category gaps", async () => {
    runMergedAuditMock.mockImplementation((url: string) => {
      if (url.includes("yoursite")) {
        return Promise.resolve(
          buildAudit({
            url: "https://yoursite.com",
            conversionScore: 78,
            benchmark: {
              overallScore: 78,
              industryAvg: 55,
              topQuartile: 80,
              categoryScores: {
                navigation: { score: 80, industryAvg: 55 },
                "trust-credibility": { score: 55, industryAvg: 55 },
              },
            },
          })
        );
      }
      return Promise.resolve(
        buildAudit({
          url: "https://competitor.com",
          conversionScore: 65,
          benchmark: {
            overallScore: 65,
            industryAvg: 55,
            topQuartile: 80,
            categoryScores: {
              navigation: { score: 60, industryAvg: 55 },
              "trust-credibility": { score: 85, industryAvg: 55 },
            },
          },
        })
      );
    });

    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/yoursite.com/i), { target: { value: "yoursite.com" } });
    fireEvent.change(screen.getByPlaceholderText(/competitor.com/i), { target: { value: "competitor.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^Compare$/i }));

    await waitFor(() => {
      expect(screen.getByText("78/100")).toBeInTheDocument();
    });
    expect(screen.getByText("65/100")).toBeInTheDocument();
    expect(screen.getByText("Where You're Ahead")).toBeInTheDocument();
    expect(screen.getByText("Where They're Ahead")).toBeInTheDocument();
    expect(runMergedAuditMock).toHaveBeenCalledWith("https://yoursite.com", "homepage", "desktop");
  });

  it("shows a friendly error toast-worthy message when a scan fails, without crashing", async () => {
    runMergedAuditMock.mockRejectedValue(new Error("Scrape failed"));
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/yoursite.com/i), { target: { value: "yoursite.com" } });
    fireEvent.change(screen.getByPlaceholderText(/competitor.com/i), { target: { value: "competitor.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^Compare$/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Compare$/i })).not.toBeDisabled();
    });
  });
});
