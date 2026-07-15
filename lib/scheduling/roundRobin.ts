export function roundRobinRounds<T>(items: T[]): { side1: T; side2: T }[][] {
  if (items.length < 2) return [];

  const arr: (T | null)[] = [...items];
  if (arr.length % 2 !== 0) arr.push(null);

  const n = arr.length;
  const numRounds = n - 1;
  const half = n / 2;
  const rounds: { side1: T; side2: T }[][] = [];

  let current = [...arr];
  for (let r = 0; r < numRounds; r++) {
    const pairs: { side1: T; side2: T }[] = [];
    for (let i = 0; i < half; i++) {
      const a = current[i];
      const b = current[n - 1 - i];
      if (a !== null && b !== null) {
        pairs.push({ side1: a, side2: b });
      }
    }
    rounds.push(pairs);

    const fixed = current[0];
    const rest = current.slice(1);
    const last = rest.pop() as T | null;
    rest.unshift(last);
    current = [fixed, ...rest];
  }

  return rounds;
}
