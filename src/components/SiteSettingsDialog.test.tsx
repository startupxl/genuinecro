import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));

const saveSiteSettingsMock = vi.fn();
vi.mock("@/lib/firebase/siteSettings", () => ({
  saveSiteSettings: (...args: unknown[]) => saveSiteSettingsMock(...args),
}));

import SiteSettingsDialog from "./SiteSettingsDialog";

describe("SiteSettingsDialog", () => {
  beforeEach(() => {
    saveSiteSettingsMock.mockReset();
    saveSiteSettingsMock.mockResolvedValue(undefined);
  });

  it("pre-fills the fields from initialSettings when editing an existing site", () => {
    render(
      <SiteSettingsDialog
        open={true}
        onOpenChange={() => {}}
        domain="example.com"
        initialSettings={{ monthlyTraffic: 50000, averageOrderValue: 80, baselineConversionRate: 2.5 }}
        onSaved={() => {}}
      />
    );
    expect(screen.getByLabelText(/Monthly traffic/i)).toHaveValue(50000);
    expect(screen.getByLabelText(/Average order value/i)).toHaveValue(80);
    expect(screen.getByLabelText(/Baseline conversion rate/i)).toHaveValue(2.5);
  });

  it("starts blank when there are no initial settings", () => {
    render(
      <SiteSettingsDialog open={true} onOpenChange={() => {}} domain="example.com" initialSettings={null} onSaved={() => {}} />
    );
    expect(screen.getByLabelText(/Monthly traffic/i)).toHaveValue(null);
  });

  it("saves the entered values and calls onSaved with them", async () => {
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <SiteSettingsDialog open={true} onOpenChange={onOpenChange} domain="example.com" initialSettings={null} onSaved={onSaved} />
    );

    fireEvent.change(screen.getByLabelText(/Monthly traffic/i), { target: { value: "50000" } });
    fireEvent.change(screen.getByLabelText(/Average order value/i), { target: { value: "80" } });
    fireEvent.change(screen.getByLabelText(/Baseline conversion rate/i), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(saveSiteSettingsMock).toHaveBeenCalledWith("uid-1", "example.com", {
        monthlyTraffic: 50000,
        averageOrderValue: 80,
        baselineConversionRate: 2.5,
      });
    });
    expect(onSaved).toHaveBeenCalledWith({ monthlyTraffic: 50000, averageOrderValue: 80, baselineConversionRate: 2.5 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables Save until all three revenue fields have a value", () => {
    render(
      <SiteSettingsDialog open={true} onOpenChange={() => {}} domain="example.com" initialSettings={null} onSaved={() => {}} />
    );
    expect(screen.getByRole("button", { name: /Save/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Monthly traffic/i), { target: { value: "50000" } });
    expect(screen.getByRole("button", { name: /Save/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Average order value/i), { target: { value: "80" } });
    fireEvent.change(screen.getByLabelText(/Baseline conversion rate/i), { target: { value: "2.5" } });
    expect(screen.getByRole("button", { name: /Save/i })).not.toBeDisabled();
  });

  it("pre-fills the site type when present in initialSettings", () => {
    render(
      <SiteSettingsDialog
        open={true}
        onOpenChange={() => {}}
        domain="example.com"
        initialSettings={{ siteType: "saas" }}
        onSaved={() => {}}
      />
    );
    expect(screen.getByLabelText(/Site type/i)).toHaveValue("saas");
  });

  it("enables Save based on site type alone, without requiring the revenue fields", () => {
    render(
      <SiteSettingsDialog open={true} onOpenChange={() => {}} domain="example.com" initialSettings={null} onSaved={() => {}} />
    );
    expect(screen.getByRole("button", { name: /Save/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Site type/i), { target: { value: "ecommerce" } });
    expect(screen.getByRole("button", { name: /Save/i })).not.toBeDisabled();
  });

  it("saves site type alone without touching the revenue fields", async () => {
    const onSaved = vi.fn();
    render(
      <SiteSettingsDialog open={true} onOpenChange={() => {}} domain="example.com" initialSettings={null} onSaved={onSaved} />
    );
    fireEvent.change(screen.getByLabelText(/Site type/i), { target: { value: "ecommerce" } });
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(saveSiteSettingsMock).toHaveBeenCalledWith("uid-1", "example.com", { siteType: "ecommerce" });
    });
    expect(onSaved).toHaveBeenCalledWith({ siteType: "ecommerce" });
  });
});
