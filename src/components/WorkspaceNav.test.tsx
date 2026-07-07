import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const signOutMock = vi.fn();
let mockUser: { uid: string; email: string; displayName: string | null } | null = null;
let mockProfile: { displayName: string | null } | null = null;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, profile: mockProfile, signOut: signOutMock, loading: false }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Growth", subscription: null }),
}));

import WorkspaceNav from "./WorkspaceNav";

describe("WorkspaceNav", () => {
  beforeEach(() => {
    mockUser = null;
    mockProfile = null;
    signOutMock.mockReset();
  });

  it("renders all eight sections with Dashboard, Audits, Action Center, Message Match, Competitor Comparison, and Experiment Workbench marked real", () => {
    mockUser = { uid: "uid-1", email: "user@example.com", displayName: null };
    mockProfile = { displayName: "Jane" };
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );

    ["Dashboard", "Audits", "Action Center", "Monitoring", "Reports", "Message Match", "Competitor Comparison", "Experiment Workbench"].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    ["Technical", "Content", "Conversion", "Analysis"].forEach((label) => {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    });
  });

  it("highlights the active section based on the current route", () => {
    mockUser = { uid: "uid-1", email: "user@example.com", displayName: null };
    mockProfile = { displayName: "Jane" };
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );

    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink).toHaveClass("bg-secondary");
  });

  it("shows a profile row with the account's name (from the Firestore profile) and plan when signed in", () => {
    mockUser = { uid: "uid-1", email: "user@example.com", displayName: null };
    mockProfile = { displayName: "Jane" };
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );

    expect(screen.getByText("Jane")).toBeInTheDocument();
    expect(screen.getByText("Growth plan")).toBeInTheDocument();
  });

  it("falls back to the email only while the profile name hasn't been set yet, ignoring any stale Firebase Auth displayName", () => {
    mockUser = { uid: "uid-1", email: "user@example.com", displayName: "Stale Auth Name" };
    mockProfile = { displayName: null };
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );

    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(screen.queryByText("Stale Auth Name")).not.toBeInTheDocument();
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

  it("positions the profile row after the nav sections (right after Experiment Workbench), in its own bordered section", () => {
    mockUser = { uid: "uid-1", email: "user@example.com", displayName: null };
    mockProfile = { displayName: "Jane" };
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );

    const profileEl = screen.getByText("Jane");
    const lastNavEl = screen.getByText("Experiment Workbench");
    // eslint-disable-next-line no-bitwise
    expect(lastNavEl.compareDocumentPosition(profileEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const profileButton = profileEl.closest("button");
    expect(profileButton).toHaveClass("border-t");
  });

  it("constrains the profile button to the sidebar's width so a long email truncates instead of overflowing", () => {
    mockUser = { uid: "uid-1", email: "experiments@genuinecro.com", displayName: null };
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );

    const profileButton = screen.getByText("experiments@genuinecro.com").closest("button");
    expect(profileButton).toHaveClass("w-full");
  });

  it("positions the Sign in button after the nav sections (right after Experiment Workbench) when signed out", () => {
    mockUser = null;
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav onSignIn={vi.fn()} />
      </MemoryRouter>
    );

    const signInEl = screen.getByText("Sign in");
    const lastNavEl = screen.getByText("Experiment Workbench");
    // eslint-disable-next-line no-bitwise
    expect(lastNavEl.compareDocumentPosition(signInEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

    fireEvent.click(screen.getByText("Audits"));
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

  it("renders a desktop collapse toggle when onToggleCollapse is provided, and calls it on click", () => {
    const onToggleCollapse = vi.fn();
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav onToggleCollapse={onToggleCollapse} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(onToggleCollapse).toHaveBeenCalled();
  });

  it("does not render a desktop collapse toggle when onToggleCollapse is absent", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).not.toBeInTheDocument();
  });

  it("adds md:hidden to the nav element when isCollapsed is true", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <WorkspaceNav isCollapsed onToggleCollapse={vi.fn()} />
      </MemoryRouter>
    );

    expect(container.querySelector("nav")).toHaveClass("md:hidden");
  });
});
