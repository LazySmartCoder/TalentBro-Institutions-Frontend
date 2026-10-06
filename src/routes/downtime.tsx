import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { DowntimeScreen } from "@/components/downtime-screen";
import { useSiteAvailability } from "@/lib/use-site-availability";

const title = "TalentBro is down for maintenance";
const description =
  "TalentBro Institutions is temporarily unavailable while we carry out scheduled maintenance.";

export const Route = createFileRoute("/downtime")({
  validateSearch: (search: Record<string, unknown>): { from?: string } => {
    // Only ever a path on this site. An absolute URL here would turn the
    // "carry on where you left off" redirect into an open redirect, and the
    // value arrives straight from the URL.
    const raw = search["from"];
    if (typeof raw !== "string") return {};
    const from = raw.startsWith("/") && !raw.startsWith("//") ? raw : "";
    return from ? { from } : {};
  },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DowntimePage,
});

/**
 * The single page every other route is sent to while the site is down.
 *
 * It stays reachable on its own for a reason: it is the one page that has to
 * render when the site's own API is the thing that is broken. Nothing on it
 * calls the API — the message comes from the same cached status check the
 * redirect that got us here used, and the retry button re-runs that check.
 *
 * When the site comes back up it sends the visitor on to wherever the redirect
 * caught them, so being interrupted by maintenance costs a refresh rather than
 * the page they were on.
 */
function DowntimePage() {
  const { down, message, refresh } = useSiteAvailability();
  const { from } = Route.useSearch();
  const navigate = useRouter();

  useEffect(() => {
    // Still down: nothing to do, this is the page for it.
    if (down) return;
    void navigate({ to: from ?? "/", replace: true });
  }, [down, from, navigate]);

  return <DowntimeScreen message={message} onRetry={refresh} />;
}