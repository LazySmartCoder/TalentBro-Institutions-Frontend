import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  History,
  Lightbulb,
  Loader2,
  MessageSquareText,
  Send,
} from "lucide-react";
import { AppNavHeader } from "@/components/tb/app-nav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiError,
  englishTrainingChat,
  englishTrainingDetail,
  englishTrainingFinalize,
  englishTrainingStart,
  finalizeEnglishTrainingKeepalive,
  me,
  type AuthUser,
  type EnglishTrainingRecord,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { GateError, GateLoading, useQuoteSplash } from "@/components/load-state";

const title = "TalentBro | English Trainer";
const description =
  "Train your corporate English with Maya — write emails, messages and letters, get focused corrections, and track your writing score.";

export const Route = createFileRoute("/english-training")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: EnglishTrainingPage,
});

const WELCOME_MESSAGE =
  "Hey! I'm Maya — your English writing coach. We'll build your corporate writing by typing to each other, and I'll correct your grammar, tone and structure as we go. First task: write a short email to a recruiter thanking them for the interview and asking about the next steps.";

// Tailored opening for returning students, based on their one running record so
// each visit picks up exactly where the last one left off.
function buildEnglishIceBreaker(record: EnglishTrainingRecord | null): string {
  if (!record || record.practice_count === 0) return WELCOME_MESSAGE;
  const score = record.writing_score ?? 0;
  const scoreNote =
    score >= 80
      ? `Great going — you're at ${score} out of 100.`
      : `So far you're at ${score} out of 100.`;
  const focus = (record.areas_for_improvement || "").trim().split(/[.!?]/)[0]?.trim();
  const focusNote = focus
    ? `Today let's keep sharpening your ${focus.charAt(0).toLowerCase()}${focus.slice(1)}.`
    : "Let's keep building your clarity and structure.";
  return `Hey, welcome back! ${scoreNote} ${focusNote} Send me your next piece of writing whenever you're ready.`;
}

function scoreLevel(score: number): { label: string; color: string; ring: string } {
  if (score >= 90)
    return { label: "Polished", color: "text-emerald-500", ring: "ring-emerald-500/40" };
  if (score >= 70) return { label: "Proficient", color: "text-sky-500", ring: "ring-sky-500/40" };
  if (score >= 40)
    return { label: "Developing", color: "text-amber-500", ring: "ring-amber-500/40" };
  return { label: "Beginner", color: "text-indigo-500", ring: "ring-indigo-500/40" };
}

type ChatMsg = {
  id: string;
  role: "user" | "mentor";
  text: string;
};

// A finalize that was fired but never confirmed by the backend is persisted to
// sessionStorage so a dropped/keepalive/mid-flight finalize is retried on the
// next page load — Maya's analysis never silently gets skipped.
const FINALIZE_FLAG_KEY = "tb:english-training-finalize";

