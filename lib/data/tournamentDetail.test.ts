import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTournamentDetail } from "./tournamentDetail";

describe("getTournamentDetail", () => {
  const insertedPlayerIds: string[] = [];
  let tournamentId: string | null = null;
  const matchIds: string[] = [];

  afterAll(async () => {
    for (const id of matchIds) {
      await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id));
      await db.delete(matches).where(eq(matches.id, id));
    }
    if (tournamentId) await db.delete(tournaments).where(eq(tournaments.id, tournamentId));
    for (const id of insertedPlayerIds) await db.delete(players).where(eq(players.id, id));
  });

  it("returns matches grouped with player names, sorted by round then court", async () => {
    const [p1] = await db.insert(players).values({ name: "__Detail P1__", duprRating: "4.00" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Detail P2__", duprRating: "4.00" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Detail Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "scheduled" })
      .returning();
    tournamentId = tournament.id;

    const [match] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 1, status: "scheduled" })
      .returning();
    matchIds.push(match.id);

    await db.insert(matchParticipants).values([
      { matchId: match.id, playerId: p1.id, side: 1 },
      { matchId: match.id, playerId: p2.id, side: 2 },
    ]);

    const detail = await getTournamentDetail(tournament.id);
    expect(detail?.matches).toHaveLength(1);
    expect(detail?.matches[0]).toMatchObject({
      roundNumber: 1,
      courtNumber: 1,
      status: "scheduled",
      side1PlayerNames: ["__Detail P1__"],
      side2PlayerNames: ["__Detail P2__"],
    });
  });

  it("returns null for a nonexistent tournament", async () => {
    const detail = await getTournamentDetail("00000000-0000-0000-0000-000000000000");
    expect(detail).toBeNull();
  });
});
