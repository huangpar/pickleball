import Link from "next/link";
import { getAllTournaments } from "@/lib/data/tournaments";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { TournamentsListClient } from "@/components/tournaments/TournamentsListClient";

export default async function TournamentsPage() {
  const allTournaments = await getAllTournaments();

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-headline text-3xl font-bold">Tournaments</h1>
        <Button href="/tournaments/new">Create Tournament</Button>
      </div>

      <TournamentsListClient tournaments={allTournaments} />
    </main>
  );
}
