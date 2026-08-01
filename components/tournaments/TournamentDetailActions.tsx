"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";
import { StartTournamentButton } from "@/components/tournaments/StartTournamentButton";
import { EndTournamentButton } from "@/components/tournaments/EndTournamentButton";
import { DeleteTournamentButton } from "@/components/tournaments/DeleteTournamentButton";
import { EditTournamentModal } from "@/components/tournaments/EditTournamentModal";
import { Button } from "@/components/Button";
import { startTournament, deleteTournament } from "@/lib/actions/tournaments";
import { endTournament } from "@/lib/actions/matches";
import { createPlayer } from "@/lib/actions/players";
import type { TournamentDetail } from "@/lib/data/tournamentDetail";
import type { PlayerRow } from "@/lib/data/players";

export function TournamentDetailActions({
  tournament,
  availablePlayers,
  isSetup,
  isCompleted,
}: {
  tournament: TournamentDetail;
  availablePlayers: PlayerRow[];
  isSetup: boolean;
  isCompleted: boolean;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-3">
        <Badge>{tournament.status.replace("_", " ")}</Badge>
        {isSetup && (
          <Button variant="secondary" onClick={() => setIsEditOpen(true)}>
            Edit
          </Button>
        )}
        {isSetup && <StartTournamentButton onStart={startTournament.bind(null, tournament.id)} />}
        {!isCompleted && !isSetup && <EndTournamentButton onEnd={endTournament.bind(null, tournament.id)} />}
        <DeleteTournamentButton
          tournamentName={tournament.name}
          onDelete={deleteTournament.bind(null, tournament.id)}
          redirectTo="/tournaments"
        />
      </div>
      <EditTournamentModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        tournamentId={tournament.id}
        currentParticipantIds={tournament.participants.map((p) => p.id)}
        currentRounds={tournament.numRounds || 4}
        availablePlayers={availablePlayers}
        onCreatePlayer={createPlayer}
        matchFormat={tournament.matchFormat as "singles" | "doubles"}
      />
    </>
  );
}
