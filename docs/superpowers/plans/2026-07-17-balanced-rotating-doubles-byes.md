# Balanced Rotating-Doubles Byes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `generateRotatingDoublesSchedule` so that when a rotating-partner doubles tournament's participant count isn't evenly divisible by 4, who sits out each round is chosen to keep every player's total bye count within 1 of every other player's, instead of the current fully-random selection.

**Architecture:** Track a `byeCounts` map across the whole schedule generation (not reset per round). Each round, select the required number of sit-outs by randomizing tie-break order then stable-sorting by bye count ascending — the players with the fewest byes so far are preferentially chosen to sit out now. No changes to match-forming logic (partner/opponent balancing) or the function's public signature.

**Tech Stack:** TypeScript · Vitest (same as the rest of this repo — no new dependencies)

## Global Constraints

- Fix is scoped entirely to `lib/scheduling/rotatingDoubles.ts` and its test file — singles and fixed-team doubles already have inherently balanced byes via the round-robin circle method and are out of scope.
- `generateRotatingDoublesSchedule`'s signature (`(playerIds: string[], numCourts: number, numRounds: number, rng?: () => number): ScheduledMatch[]`) must not change — other code already calls it with this signature.
- Bye counts across all players must never differ by more than 1, for any player count and any number of rounds.
- Existing behavior (group size, no double-booking within a round, determinism given the same seed, partner/opponent-repeat minimization) must continue to hold unchanged.

---

## Task 1: Balance bye selection in `generateRotatingDoublesSchedule`

**Files:**
- Modify: `lib/scheduling/rotatingDoubles.ts`
- Modify: `lib/scheduling/rotatingDoubles.test.ts`

**Interfaces:**
- Produces: `generateRotatingDoublesSchedule` keeps its exact existing signature and return type (`ScheduledMatch[]`) — no consumer elsewhere in the codebase needs to change.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `lib/scheduling/rotatingDoubles.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateRotatingDoublesSchedule } from "./rotatingDoubles";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function countByesByPlayer(schedule: ReturnType<typeof generateRotatingDoublesSchedule>, players: string[], numRounds: number) {
  const byeCounts = new Map<string, number>();
  for (const id of players) byeCounts.set(id, 0);

  for (let round = 1; round <= numRounds; round++) {
    const roundMatches = schedule.filter((m) => m.roundNumber === round);
    const playing = new Set(roundMatches.flatMap((m) => [...m.side1PlayerIds, ...m.side2PlayerIds]));
    for (const id of players) {
      if (!playing.has(id)) {
        byeCounts.set(id, (byeCounts.get(id) ?? 0) + 1);
      }
    }
  }

  return byeCounts;
}

describe("generateRotatingDoublesSchedule", () => {
  const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];

  it("produces 2 matches per round for 8 players (groups of 4), 4 distinct players per match", () => {
    const schedule = generateRotatingDoublesSchedule(players, 2, 3, mulberry32(42));
    const rounds = new Set(schedule.map((m) => m.roundNumber));
    expect(rounds.size).toBe(3);

    schedule.forEach((m) => {
      expect(m.side1PlayerIds).toHaveLength(2);
      expect(m.side2PlayerIds).toHaveLength(2);
      const all = [...m.side1PlayerIds, ...m.side2PlayerIds];
      expect(new Set(all).size).toBe(4); // no repeated player within a match
    });

    [1, 2, 3].forEach((roundNumber) => {
      const roundMatches = schedule.filter((m) => m.roundNumber === roundNumber);
      expect(roundMatches).toHaveLength(2); // 8 players / 4 per match
      const playersThisRound = roundMatches.flatMap((m) => [...m.side1PlayerIds, ...m.side2PlayerIds]);
      expect(new Set(playersThisRound).size).toBe(playersThisRound.length); // nobody double-booked
    });
  });

  it("sits out leftover players when count isn't divisible by 4", () => {
    const sevenPlayers = players.slice(0, 7);
    const schedule = generateRotatingDoublesSchedule(sevenPlayers, 2, 2, mulberry32(7));
    [1, 2].forEach((roundNumber) => {
      const roundMatches = schedule.filter((m) => m.roundNumber === roundNumber);
      expect(roundMatches).toHaveLength(1); // floor(7/4) = 1 match, 3 players sit out
    });
  });

  it("is deterministic given the same seed", () => {
    const a = generateRotatingDoublesSchedule(players, 2, 3, mulberry32(99));
    const b = generateRotatingDoublesSchedule(players, 2, 3, mulberry32(99));
    expect(a).toEqual(b);
  });

  it("gives every player exactly one bye when byes divide evenly", () => {
    const fivePlayers = ["p1", "p2", "p3", "p4", "p5"];
    const numRounds = 5; // 1 sit-out per round (5 % 4 = 1) * 5 rounds = 5 total byes for 5 players
    const schedule = generateRotatingDoublesSchedule(fivePlayers, 2, numRounds, mulberry32(1));

    const byeCounts = countByesByPlayer(schedule, fivePlayers, numRounds);
    expect([...byeCounts.values()]).toEqual([1, 1, 1, 1, 1]);
  });

  it("keeps bye counts within 1 of each other when byes don't divide evenly", () => {
    const sevenPlayers = players.slice(0, 7);
    const numRounds = 4; // 3 sit-outs per round (7 % 4 = 3) * 4 rounds = 12 total byes for 7 players
    const schedule = generateRotatingDoublesSchedule(sevenPlayers, 2, numRounds, mulberry32(2));

    const byeCounts = countByesByPlayer(schedule, sevenPlayers, numRounds);
    const counts = [...byeCounts.values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm run test -- lib/scheduling/rotatingDoubles.test.ts` — expected: the 3 pre-existing tests still pass, but the 2 new tests ("gives every player exactly one bye...", "keeps bye counts within 1...") FAIL — with the current fully-random selection, the bye distribution across 5 players over 5 rounds (or 7 players over 4 rounds) is not guaranteed to satisfy either assertion.

