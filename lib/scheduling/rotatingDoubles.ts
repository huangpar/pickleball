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
