import { db } from "@/lib/db/client";
import { tournaments, tournamentParticipants } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";

export interface TournamentSummary {
  id: string;
  name: string;
  status: "setup" | "scheduled" | "in_progress" | "completed";
  matchFormat: "singles" | "doubles";
  participantCount: number;
  createdAt: Date;
}

export async function getAllTournaments(): Promise<TournamentSummary[]> {
  return db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      status: tournaments.status,
      matchFormat: tournaments.matchFormat,
      createdAt: tournaments.createdAt,
      participantCount: sql<number>`count(${tournamentParticipants.playerId})::int`,
    })
    .from(tournaments)
    .leftJoin(tournamentParticipants, eq(tournamentParticipants.tournamentId, tournaments.id))
    .groupBy(tournaments.id)
    .orderBy(desc(tournaments.createdAt));
}
