export function MatchSparkline({ results }: { results: boolean[] }) {
  const recent = results.slice(-15);

  if (recent.length === 0) {
    return <p className="text-sm text-on-surface-variant">No matches played yet</p>;
  }

  return (
    <div className="flex gap-1">
      {recent.map((won, i) => (
        <span key={i} title={won ? "Win" : "Loss"} className={`w-2 h-6 rounded-sm ${won ? "bg-secondary" : "bg-error"}`} />
      ))}
    </div>
  );
}
