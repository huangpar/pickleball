import { roundRobinRounds } from "./roundRobin";
import type { ScheduledMatch } from "./types";

export function generateSinglesSchedule(
  playerIds: string[],
  numCourts: number,
  rng: () => number = Math.random
): ScheduledMatch[] {
  const rounds = roundRobinRounds(playerIds);
  const schedule: ScheduledMatch[] = [];

  rounds.forEach((pairs, roundIndex) => {
    pairs.forEach((pair, matchIndex) => {
      const allPlayers = [pair.side1, pair.side2];
      schedule.push({
        roundNumber: roundIndex + 1,
        courtNumber: (matchIndex % numCourts) + 1,
        side1PlayerIds: [pair.side1],
        side2PlayerIds: [pair.side2],
        firstServerId: allPlayers[Math.floor(rng() * allPlayers.length)],
      });
    });
  });

  return schedule;
}