function readFinalizeFlag(): boolean {
  try {
    return window.sessionStorage.getItem(FINALIZE_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFinalizeFlag(flag: boolean): void {
  try {
    if (flag) window.sessionStorage.setItem(FINALIZE_FLAG_KEY, "1");
    else window.sessionStorage.removeItem(FINALIZE_FLAG_KEY);
  } catch {
    // noop — best-effort only.
  }
}

function EnglishTrainingPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { splash, splashDone } = useQuoteSplash();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [record, setRecord] = useState<EnglishTrainingRecord | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [settling, setSettling] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(0);
  const aliveRef = useRef(true);
  const startedRef = useRef(false);
  const finalizedRef = useRef(false); // this page visit's analysis was already flushed
  const practicedRef = useRef(false); // the student actually typed this visit

  const nextId = (prefix: string) => `${prefix}-${++idRef.current}`;

  // Keep the newest message visible.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  // The visit ends the moment the student leaves (button, navigation, closing
  // the tab). Re-run Maya's analysis over their one EnglishTraining record if
  // they actually practised: a normal POST on unmount, and a keepalive request
  // on pagehide/beforeunload so even a sudden browser close flushes it. The
  // flag is queued until the backend confirms so a failure is retried on the
  // next page load (idempotent — the analysis simply re-runs).
  function finalizeRecord(): Promise<void> {
    if (!practicedRef.current || finalizedRef.current) return Promise.resolve();
    finalizedRef.current = true;
    writeFinalizeFlag(true);
    return englishTrainingFinalize()
      .then((res) => {
        if (res && res.ok) writeFinalizeFlag(false);
      })
      .catch((err: unknown) => {
        // Keep it queued — retried on the next page load.
        if (err instanceof ApiError && err.status === 401) writeFinalizeFlag(false);
      });
  }

  function finalizeRecordKeepalive() {
    if (!practicedRef.current || finalizedRef.current) return;
    finalizedRef.current = true;
    writeFinalizeFlag(true);
    finalizeEnglishTrainingKeepalive();
  }

  useEffect(() => {
    aliveRef.current = true;
    const onUnload = () => finalizeRecordKeepalive();
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
      aliveRef.current = false;
      finalizeRecord();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    me()
      .then((current) => {
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
        setStatus("ready");
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

  // Open the conversation once the page is ready: Maya greets first, then the
  // student types back. If the backend is unreachable we still greet locally so
  // the text box keeps working.
  useEffect(() => {
    if (status !== "ready" || startedRef.current) return;
    startedRef.current = true;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await englishTrainingStart();
          if (!aliveRef.current) return;
          setRecord(res.record);
          setMessages([{ id: nextId("m"), role: "mentor", text: res.reply }]);
        } catch {
          let rec: EnglishTrainingRecord | null = null;
          try {
            rec = await englishTrainingDetail();
            if (aliveRef.current) setRecord(rec);
          } catch {
            // Nothing stored to load into the record.
          }
          if (!aliveRef.current) return;
          setMessages([{ id: nextId("m"), role: "mentor", text: buildEnglishIceBreaker(rec) }]);
        }
      })();
    }, 300);
    return () => window.clearTimeout(t);
  }, [status]);

  // Retry any finalize that was never confirmed (dropped keepalive, failed
  // request, tab crash) right when the page returns, then refresh the record.
  useEffect(() => {
    if (status !== "ready") return;
    if (!readFinalizeFlag()) return;
    englishTrainingFinalize()
      .then(async (res) => {
        if (!res.ok) return;
        writeFinalizeFlag(false);
        const rec = await englishTrainingDetail().catch(() => null);
        if (rec && aliveRef.current) setRecord(rec);
      })
      .catch(() => {
        // Stay queued — retried the next time the page loads.
      });
  }, [status]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setError("");
    setBusy(true);
    practicedRef.current = true;
    setMessages((prev) => [...prev, { id: nextId("u"), role: "user", text }]);
    try {
      const res = await englishTrainingChat(text);
      if (!aliveRef.current) return;
      setMessages((prev) => [...prev, { id: nextId("m"), role: "mentor", text: res.reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not reach your coach right now.";
      if (!aliveRef.current) return;
      setError(msg);
      setMessages((prev) => [...prev, { id: nextId("e"), role: "mentor", text: msg }]);
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }

  function stopEverything() {
    finalizeRecord();
    void navigate({ to: "/self-training", replace: true });
  }

  async function endRound() {
    if (settling) return;
    setSettling(true);
    try {
      await finalizeRecord();
    } catch {
      // Best-effort — history stays reachable even if the save failed.
    } finally {
      setSettling(false);
    }
    void navigate({ to: "/english-training-history" });
  }

  if (!splashDone) return splash;

  if (status === "loading") {
    return <GateLoading />;
  }

  if (status === "error" || !user) {
    return <GateError message={errorMessage} />;
  }

  const score = record?.writing_score ?? 0;
  const level = scoreLevel(score);
  const practiceCount = record?.practice_count ?? 0;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppNavHeader
        current="self-training"
        sticky
        left={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={stopEverything}
              className="grid size-8 cursor-pointer place-items-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Leave Self Training"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="grid size-9 place-items-center rounded-lg bg-foreground text-background">
              <MessageSquareText className="size-4" />
            </span>
            <span>
              <p className="text-sm font-semibold leading-tight">English Trainer</p>
              <p className="text-[11px] text-muted-foreground">
                Corporate writing practice with Maya
              </p>
            </span>
          </div>
        }
      />

      <main className="mx-auto flex h-[calc(100svh-56px)] w-full max-w-3xl flex-col px-4 py-3 sm:px-6">
        {/* Coach header */}
        <div className="flex items-center gap-3 rounded-xl border border-amber-400/20 bg-card/60 p-3 shadow-lg shadow-amber-500/5 backdrop-blur">
          <div className="relative shrink-0">
            <img
              src="/Panelists/Maya.png"
              alt="Maya"
              className={cn("size-11 rounded-full object-cover ring-2", level.ring)}
            />
            <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-background" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">
              Maya <span className="font-normal text-muted-foreground">· English coach</span>
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {busy ? "Maya is typing…" : "Type your reply and press Enter to send"}
            </p>
          </div>
          <div className="ml-auto shrink-0 text-right">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Score
            </p>
            <p className={cn("text-xl font-semibold leading-tight", level.color)}>
              {record ? score : "—"}
              {record ? <span className="text-xs text-muted-foreground">/100</span> : null}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {practiceCount} practice{practiceCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pb-3 pr-1">
          {messages.map((m) => (
            <ChatBubble key={m.id} msg={m} user={user} />
          ))}
          {busy && (
            <div className="flex items-end gap-2">
              <img
                src="/Panelists/Maya.png"
                alt="Maya"
                className="size-8 shrink-0 rounded-full object-cover"
              />
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Maya is typing…
              </div>
            </div>
          )}
          {error && !busy && <p className="text-center text-xs text-red-500">{error}</p>}
        </div>

        {/* Composer */}
        <div className="mt-2 flex items-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void navigate({ to: "/english-training-history" })}
            className="h-12 w-12 shrink-0 cursor-pointer"
            aria-label="History and analysis"
            title="History &amp; analysis"
          >
            <History className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void navigate({ to: "/english-training-tips" })}
            className="h-12 w-12 shrink-0 cursor-pointer"
            aria-label="Tips"
            title="Tips"
          >
            <Lightbulb className="size-4" />
          </Button>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            rows={1}
            placeholder="Type your message to Maya…"
            disabled={busy || settling}
            className="max-h-40 min-h-12 flex-1 resize-none"
            maxLength={600}
          />
          <Button
            type="button"
            onClick={() => void sendMessage()}
            disabled={busy || settling || !draft.trim()}
            size="icon"
            className="h-12 w-12 shrink-0 cursor-pointer"
            aria-label="Send message"
          >
            <Send className="size-4" />
          </Button>
        </div>

        {/* End round */}
        <Button
          type="button"
          variant="outline"
          onClick={() => void endRound()}
          disabled={settling || busy}
          className="mt-2 w-full cursor-pointer gap-2"
        >
          {settling ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {settling ? "Saving round…" : "End Round"}
        </Button>
      </main>
    </div>
  );
}

function ChatBubble({ msg, user }: { msg: ChatMsg; user: AuthUser | null }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn("flex max-w-[85%] items-end gap-2", isUser ? "flex-row-reverse" : "flex-row")}
      >
        {isUser ? (
          user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name || "You"}
              className="size-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-orange-500/15 text-[11px] font-semibold text-orange-600">
              {(user?.name || user?.email || "Y").slice(0, 2).toUpperCase()}
            </span>
          )
        ) : (
          <img
            src="/Panelists/Maya.png"
            alt="Maya"
            className="size-8 shrink-0 rounded-full object-cover"
          />
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm border border-border bg-background text-foreground",
          )}
        >
          {msg.text}
        </div>
      </div>
    </div>
  );
}
