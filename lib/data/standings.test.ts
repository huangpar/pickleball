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
    const [p1] = await db.insert(players).values({ name: "__Standings Winner__" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Standings Loser__" }).returning();
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

  it("filters matches by the tournament's start date", async () => {
    const [p1] = await db.insert(players).values({ name: "__Standings Date P1__" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Standings Date P2__" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [oldTournament] = await db
      .insert(tournaments)
      .values({
        name: "__Old Tournament__",
        numCourts: 1,
        matchDurationMinutes: 30,
        matchFormat: "singles",
        startedAt: new Date("2026-01-01T00:00:00Z"),
      })
      .returning();
    const [newTournament] = await db
      .insert(tournaments)
      .values({
        name: "__New Tournament__",
        numCourts: 1,
        matchDurationMinutes: 30,
        matchFormat: "singles",
        startedAt: new Date("2026-06-01T00:00:00Z"),
      })
      .returning();
    insertedTournamentIds.push(oldTournament.id, newTournament.id);

    const [oldMatch] = await db
      .insert(matches)
      .values({
        tournamentId: oldTournament.id,
        courtNumber: 1,
        roundNumber: 1,
        side1Score: 11,
        side2Score: 4,
        status: "final",
        playedAt: new Date("2026-01-01T00:00:00Z"),
      })
      .returning();
    const [newMatch] = await db
      .insert(matches)
      .values({
        tournamentId: newTournament.id,
        courtNumber: 1,
        roundNumber: 1,
        side1Score: 11,
        side2Score: 4,
        status: "final",
        playedAt: new Date("2026-06-01T00:00:00Z"),
      })
      .returning();
    insertedMatchIds.push(oldMatch.id, newMatch.id);

    await db.insert(matchParticipants).values([
      { matchId: oldMatch.id, playerId: p1.id, side: 1 },
      { matchId: oldMatch.id, playerId: p2.id, side: 2 },
      { matchId: newMatch.id, playerId: p1.id, side: 1 },
      { matchId: newMatch.id, playerId: p2.id, side: 2 },
    ]);

    const recentOnly = await getStandings({ from: new Date("2026-03-01T00:00:00Z") });
    const recentRow = recentOnly.find((s) => s.id === p1.id);
    expect(recentRow?.matchesPlayed).toBe(1);

    const both = await getStandings();
    const bothRow = both.find((s) => s.id === p1.id);
    expect(bothRow?.matchesPlayed).toBe(2);
  });
});
