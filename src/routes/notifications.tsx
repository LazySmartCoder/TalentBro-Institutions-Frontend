import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BellOff,
  Building2,
  CalendarClock,
  CheckCheck,
  Loader2,
  Megaphone,
  Pin,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AppNavHeader } from "@/components/tb/app-nav";
import { toast } from "sonner";
import { Shell } from "@/components/dash/Shell";
import { Kpi, Panel, Pill } from "@/components/dash/bits";
import {
  createNotification,
  deleteNotification,
  getDrives,
  getNotifications,
  markNotificationsRead,
  me,
  type NotificationItem,
  type NotificationSender,
  type PlacementDrive,
} from "@/lib/api";
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

const SENDER_ICONS: Record<NotificationSender, typeof Building2> = {
  "Placement Cell": Building2,
  "TalentBro Platform": Sparkles,
};

function StudentNotifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sender, setSender] = useState<"All" | NotificationSender>("All");
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    getNotifications()
      .then((data) => {
        if (cancelled) return;
        setItems(data.notifications);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // No demo feed on failure: an honest "couldn't load" beats announcements
        // the placement cell never actually sent.
        setItems([]);
        setLoadError(err instanceof Error ? err.message : "Could not load announcements.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const list = useMemo(() => {
    const filtered = (items ?? []).filter(
      (n) => (sender === "All" || n.sender === sender) && (!unreadOnly || !n.read),
    );
    return filtered
      .slice()
      .sort(
        (a, b) =>
          Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || Number(a.read) - Number(b.read),
      );
  }, [items, sender, unreadOnly]);

  const unread = (items ?? []).filter((n) => !n.read).length;

  const senders: ("All" | NotificationSender)[] = ["All", "Placement Cell", "TalentBro Platform"];

  function markAllRead() {
    setItems((p) => (p ?? []).map((n) => ({ ...n, read: true })));
    void markNotificationsRead(undefined, true).catch(() => {});
  }

  function markRead(id: string) {
    const target = (items ?? []).find((n) => n.id === id);
    if (!target || target.read) return;
    setItems((p) => (p ?? []).map((n) => (n.id === id ? { ...n, read: true } : n)));
    void markNotificationsRead(id).catch(() => {});
  }

  function openNotification(n: NotificationItem) {
    if (n.redirect_path) {
      markRead(n.id);
      // `href` (not `to`) because redirect paths may carry a query string —
      // e.g. /student-message?peer=<candidate id> for a new direct message.
      void navigate({ href: n.redirect_path });
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
            const ItemIcon = n.sender === "Placement Cell" ? Building2 : Sparkles;
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
                    <ItemIcon className="size-3" />
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
                  {n.redirect_path ? (
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
              <p className="text-sm text-muted-foreground">
                {loadError
                  ? loadError
                  : items === null
                    ? "Loading announcements…"
                    : "No announcements match right now."}
              </p>
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

const SENDERS: ("All" | NotificationSender)[] = ["All", "Placement Cell", "TalentBro Platform"];

type Reminder = {
  key: string;
  at: number;
  day: string;
  month: string;
  title: string;
  meta: string;
};

// Campus visits and application deadlines straight off the recorded drives —
// the calendar the placement cell actually maintains.
function buildReminders(drives: PlacementDrive[]): Reminder[] {
  const rows: Reminder[] = [];
  // Only forward-looking dates belong in an "upcoming" list, so anything that
  // has already passed is dropped rather than sorted to the top.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  for (const drive of drives) {
    const add = (iso: string | null, kind: string) => {
      if (!iso) return;
      const date = new Date(iso);
      if (Number.isNaN(date.getTime()) || date.getTime() < startOfToday.getTime()) return;
      rows.push({
        key: `${drive.company_id}-${kind}-${iso}`,
        at: date.getTime(),
        day: String(date.getDate()),
        month: date.toLocaleDateString("en-IN", { month: "short" }),
        title: `${drive.company_name} — ${kind}`,
        meta: `${drive.status} · ${drive.roles.slice(0, 2).join(", ") || drive.industry}`,
      });
    };
    add(drive.campus_visit_date, "Campus visit");
    add(drive.application_deadline, "Applications close");
  }
  return rows.sort((a, b) => a.at - b.at).slice(0, 8);
}

function AdminNotifications() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [drives, setDrives] = useState<PlacementDrive[]>([]);
  const [sender, setSender] = useState<"All" | NotificationSender>("All");
  const [q, setQ] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [composing, setComposing] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "", important: false, pinned: false });

  const load = useCallback(() => {
    let cancelled = false;
    setLoadError(null);
    getNotifications()
      .then((data) => {
        if (cancelled) return;
        setItems(data.notifications);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setItems([]);
        setLoadError(err instanceof Error ? err.message : "Could not load notifications.");
      });
    getDrives()
      .then((data) => {
        if (cancelled) return;
        setDrives(data.drives);
      })
      .catch(() => {
        // The reminder rail is a nice-to-have; the feed above still works.
        if (!cancelled) setDrives([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load, reloadKey]);

  const list = useMemo(
    () =>
      (items ?? []).filter(
        (n) =>
          `${n.title} ${n.body}`.toLowerCase().includes(q.toLowerCase()) &&
          (sender === "All" || n.sender === sender) &&
          (!unreadOnly || !n.read),
      ),
    [items, q, sender, unreadOnly],
  );

  const unread = (items ?? []).filter((n) => !n.read).length;
  const reminders = useMemo(() => buildReminders(drives), [drives]);
  const driveAlerts = useMemo(() => {
    const now = Date.now();
    const week = now + 7 * 24 * 60 * 60 * 1000;
    return drives.filter((d) => {
      const deadline = d.application_deadline ? new Date(d.application_deadline).getTime() : NaN;
      return !Number.isNaN(deadline) && deadline >= now && deadline <= week;
    }).length;
  }, [drives]);

  function markAllRead() {
    setItems((p) => (p ?? []).map((n) => ({ ...n, read: true })));
    markNotificationsRead(undefined, true)
      .then(() => toast.success("All notifications marked as read"))
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Could not mark them read."),
      );
  }

  function markRead(id: string) {
    setItems((p) => (p ?? []).map((n) => (n.id === id ? { ...n, read: true } : n)));
    void markNotificationsRead(id).catch(() => {
      load();
    });
  }

  function removeNotification(id: string) {
    const snapshot = items;
    setItems((p) => (p ?? []).filter((n) => n.id !== id));
    deleteNotification(id)
      .then(() => toast.success("Notification deleted"))
      .catch((err: unknown) => {
        setItems(snapshot);
        toast.error(err instanceof Error ? err.message : "Could not delete the notification.");
      });
  }

  async function sendBroadcast() {
    if (!draft.title.trim() || !draft.body.trim() || sending) return;
    setSending(true);
    try {
      const created = await createNotification({
        title: draft.title.trim(),
        body: draft.body.trim(),
        important: draft.important,
        pinned: draft.pinned,
      });
      setItems((p) => [created, ...(p ?? [])]);
      toast.success("Broadcast sent to your students");
      setDraft({ title: "", body: "", important: false, pinned: false });
      setComposing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the broadcast.");
    } finally {
      setSending(false);
    }
  }

  const inputCls =
    "h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20";

  return (
    <Shell
      title="Notifications"
      subtitle={
        items === null
          ? "Loading your inbox…"
          : `${unread} unread ${unread === 1 ? "alert" : "alerts"} from drives, recruiters and students`
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setComposing((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3.5 py-2 text-xs font-medium transition-colors hover:bg-accent"
          >
            <Megaphone className="size-3.5" /> {composing ? "Close" : "New broadcast"}
          </button>
          <button
            onClick={markAllRead}
            disabled={unread === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
        </div>
      }
    >
      {composing && (
        <Panel
          className="mb-4"
          title="Broadcast to students"
          description="Every student of your institution sees this in their announcements"
        >
          <div className="grid gap-3">
            <div>
              <label className="mono-label" htmlFor="bc-title">
                Title
              </label>
              <input
                id="bc-title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="e.g. Registration for the Barclays drive closes Friday"
                maxLength={255}
                className={`${inputCls} mt-1.5`}
              />
            </div>
            <div>
              <label className="mono-label" htmlFor="bc-body">
                Message
              </label>
              <textarea
                id="bc-body"
                rows={3}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                placeholder="Share the eligibility bar, the link to apply, or anything else students need."
                className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={draft.important}
                  onChange={(e) => setDraft({ ...draft, important: e.target.checked })}
                  className="accent-foreground"
                />
                Mark as important
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={draft.pinned}
                  onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })}
                  className="accent-foreground"
                />
                Pin to the top
              </label>
              <button
                onClick={() => void sendBroadcast()}
                disabled={sending || !draft.title.trim() || !draft.body.trim()}
                className="ml-auto inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                {sending ? "Sending…" : "Send broadcast"}
              </button>
            </div>
          </div>
        </Panel>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Unread" value={unread} hint="requires attention" />
        <Kpi
          label="Important"
          value={(items ?? []).filter((n) => n.important).length}
          hint="flagged broadcasts"
        />
        <Kpi label="Drive Alerts" value={driveAlerts} hint="deadlines within 7 days" />
        <Kpi label="Upcoming Events" value={reminders.length} hint="from your drive calendar" />
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
                  aria-label="Search notifications"
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
              {SENDERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSender(s)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${
                    sender === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="mt-4" bodyClassName="p-0">
            {loadError && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-destructive/5 px-5 py-3">
                <p className="text-xs text-destructive">{loadError}</p>
                <button
                  onClick={() => {
                    setItems(null);
                    setReloadKey((n) => n + 1);
                  }}
                  className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium hover:bg-accent"
                >
                  Try again
                </button>
              </div>
            )}
            <ul className="divide-y divide-border">
              {list.map((n) => (
                <li
                  key={n.id}
                  className={`px-5 py-4 transition-colors ${n.read ? "" : "bg-muted/50"}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {!n.read && <span className="size-1.5 rounded-full bg-primary" />}
                    <p className="text-sm font-semibold">{n.title}</p>
                    <Pill tone={n.important ? "solid" : "muted"}>
                      {n.important ? "Important" : n.sender}
                    </Pill>
                    {n.pinned && <Pin className="size-3.5 text-muted-foreground" />}
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {n.time}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{n.body}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!n.read && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium hover:bg-accent"
                      >
                        Mark as read
                      </button>
                    )}
                    <button
                      onClick={() => removeNotification(n.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium hover:bg-accent"
                    >
                      <Trash2 className="size-3" /> Delete
                    </button>
                  </div>
                </li>
              ))}
              {list.length === 0 && (
                <li className="flex flex-col items-center gap-2 px-5 py-16 text-center">
                  <BellOff className="size-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {items === null
                      ? "Loading your inbox…"
                      : loadError
                        ? "Nothing to show until the inbox loads."
                        : "You are all caught up."}
                  </p>
                </li>
              )}
            </ul>
          </Panel>
        </div>

        <Panel
          title="Event Reminders"
          description="Deadlines and campus visits from your recorded drives"
          bodyClassName="p-0"
        >
          {reminders.length > 0 ? (
            <ul className="divide-y divide-border">
              {reminders.map((r) => (
                <li key={r.key} className="flex gap-3 px-5 py-3.5">
                  <div className="w-12 shrink-0 rounded-md border border-border py-1 text-center">
                    <p className="font-mono text-[10px] uppercase text-muted-foreground">
                      {r.month}
                    </p>
                    <p className="stat-num text-sm">{r.day}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{r.title}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{r.meta}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <CalendarClock className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {drives.length === 0
                  ? "No drives recorded yet — add a company to build the calendar."
                  : "No deadlines or campus visits on the recorded drives."}
              </p>
            </div>
          )}
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
