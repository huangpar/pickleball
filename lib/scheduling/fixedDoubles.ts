import { roundRobinRounds } from "./roundRobin";
import type { ScheduledMatch } from "./types";

export function generateFixedDoublesSchedule(
  teams: [string, string][],
  numCourts: number,
  numRounds: number | null | undefined = undefined,
  rng: () => number = Math.random
): ScheduledMatch[] {
  const teamIndices = teams.map((_, i) => i);
  const baseRounds = roundRobinRounds(teamIndices);
  const schedule: ScheduledMatch[] = [];

  // If numRounds is specified, repeat the base round-robin as needed
  const targetRounds = numRounds || baseRounds.length;
  const repetitions = Math.ceil(targetRounds / baseRounds.length);

  for (let rep = 0; rep < repetitions; rep++) {
    baseRounds.forEach((pairs, baseRoundIndex) => {
      const roundNumber = rep * baseRounds.length + baseRoundIndex + 1;
      if (roundNumber > targetRounds) return; // Stop if we've generated enough rounds

      pairs.forEach((pair, matchIndex) => {
        const side1PlayerIds = [...teams[pair.side1]];
        const side2PlayerIds = [...teams[pair.side2]];
        const allPlayers = [...side1PlayerIds, ...side2PlayerIds];
        schedule.push({
          roundNumber,
          courtNumber: (matchIndex % numCourts) + 1,
          side1PlayerIds,
          side2PlayerIds,
          firstServerId: allPlayers[Math.floor(rng() * allPlayers.length)],
        });
      });
    });
  }

  return schedule;
}
