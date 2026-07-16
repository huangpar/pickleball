import { getStandings } from "@/lib/data/standings";
import { StandingsTable } from "@/components/standings/StandingsTable";

export default async function StandingsPage() {
  const standings = await getStandings();

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-6">
      <h1 className="font-headline text-3xl font-bold">Standings</h1>
      <StandingsTable initialStandings={standings} />
    </main>
  );
}
