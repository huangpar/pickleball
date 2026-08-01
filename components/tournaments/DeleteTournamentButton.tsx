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
  onDelete: () => Promise<void>;
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
      await onDelete();
      if (redirectTo) router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsDeleting(false);
      setIsConfirming(false);
    }
  }

  if (isConfirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-on-surface-variant">Delete &quot;{tournamentName}&quot;?</span>
        <Button variant="tertiary" onClick={handleConfirmClick} disabled={isDeleting} className="text-error">
          {isDeleting ? "Deleting..." : "Confirm"}
        </Button>
        <Button variant="tertiary" onClick={handleCancelClick} disabled={isDeleting}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Button variant="tertiary" onClick={handleAskClick} className="text-error">
        Delete
      </Button>
      {error && <p className="text-error text-sm mt-1">{error}</p>}
    </div>
  );
}
