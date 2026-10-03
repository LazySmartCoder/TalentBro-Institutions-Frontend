import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotifications } from "@/lib/api";

/**
 * The bell's unread count, kept in one shared place.
 *
 * Every client screen mounts the same Shell and every student screen mounts the
 * same nav, so this is a single cache entry for the whole app rather than a
 * fetch per screen. Marking a notice read in the inbox therefore moves every
 * badge at the same instant, instead of each one waiting out its own request.
 */
const UNREAD_KEY = ["notifications", "unread"] as const;

/**
 * How often to go looking for a broadcast somebody else just sent.
 *
 * There is no socket in this app, so a poll is the only way a badge can hear
 * about a message it did not cause. Twenty seconds is quick enough to read as
 * live and slow enough that a dashboard left open all day is not the reason the
 * API falls over.
 */
const POLL_MS = 20_000;

/**
 * Tab-to-tab hand-off.
 *
 * `BroadcastChannel` never echoes to the tab that posted, so a caller writing
 * the count publishes it locally and posts it only for everybody else.
 */
const CHANNEL_NAME = "talentbro:notifications";

let channel: BroadcastChannel | null = null;

function notificationsChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  channel ??= new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

/**
 * The live unread count for whichever bell this component renders, plus the two
 * ways a screen that caused a change can tell everybody else about it.
 *
 * `publish` is for a change this user just made and already knows the result of
 * (marking read, marking everything read). `refresh` is for one the server owns
 * the answer to, such as sending a broadcast, where guessing a count would show
 * a number that is wrong until the next poll.
 */
export function useUnreadBadge() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: async () => (await getNotifications()).unread,
    refetchInterval: POLL_MS,
    // Coming back to a tab is exactly when a message that arrived while it was
    // in the background matters most.
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    const bus = notificationsChannel();
    if (!bus) return;
    const onMessage = (event: MessageEvent<{ unread?: unknown }>) => {
      const next = event.data?.unread;
      if (typeof next === "number") queryClient.setQueryData(UNREAD_KEY, next);
    };
    bus.addEventListener("message", onMessage);
    return () => bus.removeEventListener("message", onMessage);
  }, [queryClient]);

  const publish = useCallback(
    (count: number) => {
      queryClient.setQueryData(UNREAD_KEY, count);
      notificationsChannel()?.postMessage({ unread: count });
    },
    [queryClient],
  );

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
  }, [queryClient]);

  return { unread: data ?? 0, publish, refresh };
}