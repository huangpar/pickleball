# Hybrid Doubles Team Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third doubles `teamMode`, `"hybrid"`, where some players are locked into a fixed partnership for the whole tournament while everyone else rotates partners round to round, with fixed pairs always playing and byeing together as a unit.

**Architecture:** Extract the pairing/bye/grouping helpers already in `rotatingDoubles.ts` into a shared `pairingHelpers.ts` module, then build `hybridDoubles.ts` on top of them with one new concept — a team-level bye when the combined count of fixed pairs + ad-hoc rotating pairs is odd. Wire the new mode through the existing preview/setup-form/server-action pipeline that already supports `fixed` and `rotating`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle ORM + Neon Postgres, Vitest + Testing Library.

## Global Constraints

- `tournaments.teamMode` is a plain Postgres `text` column (not a real enum type) — adding `"hybrid"` to the TypeScript union in `schema.ts` requires no SQL migration, no `drizzle-kit push`.
- Fixed-pair players are always excluded from the rotating partner-coverage guarantee — they only ever partner their locked partner.
- A fixed pair always plays together and always sits out together; never split.
- Follow the existing seeded-RNG test convention (`mulberry32(seed)`) used in `rotatingDoubles.test.ts` and `fixedDoubles.test.ts`.

---

### Task 1: Extract shared pairing helpers

**Files:**
- Create: `lib/scheduling/pairingHelpers.ts`
- Modify: `lib/scheduling/rotatingDoubles.ts`
- Test: `lib/scheduling/rotatingDoubles.test.ts` (no changes — existing suite is the regression check)

**Interfaces:**
- Produces (for Task 2 to consume):
  - `export function pairKey(a: string, b: string): string`
  - `export function shuffle<T>(items: T[], rng: () => number): T[]`
  - `export function selectSitOutPlayers(playerIds: string[], sitOutCount: number, byeCounts: Map<string, number>, rng: () => number): Set<string>`
  - `export function pairUpByPartnerCoverage(playerIds: string[], partnerCounts: Map<string, number>, rng: () => number): [string, string][]`
  - `export function formGroupsFromPairs(pairs: [string, string][], opponentCounts: Map<string, number>, rng: () => number): { side1: string[]; side2: string[] }[]`

This is a pure refactor (move code, add `export`, update the one import site). No behavior changes, so there's no new failing test to write — the existing `rotatingDoubles.test.ts` suite (11 tests) is the safety net: it must pass unchanged before and after.

- [ ] **Step 1: Run the existing rotatingDoubles test suite to confirm the starting baseline**

Run: `npx vitest run lib/scheduling/rotatingDoubles.test.ts`
Expected: All 11 tests PASS (this is the baseline you must not break).

- [ ] **Step 2: Create `lib/scheduling/pairingHelpers.ts` with the five helpers moved out of `rotatingDoubles.ts`, each given an `export` keyword**

```ts
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function selectSitOutPlayers(
  playerIds: string[],
  sitOutCount: number,
  byeCounts: Map<string, number>,
  rng: () => number
): Set<string> {
  if (sitOutCount === 0) return new Set();

  const shuffled = shuffle(playerIds, rng); // randomizes tie-break order
  const sortedByFewestByes = [...shuffled].sort(
    (a, b) => (byeCounts.get(a) ?? 0) - (byeCounts.get(b) ?? 0)
  );
  return new Set(sortedByFewestByes.slice(0, sitOutCount));
}

export function pairUpByPartnerCoverage(
  playerIds: string[],
  partnerCounts: Map<string, number>,
  rng: () => number
): [string, string][] {
  const candidates: { a: string; b: string; score: number }[] = [];
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const a = playerIds[i];
      const b = playerIds[j];
      candidates.push({ a, b, score: partnerCounts.get(pairKey(a, b)) ?? 0 });
    }
  }

  const shuffled = shuffle(candidates, rng); // randomizes tie-break order
  const sorted = [...shuffled].sort((x, y) => x.score - y.score);

  const paired = new Set<string>();
  const pairs: [string, string][] = [];
  for (const { a, b } of sorted) {
    if (paired.has(a) || paired.has(b)) continue;
    pairs.push([a, b]);
    paired.add(a);
    paired.add(b);
  }

  return pairs;
}

export function formGroupsFromPairs(
  pairs: [string, string][],
  opponentCounts: Map<string, number>,
  rng: () => number
): { side1: string[]; side2: string[] }[] {
  const remaining = shuffle(pairs, rng); // randomizes matchup order/tie-break
  const used = new Array(remaining.length).fill(false);
  const groups: { side1: string[]; side2: string[] }[] = [];

  for (let i = 0; i < remaining.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const side1 = remaining[i];

    let bestScore = Infinity;
    let bestIndices: number[] = [];
    for (let j = i + 1; j < remaining.length; j++) {
      if (used[j]) continue;
      const side2 = remaining[j];
      let score = 0;
      side1.forEach((p1) => side2.forEach((p2) => (score += opponentCounts.get(pairKey(p1, p2)) ?? 0)));
      if (score < bestScore) {
        bestScore = score;
        bestIndices = [j];
      } else if (score === bestScore) {
        bestIndices.push(j);
      }
    }

    if (bestIndices.length === 0) break; // no partner left to group with (shouldn't happen: pairs count is always even)
    const chosenJ = bestIndices[Math.floor(rng() * bestIndices.length)];
    used[chosenJ] = true;
    groups.push({ side1, side2: remaining[chosenJ] });
  }

  return groups;
}
```

