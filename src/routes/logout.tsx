import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { logout } from "@/lib/api";

const title = "TalentBro | Signing Out";

export const Route = createFileRoute("/logout")({
  head: () => ({
    meta: [{ title }, { name: "robots", content: "noindex" }],
  }),
  component: LogoutPage,
});

function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await logout();
      } catch {
        // local session is cleared regardless of whether the backend call succeeds
      }
      if (!cancelled) {
        void navigate({ to: "/", replace: true });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      <span className="font-mono text-[11px] tracking-[0.2em] uppercase">Signing out…</span>
    </div>
  );
}
