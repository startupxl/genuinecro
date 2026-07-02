import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  updateProfile: vi.fn(),
  sendEmailVerification: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(() => ({})),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("@/integrations/firebase/client", () => ({ auth: {} }));

import AuthPage from "./AuthPage";

describe("AuthPage", () => {
  it("defaults to login mode when no initialMode is given", () => {
    render(<AuthPage onBack={() => {}} />);
    expect(screen.getByText("Sign in to your account.")).toBeInTheDocument();
  });

  it("starts in signup mode when initialMode is 'signup'", () => {
    render(<AuthPage onBack={() => {}} initialMode="signup" />);
    expect(screen.getByText("Create your account.")).toBeInTheDocument();
  });

  it("renders the right-side preview panel", () => {
    render(<AuthPage onBack={() => {}} />);
    expect(screen.getByTestId("auth-preview-panel")).toBeInTheDocument();
  });

  it("renders a mini chart and a floating trend card in the preview panel", () => {
    render(<AuthPage onBack={() => {}} />);
    expect(screen.getByTestId("auth-preview-chart")).toBeInTheDocument();
    expect(screen.getByText("+8 pts")).toBeInTheDocument();
  });
});