- [ ] **Step 3: Replace the moved code in `rotatingDoubles.ts` with an import, leaving `generateRotatingDoublesSchedule` untouched**

`lib/scheduling/rotatingDoubles.ts` becomes:

```ts
import { pairKey, selectSitOutPlayers, pairUpByPartnerCoverage, formGroupsFromPairs } from "./pairingHelpers";
import type { ScheduledMatch } from "./types";

export function generateRotatingDoublesSchedule(
  playerIds: string[],
  numCourts: number,
  numRounds: number,
  rng: () => number = Math.random
): ScheduledMatch[] {
  const partnerCounts = new Map<string, number>();
  const opponentCounts = new Map<string, number>();
  const byeCounts = new Map<string, number>();
  const schedule: ScheduledMatch[] = [];
  const sitOutCount = playerIds.length % 4;

  for (let round = 1; round <= numRounds; round++) {
    const sitOutIds = selectSitOutPlayers(playerIds, sitOutCount, byeCounts, rng);
    sitOutIds.forEach((id) => byeCounts.set(id, (byeCounts.get(id) ?? 0) + 1));

    const playingIds = playerIds.filter((id) => !sitOutIds.has(id));
    const pairs = pairUpByPartnerCoverage(playingIds, partnerCounts, rng);
    const groups = formGroupsFromPairs(pairs, opponentCounts, rng);

    groups.forEach(({ side1, side2 }, matchIndex) => {
      const partnerK1 = pairKey(side1[0], side1[1]);
      partnerCounts.set(partnerK1, (partnerCounts.get(partnerK1) ?? 0) + 1);
      const partnerK2 = pairKey(side2[0], side2[1]);
      partnerCounts.set(partnerK2, (partnerCounts.get(partnerK2) ?? 0) + 1);
      side1.forEach((p1) =>
        side2.forEach((p2) => {
          const k = pairKey(p1, p2);
          opponentCounts.set(k, (opponentCounts.get(k) ?? 0) + 1);
        })
      );

      const allPlayers = [...side1, ...side2];
      schedule.push({
        roundNumber: round,
        courtNumber: (matchIndex % numCourts) + 1,
        side1PlayerIds: side1,
        side2PlayerIds: side2,
        firstServerId: allPlayers[Math.floor(rng() * allPlayers.length)],
      });
    });
  }

  return schedule;
}
```

- [ ] **Step 4: Run the existing rotatingDoubles test suite again to confirm nothing broke**

Run: `npx vitest run lib/scheduling/rotatingDoubles.test.ts`
Expected: All 11 tests PASS, identical to Step 1's baseline.

- [ ] **Step 5: Run the full suite and typecheck as a final sanity check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All tests PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/scheduling/pairingHelpers.ts lib/scheduling/rotatingDoubles.ts
git commit -m "Extract shared pairing helpers from rotatingDoubles into pairingHelpers"
```

---

### Task 2: Hybrid doubles scheduling algorithm

**Files:**
- Create: `lib/scheduling/hybridDoubles.ts`
- Test: `lib/scheduling/hybridDoubles.test.ts`

**Interfaces:**
- Consumes (from Task 1): `pairKey`, `shuffle`, `selectSitOutPlayers`, `pairUpByPartnerCoverage`, `formGroupsFromPairs` from `./pairingHelpers`; `ScheduledMatch` from `./types`.
- Produces (for Task 4 to consume): `export function generateHybridDoublesSchedule(fixedPairs: [string, string][], rotatingPlayerIds: string[], numCourts: number, numRounds: number, rng: () => number = Math.random): ScheduledMatch[]`

- [ ] **Step 1: Write the failing tests**

Create `lib/scheduling/hybridDoubles.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateHybridDoublesSchedule } from "./hybridDoubles";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function countByesByPlayer(
  schedule: ReturnType<typeof generateHybridDoublesSchedule>,
  players: string[],
  numRounds: number
) {
  const byeCounts = new Map<string, number>();
  for (const id of players) byeCounts.set(id, 0);

  for (let round = 1; round <= numRounds; round++) {
    const roundMatches = schedule.filter((m) => m.roundNumber === round);
    const playing = new Set(roundMatches.flatMap((m) => [...m.side1PlayerIds, ...m.side2PlayerIds]));
    for (const id of players) {
      if (!playing.has(id)) byeCounts.set(id, (byeCounts.get(id) ?? 0) + 1);
    }
  }

  return byeCounts;
}

