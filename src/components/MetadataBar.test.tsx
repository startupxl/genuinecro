import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

describe("MetadataBar — share", () => {
  it("calls onShare when the Share button is clicked", () => {
    const onShare = vi.fn();
    render(<MetadataBar {...baseProps} onShare={onShare} />);
    fireEvent.click(screen.getByRole("button", { name: /Share/i }));
    expect(onShare).toHaveBeenCalled();
  });

  it("does not render the Share button when onShare is absent (e.g. anonymous view)", () => {
    render(<MetadataBar {...baseProps} />);
    expect(screen.queryByRole("button", { name: /Share/i })).not.toBeInTheDocument();
  });
});
