import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPlayerMatchHistory } from "./matchHistory";

describe("getPlayerMatchHistory", () => {
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

  it("includes partner and opponent names for a doubles match", async () => {
    const names = ["__History P1__", "__History P2__", "__History P3__", "__History P4__"];
    const inserted = [];
    for (const name of names) {
      const [p] = await db.insert(players).values({ name, duprRating: "4.00" }).returning();
      inserted.push(p);
    }
    insertedPlayerIds.push(...inserted.map((p) => p.id));
    const [p1, p2, p3, p4] = inserted;

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__History Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "doubles", teamMode: "fixed" })
      .returning();
    insertedTournamentIds.push(tournament.id);

    const [match] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 1,
        side1Score: 11,
        side2Score: 7,
        status: "final",
        playedAt: new Date(),
      })
      .returning();
    insertedMatchIds.push(match.id);

    await db.insert(matchParticipants).values([
      { matchId: match.id, playerId: p1.id, side: 1 },
      { matchId: match.id, playerId: p2.id, side: 1 },
      { matchId: match.id, playerId: p3.id, side: 2 },
      { matchId: match.id, playerId: p4.id, side: 2 },
    ]);

    const history = await getPlayerMatchHistory(p1.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      tournamentName: "__History Tournament__",
      ownScore: 11,
      opponentScore: 7,
      won: true,
      partnerNames: ["__History P2__"],
    });
    expect(new Set(history[0].opponentNames)).toEqual(new Set(["__History P3__", "__History P4__"]));
  });
});
