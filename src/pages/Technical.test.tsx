import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const runTechnicalAuditMock = vi.fn();
const createActionItemsMock = vi.fn();
const trackAnalysisMock = vi.fn();

vi.mock("@/lib/api/technical", () => ({
  runTechnicalAudit: (...args: unknown[]) => runTechnicalAuditMock(...args),
}));

vi.mock("@/lib/firebase/actionItems", () => ({
  createActionItems: (...args: unknown[]) => createActionItemsMock(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));

vi.mock("@/hooks/useUsageTracking", () => ({
  useUsageTracking: () => ({
    usage: { used: 0, limit: 10, canAnalyze: true, requiresAuth: false, requiresPaid: false, periodStart: null, periodEnd: null },
    trackAnalysis: (...args: unknown[]) => trackAnalysisMock(...args),
  }),
}));

import Technical from "./Technical";

describe("Technical", () => {
  beforeEach(() => {
    runTechnicalAuditMock.mockReset();
    createActionItemsMock.mockReset();
    trackAnalysisMock.mockReset();
  });

  it("runs an audit and renders the score plus issues", async () => {
    runTechnicalAuditMock.mockResolvedValue({
      url: "https://example.com",
      technicalScore: 80,
      checks: {
        canonical: { present: true, href: "https://example.com/" },
        indexability: { indexable: true, reason: null },
        robotsTxt: { exists: true, valid: true, issue: null },
        sitemap: { exists: true, valid: true, issue: null },
        linkSummary: { total: 2, ok: 1, broken: 1, redirectChains: 0 },
      },
      issues: [
        {
          category: "technical-seo",
          severity: "low",
          title: "Broken link: https://example.com/a",
          description: "This link returned 404.",
          fix: "Update or remove this link.",
          impactScore: 30,
        },
      ],
    });
    trackAnalysisMock.mockResolvedValue(undefined);
    createActionItemsMock.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <Technical />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("example.com"), { target: { value: "example.com" } });
    fireEvent.click(screen.getByText("Run Audit"));

    await waitFor(() => {
      expect(screen.getByText("80/100")).toBeInTheDocument();
    });

    expect(screen.getByText("Broken link: https://example.com/a")).toBeInTheDocument();
    expect(trackAnalysisMock).toHaveBeenCalledWith("https://example.com", "technical", "desktop", 80);
    expect(createActionItemsMock).toHaveBeenCalledWith("uid-1", "https://example.com", "technical", [
      {
        category: "technical-seo",
        severity: "low",
        title: "Broken link: https://example.com/a",
        description: "This link returned 404.",
        fix: "Update or remove this link.",
        impactScore: 30,
      },
    ]);
  });
});
