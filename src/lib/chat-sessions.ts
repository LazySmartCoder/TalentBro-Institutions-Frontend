import { infiniteQueryOptions, queryOptions, useQueryClient } from "@tanstack/react-query";
import { chatSessions } from "@/lib/api";

// Shared by the dashboard sidebar rail and the chat page, so both read the same
// cached list and a new message updates the rail without a second request.
export const CHAT_SESSIONS_KEY = ["client-chat-sessions"] as const;

// How many chats a page of the "previous chats" list holds. The sidebar only
// paints the newest handful on mount and pulls the next one when the user reaches
// the end of the scroll area, so a student with hundreds of chats never waits on
// a request for all of them.
export const CHAT_SESSIONS_PAGE_SIZE = 20;

export function chatSessionsQuery() {
  return queryOptions({
    queryKey: CHAT_SESSIONS_KEY,
    queryFn: async () => (await chatSessions()).sessions,
    staleTime: 30_000,
  });
}

/**
 * Paged chat sessions. Pages are plain `limit`/`offset` windows over the
 * server's newest-first ordering, keyed by base key + "pages" so the existing
 * `invalidateQueries({ queryKey: CHAT_SESSIONS_KEY })` calls still match by
 * prefix and refresh the rail.
 */
export function chatSessionsInfiniteQuery() {
  return infiniteQueryOptions({
    queryKey: [...CHAT_SESSIONS_KEY, "pages"],
    queryFn: ({ pageParam }) => chatSessions({ limit: CHAT_SESSIONS_PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    // `has_more` is authoritative; only the first page assumes a full window, so
    // a short trailing page stops the chain instead of firing a pointless call.
    getNextPageParam: (last, all) =>
      last.has_more ? all.length * CHAT_SESSIONS_PAGE_SIZE : undefined,
    staleTime: 30_000,
  });
}

export function useInvalidateChatSessions() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: CHAT_SESSIONS_KEY });
}
