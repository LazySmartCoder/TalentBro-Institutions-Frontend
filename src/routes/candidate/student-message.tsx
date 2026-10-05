import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Building2, Loader2, Send, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

  useEffect(() => {
    if (status !== "ready") return;
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [status, thread]);

  async function handleSend() {
    const content = draft.trim();
    const targetId = peer?.id;
    if (!content || sending || !targetId) return;
    setSending(true);
    try {
      const saved = await sendStudentMessage(targetId, content);
      setThread((prev) => [...prev, saved]);
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setSending(false);
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
  const peerSubtitle = [peer?.department, peer?.program].filter(Boolean).join(" · ");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
        {isSelf ? (
          <Link
            to="/candidate/leaderboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to Leaderboard
          </Link>
        ) : (
          <Link
            to="/student-detail/$studentId"
            params={{ studentId: peer?.id ?? "" }}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to candidate
          </Link>
        )}

        <header className="mt-4 flex items-center gap-3 border-b border-border pb-4">
          <Avatar className="size-11 rounded-xl">
            <AvatarFallback className="rounded-xl bg-primary text-sm font-bold text-primary-foreground">
              {initialsOf(peerName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{peerName}</h1>
            {isSelf ? (
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <UserRound className="size-3.5 shrink-0" /> Your own candidate profile
              </p>
            ) : (
              peerSubtitle && (
                <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  <Building2 className="size-3.5 shrink-0" /> {peerSubtitle}
                </p>
              )
            )}
          </div>
        </header>

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
            <div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto py-5">
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
                rows={2}
                disabled={sending}
                aria-label={`Message ${peerName}`}
                className="max-h-40 min-h-[2.75rem] resize-y"
              />
              <Button
                type="submit"
                size="icon"
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
      </div>
    </div>
  );
}
