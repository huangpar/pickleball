# Tournament Detail Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the existing Tournament Detail page, stack each match's name+score per side, show bye players per round, add a confirm-gated "End Tournament" button that force-completes a tournament and makes all its scores read-only, and add a per-tournament leaderboard alongside the existing global Standings page.

**Architecture:** No database schema changes. Byes and the per-tournament leaderboard are both derived at read time from existing tables, reusing the app's existing stats primitives (`computeWins`, `computeWinPercentage`, `computeTrend`) rather than introducing parallel computation. Server-side enforcement (not just UI) blocks score edits on a completed tournament.

**Tech Stack:** Next.js 16.2.10 (App Router) · TypeScript · Drizzle ORM · Neon Postgres · Vitest + @testing-library/react (same stack as the rest of this repo — no new dependencies)

## Global Constraints

- No database schema changes — byes and per-tournament standings are computed from existing `tournaments`, `tournamentParticipants`, `matches`, `matchParticipants` tables.
- Byes are computed by player ID, not by name (name-matching would break on duplicate names).
- The per-tournament leaderboard reuses `computeWins`/`computeWinPercentage`/`computeTrend` from `lib/stats.ts` and `getPlayerMatchOutcomes` from `lib/data/players.ts` — no new stats math.
- The per-tournament leaderboard has no sort toggle and no CSV export (that's the global Standings page only) — it's a simple read-only table, sorted by wins descending.
- "End Tournament" requires a confirmation step (`window.confirm`) before taking effect.
- Once a tournament's status is `completed` (via full scoring or via End Tournament), score edits must be rejected **server-side** in `recordScore`, not just hidden in the UI.
- End Tournament is a one-way action — no "reopen"/undo is in scope.

---

## Task 1: Extend `getTournamentDetail` with participant roster and byes

**Files:**
- Modify: `lib/data/tournamentDetail.ts`
- Modify: `lib/data/tournamentDetail.test.ts`

**Interfaces:**
- Consumes: `db`, `tournaments`, `matches`, `matchParticipants`, `players`, `tournamentParticipants` from `lib/db/schema.ts`/`lib/db/client.ts` (all pre-existing).
- Produces: `RoundBye` type (`{ roundNumber: number; playerNames: string[] }`); `TournamentParticipant` type (`{ id: string; name: string; duprRating: string }`); `getTournamentParticipants(tournamentId: string): Promise<TournamentParticipant[]>`; `TournamentDetail` gains `participants: { id: string; name: string }[]` and `byes: RoundBye[]`. Task 2 imports `getTournamentParticipants`. Task 7 (page) imports and renders `byes` and `participants`.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `lib/data/tournamentDetail.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants, tournamentParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTournamentDetail } from "./tournamentDetail";

describe("getTournamentDetail", () => {
  const insertedPlayerIds: string[] = [];
  const tournamentIds: string[] = [];
  const matchIds: string[] = [];

  afterAll(async () => {
    for (const id of matchIds) {
      await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id));
      await db.delete(matches).where(eq(matches.id, id));
    }
    for (const id of tournamentIds) {
      await db.delete(tournamentParticipants).where(eq(tournamentParticipants.tournamentId, id));
      await db.delete(tournaments).where(eq(tournaments.id, id));
    }
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
    tournamentIds.push(tournament.id);

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

  it("returns the full participant roster from tournament_participants", async () => {
    const [p1] = await db.insert(players).values({ name: "__Roster P1__", duprRating: "4.00" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Roster P2__", duprRating: "4.00" }).returning();
    insertedPlayerIds.push(p1.id, p2.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Roster Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "setup" })
      .returning();
    tournamentIds.push(tournament.id);

    await db.insert(tournamentParticipants).values([
      { tournamentId: tournament.id, playerId: p1.id },
      { tournamentId: tournament.id, playerId: p2.id },
    ]);

    const detail = await getTournamentDetail(tournament.id);
    expect(detail?.participants).toHaveLength(2);
    expect(detail?.participants.map((p) => p.name).sort()).toEqual(["__Roster P1__", "__Roster P2__"]);
    expect(detail?.byes).toEqual([]);
  });

  it("computes byes for roster participants without a match in a round", async () => {
    const [p1] = await db.insert(players).values({ name: "__Bye P1__", duprRating: "4.00" }).returning();
    const [p2] = await db.insert(players).values({ name: "__Bye P2__", duprRating: "4.00" }).returning();
    const [p3] = await db.insert(players).values({ name: "__Bye P3__", duprRating: "4.00" }).returning();
    insertedPlayerIds.push(p1.id, p2.id, p3.id);

    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__Bye Tournament__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "scheduled" })
      .returning();
    tournamentIds.push(tournament.id);

    await db.insert(tournamentParticipants).values([
      { tournamentId: tournament.id, playerId: p1.id },
      { tournamentId: tournament.id, playerId: p2.id },
      { tournamentId: tournament.id, playerId: p3.id },
    ]);

    // Round-robin for 3 players: round1 p1v p2 (bye p3), round2 p1v p3 (bye p2), round3 p2v p3 (bye p1)
    const [matchRound1] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 1, status: "scheduled" })
      .returning();
    const [matchRound2] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 2, status: "scheduled" })
      .returning();
    const [matchRound3] = await db
      .insert(matches)
      .values({ tournamentId: tournament.id, courtNumber: 1, roundNumber: 3, status: "scheduled" })
      .returning();
    matchIds.push(matchRound1.id, matchRound2.id, matchRound3.id);

    await db.insert(matchParticipants).values([
      { matchId: matchRound1.id, playerId: p1.id, side: 1 },
      { matchId: matchRound1.id, playerId: p2.id, side: 2 },
      { matchId: matchRound2.id, playerId: p1.id, side: 1 },
      { matchId: matchRound2.id, playerId: p3.id, side: 2 },
      { matchId: matchRound3.id, playerId: p2.id, side: 1 },
      { matchId: matchRound3.id, playerId: p3.id, side: 2 },
    ]);

    const detail = await getTournamentDetail(tournament.id);
    expect(detail?.byes).toEqual([
      { roundNumber: 1, playerNames: ["__Bye P3__"] },
      { roundNumber: 2, playerNames: ["__Bye P2__"] },
      { roundNumber: 3, playerNames: ["__Bye P1__"] },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/data/tournamentDetail.test.ts` — expected: FAIL (the two new tests fail because `detail?.participants`/`detail?.byes` are `undefined`, not matching the expected values — `getTournamentDetail` doesn't produce those fields yet).

- [ ] **Step 3: Implement the roster query and bye computation**

Replace the full contents of `lib/data/tournamentDetail.ts`:

```ts
import { db } from "@/lib/db/client";
import { tournaments, matches, matchParticipants, players, tournamentParticipants } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export interface MatchDetail {
  id: string;
  roundNumber: number;
  courtNumber: number;
  status: "scheduled" | "final";
  side1Score: number | null;
  side2Score: number | null;
  side1PlayerNames: string[];
  side2PlayerNames: string[];
}

export interface RoundBye {
  roundNumber: number;
  playerNames: string[];
}

export interface TournamentDetail {
  id: string;
  name: string;
  status: "setup" | "scheduled" | "in_progress" | "completed";
  matchFormat: "singles" | "doubles";
  matches: MatchDetail[];
  participants: { id: string; name: string }[];
  byes: RoundBye[];
}

export interface TournamentParticipant {
  id: string;
  name: string;
  duprRating: string;
}

export async function getTournamentParticipants(tournamentId: string): Promise<TournamentParticipant[]> {
  return db
    .select({ id: players.id, name: players.name, duprRating: players.duprRating })
    .from(tournamentParticipants)
    .innerJoin(players, eq(tournamentParticipants.playerId, players.id))
    .where(eq(tournamentParticipants.tournamentId, tournamentId));
}

export async function getTournamentDetail(tournamentId: string): Promise<TournamentDetail | null> {
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!tournament) return null;

  const participants = await getTournamentParticipants(tournamentId);
  const base = {
    id: tournament.id,
    name: tournament.name,
    status: tournament.status,
    matchFormat: tournament.matchFormat,
    participants: participants.map((p) => ({ id: p.id, name: p.name })),
  };

  const matchRows = await db.select().from(matches).where(eq(matches.tournamentId, tournamentId));
  if (matchRows.length === 0) return { ...base, matches: [], byes: [] };

  const matchIds = matchRows.map((m) => m.id);
  const participantRows = await db
    .select({
      matchId: matchParticipants.matchId,
      side: matchParticipants.side,
      playerId: matchParticipants.playerId,
      name: players.name,
    })
    .from(matchParticipants)
    .innerJoin(players, eq(matchParticipants.playerId, players.id))
    .where(inArray(matchParticipants.matchId, matchIds));

  const participantsByMatch = new Map<string, { side: number; playerId: string; name: string }[]>();
  for (const p of participantRows) {
    const list = participantsByMatch.get(p.matchId) ?? [];
    list.push(p);
    participantsByMatch.set(p.matchId, list);
  }

  const matchDetails: MatchDetail[] = matchRows
    .map((m) => {
      const participantsInMatch = participantsByMatch.get(m.id) ?? [];
      return {
        id: m.id,
        roundNumber: m.roundNumber,
        courtNumber: m.courtNumber,
        status: m.status,
        side1Score: m.side1Score,
        side2Score: m.side2Score,
        side1PlayerNames: participantsInMatch.filter((p) => p.side === 1).map((p) => p.name),
        side2PlayerNames: participantsInMatch.filter((p) => p.side === 2).map((p) => p.name),
      };
    })
    .sort((a, b) => a.roundNumber - b.roundNumber || a.courtNumber - b.courtNumber);

  const playingIdsByRound = new Map<number, Set<string>>();
  for (const m of matchRows) {
    const set = playingIdsByRound.get(m.roundNumber) ?? new Set<string>();
    for (const p of participantsByMatch.get(m.id) ?? []) {
      set.add(p.playerId);
    }
    playingIdsByRound.set(m.roundNumber, set);
  }

  const byes: RoundBye[] = [...playingIdsByRound.entries()]
    .map(([roundNumber, playingIds]) => ({
      roundNumber,
      playerNames: participants.filter((p) => !playingIds.has(p.id)).map((p) => p.name),
    }))
    .filter((b) => b.playerNames.length > 0)
    .sort((a, b) => a.roundNumber - b.roundNumber);

  return { ...base, matches: matchDetails, byes };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/data/tournamentDetail.test.ts` — expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/data/tournamentDetail.ts lib/data/tournamentDetail.test.ts
git commit -m "Add participant roster and bye computation to getTournamentDetail"
```

---

## Task 2: Add `getTournamentStandings`

**Files:**
- Modify: `lib/data/tournamentDetail.ts`
- Create: `lib/data/tournamentStandings.test.ts`

**Interfaces:**
- Consumes: `getTournamentParticipants` (Task 1, same file); `getPlayerMatchOutcomes` from `lib/data/players.ts`; `computeWins`, `computeWinPercentage`, `computeTrend` from `lib/stats.ts`; `StandingRow` type from `lib/standings.ts` (all pre-existing, unchanged).
- Produces: `getTournamentStandings(tournamentId: string): Promise<StandingRow[]>` (sorted by wins descending) from `lib/data/tournamentDetail.ts`. Task 7 (page) imports this.

- [ ] **Step 1: Write the failing test**

```ts
// lib/data/tournamentStandings.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db/client";
import { players, tournaments, matches, matchParticipants, tournamentParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTournamentStandings } from "./tournamentDetail";

describe("getTournamentStandings", () => {
  const insertedPlayerIds: string[] = [];
  const tournamentIds: string[] = [];
  const matchIds: string[] = [];

  afterAll(async () => {
    for (const id of matchIds) {
      await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id));
      await db.delete(matches).where(eq(matches.id, id));
    }
    for (const id of tournamentIds) {
      await db.delete(tournamentParticipants).where(eq(tournamentParticipants.tournamentId, id));
      await db.delete(tournaments).where(eq(tournaments.id, id));
    }
    for (const id of insertedPlayerIds) await db.delete(players).where(eq(players.id, id));
  });

  it("only counts matches from the requested tournament, even for a player who played in two", async () => {
    const [p1] = await db.insert(players).values({ name: "__TStandings P1__", duprRating: "4.50" }).returning();
    const [p2] = await db.insert(players).values({ name: "__TStandings P2__", duprRating: "4.00" }).returning();
    const [p3] = await db.insert(players).values({ name: "__TStandings P3__", duprRating: "4.00" }).returning();
    insertedPlayerIds.push(p1.id, p2.id, p3.id);

    const [tournamentA] = await db
      .insert(tournaments)
      .values({ name: "__TStandings Tournament A__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "scheduled" })
      .returning();
    const [tournamentB] = await db
      .insert(tournaments)
      .values({ name: "__TStandings Tournament B__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "scheduled" })
      .returning();
    tournamentIds.push(tournamentA.id, tournamentB.id);

    await db.insert(tournamentParticipants).values([
      { tournamentId: tournamentA.id, playerId: p1.id },
      { tournamentId: tournamentA.id, playerId: p2.id },
      { tournamentId: tournamentB.id, playerId: p1.id },
      { tournamentId: tournamentB.id, playerId: p3.id },
    ]);

    const [matchInA] = await db
      .insert(matches)
      .values({
        tournamentId: tournamentA.id,
        courtNumber: 1,
        roundNumber: 1,
        status: "final",
        side1Score: 11,
        side2Score: 5,
        playedAt: new Date(),
      })
      .returning();
    const [matchInB] = await db
      .insert(matches)
      .values({
        tournamentId: tournamentB.id,
        courtNumber: 1,
        roundNumber: 1,
        status: "final",
        side1Score: 3,
        side2Score: 11,
        playedAt: new Date(),
      })
      .returning();
    matchIds.push(matchInA.id, matchInB.id);

    await db.insert(matchParticipants).values([
      { matchId: matchInA.id, playerId: p1.id, side: 1 }, // p1 wins in A
      { matchId: matchInA.id, playerId: p2.id, side: 2 },
      { matchId: matchInB.id, playerId: p1.id, side: 1 }, // p1 loses in B
      { matchId: matchInB.id, playerId: p3.id, side: 2 },
    ]);

    const standingsA = await getTournamentStandings(tournamentA.id);
    expect(standingsA).toHaveLength(2);
    const p1RowInA = standingsA.find((s) => s.id === p1.id);
    expect(p1RowInA).toMatchObject({ wins: 1, matchesPlayed: 1, winPercentage: 100 });
    const p2Row = standingsA.find((s) => s.id === p2.id);
    expect(p2Row).toMatchObject({ wins: 0, matchesPlayed: 1, winPercentage: 0 });
  });

  it("returns an empty array for a tournament with no participants", async () => {
    const [tournament] = await db
      .insert(tournaments)
      .values({ name: "__TStandings Empty__", numCourts: 1, matchDurationMinutes: 30, matchFormat: "singles", status: "setup" })
      .returning();
    tournamentIds.push(tournament.id);

    const standings = await getTournamentStandings(tournament.id);
    expect(standings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/data/tournamentStandings.test.ts` — expected: FAIL with "getTournamentStandings is not exported" / "Cannot find module".

- [ ] **Step 3: Implement `getTournamentStandings`**

Append to `lib/data/tournamentDetail.ts` (after `getTournamentDetail`):

```ts
import { getPlayerMatchOutcomes } from "@/lib/data/players";
import { computeWins, computeWinPercentage, computeTrend } from "@/lib/stats";
import type { StandingRow } from "@/lib/standings";

export async function getTournamentStandings(tournamentId: string): Promise<StandingRow[]> {
  const participants = await getTournamentParticipants(tournamentId);
  if (participants.length === 0) return [];

  const matchRows = await db.select({ id: matches.id }).from(matches).where(eq(matches.tournamentId, tournamentId));
  const tournamentMatchIds = new Set(matchRows.map((m) => m.id));

  const rows: StandingRow[] = [];
  for (const participant of participants) {
    const allOutcomes = await getPlayerMatchOutcomes(participant.id);
    const outcomes = allOutcomes.filter((o) => tournamentMatchIds.has(o.matchId));
    rows.push({
      id: participant.id,
      name: participant.name,
      duprRating: participant.duprRating,
      wins: computeWins(outcomes),
      matchesPlayed: outcomes.length,
      winPercentage: computeWinPercentage(outcomes),
      trend: computeTrend(outcomes),
    });
  }

  return rows.sort((a, b) => b.wins - a.wins);
}
```

(Add the three new import lines — `getPlayerMatchOutcomes`, the stats functions, and `StandingRow` — to the top of `lib/data/tournamentDetail.ts` alongside the existing imports, not as a separate mid-file import block; the snippet above is split out here only for readability.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/data/tournamentStandings.test.ts` — expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/data/tournamentDetail.ts lib/data/tournamentStandings.test.ts
git commit -m "Add getTournamentStandings for per-tournament leaderboard"
```

---

## Task 3: `endTournament` action and `recordScore` completed-tournament guard

**Files:**
- Modify: `lib/actions/matches.ts`
- Modify: `lib/actions/matches.test.ts`

**Interfaces:**
- Produces: `endTournament(tournamentId: string): Promise<void>` (idempotent — no-op if already `completed`, throws `"Tournament not found"` if the id doesn't exist). `recordScore` now throws `"This tournament has ended — scores can no longer be edited"` if called on a match belonging to a `completed` tournament, before any validation or write. Task 7 (page) imports `endTournament` and binds it into `EndTournamentButton`'s `onEnd` prop.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `lib/actions/matches.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/actions/matches.test.ts` — expected: FAIL — `endTournament` is not exported, and the new "rejects recording a score once the tournament has been completed" test fails because `recordScore` has no such guard yet.

- [ ] **Step 3: Implement the guard and `endTournament`**

Replace the full contents of `lib/actions/matches.ts`:

```ts
"use server";

import { db } from "@/lib/db/client";
import { matches, tournaments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function recordScore(matchId: string, formData: FormData): Promise<void> {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
  if (!match) throw new Error("Match not found");

  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, match.tournamentId));
  if (tournament?.status === "completed") {
    throw new Error("This tournament has ended — scores can no longer be edited");
  }

  const side1Score = Number(formData.get("side1Score"));
  const side2Score = Number(formData.get("side2Score"));

  if (!Number.isInteger(side1Score) || side1Score < 0) {
    throw new Error("Side 1 score must be a non-negative whole number");
  }
  if (!Number.isInteger(side2Score) || side2Score < 0) {
    throw new Error("Side 2 score must be a non-negative whole number");
  }
  if (side1Score === side2Score) {
    throw new Error("Scores cannot be tied");
  }

  await db
    .update(matches)
    .set({ side1Score, side2Score, status: "final", playedAt: new Date() })
    .where(eq(matches.id, matchId));

  const stillScheduled = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.tournamentId, match.tournamentId), eq(matches.status, "scheduled")));

  if (stillScheduled.length === 0) {
    await db.update(tournaments).set({ status: "completed" }).where(eq(tournaments.id, match.tournamentId));
  } else {
    await db
      .update(tournaments)
      .set({ status: "in_progress" })
      .where(and(eq(tournaments.id, match.tournamentId), eq(tournaments.status, "scheduled")));
  }

  safeRevalidatePath(`/tournaments/${match.tournamentId}`);
  safeRevalidatePath("/tournaments");
  safeRevalidatePath("/");
}

export async function endTournament(tournamentId: string): Promise<void> {
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status === "completed") return;

  await db.update(tournaments).set({ status: "completed" }).where(eq(tournaments.id, tournamentId));

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/actions/matches.test.ts` — expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/matches.ts lib/actions/matches.test.ts
git commit -m "Add endTournament action and server-side guard against editing completed tournaments"
```

---

## Task 4: Restyle `MatchScoreForm` — stacked rows and read-only state

**Files:**
- Modify: `components/tournaments/MatchScoreForm.tsx`
- Modify: `components/tournaments/MatchScoreForm.test.tsx`

**Interfaces:**
- Produces: `MatchScoreForm` now takes `{ side1PlayerNames: string[]; side2PlayerNames: string[]; side1Score: number | null; side2Score: number | null; disabled: boolean; onSubmit: (formData: FormData) => Promise<void> }` (was previously `{ side1Score, side2Score, onSubmit }` with names rendered by the caller). Task 7 (page) passes all six props; it no longer renders match names itself.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `components/tournaments/MatchScoreForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MatchScoreForm } from "./MatchScoreForm";

describe("MatchScoreForm", () => {
  it("renders each side's names and score input on its own row, and submits edited values", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MatchScoreForm
        side1PlayerNames={["Alex Sterling"]}
        side2PlayerNames={["Ben Rivera"]}
        side1Score={11}
        side2Score={7}
        disabled={false}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText("Alex Sterling")).toBeInTheDocument();
    expect(screen.getByText("Ben Rivera")).toBeInTheDocument();
    expect(screen.getByLabelText("Side 1 score")).toHaveValue(11);
    fireEvent.change(screen.getByLabelText("Side 2 score"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const formData = onSubmit.mock.calls[0][0] as FormData;
    expect(formData.get("side1Score")).toBe("11");
    expect(formData.get("side2Score")).toBe("9");
  });

  it("shows an error message if onSubmit rejects", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Scores cannot be tied"));
    render(
      <MatchScoreForm
        side1PlayerNames={["Alex Sterling"]}
        side2PlayerNames={["Ben Rivera"]}
        side1Score={null}
        side2Score={null}
        disabled={false}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText("Side 1 score"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Side 2 score"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Scores cannot be tied")).toBeInTheDocument();
  });

  it("renders read-only names and scores with no inputs when disabled", () => {
    const onSubmit = vi.fn();
    render(
      <MatchScoreForm
        side1PlayerNames={["Alex Sterling"]}
        side2PlayerNames={["Ben Rivera"]}
        side1Score={11}
        side2Score={7}
        disabled={true}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText("Alex Sterling")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("Ben Rivera")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.queryByLabelText("Side 1 score")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("shows a dash for an unplayed match when disabled", () => {
    render(
      <MatchScoreForm
        side1PlayerNames={["Alex Sterling"]}
        side2PlayerNames={["Ben Rivera"]}
        side1Score={null}
        side2Score={null}
        disabled={true}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- components/tournaments/MatchScoreForm.test.tsx` — expected: FAIL (component doesn't accept `side1PlayerNames`/`side2PlayerNames`/`disabled` props yet; names aren't rendered, disabled branch doesn't exist).

- [ ] **Step 3: Implement the restyled component**

Replace the full contents of `components/tournaments/MatchScoreForm.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";

export function MatchScoreForm({
  side1PlayerNames,
  side2PlayerNames,
  side1Score,
  side2Score,
  disabled,
  onSubmit,
}: {
  side1PlayerNames: string[];
  side2PlayerNames: string[];
  side1Score: number | null;
  side2Score: number | null;
  disabled: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (disabled) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-body">{side1PlayerNames.join(" & ")}</span>
          <span className="font-mono font-semibold">{side1Score ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-body">{side2PlayerNames.join(" & ")}</span>
          <span className="font-mono font-semibold">{side2Score ?? "—"}</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="font-body">{side1PlayerNames.join(" & ")}</span>
        <input
          name="side1Score"
          type="number"
          min={0}
          defaultValue={side1Score ?? ""}
          aria-label="Side 1 score"
          className="border border-outline-variant rounded px-2 py-1 w-16"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-body">{side2PlayerNames.join(" & ")}</span>
        <input
          name="side2Score"
          type="number"
          min={0}
          defaultValue={side2Score ?? ""}
          aria-label="Side 2 score"
          className="border border-outline-variant rounded px-2 py-1 w-16"
        />
      </div>
      <Button type="submit" variant="secondary">
        Save
      </Button>
      {error && <p className="text-error text-sm">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- components/tournaments/MatchScoreForm.test.tsx` — expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add components/tournaments/MatchScoreForm.tsx components/tournaments/MatchScoreForm.test.tsx
git commit -m "Restyle MatchScoreForm to stacked rows and add a read-only disabled state"
```

---

## Task 5: `EndTournamentButton` component

**Files:**
- Create: `components/tournaments/EndTournamentButton.tsx`
- Test: `components/tournaments/EndTournamentButton.test.tsx`

**Interfaces:**
- Consumes: `Button` from `components/Button.tsx` (pre-existing).
- Produces: `<EndTournamentButton onEnd={() => Promise<void>} />` — confirms via `window.confirm` before calling `onEnd`; shows a loading state while pending and an inline error if `onEnd` rejects. Task 7 (page) passes `endTournament.bind(null, tournament.id)` as `onEnd`.

- [ ] **Step 1: Write the failing tests**

```tsx
// components/tournaments/EndTournamentButton.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EndTournamentButton } from "./EndTournamentButton";

describe("EndTournamentButton", () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, "confirm");
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it("calls onEnd when the user confirms", async () => {
    confirmSpy.mockReturnValue(true);
    const onEnd = vi.fn().mockResolvedValue(undefined);
    render(<EndTournamentButton onEnd={onEnd} />);

    fireEvent.click(screen.getByRole("button", { name: "End Tournament" }));

    await waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
  });

  it("does not call onEnd when the user cancels the confirmation", () => {
    confirmSpy.mockReturnValue(false);
    const onEnd = vi.fn();
    render(<EndTournamentButton onEnd={onEnd} />);

    fireEvent.click(screen.getByRole("button", { name: "End Tournament" }));

    expect(onEnd).not.toHaveBeenCalled();
  });

  it("shows an error message if onEnd rejects", async () => {
    confirmSpy.mockReturnValue(true);
    const onEnd = vi.fn().mockRejectedValue(new Error("Tournament not found"));
    render(<EndTournamentButton onEnd={onEnd} />);

    fireEvent.click(screen.getByRole("button", { name: "End Tournament" }));

    expect(await screen.findByText("Tournament not found")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- components/tournaments/EndTournamentButton.test.tsx` — expected: FAIL with "Cannot find module './EndTournamentButton'".

- [ ] **Step 3: Implement `EndTournamentButton`**

```tsx
// components/tournaments/EndTournamentButton.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

export function EndTournamentButton({ onEnd }: { onEnd: () => Promise<void> }) {
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!window.confirm("End this tournament? Scores will no longer be editable.")) {
      return;
    }
    setError(null);
    setIsEnding(true);
    try {
      await onEnd();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsEnding(false);
    }
  }

  return (
    <div>
      <Button variant="secondary" onClick={handleClick} disabled={isEnding}>
        {isEnding ? "Ending..." : "End Tournament"}
      </Button>
      {error && <p className="text-error text-sm mt-1">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- components/tournaments/EndTournamentButton.test.tsx` — expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add components/tournaments/EndTournamentButton.tsx components/tournaments/EndTournamentButton.test.tsx
git commit -m "Add EndTournamentButton with confirm-then-submit flow"
```

---

## Task 6: `TournamentStandingsTable` component

**Files:**
- Create: `components/tournaments/TournamentStandingsTable.tsx`
- Test: `components/tournaments/TournamentStandingsTable.test.tsx`

**Interfaces:**
- Consumes: `StandingRow` type from `lib/standings.ts`; `Avatar`, `Card` from `components/` (all pre-existing).
- Produces: `<TournamentStandingsTable standings={StandingRow[]} />` — a plain server component (no client interactivity, no sort toggle, no CSV export), rendering rows in the order given. Task 7 (page) passes the result of `getTournamentStandings` (Task 2), already sorted by wins descending.

- [ ] **Step 1: Write the failing tests**

```tsx
// components/tournaments/TournamentStandingsTable.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TournamentStandingsTable } from "./TournamentStandingsTable";
import type { StandingRow } from "@/lib/standings";

describe("TournamentStandingsTable", () => {
  it("renders rows already in the order given, ranked from 1", () => {
    const standings: StandingRow[] = [
      { id: "a", name: "Alex", duprRating: "4.50", wins: 3, matchesPlayed: 3, winPercentage: 100, trend: "up" },
      { id: "b", name: "Bo", duprRating: "4.00", wins: 1, matchesPlayed: 3, winPercentage: 33.3, trend: "down" },
    ];
    render(<TournamentStandingsTable standings={standings} />);

    const rows = screen.getAllByRole("row").slice(1); // skip header row
    expect(rows[0]).toHaveTextContent("01");
    expect(rows[0]).toHaveTextContent("Alex");
    expect(rows[1]).toHaveTextContent("02");
    expect(rows[1]).toHaveTextContent("Bo");
  });

  it("shows a placeholder message when there are no standings", () => {
    render(<TournamentStandingsTable standings={[]} />);
    expect(screen.getByText("No standings yet.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- components/tournaments/TournamentStandingsTable.test.tsx` — expected: FAIL with "Cannot find module './TournamentStandingsTable'".

- [ ] **Step 3: Implement `TournamentStandingsTable`**

```tsx
// components/tournaments/TournamentStandingsTable.tsx
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import type { StandingRow } from "@/lib/standings";

export function TournamentStandingsTable({ standings }: { standings: StandingRow[] }) {
  if (standings.length === 0) {
    return <p className="text-on-surface-variant">No standings yet.</p>;
  }

  return (
    <Card className="p-0">
      <table className="w-full">
        <thead>
          <tr className="text-left font-mono text-xs text-on-surface-variant uppercase border-b border-surface-container-high">
            <th className="p-4">Rank</th>
            <th className="p-4">Player</th>
            <th className="p-4">Wins</th>
            <th className="p-4">Win %</th>
            <th className="p-4">Matches</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => (
            <tr key={row.id} className="border-b border-surface-container-high last:border-0">
              <td className="p-4 font-mono">{String(i + 1).padStart(2, "0")}</td>
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <Avatar name={row.name} size="sm" />
                  {row.name}
                </div>
              </td>
              <td className="p-4">{row.wins}</td>
              <td className="p-4">{row.winPercentage}%</td>
              <td className="p-4">{row.matchesPlayed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- components/tournaments/TournamentStandingsTable.test.tsx` — expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add components/tournaments/TournamentStandingsTable.tsx components/tournaments/TournamentStandingsTable.test.tsx
git commit -m "Add read-only TournamentStandingsTable component"
```

---

## Task 7: Wire everything into the Tournament Detail page

**Files:**
- Modify: `app/tournaments/[id]/page.tsx`

**Interfaces:**
- Consumes: `getTournamentDetail`, `getTournamentStandings` (Tasks 1-2); `recordScore`, `endTournament` (Task 3); `MatchScoreForm` (Task 4); `EndTournamentButton` (Task 5); `TournamentStandingsTable` (Task 6); `Card`, `Badge` (pre-existing).
- Produces: the complete, wired page. No further tasks depend on this one.

- [ ] **Step 1: Replace the page**

Replace the full contents of `app/tournaments/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getTournamentDetail, getTournamentStandings, type MatchDetail } from "@/lib/data/tournamentDetail";
import { recordScore, endTournament } from "@/lib/actions/matches";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { MatchScoreForm } from "@/components/tournaments/MatchScoreForm";
import { EndTournamentButton } from "@/components/tournaments/EndTournamentButton";
import { TournamentStandingsTable } from "@/components/tournaments/TournamentStandingsTable";

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tournament, standings] = await Promise.all([getTournamentDetail(id), getTournamentStandings(id)]);
  if (!tournament) notFound();

  const rounds = new Map<number, MatchDetail[]>();
  for (const match of tournament.matches) {
    const list = rounds.get(match.roundNumber) ?? [];
    list.push(match);
    rounds.set(match.roundNumber, list);
  }

  const byesByRound = new Map(tournament.byes.map((b) => [b.roundNumber, b.playerNames]));
  const isCompleted = tournament.status === "completed";

  return (
    <main className="max-w-container-max mx-auto px-gutter py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold">{tournament.name}</h1>
        <div className="flex items-center gap-3">
          <Badge>{tournament.status.replace("_", " ")}</Badge>
          {!isCompleted && <EndTournamentButton onEnd={endTournament.bind(null, tournament.id)} />}
        </div>
      </div>

      {[...rounds.entries()].map(([roundNumber, roundMatches]) => (
        <Card key={roundNumber} className="p-0 divide-y divide-surface-container-high">
          <h2 className="font-headline text-lg font-semibold p-4">Round {roundNumber}</h2>
          {roundMatches.map((match) => (
            <div key={match.id} className="p-4">
              <p className="font-mono text-xs text-on-surface-variant uppercase mb-2">Court {match.courtNumber}</p>
              <MatchScoreForm
                side1PlayerNames={match.side1PlayerNames}
                side2PlayerNames={match.side2PlayerNames}
                side1Score={match.side1Score}
                side2Score={match.side2Score}
                disabled={isCompleted}
                onSubmit={recordScore.bind(null, match.id)}
              />
            </div>
          ))}
          {byesByRound.has(roundNumber) && (
            <p className="p-4 font-body text-sm text-on-surface-variant">
              Bye: {byesByRound.get(roundNumber)!.join(", ")}
            </p>
          )}
        </Card>
      ))}

      <div>
        <h2 className="font-headline text-lg font-semibold mb-4">Tournament Standings</h2>
        <TournamentStandingsTable standings={standings} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npm run test` — expected: every test across this plan's 6 prior tasks and every pre-existing test still passes, with no regressions.

- [ ] **Step 3: Run a production build**

Run: `npm run build` — expected: succeeds with no type errors (the page's props/types must line up with the restyled `MatchScoreForm` and the new `getTournamentDetail`/`getTournamentStandings` shapes).

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`.

1. Open an existing tournament with at least one match (from prior manual testing/seed data) at `/tournaments/[id]` — confirm each match now shows side 1's name+score on one row and side 2's name+score on the row below it (not side-by-side), and confirm the new "Tournament Standings" card at the bottom shows a plain rank/player/wins/win%/matches table for just this tournament's participants.
2. Create a **new singles** tournament via `/tournaments/new` with an **odd** number of participants (e.g. 3) — land on its detail page and confirm each round shows a "Bye: [name]" line for whichever participant has no match that round, rotating to a different participant each round.
3. On a tournament that still has unplayed matches, click "End Tournament", confirm the browser's confirm dialog appears, cancel it once (confirm nothing changes), then click again and accept — confirm the status badge changes to "completed", the End Tournament button disappears, and every match on the page (played and unplayed) now shows read-only names/scores with no input fields or Save buttons.
4. Attempt to visit that same tournament's detail page again after a hard refresh — confirm the read-only state persists (this is driven by the DB status, not just local component state).

Stop the dev server with Ctrl+C once every step above is confirmed.

- [ ] **Step 5: Commit**

```bash
git add "app/tournaments/[id]/page.tsx"
git commit -m "Wire byes, end tournament, read-only completed state, and per-tournament leaderboard into Tournament Detail"
```
