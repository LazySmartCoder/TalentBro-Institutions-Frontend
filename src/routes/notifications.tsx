import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BellOff,
  Building2,
  CheckCheck,
  Megaphone,
  Pin,
  Sparkles,
} from "lucide-react";
import { AppNavHeader } from "@/components/tb/app-nav";
import { toast } from "sonner";
import { Shell } from "@/components/dash/Shell";
import { Kpi, Panel, Pill } from "@/components/dash/bits";
import {
  broadcasts as broadcastSeed,
  notifications as seed,
  schedules,
  type BroadcastMessage,
  type BroadcastSender,
} from "@/lib/data";
import { me, getNotifications, markNotificationsRead, type AuthUser } from "@/lib/api";
import { cn } from "@/lib/utils";
import { GateLoading, GateError } from "@/components/load-state";

const title = "TalentBro | Notifications";
const description =
  "Important updates, drive announcements and notices broadcasted by your placement cell and the TalentBro platform.";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: NotificationsPage,
});

function LoadingScreen() {
  return <GateLoading />;
}

function ErrorScreen({ message }: { message?: string | null }) {
  return <GateError message={message} />;
}

const SENDER_ICONS: Record<BroadcastSender, typeof Building2> = {
  "Placement Cell": Building2,
  "TalentBro Platform": Sparkles,
};

function StudentNotifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<BroadcastMessage[]>([]);
  const [sender, setSender] = useState<"All" | BroadcastSender>("All");
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getNotifications()
      .then((data) => {
        if (cancelled) return;
        setItems(
          data.notifications.map((n) => ({
            id: n.id,
            sender: n.sender as BroadcastSender,
            title: n.title,
            body: n.body,
            time: n.time,
            read: n.read,
            pinned: n.pinned,
            important: n.important,
            ...(n.redirect_path ? { path: n.redirect_path } : {}),
          })),
        );
      })
      .catch(() => {
        // Backend unavailable — show the local demo broadcast feed.
        setItems(broadcastSeed);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const list = useMemo(() => {
    const filtered = items.filter(
      (n) => (sender === "All" || n.sender === sender) && (!unreadOnly || !n.read),
    );
    return filtered
      .slice()
      .sort(
        (a, b) =>
          Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || Number(a.read) - Number(b.read),
      );
  }, [items, sender, unreadOnly]);

  const unread = items.filter((n) => !n.read).length;

  const senders: ("All" | BroadcastSender)[] = ["All", "Placement Cell", "TalentBro Platform"];

  function markAllRead() {
    setItems((p) => p.map((n) => ({ ...n, read: true })));
    void markNotificationsRead(undefined, true).catch(() => {});
  }

  function markRead(id: string) {
    const target = items.find((n) => n.id === id);
    if (!target || target.read) return;
    setItems((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)));
    void markNotificationsRead(id).catch(() => {});
  }

  function openNotification(n: BroadcastMessage) {
    if (n.path) {
      markRead(n.id);
      void navigate({ to: n.path });
    } else {
      markRead(n.id);
    }
  }

  const SenderIcon = sender === "All" ? Megaphone : SENDER_ICONS[sender];

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppNavHeader
        current="notifications"
        sticky
        unread={unread}
        left={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void navigate({ to: "/chat", replace: true })}
              className="grid size-8 cursor-pointer place-items-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Back to Home"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="grid size-9 place-items-center rounded-lg bg-foreground text-background">
              <Bell className="size-4" />
            </span>
            <span>
              <p className="text-sm font-semibold leading-tight">Notifications</p>
            </span>
          </div>
        }
      />

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Announcements</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {unread > 0
                ? `${unread} unread ${unread === 1 ? "update" : "updates"} from your placement cell and TalentBro.`
                : "You're all caught up."}
            </p>
          </div>
          <button
            type="button"
            onClick={markAllRead}
            disabled={unread === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {senders.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSender(s)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                sender === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-foreground/80 hover:bg-accent",
              )}
            >
              {s}
            </button>
          ))}
          <label className="ml-1 flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-foreground/80">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="accent-foreground"
            />
            Unread only
          </label>
        </div>

        <ul className="mt-4 space-y-3">
          {list.map((n) => {
            const SenderIcon = n.sender === "Placement Cell" ? Building2 : Sparkles;
            return (
              <li
                key={n.id}
                onClick={() => openNotification(n)}
                className={cn(
                  "rounded-2xl border bg-card p-4 transition-colors sm:p-5",
                  n.read ? "border-border" : "border-primary/40",
                  "cursor-pointer hover:border-foreground/40 hover:bg-accent/40",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]",
                      n.sender === "Placement Cell"
                        ? "bg-blue-500/10 text-blue-500"
                        : "bg-violet-500/10 text-violet-500",
                    )}
                  >
                    <SenderIcon className="size-3" />
                    {n.sender}
                  </span>
                  {n.important && (
                    <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-red-500">
                      Important
                    </span>
                  )}
                  {!n.read && <span className="size-1.5 rounded-full bg-primary" />}
                  {n.pinned && <Pin className="ml-auto size-3.5 text-muted-foreground" />}
                </div>
                <p className="mt-2.5 text-sm font-semibold">{n.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{n.body}</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {n.time}
                  </span>
                  {n.path ? (
                    <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                      Open <ArrowRight className="size-3" />
                    </span>
                  ) : (
                    !n.read && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead(n.id);
                        }}
                        className="ml-auto cursor-pointer rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-accent"
                      >
                        Mark as read
                      </button>
                    )
                  )}
                </div>
              </li>
            );
          })}
          {list.length === 0 && (
            <li className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card px-5 py-16 text-center">
              <BellOff className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No announcements match right now.</p>
            </li>
          )}
        </ul>

        <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          <Megaphone className="size-4 shrink-0" />
          <span>
            You receive updates broadcasted by your placement cell and the TalentBro platform. You
            can filter them or mark them read any time.
          </span>
        </div>
      </main>
    </div>
  );
}

