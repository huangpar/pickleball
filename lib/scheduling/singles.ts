import { roundRobinRounds } from "./roundRobin";
import type { ScheduledMatch } from "./types";

export function generateSinglesSchedule(playerIds: string[], numCourts: number): ScheduledMatch[] {
  const rounds = roundRobinRounds(playerIds);
  const schedule: ScheduledMatch[] = [];

  rounds.forEach((pairs, roundIndex) => {
    pairs.forEach((pair, matchIndex) => {
      schedule.push({
        roundNumber: roundIndex + 1,
        courtNumber: (matchIndex % numCourts) + 1,
        side1PlayerIds: [pair.side1],
        side2PlayerIds: [pair.side2],
      });
    });
  });

  return schedule;
}
