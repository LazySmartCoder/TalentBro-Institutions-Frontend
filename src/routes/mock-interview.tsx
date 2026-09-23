import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, Building2, CheckCircle2, UserRoundCog } from "lucide-react";
import { AppNavHeader } from "@/components/tb/app-nav";
import { PanelRoom, type PanelMsg } from "@/components/panel";
import { GateError, GateLoading, QuoteSplashContent } from "@/components/load-state";
import { INTERVIEW_MOTIVATION_QUOTES } from "@/lib/quotes";
import {
  candidateCompanies,
  completeMockInterview,
  completeMockInterviewKeepalive,
  getDrives,
  me,
  mockInterviewDetail,
  mockInterviews,
  replyMockInterview,
  resumeMockInterview,
  startMockInterview,
  recordViolation,
  type AuthUser,
  type MockInterview,
  type MockInterviewDuration,
  type PanelistId,
  type ServerMockMessage,
} from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PANELIST_OPTIONS: {
  id: PanelistId;
  name: string;
  note: string;
  img?: string;
}[] = [
  { id: "albert", name: "Albert", note: "Technical architect", img: "/Panelists/Albert.png" },
  { id: "maya", name: "Maya", note: "Communication & HR", img: "/Panelists/Maya.png" },
  { id: "peter", name: "Peter", note: "Management & leadership", img: "/Panelists/Peter.png" },
  { id: "daniel", name: "Daniel", note: "Decision science", img: "/Panelists/Daniel.png" },
  { id: "ada", name: "Ada", note: "Analytical & logical", img: "/Panelists/Ada.png" },
  { id: "carl", name: "Carl", note: "Behavioral intelligence", img: "/Panelists/Carl.png" },
];

const DEFAULT_PANELISTS: PanelistId[] = ["atlas", ...PANELIST_OPTIONS.map((p) => p.id)];

const DURATION_OPTIONS: { id: MockInterviewDuration; label: string; hint: string }[] = [
  { id: "standard", label: "Standard", hint: "~15 min" },
  { id: "long", label: "Long", hint: "~30 min" },
];

const DURATION_MINUTES: Record<MockInterviewDuration, number> = {
  short: 10,
  standard: 15,
  long: 30,
};

const title = "TalentBro | Mock Interview";
const description = "Practice a realistic mock interview for the company of your choice.";

// Called from the Start/Open click that sends the user into a session — a real
// user gesture, so it grants the page sound permission. Resuming an
// AudioContext inside that gesture makes the mic unlock smoothly; this is the
// same "land in the room, the panel just starts talking" pattern the GD room
// uses. If a cold browser still holds the first clip back, the voice engine
// lights a "tap anywhere" hint and replays the clip on the user's first tap,
// exactly like it does there. NOTE: we deliberately do NOT prime
// speechSynthesis here — a speak() on a cold page wedges Chrome's fallback
// voice into silent failure, which is precisely what bit the first line.
function unlockBrowserAudio() {
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      const ctx = new AC();
      void ctx.resume();
      window.setTimeout(() => void ctx.close().catch(() => {}), 5000);
    }
  } catch {
    // noop
  }
  try {
    // Ask the browser to start resolving TTS voices without speaking anything.
    if (typeof window.speechSynthesis !== "undefined") {
      void window.speechSynthesis.getVoices();
    }
  } catch {
    // noop
  }
}

export const Route = createFileRoute("/mock-interview")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: MockInterviewPage,
});

function MockInterviewPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [mode, setMode] = useState<"setup" | "launching" | "session">("setup");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [preferredRoles, setPreferredRoles] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [duration, setDuration] = useState<MockInterviewDuration>("standard");
  const [panelists, setPanelists] = useState<PanelistId[]>(DEFAULT_PANELISTS);

  const [list, setList] = useState<MockInterview[]>([]);
  const [active, setActive] = useState<MockInterview | null>(null);
  const [panelMsg, setPanelMsg] = useState<ServerMockMessage[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelDone, setPanelDone] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [breakLeft, setBreakLeft] = useState(60);
  const breakEndRef = useRef(0);
  const resumeRef = useRef<() => void>(() => {});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [suspection, setSuspection] = useState(0);

  const activeRef = useRef<MockInterview | null>(null);
  const inSessionRef = useRef(false);
  const panelDoneRef = useRef(false);

  useEffect(() => {
    activeRef.current = active;
    panelDoneRef.current = panelDone;
    inSessionRef.current = mode === "session";
  }, [active, panelDone, mode]);

  useEffect(() => {
    return () => {
      if (
        inSessionRef.current &&
        !panelDoneRef.current &&
        activeRef.current &&
        activeRef.current.status !== "completed"
      ) {
        void completeMockInterview(activeRef.current.id).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const onUnload = () => {
      if (
        inSessionRef.current &&
        !panelDoneRef.current &&
        activeRef.current &&
        activeRef.current.status !== "completed"
      ) {
        completeMockInterviewKeepalive(activeRef.current.id);
      }
    };
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    me()
      .then(async (current) => {
        if (cancelled) return;
        if (!current) {
          void navigate({ to: "/candidate-auth", search: { mode: "login" }, replace: true });
          return;
        }
        if (current.profile_complete === false) {
          void navigate({ to: "/onboarding", replace: true });
          return;
        }
        setUser(current);
        const p = current?.profile as Record<string, unknown> | undefined;
        const roles = Array.isArray(p?.["preferred_roles"])
          ? (p["preferred_roles"] as unknown[]).map(String).filter(Boolean)
          : [];
        if (!cancelled) setPreferredRoles(roles);
        try {
          const interviews = await mockInterviews();
          if (!cancelled) setList(interviews);
        } catch {
          // offline — session list stays empty
        }
        let companyList: string[] = [];
        try {
          companyList = await candidateCompanies();
        } catch {
          // candidate companies unavailable — fall back below
        }
        if (companyList.length === 0) {
          try {
            const { drives } = await getDrives();
            companyList = Array.from(new Set(drives.map((d) => d.company_name).filter(Boolean)));
          } catch {
            // drives unavailable — no companies to show
          }
        }
        if (!cancelled) setCompanies(companyList);
        if (!cancelled) setStatus("ready");
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

  async function handleStart() {
    const c = company.trim();
    if (!c || sending) return;
    // The submit click that reaches here is the very user gesture the browser
    // wants for audio — warm the page up inside it so the panel's first line
    // can autoplay when the room mounts.
    unlockBrowserAudio();
    setSending(true);
    setError("");
    // Hold on a 6s launching screen while the session is created on the server,
    // then land the candidate in the room only once both are ready.
    setMode("launching");
    try {
      const [res] = await Promise.all([
        startMockInterview({
          company_name: c,
          role: role.trim(),
          questions: [],
          duration,
          panelists: panelists.includes("atlas") ? panelists : ["atlas", ...panelists],
        }),
        new Promise<void>((resolve) => window.setTimeout(resolve, 6000)),
      ]);
      setActive(res.interview);
      setPanelMsg(res.interview.messages ?? []);
      setPanelDone(res.interview.status === "completed");
      setSuspection(res.interview.suspection ?? 0);
      setList((prev) => {
        const idx = prev.findIndex((i) => i.id === res.interview.id);
        if (idx === -1) return [...prev, res.interview];
        const next = [...prev];
        next[idx] = res.interview;
        return next;
      });
      setCompany("");
      setRole("");
      setDuration("standard");
      setPanelists(DEFAULT_PANELISTS);
      setMode("session");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the interview.");
      setMode("setup");
    } finally {
      setSending(false);
    }
  }

  async function openInterview(id: string) {
    setError("");
    unlockBrowserAudio();
    const found = list.find((i) => i.id === id);
    if (found) setActive(found);
    setMode("session");
    try {
      const detail = await mockInterviewDetail(id);
      setActive(detail);
      setPanelMsg(detail.messages ?? []);
      setPanelDone(detail.status === "completed");
      setSuspection(detail.suspection ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the interview.");
    }
  }

  function openAnalysis(id: string) {
    void navigate({ to: "/interview-analysis/$interviewId", params: { interviewId: id } });
  }

  function openTranscript(id: string) {
    void navigate({ to: "/mock-interview-transcript/$interviewId", params: { interviewId: id } });
  }

  async function sendPanel(raw?: string) {
    const text = (raw ?? "").trim();
    if (!text || panelLoading || !active || panelDone || onBreak) return;

    const userMsg: ServerMockMessage = {
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    const optimistic = [...panelMsg, userMsg];
    setPanelMsg(optimistic);
    setPanelLoading(true);
    setError("");
    try {
      const { reply, panelist, done, tone } = await replyMockInterview(active.id, text);
      const assistantMsg: ServerMockMessage = {
        role: "assistant",
        panelist: panelist ?? "atlas",
        tone: tone ?? "",
        content: reply,
        created_at: new Date().toISOString(),
      };
      setPanelMsg([...optimistic, assistantMsg]);
      if (done) setPanelDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setPanelMsg([
        ...optimistic,
        {
          role: "assistant",
          panelist: "atlas",
          content: `\u26a0 ${err instanceof Error ? err.message : "Something went wrong. Please try again."}`,
          created_at: "",
        },
      ]);
    } finally {
      setPanelLoading(false);
    }
  }

  function panelMessagesToView(messages: ServerMockMessage[]): PanelMsg[] {
    const now = Date.now();
    return messages
      .filter((m) => m.content || m.role === "user")
      .map((m, i) => ({
        id: i,
        from: m.role === "user" ? "you" : m.panelist || "atlas",
        text: m.content,
        time: m.created_at
          ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : new Date(now + i * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }));
  }

  function newInterview() {
    if (active && active.status !== "completed") {
      void completeMockInterview(active.id)
        .then((updated) => {
          setList((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        })
        .catch(() => {});
    }
    setMode("setup");
    setActive(null);
    setPanelMsg([]);
    setPanelDone(false);
    setOnBreak(false);
    setBreakLeft(60);
    setSuspection(0);
    setError("");
  }

  function onCameraViolation() {
    if (panelDone || !active) return;
    breakEndRef.current = Date.now() + 60_000;
    setBreakLeft(60);
    setOnBreak(true);
    setSuspection((s) => s + 1);
    void recordViolation(active.id)
      .then((updated) => {
        setList((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      })
      .catch(() => {});
  }

  resumeRef.current = () => {
    if (!active || panelDone) return;
    setPanelLoading(true);
    resumeMockInterview(active.id)
      .then(({ reply, panelist, done }) => {
        const assistantMsg: ServerMockMessage = {
          role: "assistant",
          panelist: panelist ?? "atlas",
          tone: "",
          content: reply,
          created_at: new Date().toISOString(),
        };
        setPanelMsg((prev) => [...prev, assistantMsg]);
        if (done) setPanelDone(true);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not resume the interview.");
      })
      .finally(() => setPanelLoading(false));
  };

  useEffect(() => {
    if (!onBreak) return;
    const iv = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((breakEndRef.current - Date.now()) / 1000));
      setBreakLeft(left);
      if (left <= 0) {
        window.clearInterval(iv);
        setOnBreak(false);
        resumeRef.current();
      }
    }, 250);
    return () => window.clearInterval(iv);
  }, [onBreak]);

  if (status === "loading") {
    return <GateLoading />;
  }

  if (status === "error" || !user) {
    return <GateError message={errorMessage} />;
  }

  if (mode === "launching") {
    return <MockInterviewLaunchLoader company={company} role={role} panelists={panelists} />;
  }

  if (mode === "session") {
    return (
      <PanelRoom
        candidateName={user.name}
        candidateAvatar={user.avatar}
        context={`${active?.company_name ?? "Mock Interview"}${active?.role ? ` · ${active.role}` : ""}`}
        messages={panelMessagesToView(panelMsg)}
        loading={panelLoading}
        done={panelDone}
        panelists={active?.panelists}
        paused={onBreak}
        breakLeft={breakLeft}
        suspection={suspection}
        onViolation={onCameraViolation}
        onSend={(text) => void sendPanel(text)}
        onExit={newInterview}
        onLockViolation={newInterview}
        durationMinutes={active ? DURATION_MINUTES[active.duration] : undefined}
        startedAt={active?.created_at}
        {...(active?.id ? { onViewAnalysis: () => openAnalysis(active.id) } : {})}
      />
    );
  }

  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <AppNavHeader
        current="mock-interview"
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
              <BriefcaseBusiness className="size-4" />
            </span>
            <span>
              <p className="text-sm font-semibold leading-tight">Mock Interview</p>
            </span>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
          <div className="flex flex-1 flex-col justify-center py-8">
            <div className="mb-6 flex flex-col items-center text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-foreground text-background">
                <BriefcaseBusiness className="size-7" />
              </span>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight">Mock Interview</h1>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Your dream company called. 📞
                <br />
                Well… not really.
                <br />
                Pick the company, choose your role, hit Start, and let our AI interview panel test
                if you're actually ready. 😭
              </p>
            </div>

            <form
              className="space-y-4 rounded-2xl border border-border bg-card p-5"
              onSubmit={(e) => {
                e.preventDefault();
                void handleStart();
              }}
            >
              <div>
                <label className="text-xs font-medium" htmlFor="mi-company">
                  Target company <span className="text-red-500">*</span>
                </label>
                {companies.length > 0 ? (
                  <Select value={company} onValueChange={setCompany}>
                    <SelectTrigger id="mi-company" className="mt-1.5 h-10">
                      <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <input
                    id="mi-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Google, Infosys, TCS…"
                    className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/25"
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-medium" htmlFor="mi-role">
                  Role <span className="text-red-500">*</span>
                </label>
                {preferredRoles.length > 0 ? (
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger id="mi-role" className="mt-1.5 h-10">
                      <SelectValue placeholder="Select a preferred role" />
                    </SelectTrigger>
                    <SelectContent>
                      {preferredRoles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1.5 flex items-stretch gap-2">
                    <div className="flex flex-1 flex-col justify-center rounded-md border border-dashed border-input bg-muted/30 px-3 py-2.5">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        No preferred roles in your profile yet.
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/80">
                        Add the roles you're targeting (e.g. Software Engineer, Data Analyst) so
                        your mock interview is tailored to them.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void navigate({ to: "/candidate-profile" })}
                      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      <UserRoundCog className="size-3.5" />
                      Add roles
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium" htmlFor="mi-duration">
                  Interview length
                </label>
                <div id="mi-duration" className="mt-1.5 grid grid-cols-2 gap-2">
                  {DURATION_OPTIONS.map((opt) => {
                    const active = duration === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDuration(opt.id)}
                        aria-pressed={active}
                        className={`cursor-pointer rounded-md border px-3 py-2 text-left transition-colors ${
                          active
                            ? "border-foreground bg-foreground text-background"
                            : "border-input bg-background text-muted-foreground hover:bg-muted/60"
                        }`}
                      >
                        <span className="block text-sm font-medium">{opt.label}</span>
                        <span
                          className={`mt-0.5 block text-[11px] ${active ? "text-background/70" : "text-muted-foreground"}`}
                        >
                          {opt.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium">Panelists</label>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Pick who should interview you — e.g. only Communication or only Technical.
                </p>
                <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                  {PANELIST_OPTIONS.map((opt) => {
                    const active = panelists.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 transition-colors ${
                          active
                            ? "border-foreground/60 bg-muted/60"
                            : "border-input bg-background hover:bg-muted/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() =>
                            setPanelists((prev) =>
                              prev.includes(opt.id)
                                ? prev.filter((p) => p !== opt.id)
                                : [...prev, opt.id],
                            )
                          }
                          className="size-4 accent-foreground"
                        />
                        {opt.img ? (
                          <img
                            src={opt.img}
                            alt={opt.name}
                            className="size-9 shrink-0 rounded-full border border-border object-cover"
                          />
                        ) : (
                          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-muted text-[10px] tracking-[0.1em] text-muted-foreground">
                            {opt.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{opt.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {opt.note}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {panelists.length === 0 && (
                  <p className="mt-1.5 text-[11px] text-amber-600">Select at least one panelist.</p>
                )}
              </div>

              {error && (
                <p className="rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-500">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!company.trim() || !role.trim() || panelists.length === 0 || sending}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-foreground py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? (
                  <>
                    <span className="size-3 animate-spin rounded-full border-2 border-background/40 border-t-background" />
                    Starting interview…
                  </>
                ) : (
                  <>
                    <BriefcaseBusiness className="size-4" /> Start Mock Interview
                  </>
                )}
              </button>
            </form>

            {list.length > 0 && (
              <div className="mt-8">
                <p className="mb-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                  Past interviews
                </p>
                <div className="space-y-2">
                  {list.slice(0, 6).map((i) => (
                    <div
                      key={i.id}
                      className="group flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/60"
                      onClick={() =>
                        i.status === "completed"
                          ? void openTranscript(i.id)
                          : void openInterview(i.id)
                      }
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted">
                        <Building2 className="size-4 text-muted-foreground" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{i.company_name}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                          {i.role || "General"} · {i.message_count} turns
                        </p>
                      </div>
                      <div className="ml-auto flex shrink-0 items-center gap-2">
                        {i.status === "completed" && (
                          <>
                            <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void openAnalysis(i.id);
                              }}
                              className="shrink-0 cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium transition-colors hover:bg-muted"
                            >
                              Analyze
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 6-second launching screen shown between hitting "Start Mock Interview" and
// the panel room mounting. Shows the panelists being seated and a live countdown
// so the wait never feels frozen.
function MockInterviewLaunchLoader({
  company,
  role,
  panelists,
}: {
  company: string;
  role: string;
  panelists: PanelistId[];
}) {
  const [remaining, setRemaining] = useState(6000);

  useEffect(() => {
    const start = Date.now();
    const iv = window.setInterval(() => {
      setRemaining(Math.max(0, 6000 - (Date.now() - start)));
    }, 100);
    return () => window.clearInterval(iv);
  }, []);

  const seconds = Math.ceil(remaining / 1000);
  const pct = Math.min(100, ((6000 - remaining) / 6000) * 100);
  const seated = panelists.includes("atlas" as PanelistId) ? panelists : ["atlas", ...panelists];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-muted-foreground">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="relative grid size-14 place-items-center rounded-2xl bg-foreground text-background">
          <BriefcaseBusiness className="size-7" />
          <span className="absolute -inset-2 -z-10 animate-ping rounded-2xl bg-foreground/10" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Preparing your interview panel
        </h1>
        <p className="text-sm">
          {company}
          {role ? ` · ${role}` : ""}
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <QuoteSplashContent count={3} durationMs={6000} quotes={INTERVIEW_MOTIVATION_QUOTES} />
        <div className="flex items-center gap-3">
          {seated.map((id) => {
            const opt = PANELIST_OPTIONS.find((p) => p.id === id);
            return (
              <span key={id} className="relative shrink-0">
                {opt?.img ? (
                  <img
                    src={opt.img}
                    alt={opt.name}
                    className="size-11 rounded-full border border-border object-cover"
                  />
                ) : (
                  <span className="grid size-11 place-items-center rounded-full border border-border bg-muted text-[10px] tracking-[0.1em] text-muted-foreground">
                    AT
                  </span>
                )}
                <span className="absolute -right-0.5 -bottom-0.5 flex size-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex size-3 rounded-full border border-background bg-emerald-400" />
                </span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="w-full max-w-xs">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em]">
          <span>Entering interview room</span>
          <span>{seconds}s</span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-150 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
