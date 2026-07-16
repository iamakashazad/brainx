import { Check } from "lucide-react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import type { JobStatus } from "@/lib/api-types";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const buttonVariantStyle = {
  primary: {
    background: "var(--primary)",
    color: "var(--primary-foreground)",
    border: "1px solid transparent",
  },
  brand: {
    background: "var(--color-brand)",
    color: "var(--color-near-black)",
    border: "1px solid transparent",
  },
  ghost: {
    background: "transparent",
    color: "var(--foreground)",
    border: "1px solid var(--border-medium)",
  },
  subtle: {
    background: "var(--muted)",
    color: "var(--muted-foreground)",
    border: "1px solid transparent",
  },
} satisfies Record<string, CSSProperties>;

type ButtonVariant = keyof typeof buttonVariantStyle;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
};

export function Button({
  variant = "primary",
  icon,
  className,
  style,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      style={{
        ...buttonVariantStyle[variant],
        borderRadius: "var(--radius-full)",
        boxShadow: variant === "ghost" || variant === "subtle" ? "none" : "var(--shadow-sm)",
        ...style,
      }}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

type SurfaceProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function Surface({ children, className, style }: SurfaceProps) {
  return (
    <div
      className={className}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const statusLabel: Record<JobStatus, string> = {
  DONE: "COMPLETE",
  RUNNING: "RUNNING",
  PENDING: "QUEUED",
  ERROR: "FAILED",
};

const statusStyle: Record<JobStatus, CSSProperties> = {
  DONE: {
    background: "var(--color-brand-light)",
    color: "var(--color-brand-deep)",
  },
  RUNNING: {
    background: "var(--color-blue-bg)",
    color: "var(--color-blue)",
  },
  PENDING: {
    background: "var(--color-gray-100)",
    color: "var(--color-gray-500)",
  },
  ERROR: {
    background: "var(--color-error-bg)",
    color: "var(--color-error)",
  },
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider"
      style={{
        ...statusStyle[status],
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.6px",
        borderRadius: "var(--radius-full)",
      }}
    >
      {statusLabel[status]}
    </span>
  );
}

type StepIndicatorProps = {
  labels: readonly string[];
  activeIndex: number;
};

export function StepIndicator({ labels, activeIndex }: StepIndicatorProps) {
  return (
    <nav aria-label="Analysis steps" className="flex items-center gap-0">
      {labels.map((label, index) => {
        const isComplete = index < activeIndex;
        const isActive = index === activeIndex;
        const isLast = index === labels.length - 1;

        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                style={{
                  background: isComplete || isActive ? "var(--color-brand)" : "var(--muted)",
                  color:
                    isComplete || isActive
                      ? "var(--color-near-black)"
                      : "var(--muted-foreground)",
                }}
              >
                {isComplete ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: isActive ? "var(--foreground)" : "var(--muted-foreground)" }}
              >
                {label}
              </span>
            </div>
            {!isLast && (
              <div className="mx-3 h-px w-10" style={{ background: "var(--border-medium)" }} />
            )}
          </div>
        );
      })}
    </nav>
  );
}

type PillButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export function PillButton({ active = false, className, style, children, ...props }: PillButtonProps) {
  return (
    <button
      type="button"
      className={cx("rounded-full px-4 py-1.5 text-sm font-medium transition", className)}
      style={{
        background: active ? "var(--primary)" : "transparent",
        color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
        border: active ? "1px solid transparent" : "1px solid var(--border-medium)",
        borderRadius: "var(--radius-full)",
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
