import type { DailyActivity } from "@/lib/data/dashboard";

export function ActivityChart({ data }: { data: DailyActivity[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="flex items-end gap-3 h-40">
      {data.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
          <div
            className="w-full bg-secondary-container rounded-t"
            style={{ height: `${(d.count / max) * 100}%` }}
            title={`${d.count} matches`}
          />
          <span className="font-mono text-xs text-on-surface-variant">
            {new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" })}
          </span>
        </div>
      ))}
    </div>
  );
}
