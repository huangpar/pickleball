"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { editTournament } from "@/lib/actions/tournaments";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ParticipantPicker } from "./ParticipantPicker";
import type { PlayerRow } from "@/lib/data/players";

export function EditTournamentModal({
  isOpen,
  onClose,
  tournamentId,
  currentParticipantIds,
  currentRounds,
  availablePlayers,
  onCreatePlayer,
  matchFormat,
}: {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  currentParticipantIds: string[];
  currentRounds: number;
  availablePlayers: PlayerRow[];
  onCreatePlayer: (formData: FormData) => Promise<PlayerRow>;
  matchFormat: "singles" | "doubles";
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>(currentParticipantIds);
  const [numRounds, setNumRounds] = useState<number | "">(currentRounds);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setIsSubmitting(true);

    try {
      const rounds = numRounds === "" ? currentRounds : numRounds;
      await editTournament(tournamentId, selectedIds, rounds);
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl space-y-4">
          <h2 className="font-headline text-lg font-semibold">Edit Tournament</h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-headline text-sm font-semibold mb-2">Participants</h3>
              <ParticipantPicker
                availablePlayers={availablePlayers}
                selectedIds={selectedIds}
                onToggle={(id) =>
                  setSelectedIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
                }
                onPlayerAdded={(player) => {
                  availablePlayers.push(player);
                  setSelectedIds((prev) => [...prev, player.id]);
                }}
                onCreatePlayer={onCreatePlayer}
              />
            </div>

            {matchFormat === "doubles" && (
              <div>
                <label className="flex flex-col text-sm gap-1">
                  Number of Rounds
                  <input
                    type="number"
                    min={1}
                    value={numRounds}
                    onChange={(e) => setNumRounds(e.target.value === "" ? "" : Number(e.target.value))}
                    className="border border-outline-variant rounded px-3 py-2"
                  />
                </label>
              </div>
            )}

            {error && <p className="text-error text-sm">{error}</p>}
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
