import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddPlayerForm } from "./AddPlayerForm";

describe("AddPlayerForm", () => {
  it("calls onSubmit with the entered name, then clears the form", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AddPlayerForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alex Sterling" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Player" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const formData = onSubmit.mock.calls[0][0] as FormData;
    expect(formData.get("name")).toBe("Alex Sterling");
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue(""));
  });

  it("shows an error message if onSubmit rejects", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Name is required"));
    render(<AddPlayerForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Add Player" }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
  });
});
