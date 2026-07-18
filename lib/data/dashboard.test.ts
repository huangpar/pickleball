import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getDashboardStats,
  getMatchActivityLast7Days,
  getRecentMatches,
  getUpcomingMatches,
  getTopPerformer,
} from "./dashboard";
import { getStandings } from "./standings";

describe("dashboard data layer", () => {
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

  it("computes stats, activity, recent/upcoming matches, and top performer together", async () => {
    const [p1] = await db.insert(players).values({ name: "__Dash P1__" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Dash P2__" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Dash Tournament__", numCourts: 1, matchDurationMinutes: 40, matchFormat: "singles" })
      .returning();
    insertedTournamentIds.push(tournament.id);

    const now = new Date();
    const [finalMatch] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 1,
        side1Score: 11,
        side2Score: 3,
        status: "final",
        playedAt: now,
      })
      .returning();
    const [finalMatch2] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 2,
        side1Score: 11,
        side2Score: 2,
        status: "final",
        playedAt: now,
      })
      .returning();
    const [finalMatch3] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: 1,
        roundNumber: 3,
        side1Score: 11,
        side2Score: 9,
        status: "final",
        playedAt: now,
      })
      .returning();
    const [scheduledMatch] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 4, status: "scheduled" })
      .returning();
    insertedMatchIds.push(finalMatch.id, finalMatch2.id, finalMatch3.id, scheduledMatch.id);

    await db.insert(matchParticipants).values([
      { matchId: finalMatch.id, playerId: p1.id, side: 1 },
      { matchId: finalMatch.id, playerId: p2.id, side: 2 },
      { matchId: finalMatch2.id, playerId: p1.id, side: 1 },
      { matchId: finalMatch2.id, playerId: p2.id, side: 2 },
      { matchId: finalMatch3.id, playerId: p1.id, side: 1 },
      { matchId: finalMatch3.id, playerId: p2.id, side: 2 },
      { matchId: scheduledMatch.id, playerId: p1.id, side: 1 },
      { matchId: scheduledMatch.id, playerId: p2.id, side: 2 },
    ]);

    const stats = await getDashboardStats();
    expect(stats.activePlayers).toBeGreaterThanOrEqual(2);
    expect(stats.ongoingMatches).toBeGreaterThanOrEqual(1);
    expect(stats.avgMatchDurationMinutes).toBeGreaterThan(0);

    const activity = await getMatchActivityLast7Days();
    expect(activity).toHaveLength(7);
    const totalCounted = activity.reduce((sum, d) => sum + d.count, 0);
    expect(totalCounted).toBeGreaterThanOrEqual(3);

    // Use a generous limit: this suite runs test files in parallel against a shared
    // live DB, and other files' fixtures (also using low round numbers / current
    // timestamps) can otherwise crowd our row out of a small LIMIT window.
    const recent = await getRecentMatches(1000);
    const recentIds = recent.map((m) => m.matchId);
    expect(recentIds).toContain(finalMatch.id);
    expect(recentIds).not.toContain(scheduledMatch.id);

    const upcoming = await getUpcomingMatches(1000);
    const upcomingIds = upcoming.map((m) => m.matchId);
    expect(upcomingIds).toContain(scheduledMatch.id);
    expect(upcomingIds).not.toContain(finalMatch.id);

    // getTopPerformer computes over the ENTIRE shared DB (via getStandings/getAllPlayers),
    // not just this test's fixtures, so other persistent data (e.g. a player with a
    // perfect record and >= 3 matches from another test/task) could tie or outrank p1.
    // Assert p1's own standings row directly rather than assuming it's the unique winner.
    const standings = await getStandings();
    const p1Row = standings.find((s) => s.id === p1.id);
    expect(p1Row).toMatchObject({ wins: 3, matchesPlayed: 3, winPercentage: 100 });

    // Still exercise getTopPerformer's filtering/sorting logic for real, but tolerantly:
    // p1 has a perfect 100% record with >= 3 matches, so no other player can beat it
    // (only tie it). Whoever getTopPerformer returns must be at least as good as p1,
    // and internally consistent with the standings computation.
    const topPerformer = await getTopPerformer(3);
    expect(topPerformer).not.toBeNull();
    expect(topPerformer!.winPercentage).toBeGreaterThanOrEqual(p1Row!.winPercentage);
    const topRow = standings.find((s) => s.id === topPerformer!.id);
    expect(topRow).toBeDefined();
    expect(topRow!.matchesPlayed).toBeGreaterThanOrEqual(3);
    expect(topRow!.winPercentage).toBe(topPerformer!.winPercentage);
  });
});
