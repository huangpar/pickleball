"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";

export function MatchScoreForm({
  side1Score,
  side2Score,
  onSubmit,
}: {
  side1Score: number | null;
  side2Score: number | null;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        name="side1Score"
        type="number"
        min={0}
        defaultValue={side1Score ?? ""}
        aria-label="Side 1 score"
        className="border border-outline-variant rounded px-2 py-1 w-16"
      />
      <span>-</span>
      <input
        name="side2Score"
        type="number"
        min={0}
        defaultValue={side2Score ?? ""}
        aria-label="Side 2 score"
        className="border border-outline-variant rounded px-2 py-1 w-16"
      />
      <Button type="submit" variant="secondary">
        Save
      </Button>
      {error && <p className="text-error text-sm">{error}</p>}
    </form>
  );
}
