import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConversionGoalSelect from "./ConversionGoalSelect";
import type { ConversionGoal } from "@/lib/conversionGoals";

describe("ConversionGoalSelect", () => {
  it("groups options into Macro and Micro optgroups, plus a Custom option", () => {
    render(<ConversionGoalSelect value={null} onChange={vi.fn()} />);
    const select = screen.getByRole("combobox");
    const optgroups = select.querySelectorAll("optgroup");
    expect(optgroups).toHaveLength(2);
    expect(optgroups[0]).toHaveAttribute("label", "Macro");
    expect(optgroups[1]).toHaveAttribute("label", "Micro");
    expect(screen.getByRole("option", { name: "Purchase / Transaction" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Lead Form Submission" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Custom goal…" })).toBeInTheDocument();
  });

  it("calls onChange with the goal and its isMacro flag when a macro goal is selected", () => {
    const onChange = vi.fn();
    render(<ConversionGoalSelect value={null} onChange={onChange} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "purchase" } });

    expect(onChange).toHaveBeenCalledWith({ type: "purchase", isMacro: true });
  });

  it("calls onChange with isMacro false when a micro goal is selected", () => {
    const onChange = vi.fn();
    render(<ConversionGoalSelect value={null} onChange={onChange} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "lead_form" } });

    expect(onChange).toHaveBeenCalledWith({ type: "lead_form", isMacro: false });
  });

  it("shows a free-text input for the custom label when Custom is selected", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ConversionGoalSelect value={null} onChange={onChange} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "custom" } });
    expect(onChange).toHaveBeenCalledWith({ type: "custom", isMacro: false, customLabel: "" });

    rerender(
      <ConversionGoalSelect value={{ type: "custom", isMacro: false, customLabel: "" }} onChange={onChange} />
    );
    expect(screen.getByPlaceholderText("Describe the goal…")).toBeInTheDocument();
  });

  it("updates the custom label as the user types", () => {
    const onChange = vi.fn();
    render(
      <ConversionGoalSelect value={{ type: "custom", isMacro: false, customLabel: "" }} onChange={onChange} />
    );

    fireEvent.change(screen.getByPlaceholderText("Describe the goal…"), { target: { value: "App install" } });

    expect(onChange).toHaveBeenCalledWith({ type: "custom", isMacro: false, customLabel: "App install" });
  });

  it("does not show the custom label input for a non-custom goal", () => {
    const value: ConversionGoal = { type: "purchase", isMacro: true };
    render(<ConversionGoalSelect value={value} onChange={vi.fn()} />);
    expect(screen.queryByPlaceholderText("Describe the goal…")).not.toBeInTheDocument();
  });

  it("shows a placeholder option when no goal is selected yet", () => {
    render(<ConversionGoalSelect value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: "Select a conversion goal…" })).toBeInTheDocument();
  });

  it("disables the select when disabled is true", () => {
    render(<ConversionGoalSelect value={null} onChange={vi.fn()} disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
