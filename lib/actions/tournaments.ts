"use server";

import { db } from "@/lib/db/client";
import { tournaments, tournamentParticipants, matches, matchParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { generateSinglesSchedule } from "@/lib/scheduling/singles";
import { generateFixedDoublesSchedule } from "@/lib/scheduling/fixedDoubles";
import { generateRotatingDoublesSchedule } from "@/lib/scheduling/rotatingDoubles";
import type { ScheduledMatch } from "@/lib/scheduling/types";

export async function generateBracket(formData: FormData): Promise<string> {
  const name = String(formData.get("name") ?? "").trim();
  const numCourts = Number(formData.get("numCourts"));
  const matchDurationMinutes = Number(formData.get("matchDurationMinutes"));
  const matchFormat = String(formData.get("matchFormat"));
  const participantIds = formData.getAll("participantIds").map(String);

  if (!name) throw new Error("Tournament name is required");
  if (!Number.isInteger(numCourts) || numCourts < 1) throw new Error("Number of courts must be at least 1");
  if (!Number.isInteger(matchDurationMinutes) || matchDurationMinutes < 1) {
    throw new Error("Match duration must be at least 1 minute");
  }
  if (matchFormat !== "singles" && matchFormat !== "doubles") throw new Error("Invalid match format");
  if (participantIds.length < 2) throw new Error("Select at least 2 participants");

  let schedule: ScheduledMatch[];
  let teamMode: "fixed" | "rotating" | null = null;
  let numRounds: number | null = null;

  if (matchFormat === "singles") {
    schedule = generateSinglesSchedule(participantIds, numCourts);
  } else {
    teamMode = String(formData.get("teamMode")) as "fixed" | "rotating";
    if (teamMode !== "fixed" && teamMode !== "rotating") throw new Error("Invalid team mode");

    if (teamMode === "fixed") {
      const teamStrings = formData.getAll("fixedTeams").map(String);
      if (teamStrings.length === 0) throw new Error("At least one team is required");
      const teams: [string, string][] = teamStrings.map((t) => {
        const [a, b] = t.split(",");
        return [a, b];
      });
      schedule = generateFixedDoublesSchedule(teams, numCourts);
    } else {
      numRounds = Number(formData.get("numRounds"));
      if (!Number.isInteger(numRounds) || numRounds < 1) throw new Error("Number of rounds must be at least 1");
      schedule = generateRotatingDoublesSchedule(participantIds, numCourts, numRounds);
    }
  }

  if (schedule.length === 0) throw new Error("Not enough participants to generate a schedule");

  const [tournament] = await db
    .insert(tournaments)
    .values({ name, numCourts, matchDurationMinutes, matchFormat, teamMode, numRounds, status: "scheduled" })
    .returning();

  await db
    .insert(tournamentParticipants)
    .values(participantIds.map((playerId) => ({ tournamentId: tournament.id, playerId })));

  for (const scheduledMatch of schedule) {
    const [insertedMatch] = await db
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        courtNumber: scheduledMatch.courtNumber,
        roundNumber: scheduledMatch.roundNumber,
        status: "scheduled",
      })
      .returning();

    await db.insert(matchParticipants).values([
      ...scheduledMatch.side1PlayerIds.map((playerId) => ({ matchId: insertedMatch.id, playerId, side: 1 })),
      ...scheduledMatch.side2PlayerIds.map((playerId) => ({ matchId: insertedMatch.id, playerId, side: 2 })),
    ]);
  }

  return tournament.id;
}

export async function startTournament(tournamentId: string): Promise<void> {
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status !== "scheduled") {
    throw new Error("Tournament has already been started");
  }

  await db
    .update(tournaments)
    .set({ status: "in_progress", startedAt: new Date() })
    .where(eq(tournaments.id, tournamentId));

  safeRevalidatePath(`/tournaments/${tournamentId}`);
  safeRevalidatePath("/tournaments");
  safeRevalidatePath("/");
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
