import { getAllPlayers } from "@/lib/data/players";
import { createPlayer } from "@/lib/actions/players";
import { generateBracket } from "@/lib/actions/tournaments";
import { RoundRobinSetupForm } from "@/components/tournaments/RoundRobinSetupForm";

export default async function NewTournamentPage() {
  const allPlayers = await getAllPlayers();

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-6">
      <h1 className="font-headline text-3xl font-bold">Round Robin Setup</h1>
      <RoundRobinSetupForm initialPlayers={allPlayers} onSubmit={generateBracket} onCreatePlayer={createPlayer} />
    </main>
  );
}
