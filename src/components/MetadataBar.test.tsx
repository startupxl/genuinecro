import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MetadataBar from "./MetadataBar";

const baseProps = {
  url: "https://example.com",
  timestamp: "2026-06-01T00:00:00.000Z",
  device: "desktop" as const,
  issueCount: 5,
  onNewAnalysis: vi.fn(),
};

describe("MetadataBar — conversion goal", () => {
  it("shows the conversion goal label when provided", () => {
    render(<MetadataBar {...baseProps} conversionGoal={{ type: "lead_form", isMacro: false }} />);
    expect(screen.getByText("Lead Form Submission")).toBeInTheDocument();
  });

  it("shows the custom label for a custom goal", () => {
    render(
      <MetadataBar
        {...baseProps}
        conversionGoal={{ type: "custom", isMacro: false, customLabel: "App install" }}
      />
    );
    expect(screen.getByText("App install")).toBeInTheDocument();
  });

  it("omits the goal chip when no goal is present (older records)", () => {
    render(<MetadataBar {...baseProps} />);
    expect(screen.queryByText("Lead Form Submission")).not.toBeInTheDocument();
  });
});
