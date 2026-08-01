"use client";

import Link from "next/link";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { DeleteTournamentButton } from "@/components/tournaments/DeleteTournamentButton";
import { deleteTournament } from "@/lib/actions/tournaments";
import type { TournamentSummary } from "@/lib/data/tournaments";

export function TournamentsListClient({
  tournaments,
}: {
  tournaments: TournamentSummary[];
}) {
  return (
    <Card className="p-0 divide-y divide-surface-container-high">
      {tournaments.length === 0 && <p className="p-6 text-on-surface-variant">No tournaments yet.</p>}
      {tournaments.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-4 p-4 hover:bg-surface-container-low">
          <Link href={`/tournaments/${t.id}`} className="flex flex-1 items-center justify-between gap-4">
            <div>
              <p className="font-body font-medium">{t.name}</p>
              <p className="font-mono text-xs text-on-surface-variant uppercase">
                {t.matchFormat} &middot; {t.participantCount} participants
              </p>
            </div>
            <Badge>{t.status.replace("_", " ")}</Badge>
          </Link>
          <div className="flex items-center gap-2">
            {t.status === "setup" && (
              <Link
                href={`/tournaments/${t.id}`}
                className="p-2 text-on-surface-variant hover:text-on-surface"
                title="Edit tournament"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </Link>
            )}
            <DeleteTournamentButton tournamentName={t.name} onDelete={deleteTournament.bind(null, t.id)} />
          </div>
        </div>
      ))}
    </Card>
  );
}
