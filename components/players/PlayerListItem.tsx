"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { EditPlayerForm } from "./EditPlayerForm";
import type { PlayerRow } from "@/lib/data/players";

export function PlayerListItem({
  player,
  onUpdate,
}: {
  player: PlayerRow;
  onUpdate: (formData: FormData) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <div className="p-4">
        <EditPlayerForm
          player={player}
          onSubmit={async (formData) => {
            await onUpdate(formData);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4">
      <Link href={`/players/${player.id}`} className="flex items-center gap-3">
        <Avatar name={player.name} size="sm" />
        <span className="font-body font-medium">{player.name}</span>
      </Link>
      <Button variant="tertiary" onClick={() => setIsEditing(true)}>
        Edit
      </Button>
    </div>
  );
}
