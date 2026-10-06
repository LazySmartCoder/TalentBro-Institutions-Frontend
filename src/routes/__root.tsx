import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useNavigate,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { brandedTitle } from "@/lib/branding";
import { initTimeTracker } from "@/lib/time-tracker";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import { useSiteAvailability } from "@/lib/use-site-availability";
import { DowntimeScreen } from "@/components/downtime-screen";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,300..800;1,400&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&family=Space+Mono:wght@400;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico?v=3", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    // The inline script below sets the theme class on this element before the
    // body exists. React renders <html> without it during SSR, so the attribute
    // it adds is a real mismatch by the time hydration runs and has to be
    // suppressed here rather than warned about on every load.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (typeof document === "undefined") return;
    initTimeTracker();

    const apply = () => {
      const current = document.title;
      const next = brandedTitle(current);
      if (next !== current) {
        document.title = next;
      }
    };

    const titleEl = document.querySelector("title");
    if (!titleEl) return;
    apply();

    const observer = new MutationObserver(apply);
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <AvailabilityGate />
    </QueryClientProvider>
  );
}

/**
 * Sends every route to the one downtime page while the site is switched off.
 *
 * The switch is flipped from the Django admin dashboard. Two things happen and
 * both matter:
 *
 *   1. Any path that is not the home page is redirected to /downtime, carrying
 *      where it came from in `?from=` so the visitor lands back there afterwards.
 *   2. The downtime screen is rendered in place of <Outlet /> for the frame
 *      while that redirect is in flight, so the page behind it never mounts and
 *      never fires a query.
 *
 * The home page is deliberately exempt from both. It is the public marketing
 * page, it does not call the API, and leaving it readable means a link shared
 * from outside still lands somewhere sensible while the app itself is closed.
 *
 * While the answer is still in flight the app renders as normal. Blocking the
 * whole app on one request would make every page load wait on it, and a page
 * that never finished that request would be a page nobody could reach even when
 * the site is perfectly up.
 */
function AvailabilityGate() {
  const { down, message } = useSiteAvailability();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();

  const home = pathname === "/";
  const alreadyThere = pathname === "/downtime";
  const blocked = down && !home;

  useEffect(() => {
    if (!blocked || alreadyThere) return;
    void navigate({ to: "/downtime", search: { from: pathname }, replace: true });
  }, [blocked, alreadyThere, pathname, navigate]);

  if (blocked) return <DowntimeScreen message={message} />;
  return <Outlet />;
}
