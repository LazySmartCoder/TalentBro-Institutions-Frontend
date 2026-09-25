import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { AppNavHeader } from "@/components/tb/app-nav";

const title = "TalentBro | Resume Builder";
const description = "Build and polish your placement resume with TalentBro.";

export const Route = createFileRoute("/resume-builder")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ResumeBuilderPage,
});

function ResumeBuilderPage() {
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <AppNavHeader current="chat" />
      <main className="flex flex-1 flex-col items-center justify-center px-5 sm:px-8">
        <div className="mx-auto w-full max-w-xl text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-border bg-card text-foreground">
            <FileText className="size-6" />
          </span>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Resume Builder
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Build and polish your placement resume. This section is coming soon.
          </p>
        </div>
      </main>
    </div>
  );
}