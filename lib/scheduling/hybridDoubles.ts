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
