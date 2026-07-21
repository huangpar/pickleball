import { roundRobinRounds } from "./roundRobin";
import type { ScheduledMatch } from "./types";

export function generateFixedDoublesSchedule(
  teams: [string, string][],
  numCourts: number,
  rng: () => number = Math.random
): ScheduledMatch[] {
  const teamIndices = teams.map((_, i) => i);
  const rounds = roundRobinRounds(teamIndices);
  const schedule: ScheduledMatch[] = [];

  rounds.forEach((pairs, roundIndex) => {
    pairs.forEach((pair, matchIndex) => {
      const side1PlayerIds = [...teams[pair.side1]];
      const side2PlayerIds = [...teams[pair.side2]];
      const allPlayers = [...side1PlayerIds, ...side2PlayerIds];
      schedule.push({
        roundNumber: roundIndex + 1,
        courtNumber: (matchIndex % numCourts) + 1,
        side1PlayerIds,
        side2PlayerIds,
        firstServerId: allPlayers[Math.floor(rng() * allPlayers.length)],
      });
    });
  });

  return schedule;
}
