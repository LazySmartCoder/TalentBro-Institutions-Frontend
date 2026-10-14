import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useState, type ReactNode } from "react";

export const Route = createFileRoute("/tac")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions | TalentBro Institutions" },
      {
        name: "description",
        content: "Terms and Conditions governing the use of the TalentBro Institutions platform.",
      },
    ],
  }),
  component: TermsPage,
});

const INLINE_TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
const URL_PATTERN = /https?:\/\/[^\s)]+/g;

function linkify(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  const re = new RegExp(URL_PATTERN.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const url = match[0];
    nodes.push(
      <a
        key={`${keyPrefix}-u${i++}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="break-all font-medium text-emerald-600 underline decoration-emerald-600/30 underline-offset-4 transition-colors hover:decoration-emerald-600 dark:text-emerald-400 dark:decoration-emerald-400/30"
      >
        {url}
      </a>,
    );
    lastIndex = match.index + url.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = new RegExp(INLINE_TOKEN.source, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...linkify(text.slice(lastIndex, match.index), `${keyPrefix}-t${i++}`));
    }
    const token = match[0];
    const key = `${keyPrefix}-m${i++}`;
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded-md border border-border/70 bg-muted px-1.5 py-0.5 font-mono text-[0.82em] text-foreground"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(
        <em key={key} className="italic text-foreground/90">
          {token.slice(1, -1)}
        </em>,
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    nodes.push(...linkify(text.slice(lastIndex), `${keyPrefix}-t${i++}`));
  }
  return nodes;
}

function renderMarkdown(markdown: string): ReactNode[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  let mastheadDone = false;
  let subtitlePending = false;

  const isBlockStart = (line: string) =>
    /^-{3,}$/.test(line) ||
    /^#{1,6}\s+/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line);

  while (i < lines.length) {
    const trimmed = lines[i]!.trim();
    if (!trimmed) {
      i++;
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) {
      blocks.push(
        <hr
          key={`hr-${key++}`}
          className="my-10 h-px border-0 bg-gradient-to-r from-transparent via-border to-transparent"
        />,
      );
      i++;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = Math.min(heading[1]!.length, 3);
      const text = heading[2]!.trim();

      if (level === 1 && !mastheadDone) {
        mastheadDone = true;
        subtitlePending = true;
        blocks.push(
          <h1
            key={`h-${key++}`}
            className="text-center font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl"
          >
            {renderInline(text, `h-${key}`)}
          </h1>,
        );
      } else if (level === 2 && subtitlePending) {
        subtitlePending = false;
        blocks.push(
          <p
            key={`h-${key++}`}
            className="mt-3 text-center text-[13px] font-bold uppercase tracking-[0.28em] text-primary"
          >
            {renderInline(text, `h-${key}`)}
          </p>,
        );
      } else {
        const Tag = (level === 1 ? "h2" : level === 2 ? "h3" : "h4") as "h2" | "h3" | "h4";
        const className =
          level === 1
            ? "mt-14 flex items-center gap-3 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl"
            : level === 2
              ? "mt-9 font-display text-lg font-semibold tracking-tight text-foreground"
              : "mt-7 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground";
        const content = renderInline(text, `h-${key}`);
        blocks.push(
          <Tag key={`h-${key++}`} className={className}>
            {level === 1 && (
              <span className="h-5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            )}
            <span>{content}</span>
          </Tag>,
        );
      }
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul
          key={`ul-${key++}`}
          className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-7 text-muted-foreground marker:text-primary/60"
        >
          {items.map((item, idx) => (
            <li key={idx} className="pl-1">
              {renderInline(item, `ul-${key}-${idx}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol
          key={`ol-${key++}`}
          className="mt-4 list-decimal space-y-2 pl-5 text-[15px] leading-7 text-muted-foreground marker:font-semibold marker:text-primary/70"
        >
          {items.map((item, idx) => (
            <li key={idx} className="pl-1">
              {renderInline(item, `ol-${key}-${idx}`)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length) {
      const current = lines[i]!.trim();
      if (!current || isBlockStart(current)) break;
      paragraph.push(lines[i]!.replace(/\s+$/, ""));
      i++;
    }
    blocks.push(
      <p key={`p-${key++}`} className="mt-4 text-[15px] leading-7 text-muted-foreground">
        {paragraph.map((line, idx) => (
          <Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInline(line, `p-${key}-${idx}`)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return blocks;
}

function TermsPage() {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/tac.txt");
        if (!res.ok) throw new Error(`Failed to load terms (${res.status})`);
        const text = await res.text();
        if (!cancelled) setMarkdown(text);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-muted/70 via-muted/20 to-transparent" />

      <div className="relative mx-auto w-full max-w-[820px] px-4 py-10 sm:px-6 sm:py-16">
        <article className="animate-rise overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-panel)]">
          <div className="px-6 py-10 sm:px-12 sm:py-14">
            {error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-6 text-center">
                <p className="text-[15px] font-medium text-destructive">
                  We couldn&apos;t load the Terms &amp; Conditions.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Please refresh the page or try again later.
                </p>
              </div>
            ) : markdown === null ? (
              <div className="space-y-4" aria-hidden>
                <div className="mx-auto h-8 w-48 animate-pulse rounded-lg bg-muted" />
                <div className="mx-auto h-3 w-32 animate-pulse rounded-full bg-muted" />
                <div className="mt-10 space-y-3">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="h-3 animate-pulse rounded-full bg-muted"
                      style={{ width: `${90 - idx * 7}%` }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              renderMarkdown(markdown)
            )}
          </div>
        </article>
      </div>
    </main>
  );
}