describe("generateHybridDoublesSchedule", () => {
  const fixedPairs: [string, string][] = [
    ["f1", "f2"],
    ["f3", "f4"],
  ];
  const rotatingPlayerIds = ["r1", "r2", "r3", "r4"];

  it("keeps every fixed pair together as a side, never split or mixed with another player", () => {
    const schedule = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, 2, 6, mulberry32(1));

    fixedPairs.forEach(([a, b]) => {
      schedule.forEach((m) => {
        if (m.side1PlayerIds.includes(a) || m.side1PlayerIds.includes(b)) {
          expect(m.side1PlayerIds.sort()).toEqual([a, b].sort());
        }
        if (m.side2PlayerIds.includes(a) || m.side2PlayerIds.includes(b)) {
          expect(m.side2PlayerIds.sort()).toEqual([a, b].sort());
        }
      });
    });
  });

  it("never plays one fixed-pair member without the other in the same round", () => {
    const schedule = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, 2, 6, mulberry32(2));

    for (let round = 1; round <= 6; round++) {
      const playing = new Set(
        schedule.filter((m) => m.roundNumber === round).flatMap((m) => [...m.side1PlayerIds, ...m.side2PlayerIds])
      );
      fixedPairs.forEach(([a, b]) => {
        expect(playing.has(a)).toBe(playing.has(b));
      });
    }
  });

  it("gives every fixed-pair player exactly one partner: their locked partner, never anyone else", () => {
    const schedule = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, 2, 6, mulberry32(3));

    fixedPairs.forEach(([a, b]) => {
      const partnersOfA = new Set<string>();
      schedule.forEach((m) => {
        if (m.side1PlayerIds.includes(a)) m.side1PlayerIds.forEach((p) => p !== a && partnersOfA.add(p));
        if (m.side2PlayerIds.includes(a)) m.side2PlayerIds.forEach((p) => p !== a && partnersOfA.add(p));
      });
      expect(partnersOfA).toEqual(new Set([b]));
    });
  });

  it("achieves full partner coverage among rotating-pool players given enough rounds", () => {
    const numRounds = 12; // generous margin for 4 rotating players (3 possible pairs need covering... C(4,2)=6)
    const schedule = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, 2, numRounds, mulberry32(11));

    const rotatingPartneredPairs = new Set<string>();
    schedule.forEach((m) => {
      [m.side1PlayerIds, m.side2PlayerIds].forEach((side) => {
        if (side.every((p) => rotatingPlayerIds.includes(p))) {
          rotatingPartneredPairs.add([...side].sort().join("|"));
        }
      });
    });

    const allPossibleRotatingPairs = new Set<string>();
    for (let i = 0; i < rotatingPlayerIds.length; i++) {
      for (let j = i + 1; j < rotatingPlayerIds.length; j++) {
        allPossibleRotatingPairs.add([rotatingPlayerIds[i], rotatingPlayerIds[j]].sort().join("|"));
      }
    }

    expect(rotatingPartneredPairs.size).toBe(allPossibleRotatingPairs.size);
  });

  it("keeps bye counts reasonably balanced across all players when the team count is often odd", () => {
    // 1 fixed pair + 4 rotating players (2 rotating pairs) = 3 teams per round (odd) -> 1 team byes each round
    const oneFixedPair: [string, string][] = [["f1", "f2"]];
    const numRounds = 6;
    const schedule = generateHybridDoublesSchedule(oneFixedPair, rotatingPlayerIds, 2, numRounds, mulberry32(5));

    const allPlayers = ["f1", "f2", ...rotatingPlayerIds];
    const byeCounts = countByesByPlayer(schedule, allPlayers, numRounds);
    const counts = [...byeCounts.values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  });

  it("produces valid matches with exactly 2 players per side and no double-booking within a round", () => {
    const schedule = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, 2, 4, mulberry32(6));

    schedule.forEach((m) => {
      expect(m.side1PlayerIds).toHaveLength(2);
      expect(m.side2PlayerIds).toHaveLength(2);
    });

    for (let round = 1; round <= 4; round++) {
      const roundMatches = schedule.filter((m) => m.roundNumber === round);
      const playersThisRound = roundMatches.flatMap((m) => [...m.side1PlayerIds, ...m.side2PlayerIds]);
      expect(new Set(playersThisRound).size).toBe(playersThisRound.length);
    }
  });

  it("assigns firstServerId as one of the match's own 4 participants", () => {
    const schedule = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, 2, 4, mulberry32(6));
    schedule.forEach((m) => {
      const participants = [...m.side1PlayerIds, ...m.side2PlayerIds];
      expect(participants).toContain(m.firstServerId);
    });
  });

  it("is deterministic given the same seed", () => {
    const a = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, 2, 4, mulberry32(99));
    const b = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, 2, 4, mulberry32(99));
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run the test file to verify it fails**

