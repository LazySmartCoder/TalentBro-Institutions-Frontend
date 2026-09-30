import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2, MessageSquare, Plus, Trash2 } from "lucide-react";
import { deleteChatSession } from "@/lib/api";
import { CHAT_SESSIONS_KEY, chatSessionsInfiniteQuery } from "@/lib/chat-sessions";
import { usePagedScroll } from "@/lib/use-paged-scroll";
import { cn } from "@/lib/utils";

// A placeholder row left behind by an abandoned draft is noise, so it never shows.
const isDraft = (title: string, messageCount: number) => title === "New chat" && messageCount === 0;

// Lives in the dashboard sidebar on every client page, so the assistant is one
// click away from Students, Companies, Drives and the rest. Selecting a thread
// navigates to the chat page with that session in the URL, which keeps the list
// and the open thread in step as the user moves around the dashboard.
//
// The list is paged, so only the newest handful of chats is fetched up front and
// the rest arrive as the user scrolls to the end.
export function ClientChatRail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pages = useInfiniteQuery(chatSessionsInfiniteQuery());
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeSession = useRouterState({
    select: (s) => (s.location.search as { session?: string }).session,
  });

  const onChatPage = pathname.startsWith("/client-chat");
  const sessions = (pages.data?.pages.flatMap((page) => page.sessions) ?? []).filter(
    (s) => !isDraft(s.title, s.message_count),
  );

  const loadMore = pages.hasNextPage
    ? () => {
        if (!pages.isFetchingNextPage) void pages.fetchNextPage();
      }
    : () => {};
  const sentinel = usePagedScroll(loadMore, pages.hasNextPage !== false);

  async function handleDelete(id: string) {
    try {
      await deleteChatSession(id);
      await queryClient.invalidateQueries({ queryKey: CHAT_SESSIONS_KEY });
      if (onChatPage && activeSession === id) {
        void navigate({ to: "/client-chat", search: {}, replace: true });
      }
    } catch {
      // A failed delete must not clear the rail; the list stays as it was.
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-1 pt-3">
        <button
          type="button"
          onClick={() => void navigate({ to: "/client-chat", search: {} })}
          className={cn(
            "flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-sidebar-border bg-transparent py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent/60",
            onChatPage && !activeSession
              ? "bg-sidebar-accent text-sidebar-primary"
              : "text-sidebar-foreground/70 hover:text-sidebar-accent-foreground",
          )}
        >
          <Plus className="size-4" /> New chat
        </button>
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-0.5 overflow-y-auto no-scrollbar">
        {sessions.length === 0 ? (
          <p className="px-1.5 text-xs text-sidebar-foreground/60">
            No previous chats yet — start one above.
          </p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className={cn(
                "group flex items-center gap-2 rounded-md px-2 py-2 transition-colors",
                onChatPage && activeSession === s.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )}
            >
              <button
                type="button"
                onClick={() => void navigate({ to: "/client-chat", search: { session: s.id } })}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-sm"
              >
                <MessageSquare className="size-3.5 shrink-0 opacity-70" />
                <span className="truncate text-[13px]">{s.title}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(s.id)}
                aria-label={`Delete chat ${s.title}`}
                className="shrink-0 cursor-pointer rounded p-1 opacity-0 transition-opacity hover:bg-sidebar-accent group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        )}
        <div ref={sentinel} aria-hidden className="flex justify-center py-2">
          {pages.isFetchingNextPage ? (
            <Loader2 className="size-3.5 animate-spin text-sidebar-foreground/60" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
