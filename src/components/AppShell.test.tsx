import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

let mockUser: { uid: string; email: string; displayName: string | null } | null = null;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, signOut: vi.fn(), loading: false }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Free", subscription: null }),
}));

import AppShell from "./AppShell";

describe("AppShell", () => {
  beforeEach(() => {
    mockUser = null;
    localStorage.clear();
  });

  it("shows a mobile menu toggle button", () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div>Page content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
  });

  it("opens the nav drawer and shows a backdrop when the toggle is clicked", () => {
    const { container } = render(
      <MemoryRouter>
        <AppShell>
          <div>Page content</div>
        </AppShell>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    expect(container.querySelector("nav")).toHaveClass("translate-x-0");
    expect(screen.getByRole("button", { name: "Close menu" })).toBeInTheDocument();
    expect(container.querySelector('[data-testid="mobile-nav-backdrop"]')).toBeInTheDocument();
  });

  it("closes the drawer when the backdrop is clicked", () => {
    const { container } = render(
      <MemoryRouter>
        <AppShell>
          <div>Page content</div>
        </AppShell>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(container.querySelector('[data-testid="mobile-nav-backdrop"]')!);

    expect(container.querySelector("nav")).toHaveClass("-translate-x-full");
  });

  it("closes the drawer when a nav link is clicked", () => {
    const { container } = render(
      <MemoryRouter>
        <AppShell>
          <div>Page content</div>
        </AppShell>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByText("Audits"));

    expect(container.querySelector("nav")).toHaveClass("-translate-x-full");
  });

  it("collapses the sidebar and shows a desktop expand button when the collapse toggle is clicked", () => {
    const { container } = render(
      <MemoryRouter>
        <AppShell>
          <div>Page content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Expand sidebar" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(container.querySelector("nav")).toHaveClass("md:hidden");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });

  it("expands the sidebar again when the expand button is clicked", () => {
    const { container } = render(
      <MemoryRouter>
        <AppShell>
          <div>Page content</div>
        </AppShell>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));

    expect(container.querySelector("nav")).not.toHaveClass("md:hidden");
    expect(screen.queryByRole("button", { name: "Expand sidebar" })).not.toBeInTheDocument();
  });

  it("persists the collapsed preference to localStorage and restores it on the next mount", () => {
    const { unmount } = render(
      <MemoryRouter>
        <AppShell>
          <div>Page content</div>
        </AppShell>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    unmount();

    render(
      <MemoryRouter>
        <AppShell>
          <div>Page content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });
});