Run: `npx vitest run lib/scheduling/hybridDoubles.test.ts`
Expected: FAIL — `Cannot find module './hybridDoubles'` (file doesn't exist yet).

- [ ] **Step 3: Implement `lib/scheduling/hybridDoubles.ts`**

```ts
import { pairKey, shuffle, selectSitOutPlayers, pairUpByPartnerCoverage, formGroupsFromPairs } from "./pairingHelpers";
import type { ScheduledMatch } from "./types";

function selectByeTeam(
  teams: [string, string][],
  byeCounts: Map<string, number>,
  rng: () => number
): { remaining: [string, string][]; byeTeam: [string, string] | null } {
  if (teams.length % 2 === 0) return { remaining: teams, byeTeam: null };

  const shuffled = shuffle(teams, rng); // randomizes tie-break order
  const sorted = [...shuffled].sort((a, b) => {
    const costA = (byeCounts.get(a[0]) ?? 0) + (byeCounts.get(a[1]) ?? 0);
    const costB = (byeCounts.get(b[0]) ?? 0) + (byeCounts.get(b[1]) ?? 0);
    return costA - costB;
  });

  const [byeTeam, ...remaining] = sorted;
  return { remaining, byeTeam };
}

export function generateHybridDoublesSchedule(
  fixedPairs: [string, string][],
  rotatingPlayerIds: string[],
  numCourts: number,
  numRounds: number,
  rng: () => number = Math.random
): ScheduledMatch[] {
  const partnerCounts = new Map<string, number>();
  const opponentCounts = new Map<string, number>();
  const byeCounts = new Map<string, number>();
  const schedule: ScheduledMatch[] = [];
  const sitOutCount = rotatingPlayerIds.length % 2;

  for (let round = 1; round <= numRounds; round++) {
    const sitOutIds = selectSitOutPlayers(rotatingPlayerIds, sitOutCount, byeCounts, rng);
    sitOutIds.forEach((id) => byeCounts.set(id, (byeCounts.get(id) ?? 0) + 1));

    const playingRotatingIds = rotatingPlayerIds.filter((id) => !sitOutIds.has(id));
    const rotatingPairs = pairUpByPartnerCoverage(playingRotatingIds, partnerCounts, rng);

    const allTeams: [string, string][] = [...fixedPairs, ...rotatingPairs];
    const { remaining: teamsThisRound, byeTeam } = selectByeTeam(allTeams, byeCounts, rng);
    if (byeTeam) {
      byeCounts.set(byeTeam[0], (byeCounts.get(byeTeam[0]) ?? 0) + 1);
      byeCounts.set(byeTeam[1], (byeCounts.get(byeTeam[1]) ?? 0) + 1);
    }

    const groups = formGroupsFromPairs(teamsThisRound, opponentCounts, rng);

    groups.forEach(({ side1, side2 }, matchIndex) => {
      const partnerK1 = pairKey(side1[0], side1[1]);
      partnerCounts.set(partnerK1, (partnerCounts.get(partnerK1) ?? 0) + 1);
      const partnerK2 = pairKey(side2[0], side2[1]);
      partnerCounts.set(partnerK2, (partnerCounts.get(partnerK2) ?? 0) + 1);
      side1.forEach((p1) =>
        side2.forEach((p2) => {
          const k = pairKey(p1, p2);
          opponentCounts.set(k, (opponentCounts.get(k) ?? 0) + 1);
        })
      );

      const allPlayers = [...side1, ...side2];
      schedule.push({
        roundNumber: round,
        courtNumber: (matchIndex % numCourts) + 1,
        side1PlayerIds: side1,
        side2PlayerIds: side2,
        firstServerId: allPlayers[Math.floor(rng() * allPlayers.length)],
      });
    });
  }

  return schedule;
}
```

- [ ] **Step 4: Run the test file to verify it passes**

Run: `npx vitest run lib/scheduling/hybridDoubles.test.ts`
Expected: All 8 tests PASS.

If a specific test fails due to seed-dependent randomness (e.g. the coverage test doesn't quite achieve full coverage, or the bye-balance test exceeds the tolerance), that is expected to be seed-sensitive — try adjacent seed values (e.g. 12, 13, 14...) for that specific test only, and add a one-line comment explaining why that seed was chosen, following the precedent already set in `rotatingDoubles.test.ts` (see the comment on the "forms zero repeat partnerships..." test). Do not weaken the assertion itself to make a bad seed pass.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All tests PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/scheduling/hybridDoubles.ts lib/scheduling/hybridDoubles.test.ts
git commit -m "Add hybrid doubles scheduling algorithm"
```

---

### Task 3: Hybrid doubles match-count preview

**Files:**
- Modify: `lib/scheduling/preview.ts`
- Test: `lib/scheduling/preview.test.ts`

**Interfaces:**
- Produces (for Task 5 to consume): `export function computeHybridDoublesPreview(fixedPairCount: number, rotatingPlayerCount: number, numCourts: number, matchDurationMinutes: number, numRounds: number): { totalMatches: number; estimatedMinutes: number }`

- [ ] **Step 1: Write the failing test**

Append to `lib/scheduling/preview.test.ts`:

```ts
describe("computeHybridDoublesPreview", () => {
  it("computes total matches from fixed pairs plus rotating pairs, times rounds", () => {
    // 2 fixed pairs + 4 rotating players (2 rotating pairs) = 4 teams/round -> 2 matches/round
    const result = computeHybridDoublesPreview(2, 4, 2, 30, 5);
    expect(result.totalMatches).toBe(10); // 2 matches/round * 5 rounds
    expect(result.estimatedMinutes).toBe(150); // ceil(10/2) * 30
  });

  it("accounts for an odd rotating player leaving one rotating player unpaired that round", () => {
    // 1 fixed pair + 3 rotating players (floor(3/2)=1 rotating pair) = 2 teams/round -> 1 match/round
    const result = computeHybridDoublesPreview(1, 3, 2, 30, 4);
    expect(result.totalMatches).toBe(4); // 1 match/round * 4 rounds
  });
});
```

Add `computeHybridDoublesPreview` to the existing import at the top of the file:

```ts
import {
  computeSinglesPreview,
  computeFixedDoublesPreview,
  computeRotatingDoublesPreview,
  computeHybridDoublesPreview,
} from "./preview";
```

- [ ] **Step 2: Run the test file to verify it fails**

Run: `npx vitest run lib/scheduling/preview.test.ts`
Expected: FAIL — `computeHybridDoublesPreview is not a function` (or import error).

- [ ] **Step 3: Add the function to `lib/scheduling/preview.ts`**

Append:

```ts
export function computeHybridDoublesPreview(
  fixedPairCount: number,
  rotatingPlayerCount: number,
  numCourts: number,
  matchDurationMinutes: number,
  numRounds: number
) {
  const totalTeams = fixedPairCount + Math.floor(rotatingPlayerCount / 2);
  const matchesPerRound = Math.floor(totalTeams / 2);
  const totalMatches = matchesPerRound * numRounds;
  return { totalMatches, estimatedMinutes: estimateMinutes(totalMatches, numCourts, matchDurationMinutes) };
}
```

- [ ] **Step 4: Run the test file to verify it passes**

Run: `npx vitest run lib/scheduling/preview.test.ts`
Expected: All tests PASS (2 new + 4 existing = 6 total).

- [ ] **Step 5: Commit**

```bash
git add lib/scheduling/preview.ts lib/scheduling/preview.test.ts
git commit -m "Add hybrid doubles match-count preview calculation"
```

---

### Task 4: Wire hybrid mode through schema and `generateBracket`

**Files:**
- Modify: `lib/db/schema.ts:15`
- Modify: `lib/actions/tournaments.ts`
- Test: `lib/actions/tournaments.test.ts`

**Interfaces:**
- Consumes (from Task 2): `generateHybridDoublesSchedule` from `@/lib/scheduling/hybridDoubles`.
- Consumes: existing `ScheduledMatch` type, existing `generateBracket(formData: FormData): Promise<string>` signature (unchanged).

No database migration needed — `team_mode` is a plain `text` column; the `{ enum: [...] }` array is a TypeScript-only compile-time check (confirmed by inspecting `drizzle/0000_majestic_prodigy.sql`, which defines `"team_mode" text` with no `CREATE TYPE`).

- [ ] **Step 1: Write the failing test**

Append to `lib/actions/tournaments.test.ts`, inside the `describe("generateBracket", ...)` block (after the existing "creates a fixed-team doubles tournament..." test):

```ts
  it("creates a hybrid doubles tournament from fixed pairs plus a rotating pool", async () => {
    const ids = await insertTestPlayers(6); // 2 fixed-pair players + 4 rotating players

    const formData = new FormData();
    formData.set("name", "__Bracket Hybrid Tournament__");
    formData.set("numCourts", "2");
    formData.set("matchDurationMinutes", "30");
    formData.set("matchFormat", "doubles");
    formData.set("teamMode", "hybrid");
    formData.set("numRounds", "3");
    ids.forEach((id) => formData.append("participantIds", id));
    formData.append("fixedPairs", `${ids[0]},${ids[1]}`);

    const tournamentId = await generateBracket(formData);
    createdTournamentIds.push(tournamentId);

    const [tournamentRow] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
    expect(tournamentRow.teamMode).toBe("hybrid");
    expect(tournamentRow.numRounds).toBe(3);

    const matchRows = await db.select().from(matches).where(eq(matches.tournamentId, tournamentId));
    expect(matchRows.length).toBeGreaterThan(0);
    expect(new Set(matchRows.map((m) => m.roundNumber)).size).toBeLessThanOrEqual(3);
  });
```

- [ ] **Step 2: Run the test file to verify it fails**

Run: `npx vitest run lib/actions/tournaments.test.ts`
Expected: FAIL — `Invalid team mode` (thrown by the current `generateBracket`, which only accepts `"fixed"` / `"rotating"`).

- [ ] **Step 3: Update `lib/db/schema.ts:15`**

```ts
  teamMode: text("team_mode", { enum: ["fixed", "rotating", "hybrid"] }),
```

- [ ] **Step 4: Update `lib/actions/tournaments.ts`**

Add the import:

```ts
import { generateHybridDoublesSchedule } from "@/lib/scheduling/hybridDoubles";
```

Update the type and branching inside `generateBracket`:

```ts
  let schedule: ScheduledMatch[];
  let teamMode: "fixed" | "rotating" | "hybrid" | null = null;
  let numRounds: number | null = null;

  if (matchFormat === "singles") {
    schedule = generateSinglesSchedule(participantIds, numCourts);
  } else {
    teamMode = String(formData.get("teamMode")) as "fixed" | "rotating" | "hybrid";
    if (teamMode !== "fixed" && teamMode !== "rotating" && teamMode !== "hybrid") {
      throw new Error("Invalid team mode");
    }

    if (teamMode === "fixed") {
      const teamStrings = formData.getAll("fixedTeams").map(String);
      if (teamStrings.length === 0) throw new Error("At least one team is required");
      const teams: [string, string][] = teamStrings.map((t) => {
        const [a, b] = t.split(",");
        return [a, b];
      });
      schedule = generateFixedDoublesSchedule(teams, numCourts);
    } else if (teamMode === "rotating") {
      numRounds = Number(formData.get("numRounds"));
      if (!Number.isInteger(numRounds) || numRounds < 1) throw new Error("Number of rounds must be at least 1");
      schedule = generateRotatingDoublesSchedule(participantIds, numCourts, numRounds);
    } else {
      numRounds = Number(formData.get("numRounds"));
      if (!Number.isInteger(numRounds) || numRounds < 1) throw new Error("Number of rounds must be at least 1");
      const pairStrings = formData.getAll("fixedPairs").map(String);
      const fixedPairs: [string, string][] = pairStrings.map((t) => {
        const [a, b] = t.split(",");
        return [a, b];
      });
      const fixedPairPlayerIds = new Set(fixedPairs.flat());
      const rotatingPlayerIds = participantIds.filter((id) => !fixedPairPlayerIds.has(id));
      schedule = generateHybridDoublesSchedule(fixedPairs, rotatingPlayerIds, numCourts, numRounds);
    }
  }
```

- [ ] **Step 5: Run the test file to verify it passes**

Run: `npx vitest run lib/actions/tournaments.test.ts`
Expected: All tests PASS (1 new + 9 existing = 10 total).

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All tests PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add lib/db/schema.ts lib/actions/tournaments.ts lib/actions/tournaments.test.ts
git commit -m "Wire hybrid doubles team mode through generateBracket"
```

---

### Task 5: Hybrid mode setup UI

**Files:**
- Modify: `components/tournaments/ParticipantPicker.tsx`
- Modify: `components/tournaments/RoundRobinSetupForm.tsx`
- Test: `components/tournaments/ParticipantPicker.test.tsx`
- Test: `components/tournaments/RoundRobinSetupForm.test.tsx`

**Interfaces:**
- Consumes (from Task 3): `computeHybridDoublesPreview` from `@/lib/scheduling/preview`.
- `ParticipantPicker` gains an optional prop so its existing default behavior (and existing tests) are unaffected when the prop is omitted:
  ```ts
  pairLocking?: {
    lockedPairs: [string, string][];
    armedId: string | null;
    onPairClick: (id: string) => void;
  }
  ```

- [ ] **Step 1: Write the failing `ParticipantPicker` test**

Append to `components/tournaments/ParticipantPicker.test.tsx`:

```ts
  it("routes clicks on selected players to onPairClick instead of onToggle when pairLocking is active", () => {
    const onToggle = vi.fn();
    const onPairClick = vi.fn();
    const players = [
      { id: "1", name: "Alex Sterling" },
      { id: "2", name: "Ben Rivera" },
    ];
    render(
      <ParticipantPicker
        availablePlayers={players}
        selectedIds={["1"]}
        onToggle={onToggle}
        onPlayerAdded={vi.fn()}
        onCreatePlayer={vi.fn()}
        pairLocking={{ lockedPairs: [], armedId: null, onPairClick }}
      />
    );

    fireEvent.click(screen.getByLabelText("Alex Sterling")); // already selected -> pair click
    expect(onPairClick).toHaveBeenCalledWith("1");
    expect(onToggle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Ben Rivera")); // not yet selected -> normal toggle
    expect(onToggle).toHaveBeenCalledWith("2");
  });
```

Update the test file's imports to include `fireEvent`:

```ts
import { render, screen, fireEvent } from "@testing-library/react";
```

- [ ] **Step 2: Run the test file to verify it fails**

Run: `npx vitest run components/tournaments/ParticipantPicker.test.tsx`
Expected: FAIL — clicking calls `onToggle` regardless (current behavior has no `pairLocking` prop).

- [ ] **Step 3: Implement the change in `components/tournaments/ParticipantPicker.tsx`**

Replace the full file contents:

```tsx
"use client";

import { useState } from "react";
import { AddPlayerForm } from "@/components/players/AddPlayerForm";
import type { PlayerRow } from "@/lib/data/players";

export function ParticipantPicker({
  availablePlayers,
  selectedIds,
  onToggle,
  onPlayerAdded,
  onCreatePlayer,
  pairLocking,
}: {
  availablePlayers: PlayerRow[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onPlayerAdded: (player: PlayerRow) => void;
  onCreatePlayer: (formData: FormData) => Promise<PlayerRow>;
  pairLocking?: {
    lockedPairs: [string, string][];
    armedId: string | null;
    onPairClick: (id: string) => void;
  };
}) {
  const [filter, setFilter] = useState("");
  const filtered = availablePlayers.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));

  async function handleCreate(formData: FormData) {
    const player = await onCreatePlayer(formData);
    onPlayerAdded(player);
    onToggle(player.id);
  }

  function handleRowClick(id: string, isSelected: boolean) {
    if (pairLocking && isSelected) {
      pairLocking.onPairClick(id);
    } else {
      onToggle(id);
    }
  }

  return (
    <div className="space-y-4">
      <input
        placeholder="Filter by name..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="border border-outline-variant rounded px-3 py-2 w-full"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
        {filtered.map((player) => {
          const isSelected = selectedIds.includes(player.id);
          const isLocked = pairLocking?.lockedPairs.some((pair) => pair.includes(player.id)) ?? false;
          const isArmed = pairLocking?.armedId === player.id;
          return (
            <label
              key={player.id}
              className={`flex items-center justify-between border rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                isLocked
                  ? "bg-primary-container border-primary-container text-on-primary-container font-medium"
                  : isSelected
                    ? `bg-secondary-container border-secondary-container text-on-secondary-container font-medium ${isArmed ? "ring-2 ring-primary" : ""}`
                    : "bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={isSelected}
                onChange={() => handleRowClick(player.id, isSelected)}
                aria-label={player.name}
              />
              <span className="font-body">
                {player.name}
              </span>
            </label>
          );
        })}
      </div>
      <div>
        <h3 className="font-headline text-sm font-semibold mb-2">Add a new player</h3>
        <AddPlayerForm onSubmit={handleCreate} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test file to verify it passes**

