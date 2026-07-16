import { getAllPlayers } from "@/lib/data/players";
import { createPlayer, updatePlayer } from "@/lib/actions/players";
import { AddPlayerForm } from "@/components/players/AddPlayerForm";
import { PlayerListItem } from "@/components/players/PlayerListItem";
import { Card } from "@/components/Card";

export default async function PlayersPage() {
  const allPlayers = await getAllPlayers();

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-8">
      <h1 className="font-headline text-3xl font-bold">Players</h1>

      <Card>
        <h2 className="font-headline text-lg font-semibold mb-4">Add Player</h2>
        <AddPlayerForm onSubmit={createPlayer} />
      </Card>

      <Card className="p-0 divide-y divide-surface-container-high">
        {allPlayers.map((player) => (
          <PlayerListItem key={player.id} player={player} onUpdate={updatePlayer.bind(null, player.id)} />
        ))}
      </Card>
    </main>
  );
}
