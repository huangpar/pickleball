import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditPlayerForm } from "./EditPlayerForm";

describe("EditPlayerForm", () => {
  const player = { id: "p1", name: "Alex Sterling" };

  it("pre-fills the current name, and calls onSubmit with edits", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<EditPlayerForm player={player} onSubmit={onSubmit} onCancel={vi.fn()} />);

    expect(screen.getByLabelText("Name")).toHaveValue("Alex Sterling");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alex Sterling New" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const formData = onSubmit.mock.calls[0][0] as FormData;
    expect(formData.get("name")).toBe("Alex Sterling New");
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(<EditPlayerForm player={player} onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