Run: `npx vitest run components/tournaments/ParticipantPicker.test.tsx`
Expected: All tests PASS (1 new + 1 existing = 2 total).

- [ ] **Step 5: Write the failing `RoundRobinSetupForm` tests**

Append to `components/tournaments/RoundRobinSetupForm.test.tsx`:

```ts
  it("shows the Hybrid team mode option for doubles format", () => {
    render(<RoundRobinSetupForm initialPlayers={initialPlayers} onSubmit={vi.fn()} onCreatePlayer={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Doubles"));

    expect(screen.getByLabelText("Hybrid")).toBeInTheDocument();
  });

  it("locks two clicked players into a fixed pair in hybrid mode, leaving the rest as the rotating pool", () => {
    render(<RoundRobinSetupForm initialPlayers={initialPlayers} onSubmit={vi.fn()} onCreatePlayer={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Alex Sterling"));
    fireEvent.click(screen.getByLabelText("Ben Rivera"));
    fireEvent.click(screen.getByLabelText("Chris Jung"));
    fireEvent.click(screen.getByLabelText("Dana Kim"));
    fireEvent.click(screen.getByLabelText("Doubles"));
    fireEvent.click(screen.getByLabelText("Hybrid"));

    fireEvent.click(screen.getByLabelText("Alex Sterling")); // arm
    fireEvent.click(screen.getByLabelText("Ben Rivera")); // lock

    expect(screen.getByText("Alex Sterling & Ben Rivera")).toBeInTheDocument();
  });

  it("unlocks a fixed pair when either member is clicked again", () => {
    render(<RoundRobinSetupForm initialPlayers={initialPlayers} onSubmit={vi.fn()} onCreatePlayer={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Alex Sterling"));
    fireEvent.click(screen.getByLabelText("Ben Rivera"));
    fireEvent.click(screen.getByLabelText("Doubles"));
    fireEvent.click(screen.getByLabelText("Hybrid"));
    fireEvent.click(screen.getByLabelText("Alex Sterling"));
    fireEvent.click(screen.getByLabelText("Ben Rivera"));
    expect(screen.getByText("Alex Sterling & Ben Rivera")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Alex Sterling")); // unlock

    expect(screen.queryByText("Alex Sterling & Ben Rivera")).not.toBeInTheDocument();
  });

  it("shows the Number of Rounds input and computes the preview for hybrid mode", () => {
    render(<RoundRobinSetupForm initialPlayers={initialPlayers} onSubmit={vi.fn()} onCreatePlayer={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Alex Sterling"));
    fireEvent.click(screen.getByLabelText("Ben Rivera"));
    fireEvent.click(screen.getByLabelText("Chris Jung"));
    fireEvent.click(screen.getByLabelText("Dana Kim"));
    fireEvent.click(screen.getByLabelText("Doubles"));
    fireEvent.click(screen.getByLabelText("Hybrid"));
    fireEvent.click(screen.getByLabelText("Alex Sterling"));
    fireEvent.click(screen.getByLabelText("Ben Rivera"));

    const roundsInput = screen.getByLabelText(/Number of Rounds/i);
    fireEvent.change(roundsInput, { target: { value: "3" } });

    // 1 fixed pair + 2 rotating players (1 rotating pair) = 2 teams/round -> 1 match/round * 3 rounds = 3
    expect(screen.getByText(/3 matches/i)).toBeInTheDocument();
  });
```

