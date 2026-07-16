import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStandings } from "./standings";

describe("getStandings", () => {
  const insertedPlayerIds: string[] = [];
  const insertedTournamentIds: string[] = [];
  const insertedMatchIds: string[] = [];

  afterAll(async () => {
    for (const id of insertedMatchIds) {
      await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id));
      await db.delete(matches).where(eq(matches.id, id));
    }
    for (const id of insertedTournamentIds) await db.delete(tournaments).where(eq(tournaments.id, id));
    for (const id of insertedPlayerIds) await db.delete(players).where(eq(players.id, id));
  });

  it("computes wins, matches played, and win percentage per player", async () => {
    const [p1] = await db.insert(players).values({ name: "__Standings Winner__", duprRating: "4.50" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Standings Loser__", duprRating: "4.00" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Standings Test Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles" })
      .returning();
    insertedTournamentIds.push(tournament.id);

    const [match] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 1,
        side1Score: 11,
        side2Score: 4,
        status: "final",
        playedAt: new Date(),
      })
      .returning();
    insertedMatchIds.push(match.id);

    await db.insert(matchParticipants).values([
      { matchId: match.id, playerId: p1.id, side: 1 },
      { matchId: match.id, playerId: p2.id, side: 2 },
    ]);

    const standings = await getStandings();
    const winnerRow = standings.find((s) => s.id === p1.id);
    const loserRow = standings.find((s) => s.id === p2.id);

    expect(winnerRow).toMatchObject({ wins: 1, matchesPlayed: 1, winPercentage: 100 });
    expect(loserRow).toMatchObject({ wins: 0, matchesPlayed: 1, winPercentage: 0 });
  });
});
