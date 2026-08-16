import { roundRobinRounds } from "./roundRobin";
import type { ScheduledMatch } from "./types";

export function naturalSinglesRoundCount(participantCount: number): number {
  if (participantCount < 2) return 0;
  return participantCount % 2 === 0 ? participantCount - 1 : participantCount;
}

export function generateSinglesSchedule(
  playerIds: string[],
  numCourts: number,
  numRounds: number | null | undefined = undefined,
  rng: () => number = Math.random
): ScheduledMatch[] {
  const baseRounds = roundRobinRounds(playerIds);
  const schedule: ScheduledMatch[] = [];
  if (baseRounds.length === 0) return schedule;

  // If numRounds is specified, repeat the base round-robin as needed
  const targetRounds = numRounds || baseRounds.length;
  const repetitions = Math.ceil(targetRounds / baseRounds.length);

  for (let rep = 0; rep < repetitions; rep++) {
    baseRounds.forEach((pairs, baseRoundIndex) => {
      const roundNumber = rep * baseRounds.length + baseRoundIndex + 1;
      if (roundNumber > targetRounds) return; // Stop if we've generated enough rounds

      pairs.forEach((pair, matchIndex) => {
        const allPlayers = [pair.side1, pair.side2];
        schedule.push({
          roundNumber,
          courtNumber: (matchIndex % numCourts) + 1,
          side1PlayerIds: [pair.side1],
          side2PlayerIds: [pair.side2],
          firstServerId: allPlayers[Math.floor(rng() * allPlayers.length)],
        });
      });
    });
  }

  return schedule;
}
