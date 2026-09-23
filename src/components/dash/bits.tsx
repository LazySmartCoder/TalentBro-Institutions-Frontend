import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  description,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("dash-panel", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Kpi({
  label,
  value,
  suffix,
  delta,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  delta?: number;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="dash-panel p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="dash-mono-label">{label}</p>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </div>
      <p className="dash-stat-num mt-3 text-3xl">
        {value}
        {suffix && <span className="ml-1 text-base text-muted-foreground">{suffix}</span>}
      </p>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono font-medium",
              up ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta)}%
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "solid" | "muted" | "outline";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        tone === "solid" && "bg-primary text-primary-foreground",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "outline" && "border border-border text-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function Bar({ value, max = 100 }: { value: number; max?: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
      />
    </div>
  );
}

export const chartColors = {
  ink: "oklch(0.14 0 0)",
  mid: "oklch(0.5 0 0)",
  light: "oklch(0.78 0 0)",
  grid: "oklch(0.9 0 0)",
};
