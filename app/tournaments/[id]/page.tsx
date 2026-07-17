import { notFound } from "next/navigation";
import { getTournamentDetail, getTournamentStandings, type MatchDetail } from "@/lib/data/tournamentDetail";
import { recordScore, endTournament } from "@/lib/actions/matches";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { MatchScoreForm } from "@/components/tournaments/MatchScoreForm";
import { EndTournamentButton } from "@/components/tournaments/EndTournamentButton";
import { TournamentStandingsTable } from "@/components/tournaments/TournamentStandingsTable";

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tournament, standings] = await Promise.all([getTournamentDetail(id), getTournamentStandings(id)]);
  if (!tournament) notFound();

  const rounds = new Map<number, MatchDetail[]>();
  for (const match of tournament.matches) {
    const list = rounds.get(match.roundNumber) ?? [];
    list.push(match);
    rounds.set(match.roundNumber, list);
  }

  const byesByRound = new Map(tournament.byes.map((b) => [b.roundNumber, b.playerNames]));
  const isCompleted = tournament.status === "completed";

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold">{tournament.name}</h1>
        <div className="flex items-center gap-3">
          <Badge>{tournament.status.replace("_", " ")}</Badge>
          {!isCompleted && <EndTournamentButton onEnd={endTournament.bind(null, tournament.id)} />}
        </div>
      </div>

      {[...rounds.entries()].map(([roundNumber, roundMatches]) => (
        <Card key={roundNumber} className="p-0 divide-y divide-surface-container-high">
          <h2 className="font-headline text-lg font-semibold p-4">Round {roundNumber}</h2>
          {roundMatches.map((match) => (
            <div key={match.id} className="p-4">
              <p className="font-mono text-xs text-on-surface-variant uppercase mb-2">Court {match.courtNumber}</p>
              <MatchScoreForm
                side1PlayerNames={match.side1PlayerNames}
                side2PlayerNames={match.side2PlayerNames}
                side1Score={match.side1Score}
                side2Score={match.side2Score}
                disabled={isCompleted}
                onSubmit={recordScore.bind(null, match.id)}
              />
            </div>
          ))}
          {byesByRound.has(roundNumber) && (
            <p className="p-4 font-body text-sm text-on-surface-variant">
              Bye: {byesByRound.get(roundNumber)!.join(", ")}
            </p>
          )}
        </Card>
      ))}

      <div>
        <h2 className="font-headline text-lg font-semibold mb-4">Tournament Standings</h2>
        <TournamentStandingsTable standings={standings} />
      </div>
    </main>
  );
}
