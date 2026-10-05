import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Building2, Loader2, MessagesSquare, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { createForumPost, deleteForumPost, forumPosts, type ForumPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import { GateError, GateLoading } from "@/components/load-state";

const title = "Discussion Forum | TalentBro";
const description = "Ask and answer inside your own college.";

// Must match FORUM_POST_MAX_CHARS in Backend/TalentBroIns/views.py. Counted as
// the browser counts it so the counter cannot promise a length the server then
// rejects — a plain JS string is UTF-16, so `body.length` is the same number the
// view will len() before saving.
const MAX_CHARS = 2000;

export const Route = createFileRoute("/candidate/discussion-forum")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: DiscussionForumPage,
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

function DiscussionForumPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [institution, setInstitution] = useState<{ id: string; name: string } | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [total, setTotal] = useState(0);
  const [view, setView] = useState<"all" | "mine">("all");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // A one-shot guard for the "load the next page" button. Refs rather than state
  // because the sentinel can fire again on the same render the flag is set, and a
  // state update would not have landed yet — two fetches, then a duplicate page.
  const loadingMoreRef = useRef(false);

  const loadFirstPage = useCallback(async (mine: boolean) => {
    setStatus("loading");
    try {
      const data = await forumPosts({ mine });
      setInstitution(data.institution);
      setPosts(data.posts);
      setTotal(data.total);
      setOffset(data.posts.length);
      setHasMore(data.has_more);
      setStatus("ready");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : null);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void loadFirstPage(view === "mine");
  }, [view, loadFirstPage]);

  async function loadMore() {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const data = await forumPosts({ mine: view === "mine", offset });
      setPosts((prev) => [...prev, ...data.posts]);
      setOffset((prev) => prev + data.posts.length);
      setHasMore(data.has_more);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load more posts.");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  async function handlePost() {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const saved = await createForumPost(body);
      setDraft("");
      // On "My posts" the new row belongs at the top of what is already on
      // screen, so prepend it. On "All posts" the server has just placed it there
      // and re-fetching would fight the optimistic insert, so only the count moves.
      if (view === "mine") {
        setPosts((prev) => [saved, ...prev]);
        setTotal((prev) => prev + 1);
      } else {
        setTotal((prev) => prev + 1);
      }
      toast.success("Posted to your college forum");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post.");
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(post: ForumPost) {
    if (deletingId) return;
    setDeletingId(post.id);
    try {
      await deleteForumPost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setTotal((prev) => Math.max(0, prev - 1));
      toast.success("Post deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the post.");
    } finally {
      setDeletingId(null);
    }
  }

  if (status === "loading") return <GateLoading />;
  if (status === "error")
    return <GateError message={errorMessage} onRetry={() => void loadFirstPage(view === "mine")} />;

  const remaining = MAX_CHARS - draft.length;
  const canPost = draft.trim().length > 0 && draft.length <= MAX_CHARS;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
        <Link
          to="/candidate/chat"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to Chat
        </Link>

        <header className="mt-4 border-b border-border pb-4">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <MessagesSquare className="size-5" /> Discussion Forum
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="size-3.5 shrink-0" />
            {institution
              ? `${institution.name} — only students here can see these posts.`
              : "Add your college to your profile to join the discussion."}
          </p>
        </header>

        {/* Composer. Hidden without a college because the server resolves the
            college from the profile and would reject the post anyway. A single
            line, like a chat send box: one thought per post, so there is no
            multi-line draft to lose track of. Enter posts, Shift+Enter is left
            alone here because there is no second line to move to. */}
        {institution && (
          <section className="mt-5 rounded-2xl border border-border bg-card p-4">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handlePost();
                }
              }}
              maxLength={MAX_CHARS}
              placeholder="Ask a question or share something with your college…"
              aria-label="Write a post"
              className="w-full"
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "font-mono text-[10px] uppercase tracking-[0.12em]",
                  remaining < 100 ? "text-amber-600" : "text-muted-foreground",
                )}
              >
                {draft.length}/{MAX_CHARS}
              </span>
              <button
                type="button"
                onClick={() => void handlePost()}
                disabled={!canPost || posting}
                className="ml-auto inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {posting && <Loader2 className="size-3.5 animate-spin" />}
                {posting ? "Posting…" : "Post"}
              </button>
            </div>
          </section>
        )}

        {/* All posts / My posts. This is a server-side filter, not a client one,
            so "My posts" stays correct on pages beyond the first. */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {(["all", "mine"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                aria-pressed={view === key}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  view === key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {key === "all" ? "All posts" : "My posts"}
              </button>
            ))}
          </div>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {posts.length} of {total}
          </span>
        </div>

        <ul className="mt-4 flex-1 space-y-3">
          {posts.map((post) => (
            <li
              key={post.id}
              className={cn(
                "rounded-2xl border bg-card p-4",
                post.is_mine ? "border-primary/40" : "border-border",
              )}
            >
              <div className="flex items-start gap-3">
                <Avatar className="size-9 shrink-0 rounded-xl">
                  {/* Only rendered when a photo was actually uploaded, so
                      radix falls through to the initials for everyone else
                      instead of flashing a broken-image frame. */}
                  {post.author.avatar ? (
                    <AvatarImage src={post.author.avatar} alt={post.author.full_name} />
                  ) : null}
                  <AvatarFallback className="rounded-xl bg-primary text-xs font-bold text-primary-foreground">
                    {initialsOf(post.author.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold">
                      {post.is_mine ? "You" : post.author.full_name}
                    </span>
                    {/* `time` is the server's relative stamp, so a post never
                        claims to be "5 min ago" on a stale client clock. */}
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {post.time}
                    </span>
                  </div>
                  {(post.author.department || post.author.program) && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[post.author.department, post.author.program].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                {/* Delete-only, and only on the viewer's own rows — `is_mine` is
                    resolved server-side, so this cannot be turned on for someone
                    else's post by editing the DOM. There is no edit: a post is
                    removed or reposted as a new one. */}
                {post.is_mine && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(post)}
                    disabled={deletingId === post.id}
                    aria-label="Delete your post"
                    title="Delete this post"
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-wait disabled:opacity-60"
                  >
                    {deletingId === post.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </button>
                )}
              </div>
              {/* Rendered as text, never as markup: a post is plain text, so this
                  is also what stops a pasted <script> from becoming an element. */}
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">
                {post.body}
              </p>
            </li>
          ))}
        </ul>

        {posts.length === 0 && (
          <div className="flex-1 py-16 text-center">
            <MessagesSquare className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              {view === "mine" ? "You have not posted yet." : "No posts yet."}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              {view === "mine"
                ? "Anything you post shows up here, and only here, until you delete it."
                : "Be the first to ask something on your college board."}
            </p>
          </div>
        )}

        {hasMore && (
          <div className="mt-4 flex justify-center pb-8">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3.5 py-2 text-xs font-medium transition-colors hover:bg-accent disabled:cursor-wait disabled:opacity-60"
            >
              {loadingMore && <Loader2 className="size-3.5 animate-spin" />}
              {loadingMore ? "Loading…" : "Load more posts"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
