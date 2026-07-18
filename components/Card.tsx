export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const hasPadding = className.match(/\bp(-[xytrbl])?-\d+\b|\bp-0\b/);
  const paddingClass = hasPadding ? "" : "p-6";

  return (
    <div className={`bg-surface-container-lowest border border-surface-container-high rounded-lg ${paddingClass} ${className}`}>
      {children}
    </div>
  );
}
