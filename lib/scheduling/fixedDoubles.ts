import { roundRobinRounds } from "./roundRobin";
import type { ScheduledMatch } from "./types";

export function generateFixedDoublesSchedule(
  teams: [string, string][],
  numCourts: number
): ScheduledMatch[] {
  const teamIndices = teams.map((_, i) => i);
  const rounds = roundRobinRounds(teamIndices);
  const schedule: ScheduledMatch[] = [];

  rounds.forEach((pairs, roundIndex) => {
    pairs.forEach((pair, matchIndex) => {
      schedule.push({
        roundNumber: roundIndex + 1,
        courtNumber: (matchIndex % numCourts) + 1,
        side1PlayerIds: [...teams[pair.side1]],
        side2PlayerIds: [...teams[pair.side2]],
      });
    });
  });

  return schedule;
}
