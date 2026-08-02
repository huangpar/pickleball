"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";

export function DeleteTournamentButton({
  tournamentName,
  onDelete,
  redirectTo,
}: {
  tournamentName: string;
  onDelete: () => Promise<{ error?: string }>;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAskClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setError(null);
    setIsConfirming(true);
  }

  function handleCancelClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setIsConfirming(false);
  }

  async function handleConfirmClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setError(null);
    setIsDeleting(true);
    try {
      const result = await onDelete();
      if (result?.error) {
        setError(result.error);
        setIsDeleting(false);
        setIsConfirming(false);
        return;
      }
      if (redirectTo) router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsDeleting(false);
      setIsConfirming(false);
    }
  }

  if (isConfirming) {
    return (
      <div className="flex flex-col items-end gap-1 max-w-[9rem]">
        <span className="text-sm text-on-surface-variant text-right">Delete &quot;{tournamentName}&quot;?</span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="tertiary" onClick={handleConfirmClick} disabled={isDeleting} className="text-error">
            {isDeleting ? "Deleting..." : "Confirm"}
          </Button>
          <Button variant="tertiary" onClick={handleCancelClick} disabled={isDeleting}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Button
        variant="tertiary"
        onClick={handleAskClick}
        className="text-error px-2"
        aria-label={`Delete ${tournamentName}`}
        title="Delete tournament"
      >
        &times;
      </Button>
      {error && <p className="text-error text-sm mt-1">{error}</p>}
    </div>
  );
}
