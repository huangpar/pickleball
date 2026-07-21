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

function pairUpByPartnerCoverage(
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

function formGroupsFromPairs(
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