- [ ] **Step 6: Run the test file to verify it fails**

Run: `npx vitest run components/tournaments/RoundRobinSetupForm.test.tsx`
Expected: FAIL — `getByLabelText("Hybrid")` finds nothing (no Hybrid option exists yet).

- [ ] **Step 7: Implement the changes in `components/tournaments/RoundRobinSetupForm.tsx`**

Update the `TeamMode` type (line 16):

```ts
type TeamMode = "fixed" | "rotating" | "hybrid";
```

Add new state, after the existing `numRounds` state (around line 33):

```ts
  const [lockedPairs, setLockedPairs] = useState<[string, string][]>([]);
  const [armedId, setArmedId] = useState<string | null>(null);
```

Add derived `rotatingPlayerIds` next to the existing `fixedTeams` derivation (around line 41-47):

```ts
  const rotatingPlayerIds =
    matchFormat === "doubles" && teamMode === "hybrid"
      ? selectedOrder.filter((id) => !lockedPairs.some((pair) => pair.includes(id)))
      : [];
```

Update the `preview` memo (lines 49-59) to branch to the new preview function:

```ts
  const preview = useMemo(() => {
    const courts = numCourts === "" ? 0 : numCourts;
    const rounds = numRounds === "" ? 0 : numRounds;
    if (matchFormat === "singles") {
      return computeSinglesPreview(selectedOrder.length, courts, matchDurationMinutes);
    }
    if (teamMode === "fixed") {
      return computeFixedDoublesPreview(fixedTeams.length, courts, matchDurationMinutes);
    }
    if (teamMode === "hybrid") {
      return computeHybridDoublesPreview(lockedPairs.length, rotatingPlayerIds.length, courts, matchDurationMinutes, rounds);
    }
    return computeRotatingDoublesPreview(selectedOrder.length, courts, matchDurationMinutes, rounds);
  }, [
    matchFormat,
    teamMode,
    selectedOrder.length,
    numCourts,
    matchDurationMinutes,
    numRounds,
    fixedTeams.length,
    lockedPairs.length,
    rotatingPlayerIds.length,
  ]);
```

