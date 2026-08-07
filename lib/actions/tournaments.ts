"use server";

import { db } from "@/lib/db/client";
import { tournaments, tournamentParticipants, matches, matchParticipants } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { generateSinglesSchedule } from "@/lib/scheduling/singles";
import { generateFixedDoublesSchedule } from "@/lib/scheduling/fixedDoubles";
import { generateRotatingDoublesSchedule } from "@/lib/scheduling/rotatingDoubles";
import { generateHybridDoublesSchedule } from "@/lib/scheduling/hybridDoubles";
import type { ScheduledMatch } from "@/lib/scheduling/types";

export async function generateBracket(formData: FormData): Promise<{ tournamentId: string } | { error: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const numCourts = Number(formData.get("numCourts"));
  const matchDurationMinutes = Number(formData.get("matchDurationMinutes"));
  const matchFormat = String(formData.get("matchFormat"));
  const participantIds = formData.getAll("participantIds").map(String);
  const uniqueParticipantIds = [...new Set(participantIds)];

  if (!name) return { error: "Tournament name is required" };
  if (!Number.isInteger(numCourts) || numCourts < 1) return { error: "Number of courts must be at least 1" };
  if (!Number.isInteger(matchDurationMinutes) || matchDurationMinutes < 1) {
    return { error: "Match duration must be at least 1 minute" };
  }
  if (matchFormat !== "singles" && matchFormat !== "doubles") return { error: "Invalid match format" };
  if (uniqueParticipantIds.length < 2) return { error: "Select at least 2 participants" };

  let schedule: ScheduledMatch[];
  let teamMode: "fixed" | "rotating" | "hybrid" | null = null;
  let numRounds: number | null = null;

  if (matchFormat === "singles") {
    schedule = generateSinglesSchedule(uniqueParticipantIds, numCourts);
  } else {
    teamMode = String(formData.get("teamMode")) as "fixed" | "rotating" | "hybrid";
    if (teamMode !== "fixed" && teamMode !== "rotating" && teamMode !== "hybrid") {
      return { error: "Invalid team mode" };
    }

    if (teamMode === "fixed") {
      const teamStrings = formData.getAll("fixedTeams").map(String);
      if (teamStrings.length === 0) return { error: "At least one team is required" };
      const teams: [string, string][] = teamStrings.map((t) => {
        const [a, b] = t.split(",");
        return [a, b];
      });
      schedule = generateFixedDoublesSchedule(teams, numCourts);
    } else if (teamMode === "rotating") {
      numRounds = Number(formData.get("numRounds"));
      if (!Number.isInteger(numRounds) || numRounds < 1) return { error: "Number of rounds must be at least 1" };
      schedule = generateRotatingDoublesSchedule(uniqueParticipantIds, numCourts, numRounds);
    } else {
      numRounds = Number(formData.get("numRounds"));
      if (!Number.isInteger(numRounds) || numRounds < 1) return { error: "Number of rounds must be at least 1" };
      const pairStrings = formData.getAll("fixedPairs").map(String);
      const fixedPairs: [string, string][] = pairStrings.map((t) => {
        const [a, b] = t.split(",");
        return [a, b];
      });
      const fixedPairPlayerIds = new Set(fixedPairs.flat());
      const rotatingPlayerIds = uniqueParticipantIds.filter((id) => !fixedPairPlayerIds.has(id));
      schedule = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, numCourts, numRounds);
    }
  }

  if (schedule.length === 0) return { error: "Not enough participants to generate a schedule" };

  const [tournament] = await db
    .insert(tournaments)
    .values({ name, numCourts, matchDurationMinutes, matchFormat, teamMode, numRounds, status: "setup" })
    .returning();

  await db
    .insert(tournamentParticipants)
    .values(uniqueParticipantIds.map((playerId) => ({ tournamentId: tournament.id, playerId })));

  for (const scheduledMatch of schedule) {
    const [insertedMatch] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: scheduledMatch.courtNumber,
        roundNumber: scheduledMatch.roundNumber,
        status: "scheduled",
        firstServerId: scheduledMatch.firstServerId,
      })
      .returning();

    await db.insert(matchParticipants).values([
      ...scheduledMatch.side1PlayerIds.map((playerId) => ({ matchId: insertedMatch.id, playerId, side: 1 })),
      ...scheduledMatch.side2PlayerIds.map((playerId) => ({ matchId: insertedMatch.id, playerId, side: 2 })),
    ]);
  }

  safeRevalidatePath("/tournaments");
  safeRevalidatePath("/");

  return { tournamentId: tournament.id };
}

export async function startTournament(tournamentId: string): Promise<{ error?: string }> {
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!tournament) return { error: "Tournament not found" };
  if (tournament.status !== "setup") {
    return { error: "Tournament has already been started" };
  }

  await db
    .update(tournaments)
    .set({ status: "in_progress", startedAt: new Date() })
    .where(eq(tournaments.id, tournamentId));

  safeRevalidatePath(`/tournaments/${tournamentId}`);
  safeRevalidatePath("/tournaments");
  safeRevalidatePath("/");
  return {};
}

