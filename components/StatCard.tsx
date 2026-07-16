import { Card } from "./Card";

export function StatCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <Card>
      <p className="font-mono text-xs uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="font-headline text-3xl font-bold mt-2">{value}</p>
      {sublabel && <p className="font-body text-sm text-on-surface-variant mt-1">{sublabel}</p>}
    </Card>
  );
}
