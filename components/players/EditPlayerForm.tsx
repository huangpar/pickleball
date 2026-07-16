"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import type { PlayerRow } from "@/lib/data/players";

export function EditPlayerForm({
  player,
  onSubmit,
  onCancel,
}: {
  player: PlayerRow;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
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
    <form onSubmit={handleSubmit} noValidate className="flex flex-wrap gap-3 items-end">
      <label className="flex flex-col text-sm gap-1">
        Name
        <input name="name" defaultValue={player.name} required className="border border-outline-variant rounded px-3 py-2" />
      </label>
      <label className="flex flex-col text-sm gap-1">
        DUPR Rating
        <input
          name="duprRating"
          type="number"
          step="0.1"
          min="1"
          max="8"
          defaultValue={player.duprRating}
          required
          className="border border-outline-variant rounded px-3 py-2 w-28"
        />
      </label>
      <Button type="submit">Save</Button>
      <Button type="button" variant="tertiary" onClick={onCancel}>
        Cancel
      </Button>
      {error && <p className="text-error text-sm w-full">{error}</p>}
    </form>
  );
}