const ADMIN_CATEGORIES = ["All", "Drive", "Student", "Company", "AI", "System"];

function AdminNotifications() {
  const [items, setItems] = useState(seed);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const list = useMemo(
    () =>
      items.filter(
        (n) =>
          `${n.title} ${n.body}`.toLowerCase().includes(q.toLowerCase()) &&
          (cat === "All" || n.category === cat) &&
          (!unreadOnly || !n.read),
      ),
    [items, cat, q, unreadOnly],
  );

  const unread = items.filter((n) => !n.read).length;

  return (
    <Shell
      title="Notifications"
      subtitle={`${unread} unread alerts across drives, recruiters and students`}
      actions={
        <button
          onClick={() => {
            setItems((p) => p.map((n) => ({ ...n, read: true })));
            toast.success("All notifications marked as read");
          }}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <CheckCheck className="size-3.5" /> Mark all read
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Unread" value={unread} hint="requires attention" />
        <Kpi
          label="High Priority"
          value={items.filter((n) => n.priority === "High").length}
          hint="escalations"
        />
        <Kpi
          label="Drive Alerts"
          value={items.filter((n) => n.category === "Drive").length}
          hint="pipeline updates"
        />
        <Kpi label="Upcoming Events" value={schedules.length} hint="next 10 days" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel bodyClassName="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <Bell className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search notifications…"
                  className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                  className="accent-foreground"
                />
                Unread only
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {ADMIN_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${
                    cat === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="mt-4" bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {list.map((n) => (
                <li
                  key={n.id}
                  className={`px-5 py-4 transition-colors ${n.read ? "" : "bg-muted/50"}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {!n.read && <span className="size-1.5 rounded-full bg-primary" />}
                    <p className="text-sm font-semibold">{n.title}</p>
                    <Pill tone={n.priority === "High" ? "solid" : "muted"}>{n.category}</Pill>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {n.time}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{n.body}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() =>
                        setItems((p) => p.map((x) => (x.id === n.id ? { ...x, read: !x.read } : x)))
                      }
                      className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium hover:bg-accent"
                    >
                      Mark as {n.read ? "unread" : "read"}
                    </button>
                    <button
                      onClick={() => {
                        setItems((p) => p.filter((x) => x.id !== n.id));
                        toast.success("Notification dismissed");
                      }}
                      className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium hover:bg-accent"
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
              {list.length === 0 && (
                <li className="flex flex-col items-center gap-2 px-5 py-16 text-center">
                  <BellOff className="size-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">You are all caught up.</p>
                </li>
              )}
            </ul>
          </Panel>
        </div>

        <Panel
          title="Event Reminders"
          description="Auto-generated from the drive calendar"
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border">
            {schedules.map((s) => (
              <li key={s.id} className="flex gap-3 px-5 py-3.5">
                <div className="w-12 shrink-0 rounded-md border border-border py-1 text-center">
                  <p className="font-mono text-[10px] uppercase text-muted-foreground">
                    {s.date.split(" ")[0]}
                  </p>
                  <p className="stat-num text-sm">{s.date.split(" ")[1]}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{s.title}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {s.time} · {s.company}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </Shell>
  );
}

function NotificationsPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<"loading" | "admin" | "student" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    me()
      .then((current) => {
        if (cancelled) return;
        if (!current) {
          void navigate({
            to: "/candidate-auth",
            search: { mode: "login" },
            replace: true,
          });
        } else {
          setView(current.role === "institution_staff" ? "admin" : "student");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : null);
          setView("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (view === "loading") return <LoadingScreen />;
  if (view === "error") return <ErrorScreen message={errorMessage} />;
  if (view === "admin") return <AdminNotifications />;
  return <StudentNotifications />;
}
