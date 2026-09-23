import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft, Building2, FileText, Loader2 } from "lucide-react";
import { Avatar } from "@/components/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { mockInterviewDetail, type MockInterviewDetail } from "@/lib/api";

const title = "TalentBro | Interview Transcript";
const description =
  "Read the full transcript of your past mock interview — every question and answer, in order.";

export const Route = createFileRoute("/mock-interview-transcript/$interviewId")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: TranscriptPage,
});

type Speaker = {
  id: string;
  name: string;
  role: string;
  mark: string;
  ai: boolean;
  img?: string;
};

const SPEAKERS: Record<string, Speaker> = {
  you: { id: "you", name: "You", role: "Candidate", mark: "CA", ai: false },
  atlas: {
    id: "atlas",
    name: "Atlas",
    role: "Session Host & Integrity Monitor",
    mark: "At",
    ai: true,
  },
  albert: {
    id: "albert",
    name: "Albert",
    role: "Technical Architect",
    mark: "A",
    ai: true,
    img: "/Panelists/Albert.png",
  },
  peter: {
    id: "peter",
    name: "Peter",
    role: "Management & Leadership",
    mark: "P",
    ai: true,
    img: "/Panelists/Peter.png",
  },
  daniel: {
    id: "daniel",
    name: "Daniel",
    role: "Decision Science & Analytics",
    mark: "D",
    ai: true,
    img: "/Panelists/Daniel.png",
  },
  maya: {
    id: "maya",
    name: "Maya",
    role: "Communication & HR",
    mark: "M",
    ai: true,
    img: "/Panelists/Maya.png",
  },
  ada: {
    id: "ada",
    name: "Ada",
    role: "Analytical & Logical Thinking",
    mark: "Ad",
    ai: true,
    img: "/Panelists/Ada.png",
  },
  carl: {
    id: "carl",
    name: "Carl",
    role: "Behavioral Intelligence",
    mark: "C",
    ai: true,
    img: "/Panelists/Carl.png",
  },
};

const fallbackSpeaker: Speaker = { id: "panel", name: "Panel", role: "", mark: "", ai: true };

const speakerFor = (id: string) => SPEAKERS[id] ?? fallbackSpeaker;

function formatDate(raw: string) {
  return new Date(raw).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function formatTime(raw: string) {
  if (!raw) return "";
  return new Date(raw).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function TranscriptPage() {
  const { interviewId } = Route.useParams();
  const { data, isLoading, isError, refetch } = useQuery<MockInterviewDetail>({
    queryKey: ["mock-interview-transcript", interviewId],
    queryFn: () => mockInterviewDetail(interviewId),
    staleTime: 60_000,
  });

  const detail = data ?? null;

  useEffect(() => {
    document.title = detail ? `Transcript — ${detail.company_name}` : title;
  }, [detail]);

  const messages = detail?.messages ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GridBackdrop />
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between">
          <Link
            to="/mock-interview"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to Mock Interviews
          </Link>
          {detail?.status === "completed" && (
            <Link
              to="/interview-analysis/$interviewId"
              params={{ interviewId }}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <FileText className="size-4" /> View Analysis
            </Link>
          )}
        </div>

        {isLoading && <TranscriptSkeleton />}

        {isError && !detail && (
          <EmptyState onRetry={() => void refetch()} message="We couldn't load this transcript." />
        )}

        {!isLoading && !isError && !detail && (
          <EmptyState
            onRetry={() => void refetch()}
            message="No transcript found for this interview."
          />
        )}

        {detail && (
          <>
            <header className="rounded-2xl border border-border bg-card/60 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted">
                    <Building2 className="size-5 text-muted-foreground" />
                  </span>
                  <div>
                    <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
                      {detail.company_name}
                    </h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {detail.role || "General"} · {formatDate(detail.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.15em] ${
                      detail.status === "completed"
                        ? "border-emerald-500/40 text-emerald-600"
                        : "border-amber-500/40 text-amber-600"
                    }`}
                  >
                    {detail.status === "completed" ? "Completed" : "In progress"}
                  </span>
                  <span className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    {detail.message_count} turns
                  </span>
                </div>
              </div>
              {detail.questions.length > 0 && (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Focus areas
                  </p>
                  <ul className="mt-2 space-y-1">
                    {detail.questions.map((q, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground" />
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </header>

            <section className="mt-6 space-y-6">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card/40 px-6 py-16 text-center">
                  <FileText className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    This interview has no messages yet.
                  </p>
                </div>
              ) : (
                messages.map((m, i) => {
                  const isUser = m.role === "user";
                  const speaker = speakerFor(isUser ? "you" : (m.panelist ?? "atlas"));
                  return (
                    <article key={i} className="flex gap-3">
                      <Avatar m={speaker} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-baseline gap-2">
                          <span className="text-sm">{speaker.name}</span>
                          {speaker.ai && (
                            <span className="rounded border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                              AI
                            </span>
                          )}
                          {!isUser && m.tone && (
                            <span className="rounded border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                              {m.tone}
                            </span>
                          )}
                          {formatTime(m.created_at) && (
                            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                              {formatTime(m.created_at)}
                            </span>
                          )}
                        </p>
                        <p
                          className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${
                            isUser ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {m.content}
                        </p>
                      </div>
                    </article>
                  );
                })
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function GridBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_50%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:44px_44px]" />
    </div>
  );
}

function EmptyState({ onRetry, message }: { onRetry: () => void; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card/40 px-6 py-20 text-center">
      <FileText className="size-10 text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold">{message}</h2>
      <button
        onClick={onRetry}
        className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <Loader2 className="size-4" /> Load Transcript
      </button>
    </div>
  );
}

function TranscriptSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
        <div className="mt-4 flex gap-2 border-t border-border pt-4">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
