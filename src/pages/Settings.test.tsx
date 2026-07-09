import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const subscribeToKitMock = vi.fn();
const getIdTokenMock = vi.fn().mockResolvedValue("id-token-abc");
const mockUser = { uid: "uid-1", email: "person@example.com", getIdToken: getIdTokenMock };

vi.mock("@/lib/api/kit", () => ({
  subscribeToKit: (...args: unknown[]) => subscribeToKitMock(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

let mockPlan = "Free";
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: mockPlan, subscription: null }),
}));

const getGA4StatusMock = vi.fn();
const getGA4AuthorizeUrlMock = vi.fn();
const getGA4PropertiesMock = vi.fn();
const selectGA4PropertyMock = vi.fn();
const disconnectGA4Mock = vi.fn();

vi.mock("@/lib/api/ga4", () => ({
  getGA4Status: (...args: unknown[]) => getGA4StatusMock(...args),
  getGA4AuthorizeUrl: (...args: unknown[]) => getGA4AuthorizeUrlMock(...args),
  getGA4Properties: (...args: unknown[]) => getGA4PropertiesMock(...args),
  selectGA4Property: (...args: unknown[]) => selectGA4PropertyMock(...args),
  disconnectGA4: (...args: unknown[]) => disconnectGA4Mock(...args),
}));

import Settings from "./Settings";

describe("Settings", () => {
  beforeEach(() => {
    localStorage.clear();
    subscribeToKitMock.mockReset().mockResolvedValue(true);
    mockPlan = "Pro";
    getGA4StatusMock.mockReset().mockResolvedValue({
      connected: false,
      pendingPropertySelection: false,
      propertyId: null,
      propertyDisplayName: null,
    });
    getGA4AuthorizeUrlMock.mockReset().mockResolvedValue("https://accounts.google.com/mock-consent");
    getGA4PropertiesMock.mockReset().mockResolvedValue([]);
    selectGA4PropertyMock.mockReset().mockResolvedValue(undefined);
    disconnectGA4Mock.mockReset().mockResolvedValue(undefined);
  });

  it("subscribes to Kit when Weekly Digest is turned on and saved", async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("switch", { name: "Weekly Digest" }));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(subscribeToKitMock).toHaveBeenCalledWith("person@example.com");
    });
  });

  it("does not call Kit when saving with both digest toggles off", async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("switch", { name: "Auto-detect Page Type" }));
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.queryByText("Save")).not.toBeInTheDocument();
    });
    expect(subscribeToKitMock).not.toHaveBeenCalled();
  });

  describe("Google Analytics 4 integration", () => {
    it("shows an upgrade prompt instead of a Connect button on the free plan", async () => {
      mockPlan = "Free";
      render(
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      );

      await waitFor(() => expect(screen.getByText(/upgrade to pro/i)).toBeInTheDocument());
      expect(screen.queryByRole("button", { name: "Connect Google Analytics" })).not.toBeInTheDocument();
    });

    it("shows a Connect Google Analytics button when not connected on a paid plan", async () => {
      render(
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      );

      await waitFor(() => expect(getGA4StatusMock).toHaveBeenCalledWith(mockUser));
      expect(screen.getByRole("button", { name: "Connect Google Analytics" })).toBeInTheDocument();
    });

    it("fetches an authorize URL and redirects to it when Connect is clicked", async () => {
      const originalLocation = window.location;
      // @ts-expect-error - test-only stub of window.location.href
      delete window.location;
      window.location = { ...originalLocation, href: "" } as Location;

      render(
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      );

      await waitFor(() => screen.getByRole("button", { name: "Connect Google Analytics" }));
      fireEvent.click(screen.getByRole("button", { name: "Connect Google Analytics" }));

      await waitFor(() => expect(getGA4AuthorizeUrlMock).toHaveBeenCalledWith(mockUser));
      await waitFor(() => expect(window.location.href).toBe("https://accounts.google.com/mock-consent"));

      window.location = originalLocation;
    });

    it("shows the connected property and a Disconnect button once connected", async () => {
      getGA4StatusMock.mockResolvedValue({
        connected: true,
        pendingPropertySelection: false,
        propertyId: "123",
        propertyDisplayName: "Acme Website",
      });

      render(
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      );

      await waitFor(() => expect(screen.getByText("Acme Website")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    });

    it("disconnects and returns to the Connect state when Disconnect is clicked", async () => {
      getGA4StatusMock.mockResolvedValue({
        connected: true,
        pendingPropertySelection: false,
        propertyId: "123",
        propertyDisplayName: "Acme Website",
      });

      render(
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      );

      await waitFor(() => screen.getByRole("button", { name: "Disconnect" }));
      fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

      await waitFor(() => expect(disconnectGA4Mock).toHaveBeenCalledWith(mockUser));
      await waitFor(() => expect(screen.getByRole("button", { name: "Connect Google Analytics" })).toBeInTheDocument());
    });

    it("shows a property picker when redirected back needing a property choice", async () => {
      getGA4StatusMock.mockResolvedValue({
        connected: false,
        pendingPropertySelection: true,
        propertyId: null,
        propertyDisplayName: null,
      });
      getGA4PropertiesMock.mockResolvedValue([
        { propertyId: "1", displayName: "Site A", accountName: "Acme" },
        { propertyId: "2", displayName: "Site B", accountName: "Acme" },
      ]);

      render(
        <MemoryRouter initialEntries={["/settings?ga4=choose-property"]}>
          <Settings />
        </MemoryRouter>
      );

      await waitFor(() => expect(screen.getByText("Site A")).toBeInTheDocument());
      expect(screen.getByText("Site B")).toBeInTheDocument();
    });

    it("selects a property from the picker", async () => {
      getGA4StatusMock.mockResolvedValue({
        connected: false,
        pendingPropertySelection: true,
        propertyId: null,
        propertyDisplayName: null,
      });
      getGA4PropertiesMock.mockResolvedValue([{ propertyId: "1", displayName: "Site A", accountName: "Acme" }]);

      render(
        <MemoryRouter initialEntries={["/settings?ga4=choose-property"]}>
          <Settings />
        </MemoryRouter>
      );

      await waitFor(() => screen.getByText("Site A"));
      fireEvent.click(screen.getByRole("button", { name: "Use this property" }));

      await waitFor(() => expect(selectGA4PropertyMock).toHaveBeenCalledWith(mockUser, "1", "Site A"));
    });
  });
});
