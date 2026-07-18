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
