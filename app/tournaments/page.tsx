import Link from "next/link";
import { getAllTournaments } from "@/lib/data/tournaments";
import { deleteTournament } from "@/lib/actions/tournaments";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { DeleteTournamentButton } from "@/components/tournaments/DeleteTournamentButton";

export default async function TournamentsPage() {
  const allTournaments = await getAllTournaments();

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-headline text-3xl font-bold">Tournaments</h1>
        <Button href="/tournaments/new">Create Tournament</Button>
      </div>

      <Card className="p-0 divide-y divide-surface-container-high">
        {allTournaments.length === 0 && <p className="p-6 text-on-surface-variant">No tournaments yet.</p>}
        {allTournaments.map((t) => (
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
            <DeleteTournamentButton tournamentName={t.name} onDelete={deleteTournament.bind(null, t.id)} />
          </div>
        ))}
      </Card>
    </main>
  );
}
