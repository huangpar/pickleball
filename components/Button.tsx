import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "tertiary";

const variantClasses: Record<Variant, string> = {
  primary: "bg-secondary text-on-secondary hover:opacity-90",
  secondary: "bg-transparent border border-outline/20 text-on-surface hover:bg-surface-container-low",
  tertiary: "bg-transparent text-on-surface hover:bg-surface-container-low",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  href?: string;
  children: ReactNode;
}

export function Button({ variant = "primary", href, className = "", children, ...props }: ButtonProps) {
  const classes = `px-4 py-2 rounded font-body font-medium text-sm transition-colors ${variantClasses[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
