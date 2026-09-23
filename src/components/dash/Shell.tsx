import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  GraduationCap,
  Building2,
  CalendarRange,
  FileBarChart,
  Bell,
  Settings,
  Search,
  Menu,
  X,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { me, type AuthUser } from "@/lib/api";
import { notifications } from "@/lib/data";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogoutConfirmDialog } from "@/components/logout-confirm";
import { GateLoading, GateError } from "@/components/load-state";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/students", label: "Students", icon: GraduationCap },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/drives", label: "Placement Drives", icon: CalendarRange },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/dashboard", label: "Settings", icon: Settings },
] as const;

export function Shell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    let cancelled = false;
    me()
      .then((current) => {
        if (cancelled) return;
        if (current) {
          setUser(current);
          setStatus("ready");
        } else {
          void navigate({
            to: "/institution-auth",
            search: { mode: "login" },
            replace: true,
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : null);
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (status === "loading") {
    return <GateLoading />;
  }

  if (status === "error" || !user) {
    return <GateError message={errorMessage} />;
  }

  const initials = user.name
    ? user.name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0] ?? "")
        .join("")
        .toUpperCase()
    : user.email.slice(0, 2).toUpperCase();

  return (
    <div className="dash-root min-h-screen bg-background">
      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-6">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-md bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground">
              TB
            </span>
            <span className="font-display text-[15px] font-bold tracking-tight text-sidebar-primary">
              TalentBro
            </span>
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            if (item.label === "Settings") {
              return (
                <LogoutConfirmDialog key={item.label}>
                  <button
                    type="button"
                    className="group flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  >
                    <LogOut className="size-4 shrink-0" />
                    <span className="flex-1">Sign out</span>
                  </button>
                </LogoutConfirmDialog>
              );
            }
            return (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.label === "Notifications" && unread > 0 && (
                  <span className="rounded-full bg-sidebar-primary px-1.5 py-0.5 font-mono text-[10px] font-bold text-sidebar-primary-foreground">
                    {unread}
                  </span>
                )}
                {active && <ChevronRight className="size-3.5" />}
              </Link>
            );
          })}
        </nav>

        <div className="m-3 rounded-lg border border-sidebar-border p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/50">
            Signed in
          </p>
          <p className="mt-1.5 truncate text-sm font-medium text-sidebar-primary">
            {user.name || user.email}
          </p>
          <p className="truncate text-xs text-sidebar-foreground/60">
            {user.institution ? `TPO · ${user.institution}` : user.email}
          </p>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
            <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <div className="relative hidden max-w-sm flex-1 sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search students, companies, drives…"
                className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground md:block">
                AY 2025-26
              </span>
              <ThemeToggle className="size-9" />
              <Link
                to="/notifications"
                className="relative grid size-9 place-items-center rounded-md border border-border bg-card transition-colors hover:bg-accent"
                aria-label="Notifications"
              >
                <Bell className="size-4" />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary font-mono text-[9px] font-bold text-primary-foreground">
                    {unread}
                  </span>
                )}
              </Link>
              <Avatar className="size-9 rounded-md">
                {user.avatar ? (
                  <AvatarImage src={user.avatar} alt={user.name || "Profile"} />
                ) : null}
                <AvatarFallback className="rounded-md bg-primary font-display text-xs font-bold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold sm:text-[28px]">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