Update the import (line 9-12):

```ts
import {
  computeSinglesPreview,
  computeFixedDoublesPreview,
  computeRotatingDoublesPreview,
  computeHybridDoublesPreview,
} from "@/lib/scheduling/preview";
```

Add the pair-click handler, near `toggleParticipant` (around line 61-63):

```ts
  function handlePairClick(id: string) {
    const existingPair = lockedPairs.find((pair) => pair.includes(id));
    if (existingPair) {
      setLockedPairs((prev) => prev.filter((pair) => pair !== existingPair));
      return;
    }
    if (armedId === null) {
      setArmedId(id);
    } else if (armedId === id) {
      setArmedId(null);
    } else {
      setLockedPairs((prev) => [...prev, [armedId, id]]);
      setArmedId(null);
    }
  }
```

Update `handleSubmit`'s doubles branch (lines 77-84):

```ts
      if (matchFormat === "doubles") {
        formData.set("teamMode", teamMode);
        if (teamMode === "rotating") {
          formData.set("numRounds", String(numRounds));
        } else if (teamMode === "hybrid") {
          formData.set("numRounds", String(numRounds));
          lockedPairs.forEach((pair) => formData.append("fixedPairs", pair.join(",")));
        } else {
          fixedTeams.forEach((team) => formData.append("fixedTeams", team.join(",")));
        }
      }
```

