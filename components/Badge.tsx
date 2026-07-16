export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-tertiary-container text-on-tertiary-container font-mono text-xs uppercase tracking-wide px-2 py-1 rounded">
      {children}
    </span>
  );
}
