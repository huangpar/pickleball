import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, tournamentParticipants, matches, matchParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateBracket, startTournament } from "./tournaments";

describe("generateBracket", () => {
  const insertedPlayerIds: string[] = [];
  const createdTournamentIds: string[] = [];

  afterAll(async () => {
    for (const tournamentId of createdTournamentIds) {
      const matchRows = await db.select({ id: matches.id }).from(matches).where(eq(matches.tournamentId, tournamentId));
      for (const m of matchRows) {
        await db.delete(matchParticipants).where(eq(matchParticipants.matchId, m.id));
      }
      await db.delete(matches).where(eq(matches.tournamentId, tournamentId));
      await db.delete(tournamentParticipants).where(eq(tournamentParticipants.tournamentId, tournamentId));
      await db.delete(tournaments).where(eq(tournaments.id, tournamentId));
    }
    for (const id of insertedPlayerIds) await db.delete(players).where(eq(players.id, id));
  });

  async function insertTestPlayers(count: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const [p] = await db.insert(players).values({ name: `__Bracket P${i}__` }).returning();
      ids.push(p.id);
    }
    insertedPlayerIds.push(...ids);
    return ids;
  }

  it("creates a singles tournament with a full round-robin schedule", async () => {
    const ids = await insertTestPlayers(4);

    const formData = new FormData();
    formData.set("name", "__Bracket Singles Tournament__");
    formData.set("numCourts", "2");
    formData.set("matchDurationMinutes", "30");
    formData.set("matchFormat", "singles");
    ids.forEach((id) => formData.append("participantIds", id));

    const tournamentId = await generateBracket(formData);
    createdTournamentIds.push(tournamentId);

    const [tournamentRow] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
    expect(tournamentRow.status).toBe("scheduled");
    expect(tournamentRow.matchFormat).toBe("singles");

    const matchRows = await db.select().from(matches).where(eq(matches.tournamentId, tournamentId));
    expect(matchRows).toHaveLength(6); // C(4,2)

    const participantRows = await db
      .select()
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournamentId));
    expect(participantRows).toHaveLength(4);
  });

  it("creates a fixed-team doubles tournament from submitted team pairs", async () => {
    const ids = await insertTestPlayers(4); // 2 teams of 2

    const formData = new FormData();
    formData.set("name", "__Bracket Doubles Tournament__");
    formData.set("numCourts", "1");
    formData.set("matchDurationMinutes", "30");
    formData.set("matchFormat", "doubles");
    formData.set("teamMode", "fixed");
    ids.forEach((id) => formData.append("participantIds", id));
    formData.append("fixedTeams", `${ids[0]},${ids[1]}`);
    formData.append("fixedTeams", `${ids[2]},${ids[3]}`);

    const tournamentId = await generateBracket(formData);
    createdTournamentIds.push(tournamentId);

    const matchRows = await db.select().from(matches).where(eq(matches.tournamentId, tournamentId));
    expect(matchRows).toHaveLength(1); // C(2,2) team pairings = 1 match

    const participantRows = await db
      .select()
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, matchRows[0].id));
    expect(participantRows).toHaveLength(4); // 2 players per side
  });

  it("rejects fewer than 2 participants", async () => {
    const formData = new FormData();
    formData.set("name", "__Invalid Tournament__");
    formData.set("numCourts", "1");
    formData.set("matchDurationMinutes", "30");
    formData.set("matchFormat", "singles");
    formData.append("participantIds", "only-one-id");

    await expect(generateBracket(formData)).rejects.toThrow("Select at least 2 participants");
  });
});

describe("startTournament", () => {
  const tournamentIds: string[] = [];

  afterAll(async () => {
    for (const id of tournamentIds) await db.delete(tournaments).where(eq(tournaments.id, id));
  });

  it("moves a scheduled tournament to in_progress and records the start time", async () => {
    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Start Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "scheduled" })
      .returning();
    tournamentIds.push(tournament.id);

    const before = new Date();
    await startTournament(tournament.id);
    const after = new Date();

    const [updated] = await db.select().from(tournaments).where(eq(tournaments.id, tournament.id));
    expect(updated.status).toBe("in_progress");
    expect(updated.startedAt).not.toBeNull();
    expect(updated.startedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(updated.startedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("rejects starting a tournament that has already been started", async () => {
    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Already Started__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "in_progress" })
      .returning();
    tournamentIds.push(tournament.id);

    await expect(startTournament(tournament.id)).rejects.toThrow("Tournament has already been started");
  });

  it("throws for a nonexistent tournament", async () => {
    await expect(startTournament("00000000-0000-0000-0000-000000000000")).rejects.toThrow("Tournament not found");
  });
});