Add the "Hybrid" radio option, after the existing "Rotating Partners" radio (around line 165-175):

```tsx
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="teamMode"
                checked={teamMode === "hybrid"}
                onChange={() => setTeamMode("hybrid")}
                aria-label="Hybrid"
              />
              Hybrid
            </label>
```

Update the "Number of Rounds" input's condition (around line 178) to also show for hybrid:

```tsx
        {matchFormat === "doubles" && (teamMode === "rotating" || teamMode === "hybrid") && (
          <label className="flex flex-col text-sm gap-1">
            Number of Rounds
            <input
              type="number"
              min={1}
              value={numRounds}
              onChange={(e) => setNumRounds(e.target.value === "" ? "" : Number(e.target.value))}
              className="border border-outline-variant rounded px-3 py-2"
            />
          </label>
        )}
```

Add a "Fixed Pairs" summary block, after the existing fixed-team summary block (around line 191-202):

```tsx
        {matchFormat === "doubles" && teamMode === "hybrid" && lockedPairs.length > 0 && (
          <div>
            <h3 className="font-headline text-sm font-semibold mb-2">Fixed Pairs</h3>
            <ul className="space-y-1">
              {lockedPairs.map(([a, b], i) => (
                <li key={i} className="font-body text-sm">
                  {playersById.get(a)?.name} &amp; {playersById.get(b)?.name}
                </li>
              ))}
            </ul>
          </div>
        )}
```

Pass `pairLocking` to `ParticipantPicker` when in hybrid mode, updating the existing `<ParticipantPicker ... />` call (around line 207-213):

```tsx
        <ParticipantPicker
          availablePlayers={availablePlayers}
          selectedIds={selectedOrder}
          onToggle={toggleParticipant}
          onPlayerAdded={(player) => setAvailablePlayers((prev) => [...prev, player])}
          onCreatePlayer={onCreatePlayer}
          pairLocking={
            matchFormat === "doubles" && teamMode === "hybrid"
              ? { lockedPairs, armedId, onPairClick: handlePairClick }
              : undefined
          }
        />
```

- [ ] **Step 8: Run the test file to verify it passes**

Run: `npx vitest run components/tournaments/RoundRobinSetupForm.test.tsx`
Expected: All tests PASS (4 new + 2 existing = 6 total).

- [ ] **Step 9: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All tests PASS, no type errors.

- [ ] **Step 10: Commit**

```bash
git add components/tournaments/ParticipantPicker.tsx components/tournaments/ParticipantPicker.test.tsx components/tournaments/RoundRobinSetupForm.tsx components/tournaments/RoundRobinSetupForm.test.tsx
git commit -m "Add hybrid doubles pair-locking UI to tournament setup form"
```

---

### Task 6: Final whole-feature verification

**Files:** None (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests PASS (baseline 124 + this feature's ~14 new tests).

- [ ] **Step 2: Run the typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Manually verify in the browser**

Start the dev server, go to `/tournaments/new`, select Doubles, select Hybrid, pick 6 participants, click two names to lock a fixed pair, verify the "Fixed Pairs" summary shows them, set rounds to 3, click Generate Bracket, and confirm the tournament detail page shows matches where the fixed pair always appears together.

- [ ] **Step 4: Report completion**

Summarize what was built and confirm readiness for `superpowers:finishing-a-development-branch`.
