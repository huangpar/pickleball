import { notFound } from "next/navigation";
import { getTournamentDetail, getTournamentStandings, type MatchDetail } from "@/lib/data/tournamentDetail";
import { recordScore, endTournament } from "@/lib/actions/matches";
import { startTournament } from "@/lib/actions/tournaments";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { MatchScoreForm } from "@/components/tournaments/MatchScoreForm";
import { EndTournamentButton } from "@/components/tournaments/EndTournamentButton";
import { StartTournamentButton } from "@/components/tournaments/StartTournamentButton";
import { TournamentStandingsTable } from "@/components/tournaments/TournamentStandingsTable";

import { Tabs } from "@/components/Tabs";

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
  const isScheduled = tournament.status === "scheduled";
  const canScore = tournament.status === "in_progress";

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-headline text-3xl font-bold">{tournament.name}</h1>
        <div className="flex items-center gap-3">
          <Badge>{tournament.status.replace("_", " ")}</Badge>
          {isScheduled && <StartTournamentButton onStart={startTournament.bind(null, tournament.id)} />}
          {!isCompleted && !isScheduled && <EndTournamentButton onEnd={endTournament.bind(null, tournament.id)} />}
        </div>
      </div>

      <Tabs
        tabs={[
          ...[...rounds.entries()].map(([roundNumber, roundMatches]) => ({
            id: `round-${roundNumber}`,
            label: `Round ${roundNumber}`,
            content: (
              <div className="space-y-4">
                <h2 className="font-headline text-lg font-semibold">Round {roundNumber}</h2>
                {roundMatches.map((match) => (
                  <Card key={match.id} className="p-0 overflow-hidden border border-outline-variant/30 shadow-sm">
                    <div className="bg-surface-bright border-b border-outline-variant/30 px-4 py-3">
                      <h3 className="font-mono text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Court {match.courtNumber}</h3>
                    </div>
                    <MatchScoreForm
                      side1PlayerNames={match.side1PlayerNames}
                      side2PlayerNames={match.side2PlayerNames}
                      side1Score={match.side1Score}
                      side2Score={match.side2Score}
                      disabled={!canScore}
                      onSubmit={recordScore.bind(null, match.id)}
                    />
                  </Card>
                ))}
                {byesByRound.has(roundNumber) && (
                  <Card className="p-0 overflow-hidden border border-outline-variant/30 shadow-sm">
                    <div className="flex items-center gap-3 px-4 py-3 bg-surface-container-lowest">
                      <span className="inline-block bg-surface-container-high text-on-surface-variant font-mono text-xs uppercase font-bold tracking-wide px-2 py-1 rounded">BYE</span>
                      <span className="font-body text-on-surface">{byesByRound.get(roundNumber)!.join(", ")}</span>
                    </div>
                  </Card>
                )}
              </div>
            ),
          })),
          {
            id: "standings",
            label: "Standings",
            content: (
              <div>
                <h2 className="font-headline text-lg font-semibold mb-4">Tournament Standings</h2>
                <TournamentStandingsTable standings={standings} />
              </div>
            ),
          },
        ]}
      />
    </main>
  );
}