- [ ] **Step 3: Implement balanced bye selection**

Replace the full contents of `lib/scheduling/rotatingDoubles.ts`:

```ts
import type { ScheduledMatch } from "./types";

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function selectSitOutPlayers(
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

function bestTeamSplit(
  group: string[],
  partnerCounts: Map<string, number>,
  opponentCounts: Map<string, number>,
  rng: () => number
): { side1: string[]; side2: string[] } {
  const [a, b, c, d] = group;
  const options: [string[], string[]][] = [
    [[a, b], [c, d]],
    [[a, c], [b, d]],
    [[a, d], [b, c]],
  ];

  const scored = options.map((opt) => {
    const [s1, s2] = opt;
    const partnerScore =
      (partnerCounts.get(pairKey(s1[0], s1[1])) ?? 0) + (partnerCounts.get(pairKey(s2[0], s2[1])) ?? 0);
    let opponentScore = 0;
    s1.forEach((p1) => s2.forEach((p2) => (opponentScore += opponentCounts.get(pairKey(p1, p2)) ?? 0)));
    return { opt, score: partnerScore * 2 + opponentScore };
  });

  const minScore = Math.min(...scored.map((s) => s.score));
  const bestOptions = scored.filter((s) => s.score === minScore).map((s) => s.opt);
  const chosen = bestOptions[Math.floor(rng() * bestOptions.length)];
  return { side1: chosen[0], side2: chosen[1] };
}

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
    const shuffled = shuffle(playingIds, rng);
    const groups: string[][] = [];
    for (let i = 0; i + 4 <= shuffled.length; i += 4) {
      groups.push(shuffled.slice(i, i + 4));
    }

    groups.forEach((group, matchIndex) => {
      const { side1, side2 } = bestTeamSplit(group, partnerCounts, opponentCounts, rng);

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

      schedule.push({
        roundNumber: round,
        courtNumber: (matchIndex % numCourts) + 1,
        side1PlayerIds: side1,
        side2PlayerIds: side2,
      });
    });
  }

  return schedule;
}
```

- [ ] **Step 4: Run tests to verify they all pass**

Run: `npm run test -- lib/scheduling/rotatingDoubles.test.ts` — expected: 5 passed.

- [ ] **Step 5: Run the full test suite**

Run: `npm run test` — expected: every test in the repo still passes (this function's signature and return shape are unchanged, so nothing else should be affected — but confirm there's no regression, e.g. in `lib/actions/tournaments.ts`'s `generateBracket`, which calls this function for rotating-doubles tournaments).

- [ ] **Step 6: Manually verify in the browser**

Run: `npm run dev`. Create a new **doubles / rotating partners** tournament via `/tournaments/new` with a player count that isn't a multiple of 4 (e.g. 9 players, 6 rounds) and a small enough round count to inspect by hand. On the resulting tournament's detail page, note which player(s) show up in the "Bye: ..." line for each round — confirm no single player appears in the bye line noticeably more often than others across the rounds (with 9 players and 6 rounds, `9 % 4 = 1` sit-out per round × 6 rounds = 6 total byes over 9 players, so most players should sit out 0 or 1 times, none more than 1 apart from any other). Stop the dev server with Ctrl+C once confirmed.

- [ ] **Step 7: Commit**

```bash
git add lib/scheduling/rotatingDoubles.ts lib/scheduling/rotatingDoubles.test.ts
git commit -m "Balance bye selection in rotating-partner doubles scheduling"
```
