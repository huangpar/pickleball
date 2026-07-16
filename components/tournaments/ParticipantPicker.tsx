"use client";

import { useState } from "react";
import { AddPlayerForm } from "@/components/players/AddPlayerForm";
import type { PlayerRow } from "@/lib/data/players";

export function ParticipantPicker({
  availablePlayers,
  selectedIds,
  onToggle,
  onPlayerAdded,
  onCreatePlayer,
}: {
  availablePlayers: PlayerRow[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onPlayerAdded: (player: PlayerRow) => void;
  onCreatePlayer: (formData: FormData) => Promise<PlayerRow>;
}) {
  const [filter, setFilter] = useState("");
  const filtered = availablePlayers.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));

  async function handleCreate(formData: FormData) {
    const player = await onCreatePlayer(formData);
    onPlayerAdded(player);
    onToggle(player.id);
  }

  return (
    <div className="space-y-4">
      <input
        placeholder="Filter by name..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="border border-outline-variant rounded px-3 py-2 w-full"
      />
      <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
        {filtered.map((player) => (
          <label key={player.id} className="flex items-center gap-2 border border-outline-variant rounded px-3 py-2">
            <input
              type="checkbox"
              checked={selectedIds.includes(player.id)}
              onChange={() => onToggle(player.id)}
              aria-label={player.name}
            />
            <span>
              {player.name} <span className="font-mono text-xs text-on-surface-variant">{player.duprRating}</span>
            </span>
          </label>
        ))}
      </div>
      <div>
        <h3 className="font-headline text-sm font-semibold mb-2">Add a new player</h3>
        <AddPlayerForm onSubmit={handleCreate} />
      </div>
    </div>
  );
}
