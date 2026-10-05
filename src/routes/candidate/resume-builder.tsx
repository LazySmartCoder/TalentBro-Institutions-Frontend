import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Download, FileText, Loader2, Sparkles } from "lucide-react";
import { AppNavHeader } from "@/components/tb/app-nav";
import { Button } from "@/components/ui/button";
import { apiUrl, buildResume } from "@/lib/api";

const title = "TalentBro | Resume Builder";
const description = "Build and polish your placement resume with TalentBro.";

export const Route = createFileRoute("/candidate/resume-builder")({
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
  // A full Apify scrape of the LinkedIn profile takes tens of seconds, so the
  // button stays disabled for the whole round trip rather than letting the
  // student fire off several overlapping scrapes.
  const [building, setBuilding] = useState(false);
  // Set once a build succeeds, so the download link only appears after a PDF has
  // actually been written rather than pointing at a 404 on first load.
  const [pdfPath, setPdfPath] = useState<string | null>(null);

  async function handleBuild() {
    setBuilding(true);
    try {
      const result = await buildResume();
      setPdfPath(result.pdf_url);
      toast.success(
        result.sections.length
          ? `Resume ready — built from ${result.sections.length} LinkedIn sections.`
          : "Resume ready, but LinkedIn returned no sections to add.",
      );
    } catch (err) {
      setPdfPath(null);
      toast.error(err instanceof Error ? err.message : "Could not build your resume.");
    } finally {
      setBuilding(false);
    }
  }

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
            We pull your LinkedIn profile and your TalentBro profile together into a single
            resume you can download and share.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              size="lg"
              disabled={building}
              onClick={() => void handleBuild()}
            >
              {building ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              {building ? "Building your resume…" : "Build my Resume"}
            </Button>
            {pdfPath && (
              <Button asChild variant="outline" size="lg">
                <a href={apiUrl(pdfPath)} download>
                  <Download className="size-4" aria-hidden="true" />
                  Download PDF
                </a>
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
