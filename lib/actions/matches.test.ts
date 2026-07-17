import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { recordScore, endTournament } from "./matches";

describe("recordScore", () => {
  const insertedPlayerIds: string[] = [];
  const tournamentIds: string[] = [];
  const matchIds: string[] = [];

  afterAll(async () => {
    for (const id of matchIds) {
      await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id));
      await db.delete(matches).where(eq(matches.id, id));
    }
    for (const id of tournamentIds) {
      await db.delete(tournaments).where(eq(tournaments.id, id));
    }
    for (const id of insertedPlayerIds) await db.delete(players).where(eq(players.id, id));
  });

  it("flips the tournament to in_progress on the first score, then completed once all matches are final", async () => {
    const [p1] = await db.insert(players).values({ name: "__Score P1__", duprRating: "4.00" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Score P2__", duprRating: "4.00" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Score Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "scheduled" })
      .returning();
    tournamentIds.push(tournament.id);

    const [matchA] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 1, status: "scheduled" })
      .returning();
    const [matchB] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 2, status: "scheduled" })
      .returning();
    matchIds.push(matchA.id, matchB.id);
    await db.insert(matchParticipants).values([
      { matchId: matchA.id, playerId: p1.id, side: 1 },
      { matchId: matchA.id, playerId: p2.id, side: 2 },
      { matchId: matchB.id, playerId: p1.id, side: 1 },
      { matchId: matchB.id, playerId: p2.id, side: 2 },
    ]);

    const scoreFormA = new FormData();
    scoreFormA.set("side1Score", "11");
    scoreFormA.set("side2Score", "7");
    await recordScore(matchA.id, scoreFormA);

    const [afterFirst] = await db.select().from(tournaments).where(eq(tournaments.id, tournament.id));
    expect(afterFirst.status).toBe("in_progress");

    const scoreFormB = new FormData();
    scoreFormB.set("side1Score", "9");
    scoreFormB.set("side2Score", "11");
    await recordScore(matchB.id, scoreFormB);

    const [afterSecond] = await db.select().from(tournaments).where(eq(tournaments.id, tournament.id));
    expect(afterSecond.status).toBe("completed");

    const [updatedMatchA] = await db.select().from(matches).where(eq(matches.id, matchA.id));
    expect(updatedMatchA.status).toBe("final");
    expect(updatedMatchA.side1Score).toBe(11);
  });

  it("rejects a tied score", async () => {
    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Tie Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "scheduled" })
      .returning();
    tournamentIds.push(tournament.id);
    const [match] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 1, status: "scheduled" })
      .returning();
    matchIds.push(match.id);

    const formData = new FormData();
    formData.set("side1Score", "5");
    formData.set("side2Score", "5");
    await expect(recordScore(match.id, formData)).rejects.toThrow("Scores cannot be tied");
  });

  it("rejects recording a score once the tournament has been completed", async () => {
    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Completed Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "completed" })
      .returning();
    tournamentIds.push(tournament.id);
    const [match] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 1, status: "scheduled" })
      .returning();
    matchIds.push(match.id);

    const formData = new FormData();
    formData.set("side1Score", "11");
    formData.set("side2Score", "7");
    await expect(recordScore(match.id, formData)).rejects.toThrow(
      "This tournament has ended — scores can no longer be edited"
    );

    const [unchangedMatch] = await db.select().from(matches).where(eq(matches.id, match.id));
    expect(unchangedMatch.status).toBe("scheduled");
    expect(unchangedMatch.side1Score).toBeNull();
  });
});

describe("endTournament", () => {
  const tournamentIds: string[] = [];
  const matchIds: string[] = [];

  afterAll(async () => {
    for (const id of matchIds) await db.delete(matches).where(eq(matches.id, id));
    for (const id of tournamentIds) await db.delete(tournaments).where(eq(tournaments.id, id));
  });

  it("force-completes a tournament even with unplayed matches remaining", async () => {
    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__End Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "in_progress" })
      .returning();
    tournamentIds.push(tournament.id);
    const [match] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 1, status: "scheduled" })
      .returning();
    matchIds.push(match.id);

    await endTournament(tournament.id);

    const [updated] = await db.select().from(tournaments).where(eq(tournaments.id, tournament.id));
    expect(updated.status).toBe("completed");

    const [unchangedMatch] = await db.select().from(matches).where(eq(matches.id, match.id));
    expect(unchangedMatch.status).toBe("scheduled"); // left as-is, not force-scored
  });

  it("is idempotent when called on an already-completed tournament", async () => {
    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Already Ended__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "completed" })
      .returning();
    tournamentIds.push(tournament.id);

    await expect(endTournament(tournament.id)).resolves.toBeUndefined();

    const [updated] = await db.select().from(tournaments).where(eq(tournaments.id, tournament.id));
    expect(updated.status).toBe("completed");
  });

  it("throws for a nonexistent tournament", async () => {
    await expect(endTournament("00000000-0000-0000-0000-000000000000")).rejects.toThrow("Tournament not found");
  });
});
