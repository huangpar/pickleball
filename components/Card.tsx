export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-container-lowest border border-surface-container-high rounded-lg p-6 ${className}`}>
      {children}
    </div>
  );
}