export async function deleteTournament(tournamentId: string): Promise<{ error?: string }> {
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!tournament) return { error: "Tournament not found" };

  const matchRows = await db.select({ id: matches.id }).from(matches).where(eq(matches.tournamentId, tournamentId));
  const matchIds = matchRows.map((m) => m.id);
  if (matchIds.length > 0) {
    await db.delete(matchParticipants).where(inArray(matchParticipants.matchId, matchIds));
    await db.delete(matches).where(eq(matches.tournamentId, tournamentId));
  }
  await db.delete(tournamentParticipants).where(eq(tournamentParticipants.tournamentId, tournamentId));
  await db.delete(tournaments).where(eq(tournaments.id, tournamentId));

  safeRevalidatePath("/tournaments");
  safeRevalidatePath("/");
  return {};
}

export async function editTournament(
  tournamentId: string,
  participantIds: string[],
  numRounds: number
): Promise<{ error?: string }> {
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!tournament) return { error: "Tournament not found" };
  if (tournament.status !== "setup") return { error: "Tournament is not in setup status" };

  // Get current participants to check if they changed
  const currentParticipants = await db
    .select({ playerId: tournamentParticipants.playerId })
    .from(tournamentParticipants)
    .where(eq(tournamentParticipants.tournamentId, tournamentId));

  const currentParticipantIds = currentParticipants.map((p) => p.playerId).sort();
  const newParticipantIds = [...participantIds].sort();
  const participantsChanged = JSON.stringify(currentParticipantIds) !== JSON.stringify(newParticipantIds);

  // Allow rounds-only changes for fixed/hybrid, but reject participant changes
  if ((tournament.teamMode === "fixed" || tournament.teamMode === "hybrid") && participantsChanged) {
    return { error: "Cannot re-edit fixed/hybrid teams (no stored mapping)" };
  }

  if (participantIds.length < 2) return { error: "Select at least 2 participants" };

  // Validate doubles participant count
  if (tournament.matchFormat === "doubles" && participantIds.length < 4) {
    return { error: "Doubles tournaments require at least 4 participants" };
  }

  // NOTE: Transaction support requires db driver with transaction capability (e.g., postgres driver with WebSocket).
  // Current neon-http driver does not support transactions. When switching to WebSocket driver,
  // wrap this block: await db.transaction(async (tx) => { ... replace db. with tx. ... })
  const matchRows = await db.select({ id: matches.id }).from(matches).where(eq(matches.tournamentId, tournamentId));
  const matchIds = matchRows.map((m) => m.id);
  if (matchIds.length > 0) {
    await db.delete(matchParticipants).where(inArray(matchParticipants.matchId, matchIds));
    await db.delete(matches).where(inArray(matches.id, matchIds));
  }

  await db.delete(tournamentParticipants).where(eq(tournamentParticipants.tournamentId, tournamentId));
  await db.insert(tournamentParticipants).values(participantIds.map((playerId) => ({ tournamentId, playerId })));

  if (numRounds !== tournament.numRounds) {
    await db.update(tournaments).set({ numRounds }).where(eq(tournaments.id, tournamentId));
  }

  // For fixed/hybrid tournaments with only rounds changed, skip match regeneration
  if (!participantsChanged && (tournament.teamMode === "fixed" || tournament.teamMode === "hybrid")) {
    safeRevalidatePath("/tournaments");
    safeRevalidatePath(`/tournaments/${tournamentId}`);
    return {};
  }

  let schedule: ScheduledMatch[];
  if (tournament.matchFormat === "singles") {
    schedule = generateSinglesSchedule(participantIds, tournament.numCourts);
  } else if (tournament.teamMode === "rotating") {
    schedule = generateRotatingDoublesSchedule(participantIds, tournament.numCourts, numRounds);
  } else {
    return { error: "Unknown team mode" };
  }

  for (const scheduledMatch of schedule) {
    const [insertedMatch] = await db
      .insert(matches)
      .values({
        tournamentId,
        courtNumber: scheduledMatch.courtNumber,
        roundNumber: scheduledMatch.roundNumber,
        status: "scheduled",
        firstServerId: scheduledMatch.firstServerId,
      })
      .returning();

    await db.insert(matchParticipants).values([
      ...scheduledMatch.side1PlayerIds.map((playerId) => ({ matchId: insertedMatch.id, playerId, side: 1 })),
      ...scheduledMatch.side2PlayerIds.map((playerId) => ({ matchId: insertedMatch.id, playerId, side: 2 })),
    ]);
  }

  safeRevalidatePath("/tournaments");
  safeRevalidatePath(`/tournaments/${tournamentId}`);
  return {};
}

// `revalidatePath` requires an active Next.js request-scoped store and throws
// "Invariant: static generation store missing" when called outside one (e.g.
// invoking this server action directly from a Vitest test, rather than through
// a real Next.js request). That invariant is irrelevant here — there's no
// route cache to invalidate outside a real request — so it's safe to ignore.
function safeRevalidatePath(path: string): void {
  try {
    revalidatePath(path);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Invariant: static generation store missing")) {
      return; // No-op outside a Next.js request context (e.g. tests).
    }
    throw error;
  }
}
