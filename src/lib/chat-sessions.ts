import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { chatSessions } from "@/lib/api";

// Shared by the dashboard sidebar rail and the chat page, so both read the same
// cached list and a new message updates the rail without a second request.
export const CHAT_SESSIONS_KEY = ["client-chat-sessions"] as const;

export function chatSessionsQuery() {
  return queryOptions({
    queryKey: CHAT_SESSIONS_KEY,
    queryFn: chatSessions,
    staleTime: 30_000,
  });
}

export function useInvalidateChatSessions() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: CHAT_SESSIONS_KEY });
}
