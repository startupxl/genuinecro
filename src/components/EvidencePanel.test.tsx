import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EvidencePanel from "./EvidencePanel";
import type { FrictionPoint } from "@/lib/mockData";

const updateActionItemEvidenceMock = vi.fn();
vi.mock("@/lib/firebase/actionItems", () => ({
  updateActionItemEvidence: (...args: unknown[]) => updateActionItemEvidenceMock(...args),
}));

function buildPoint(overrides: Partial<FrictionPoint> = {}): FrictionPoint {
  return {
    id: "fp-1",
    category: "ux-clarity",
    severity: "high",
    title: "Test friction point",
    description: "A description of the issue.",
    selector: ".hero",
    fix: "Do the fix.",
    impactScore: 80,
    benchmark: { industryAvg: 50, topPerformers: 80, label: "Score" },
    abTest: { testName: "Test", hypothesis: "H", control: "C", variant: "V", metric: "M", duration: "2 weeks" },
    ...overrides,
  };
}

describe("EvidencePanel", () => {
  it("shows the Evidence Base section and citation text when sourceCitation is present", () => {
    render(
      <EvidencePanel
        point={buildPoint({ sourceCitation: "Baymard Institute's publicly published checkout usability research" })}
      />
    );
    expect(screen.getByText("Evidence Base")).toBeInTheDocument();
    expect(
      screen.getByText("Baymard Institute's publicly published checkout usability research")
    ).toBeInTheDocument();
  });

  it("does not show the Evidence Base section when sourceCitation is absent", () => {
    render(<EvidencePanel point={buildPoint({ sourceCitation: undefined })} />);
    expect(screen.queryByText("Evidence Base")).not.toBeInTheDocument();
  });

  it("shows the empty-state prompt when no point is selected", () => {
    render(<EvidencePanel point={null} />);
    expect(
      screen.getByText("Select a friction point to view evidence and fix recommendations.")
    ).toBeInTheDocument();
  });

  it("lists affected pages when affectedUrls is present (domain-aggregated view)", () => {
    render(
      <EvidencePanel
        point={buildPoint({ affectedUrls: ["https://a.com/", "https://a.com/pricing"] })}
      />
    );
    expect(screen.getByText("Affected Pages (2)")).toBeInTheDocument();
    expect(screen.getByText("https://a.com/")).toBeInTheDocument();
    expect(screen.getByText("https://a.com/pricing")).toBeInTheDocument();
  });

  it("does not show the Affected Pages section for a normal single-page friction point", () => {
    render(<EvidencePanel point={buildPoint()} />);
    expect(screen.queryByText(/Affected Pages/)).not.toBeInTheDocument();
  });

  it("shows the duration rationale when the A/B test recommendation carries one", () => {
    render(
      <EvidencePanel
        point={buildPoint({
          abTest: {
            testName: "Test", hypothesis: "H", control: "C", variant: "V", metric: "M", duration: "2 weeks",
            durationRationale: "Assumes ~1,000 weekly visitors and the ~2.7% baseline desktop conversion rate; extend the test if your traffic is lower.",
          },
        })}
      />
    );
    expect(screen.getByText("Why this duration?")).toBeInTheDocument();
    expect(screen.getByText(/Assumes ~1,000 weekly visitors/)).toBeInTheDocument();
  });

  it("omits the duration rationale line when the A/B test recommendation doesn't carry one", () => {
    render(<EvidencePanel point={buildPoint()} />);
    expect(screen.queryByText("Why this duration?")).not.toBeInTheDocument();
  });

  it("shows the effort and confidence ratings when present", () => {
    render(<EvidencePanel point={buildPoint({ effort: "medium", confidence: "high" })} />);
    expect(screen.getByText("Effort to fix")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Confidence")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("omits the effort/confidence section for older records that predate this field", () => {
    render(<EvidencePanel point={buildPoint()} />);
    expect(screen.queryByText("Effort to fix")).not.toBeInTheDocument();
    expect(screen.queryByText("Confidence")).not.toBeInTheDocument();
  });

  it("shows the estimated monthly revenue impact when site settings make it computable", () => {
    render(
      <EvidencePanel
        point={buildPoint({ roiEstimate: "Could increase conversion by 15-30%" })}
        siteSettings={{ monthlyTraffic: 100000, averageOrderValue: 80, baselineConversionRate: 2.5 }}
      />
    );
    expect(screen.getByText("Estimated Revenue Impact")).toBeInTheDocument();
    expect(screen.getByText("$30,000 – $60,000 / month")).toBeInTheDocument();
  });

  it("omits the revenue impact section when there are no site settings", () => {
    render(<EvidencePanel point={buildPoint({ roiEstimate: "Could increase conversion by 15-30%" })} siteSettings={null} />);
    expect(screen.queryByText("Estimated Revenue Impact")).not.toBeInTheDocument();
  });

  it("omits the revenue impact section when the roiEstimate has no parseable percentage", () => {
    render(
      <EvidencePanel
        point={buildPoint({ roiEstimate: "Improves trust" })}
        siteSettings={{ monthlyTraffic: 100000, averageOrderValue: 80, baselineConversionRate: 2.5 }}
      />
    );
    expect(screen.queryByText("Estimated Revenue Impact")).not.toBeInTheDocument();
  });

  describe("Your Supporting Evidence", () => {
    beforeEach(() => {
      updateActionItemEvidenceMock.mockReset();
      updateActionItemEvidenceMock.mockResolvedValue(undefined);
    });

    it("pre-fills the textarea with existing userEvidence", () => {
      render(<EvidencePanel point={buildPoint({ userEvidence: "Confirmed in user testing session #3." })} />);
      expect(screen.getByLabelText(/Your Supporting Evidence/i)).toHaveValue("Confirmed in user testing session #3.");
    });

    it("starts blank when there is no existing userEvidence", () => {
      render(<EvidencePanel point={buildPoint()} />);
      expect(screen.getByLabelText(/Your Supporting Evidence/i)).toHaveValue("");
    });

    it("saves the edited note by calling updateActionItemEvidence with the point's id", async () => {
      render(<EvidencePanel point={buildPoint({ id: "item-42" })} />);
      fireEvent.change(screen.getByLabelText(/Your Supporting Evidence/i), {
        target: { value: "Client's analytics confirm this drop-off." },
      });
      fireEvent.click(screen.getByRole("button", { name: /Save note/i }));

      await waitFor(() => {
        expect(updateActionItemEvidenceMock).toHaveBeenCalledWith("item-42", "Client's analytics confirm this drop-off.");
      });
    });
  });
});
