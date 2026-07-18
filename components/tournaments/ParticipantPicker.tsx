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
        {filtered.map((player) => {
          const isSelected = selectedIds.includes(player.id);
          return (
            <label
              key={player.id}
              className={`flex items-center justify-between border rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                isSelected
                  ? "bg-secondary-container border-secondary-container text-on-secondary-container font-medium"
                  : "bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={isSelected}
                onChange={() => onToggle(player.id)}
                aria-label={player.name}
              />
              <span className="font-body">
                {player.name}
              </span>
              <span className={`font-mono text-xs ${isSelected ? "text-on-secondary-container/70" : "text-on-surface-variant"}`}>
                {player.duprRating}
              </span>
            </label>
          );
        })}
      </div>
      <div>
        <h3 className="font-headline text-sm font-semibold mb-2">Add a new player</h3>
        <AddPlayerForm onSubmit={handleCreate} />
      </div>
    </div>
  );
}
