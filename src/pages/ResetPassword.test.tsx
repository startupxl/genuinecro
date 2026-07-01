import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const confirmPasswordResetMock = vi.fn();

vi.mock("firebase/auth", () => ({
  confirmPasswordReset: (...args: unknown[]) => confirmPasswordResetMock(...args),
}));

vi.mock("@/integrations/firebase/client", () => ({ auth: {} }));

import ResetPassword from "./ResetPassword";

function renderWithCode(code: string | null) {
  const path = code ? `/reset-password?oobCode=${code}` : "/reset-password";
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ResetPassword", () => {
  beforeEach(() => {
    confirmPasswordResetMock.mockReset();
  });

  it("confirms the password reset using the oobCode from the URL", async () => {
    confirmPasswordResetMock.mockResolvedValue(undefined);
    renderWithCode("test-code-123");

    fireEvent.change(screen.getByPlaceholderText("New password"), {
      target: { value: "newpassword123" },
    });
    fireEvent.click(screen.getByText("Update Password"));

    await waitFor(() => {
      expect(confirmPasswordResetMock).toHaveBeenCalledWith({}, "test-code-123", "newpassword123");
    });
  });

  it("shows an error and does not call confirmPasswordReset when oobCode is missing", async () => {
    renderWithCode(null);

    fireEvent.change(screen.getByPlaceholderText("New password"), {
      target: { value: "newpassword123" },
    });
    fireEvent.click(screen.getByText("Update Password"));

    await waitFor(() => {
      expect(confirmPasswordResetMock).not.toHaveBeenCalled();
    });
  });
});
