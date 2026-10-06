import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getSiteStatus } from "@/lib/api";

const SITE_STATUS_KEY = ["site-status"] as const;

/**
 * How often to re-ask whether the site is up.
 *
 * There is no push channel here, so a poll is the only way a tab that is already
 * open can hear about the switch being flipped. Thirty seconds is quick enough
 * that nobody keeps clicking through a dead page and slow enough that a
 * dashboard left open overnight is not four requests a minute.
 */
const POLL_MS = 30_000;

export type SiteAvailability = {
  /** True while the site is deliberately down. */
  down: boolean;
  /** The message the admin wrote, or the API's default. Never blank. */
  message: string;
  /** Ask again now. This is what the downtime page's "Try again" button calls. */
  refresh: () => void;
};

/**
 * Whether the site is currently switched down, plus the message to show.
 *
 * A failed check reads as *up*, on purpose. This hook gates the whole app, so
 * treating an unreachable API as "down" would mean one dropped connection or a
 * slow backend locks every user out of every page. The failure mode that costs
 * a little polish — a user stays on a page whose data is failing anyway — is
 * far better than the one that hides the app entirely.
 *
 * The check is client-side only. The server renders the real page and this
 * swaps it once the answer arrives, which is the same trade the candidate gate
 * makes: a brief flash on a cold load, no work for a page nobody visits.
 */
export function useSiteAvailability(): SiteAvailability {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: SITE_STATUS_KEY,
    queryFn: async () => {
      const status = await getSiteStatus();
      return { down: status.site_down, message: status.message };
    },
    refetchInterval: POLL_MS,
    // Coming back to a tab is exactly when "is this thing actually down?" matters.
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // One try, then believe it is up. See the note above: a retry loop here
    // would just keep the whole app hidden for as long as the API is unhappy.
    retry: false,
  });

  // A refetch rather than a reload: the downtime page hands the visitor back to
  // the route they came from as soon as this reports the site is up, so pressing
  // "Try again" is enough to carry on without losing their place.
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: SITE_STATUS_KEY });
  }, [queryClient]);

  return {
    down: data?.down ?? false,
    message: data?.message ?? "",
    refresh,
  };
}
