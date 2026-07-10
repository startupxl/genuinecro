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
const addGA4PropertyMock = vi.fn();
const removeGA4PropertyMock = vi.fn();
const disconnectGA4Mock = vi.fn();

vi.mock("@/lib/api/ga4", () => ({
  getGA4Status: (...args: unknown[]) => getGA4StatusMock(...args),
  getGA4AuthorizeUrl: (...args: unknown[]) => getGA4AuthorizeUrlMock(...args),
  getGA4Properties: (...args: unknown[]) => getGA4PropertiesMock(...args),
  addGA4Property: (...args: unknown[]) => addGA4PropertyMock(...args),
  removeGA4Property: (...args: unknown[]) => removeGA4PropertyMock(...args),
  disconnectGA4: (...args: unknown[]) => disconnectGA4Mock(...args),
}));

import Settings from "./Settings";

describe("Settings", () => {
  beforeEach(() => {
    localStorage.clear();
    subscribeToKitMock.mockReset().mockResolvedValue(true);
    mockPlan = "Pro";
    getGA4StatusMock.mockReset().mockResolvedValue({ connected: false, properties: [] });
    getGA4AuthorizeUrlMock.mockReset().mockResolvedValue("https://accounts.google.com/mock-consent");
    getGA4PropertiesMock.mockReset().mockResolvedValue([]);
    addGA4PropertyMock.mockReset().mockResolvedValue(undefined);
    removeGA4PropertyMock.mockReset().mockResolvedValue(undefined);
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

    it("shows every mapped site's domain and property name once connected", async () => {
      getGA4StatusMock.mockResolvedValue({
        connected: true,
        properties: [
          { domain: "example.com", propertyId: "123", propertyDisplayName: "Acme Website" },
          { domain: "client.com", propertyId: "456", propertyDisplayName: "Client Website" },
        ],
      });

      render(
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      );

      await waitFor(() => expect(screen.getByText("example.com")).toBeInTheDocument());
      expect(screen.getByText("Acme Website")).toBeInTheDocument();
      expect(screen.getByText("client.com")).toBeInTheDocument();
      expect(screen.getByText("Client Website")).toBeInTheDocument();
    });

    it("adds a new site mapping using a domain and a property picked from the connected Google account", async () => {
      getGA4StatusMock.mockResolvedValue({ connected: true, properties: [] });
      getGA4PropertiesMock.mockResolvedValue([
        { propertyId: "123", displayName: "Acme Website", accountName: "Acme Inc" },
        { propertyId: "456", displayName: "Client Website", accountName: "Client Inc" },
      ]);

      render(
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      );

      await waitFor(() => screen.getByPlaceholderText("example.com"));
      fireEvent.change(screen.getByPlaceholderText("example.com"), { target: { value: "client.com" } });
      fireEvent.change(screen.getByLabelText("GA4 property"), { target: { value: "456" } });
      fireEvent.click(screen.getByRole("button", { name: "Add site" }));

      await waitFor(() =>
        expect(addGA4PropertyMock).toHaveBeenCalledWith(mockUser, "client.com", "456", "Client Website")
      );
    });

    it("removes a site mapping when Remove is clicked", async () => {
      getGA4StatusMock.mockResolvedValue({
        connected: true,
        properties: [{ domain: "example.com", propertyId: "123", propertyDisplayName: "Acme Website" }],
      });

      render(
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      );

      await waitFor(() => screen.getByRole("button", { name: /Remove/i }));
      fireEvent.click(screen.getByRole("button", { name: /Remove/i }));

      await waitFor(() => expect(removeGA4PropertyMock).toHaveBeenCalledWith(mockUser, "example.com"));
      await waitFor(() => expect(screen.queryByText("example.com")).not.toBeInTheDocument());
    });

    it("disconnects the whole Google account and returns to the Connect state", async () => {
      getGA4StatusMock.mockResolvedValue({
        connected: true,
        properties: [{ domain: "example.com", propertyId: "123", propertyDisplayName: "Acme Website" }],
      });

      render(
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      );

      await waitFor(() => screen.getByRole("button", { name: /Disconnect Google account/i }));
      fireEvent.click(screen.getByRole("button", { name: /Disconnect Google account/i }));

      await waitFor(() => expect(disconnectGA4Mock).toHaveBeenCalledWith(mockUser));
      await waitFor(() => expect(screen.getByRole("button", { name: "Connect Google Analytics" })).toBeInTheDocument());
    });
  });
});
