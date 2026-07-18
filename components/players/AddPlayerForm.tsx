"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";

export function AddPlayerForm({ onSubmit }: { onSubmit: (formData: FormData) => Promise<unknown> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      await onSubmit(formData);
      formRef.current?.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-wrap gap-3 items-end">
      <label className="flex flex-col text-sm gap-1">
        Name
        <input name="name" required className="border border-outline-variant rounded px-3 py-2" />
      </label>
      {/* <label className="flex flex-col text-sm gap-1">
        DUPR Rating
        <input
          name="duprRating"
          type="number"
          step="0.1"
          min="1"
          max="8"
          required
          className="border border-outline-variant rounded px-3 py-2 w-28"
        />
      </label> */}
      <Button type="submit">Add Player</Button>
      {error && <p className="text-error text-sm w-full">{error}</p>}
    </form>
  );
}
