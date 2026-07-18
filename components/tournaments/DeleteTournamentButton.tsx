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
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm(`Delete "${tournamentName}"? This permanently removes it and all of its matches.`)) {
      return;
    }
    setError(null);
    setIsDeleting(true);
    try {
      await onDelete();
      if (redirectTo) router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsDeleting(false);
    }
  }

  return (
    <div>
      <Button variant="tertiary" onClick={handleClick} disabled={isDeleting} className="text-error">
        {isDeleting ? "Deleting..." : "Delete"}
      </Button>
      {error && <p className="text-error text-sm mt-1">{error}</p>}
    </div>
  );
}
