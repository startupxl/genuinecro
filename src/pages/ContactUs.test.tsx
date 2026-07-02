import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Free", subscription: null }),
}));

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

import ContactUs from "./ContactUs";

function fillForm() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Jane Doe" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jane@example.com" } });
  fireEvent.click(screen.getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name: "General Inquiry" }));
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Something is broken." } });
}

describe("ContactUs", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("submits the message to Formspree and shows a success toast", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    render(
      <MemoryRouter>
        <ContactUs />
      </MemoryRouter>
    );

    fillForm();
    fireEvent.click(screen.getByText("Send Message"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://formspree.io/f/mgojpydr",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "Content-Type": "application/json", Accept: "application/json" }),
          body: JSON.stringify({ name: "Jane Doe", email: "jane@example.com", subject: "general", message: "Something is broken." }),
        })
      );
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Message sent! We'll get back to you within 24–48 hours.");
  });

  it("shows an error toast when the Formspree request fails", async () => {
    fetchMock.mockResolvedValue({ ok: false });

    render(
      <MemoryRouter>
        <ContactUs />
      </MemoryRouter>
    );

    fillForm();
    fireEvent.click(screen.getByText("Send Message"));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Couldn't send your message. Please try again or email us directly.");
    });
  });
});
