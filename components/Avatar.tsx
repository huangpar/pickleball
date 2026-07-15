import { getInitials } from "@/lib/initials";

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = getInitials(name);
  const sizeClasses = size === "sm" ? "w-8 h-8 text-sm" : "w-10 h-10 text-base";

  return (
    <div
      className={`${sizeClasses} rounded-full bg-surface-container-highest text-primary font-headline font-semibold flex items-center justify-center shrink-0`}
      title={name}
    >
      {initials}
    </div>
  );
}
