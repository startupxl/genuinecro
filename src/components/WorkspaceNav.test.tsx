import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const signOutMock = vi.fn();
let mockUser: { uid: string; email: string; displayName: string | null } | null = null;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, signOut: signOutMock, loading: false }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Growth", subscription: null }),
}));

import WorkspaceNav from "./WorkspaceNav";

describe("WorkspaceNav", () => {
  beforeEach(() => {
    mockUser = null;
    signOutMock.mockReset();
  });

  it("renders all nine sections with Dashboard, Technical, Conversion, Action Center, and Bulk marked real", () => {
    mockUser = { uid: "uid-1", email: "user@example.com", displayName: "Jane" };
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );

    ["Dashboard", "Technical", "Content", "Conversion", "Monitoring", "Analysis", "Action Center", "Reports", "Bulk"].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("highlights the active section based on the current route", () => {
    mockUser = { uid: "uid-1", email: "user@example.com", displayName: "Jane" };
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );

    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink).toHaveClass("bg-secondary");
  });

  it("shows a profile row with the user's name and plan when signed in", () => {
    mockUser = { uid: "uid-1", email: "user@example.com", displayName: "Jane" };
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );

    expect(screen.getByText("Jane")).toBeInTheDocument();
    expect(screen.getByText("Growth plan")).toBeInTheDocument();
  });

  it("shows a Sign in button instead of a profile row when signed out", () => {
    mockUser = null;
    const onSignIn = vi.fn();
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav onSignIn={onSignIn} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Jane")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Sign in"));
    expect(onSignIn).toHaveBeenCalled();
  });

  it("is off-screen by default on mobile and slides in when isOpen is true", () => {
    const { container, rerender } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );
    expect(container.querySelector("nav")).toHaveClass("-translate-x-full");

    rerender(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav isOpen />
      </MemoryRouter>
    );
    expect(container.querySelector("nav")).toHaveClass("translate-x-0");
  });

  it("calls onNavigate when a nav link is clicked, so mobile callers can close the drawer", () => {
    const onNavigate = vi.fn();
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav onNavigate={onNavigate} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Technical"));
    expect(onNavigate).toHaveBeenCalled();
  });

  it("calls onNavigate in addition to onSignIn when Sign in is clicked", () => {
    mockUser = null;
    const onNavigate = vi.fn();
    const onSignIn = vi.fn();
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav onNavigate={onNavigate} onSignIn={onSignIn} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Sign in"));
    expect(onNavigate).toHaveBeenCalled();
    expect(onSignIn).toHaveBeenCalled();
  });
});
