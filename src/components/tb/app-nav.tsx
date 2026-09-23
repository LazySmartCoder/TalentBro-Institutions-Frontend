import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNotifications } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type NavPage =
  "chat" | "mock-interview" | "tutorials" | "self-training" | "notifications" | "profile";

export function AppNavIconButton({
  label,
  onClick,
  className,
  side,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          disabled={disabled}
          className={cn(
            "grid size-9 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side={side ?? "bottom"} sideOffset={8} className="shadow-lg">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function AppNavHeader({
  current,
  left,
  center,
  actions,
  unread: unreadOverride,
  sticky,
}: {
  current?: NavPage;
  left?: ReactNode;
  center?: ReactNode;
  actions?: ReactNode;
  unread?: number;
  sticky?: boolean;
}) {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [unread, setUnread] = useState<number | null>(null);

  // Fetch the live unread notification count so the bell badge shows on every
  // page that renders the header. Pages that already track the count (chat,
  // notifications) can override it via the ``unread`` prop.
  useEffect(() => {
    let cancelled = false;
    getNotifications()
      .then((data) => {
        if (!cancelled) setUnread(data.unread);
      })
      .catch(() => {
        // Backend unavailable — keep the badge hidden.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const badge = unreadOverride ?? unread ?? 0;

  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={300}>
      <header
        className={`relative flex items-center gap-3 border-b border-border px-4 py-3 lg:px-6 ${
          sticky ? "sticky top-0 z-20 bg-background/85 backdrop-blur" : "backdrop-blur"
        }`}
      >
        {left}
        {center && (
          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2">{center}</div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <AppNavIconButton
            label="Notifications"
            onClick={() => void navigate({ to: "/notifications" })}
            className="relative"
          >
            <Bell className="size-4" />
            {badge > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-primary font-mono text-[9px] font-bold text-primary-foreground">
                {badge}
              </span>
            )}
          </AppNavIconButton>
          {actions}
          <AppNavIconButton
            label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggle}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </AppNavIconButton>
        </div>
      </header>
    </TooltipProvider>
  );
}
