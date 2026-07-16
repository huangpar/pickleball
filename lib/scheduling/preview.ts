function estimateMinutes(totalMatches: number, numCourts: number, matchDurationMinutes: number): number {
  if (totalMatches === 0) return 0;
  const roundsNeeded = Math.ceil(totalMatches / numCourts);
  return roundsNeeded * matchDurationMinutes;
}

export function computeSinglesPreview(participantCount: number, numCourts: number, matchDurationMinutes: number) {
  const totalMatches = participantCount < 2 ? 0 : (participantCount * (participantCount - 1)) / 2;
  return { totalMatches, estimatedMinutes: estimateMinutes(totalMatches, numCourts, matchDurationMinutes) };
}

export function computeFixedDoublesPreview(teamCount: number, numCourts: number, matchDurationMinutes: number) {
  const totalMatches = teamCount < 2 ? 0 : (teamCount * (teamCount - 1)) / 2;
  return { totalMatches, estimatedMinutes: estimateMinutes(totalMatches, numCourts, matchDurationMinutes) };
}

export function computeRotatingDoublesPreview(
  participantCount: number,
  numCourts: number,
  matchDurationMinutes: number,
  numRounds: number
) {
  const matchesPerRound = Math.floor(participantCount / 4);
  const totalMatches = matchesPerRound * numRounds;
  return { totalMatches, estimatedMinutes: estimateMinutes(totalMatches, numCourts, matchDurationMinutes) };
}
