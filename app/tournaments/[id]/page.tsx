import { notFound } from "next/navigation";
import { getTournamentDetail, type MatchDetail } from "@/lib/data/tournamentDetail";
import { recordScore } from "@/lib/actions/matches";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { MatchScoreForm } from "@/components/tournaments/MatchScoreForm";

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await getTournamentDetail(id);
  if (!tournament) notFound();

  const rounds = new Map<number, MatchDetail[]>();
  for (const match of tournament.matches) {
    const list = rounds.get(match.roundNumber) ?? [];
    list.push(match);
    rounds.set(match.roundNumber, list);
  }

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold">{tournament.name}</h1>
        <Badge>{tournament.status.replace("_", " ")}</Badge>
      </div>

      {[...rounds.entries()].map(([roundNumber, roundMatches]) => (
        <Card key={roundNumber} className="p-0 divide-y divide-surface-container-high">
          <h2 className="font-headline text-lg font-semibold p-4">Round {roundNumber}</h2>
          {roundMatches.map((match) => (
            <div key={match.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-mono text-xs text-on-surface-variant uppercase">Court {match.courtNumber}</p>
                <p className="font-body font-medium">
                  {match.side1PlayerNames.join(" & ")} vs. {match.side2PlayerNames.join(" & ")}
                </p>
              </div>
              <MatchScoreForm
                side1Score={match.side1Score}
                side2Score={match.side2Score}
                onSubmit={recordScore.bind(null, match.id)}
              />
            </div>
          ))}
        </Card>
      ))}
    </main>
  );
}
