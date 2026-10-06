import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AppNavHeader } from "@/components/tb/app-nav";
import {
  me,
  ownCandidateId,
  sendStudentMessage,
  studentMessages,
  type StudentMessage,
  type StudentMessagePeer,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { GateError, GateLoading } from "@/components/load-state";

const title = "Messages | TalentBro";
const description = "Your candidate conversations on TalentBro.";

// Where the composer stops growing and starts scrolling, in px. Must stay in
// step with its `max-h-40`, or the box would be told to be taller than it is
// allowed to paint and the last line would be cut off.
const COMPOSER_MAX_PX = 160;

// The window is always scoped to the signed-in candidate's own profile id; the
// optional `peer` param only picks which conversation is open inside it. A
// TalentBro notification tap lands here as /student-message?peer=<sender id>,
// and the thread itself is still resolved against the tapper's own session.
export const Route = createFileRoute("/candidate/student-message")({
  validateSearch: (search: Record<string, unknown>): { peer?: string } => {
    const peer = typeof search["peer"] === "string" ? search["peer"].trim() : "";
    return peer ? { peer } : {};
  },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ],
  }),
  component: StudentMessagePage,
});

function initialsOf(name?: string) {
  const source = (name || "?").trim();
  return (
    source
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] ?? "")
      .join("")
      .toUpperCase() || "?"
  );
}

function formatStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function StudentMessagePage() {
  const navigate = useNavigate();
  const { peer: peerFromUrl } = Route.useSearch();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [peer, setPeer] = useState<StudentMessagePeer | null>(null);
  const [isSelf, setIsSelf] = useState(false);
  const [thread, setThread] = useState<StudentMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  // Whether the reader is parked at the newest message. A ref, not state: the
  // scroll handler and the effect that jumps to the bottom both read it, and a
  // re-render between them would let a stale value win.
  const stickToBottom = useRef(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = await me();
        if (cancelled) return;
        if (!current) {
          void navigate({ to: "/candidate/auth", search: { mode: "login" }, replace: true });
          return;
        }
        // No ?peer= means "my own profile" — the screen never falls back to
        // someone else's candidate id.
        const ownId = ownCandidateId(current);
        const targetId = peerFromUrl ?? ownId;
        if (!targetId) {
          setErrorMessage("Your candidate profile is not set up yet.");
          setStatus("error");
          return;
        }
        const data = await studentMessages(targetId);
        if (cancelled) return;
        setPeer(data.peer);
        setIsSelf(data.is_self);
        setThread(data.messages);
        setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : null);
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, peerFromUrl]);

  // Hold the thread on its newest message. A layout effect rather than a normal
  // one so the jump happens before the browser paints the new bubble — with a
  // plain effect the reader sees the message land below the fold and then get
  // yanked, which on a phone reads as the page lurching. Skipped once the
  // reader has scrolled up, so browsing history is not interrupted by their own
  // or the other side's next message.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller && stickToBottom.current) scroller.scrollTop = scroller.scrollHeight;
  }, [thread]);

  // Size the composer to its own content: one line to begin with, exactly as
  // tall as the send button beside it, widening only once a message actually
  // wraps. Keyed on `draft` rather than the change event so clearing the box
  // after a send shrinks it again instead of leaving the last message's height
  // behind. `auto` first, because the browser only reports the height a box
  // *would* take unclamped.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_PX)}px`;
  }, [draft]);

  async function handleSend() {
    const content = draft.trim();
    const targetId = peer?.id;
    if (!content || sending || !targetId) return;
    // Enter posts from inside the composer, so the caret has to survive the
    // round-trip. Only when it was in there to begin with: a send started from
    // the button while the reader had scrolled off should not drag focus back.
    const restoreFocus = composerRef.current === document.activeElement;
    setSending(true);
    try {
      const saved = await sendStudentMessage(targetId, content);
      setThread((prev) => [...prev, saved]);
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setSending(false);
      if (restoreFocus) composerRef.current?.focus();
    }
  }

  if (status === "loading") return <GateLoading />;
  if (status === "error")
    return (
      <GateError
        message={errorMessage}
        onRetry={() =>
          void navigate({
            to: "/candidate/student-message",
            search: peerFromUrl ? { peer: peerFromUrl } : {},
          })
        }
      />
    );

  const peerName = peer?.full_name || (isSelf ? "You" : "this candidate");

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <AppNavHeader
        current="chat"
        sticky
        left={
          <div className="flex min-w-0 items-center gap-2.5">
            {/* The way back depends on how the thread was opened: your own profile
                is reached from the leaderboard, someone else's from their detail
                page. One button, so the nav row cannot disagree with itself. */}
            <button
              type="button"
              onClick={() =>
                isSelf
                  ? void navigate({ to: "/candidate/leaderboard" })
                  : void navigate({
                      to: "/student-detail/$studentId",
                      params: { studentId: peer?.id ?? "" },
                    })
              }
              className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={isSelf ? "Back to Leaderboard" : "Back to candidate"}
            >
              <ArrowLeft className="size-4" />
            </button>
            <Avatar className="size-9 shrink-0 rounded-lg">
              <AvatarFallback className="rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                {initialsOf(peerName)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{peerName}</p>
            </span>
          </div>
        }
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
        {isSelf ? (
          <div className="flex-1 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              This window always belongs to your own candidate profile.
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Open a candidate from the leaderboard and tap{" "}
              <span className="font-medium text-foreground">Chat</span> to start a conversation —
              their reply lands in your notifications.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-5"
              onClick={() => void navigate({ to: "/candidate/leaderboard" })}
            >
              Browse candidates
            </Button>
          </div>
        ) : (
          <>
            <div
              ref={scrollerRef}
              onScroll={(event) => {
                const el = event.currentTarget;
                // Within one message height of the bottom counts as "at the
                // bottom": a bubble that is only partly cut off still reads as
                // the newest thing in the thread.
                stickToBottom.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < el.clientHeight;
              }}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto pt-1"
            >
              {thread.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  No messages yet. Say hello to {peerName}.
                </div>
              ) : (
                thread.map((message) => (
                  <div
                    key={message.id}
                    className={cn("flex", message.is_mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl border px-4 py-2.5",
                        message.is_mine ? "border-primary/30 bg-primary/10" : "bg-muted",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                      <p className="mt-1 text-right text-[10px] text-muted-foreground">
                        {formatStamp(message.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSend();
              }}
              className="sticky bottom-0 flex items-end gap-2 border-t border-border bg-background py-4"
            >
              <Textarea
                ref={composerRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={`Message ${peerName}…`}
                maxLength={2000}
                rows={1}
                aria-label={`Message ${peerName}`}
                /* Deliberately not disabled while sending. Disabling a focused
                   textarea blurs it, which is exactly what threw the caret back
                   to the page after every Enter; handleSend already refuses to
                   send twice, so the guard is all the disabled state ever did. */
                className="max-h-40 min-h-9 resize-none overflow-y-auto"
              />
              <Button
                type="submit"
                size="icon"
                className="shrink-0"
                disabled={sending || !draft.trim()}
                aria-label="Send"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
