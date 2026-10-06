import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Clock,
  GraduationCap,
  Star,
  Target,
} from "lucide-react";

import { AppNavHeader } from "@/components/tb/app-nav";
import { Bar, Panel, Pill } from "@/components/dash/bits";
import { GateError, GateLoading } from "@/components/load-state";
import {
  courseSegments,
  getCourses,
  getProfile,
  me,
  type AuthUser,
  type CandidateProfile,
  type CourseWeaknessSegment,
  type CourseraCourse,
  type CourseraCoursesResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const title = "TalentBro | Courses";
const description =
  "Curated online courses and specialisations from top universities and companies, to help you build the skills recruiters actually look for.";

export const Route = createFileRoute("/candidate/courses")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  // There is no search box on this screen by design; the query is overridable
  // straight from the address bar, e.g. /courses?q=journalism. An absent or blank
  // value is dropped so the scraper's default applies.
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    const raw = typeof search["q"] === "string" ? search["q"].trim() : "";
    return raw ? { q: raw } : {};
  },
  component: CoursesPage,
});

function formatCount(value: number | null): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(value);
}

function CourseImage({ src, alt }: { src: string; alt: string }) {
  if (!src) {
    return (
      <div className="grid aspect-video w-full place-items-center bg-muted">
        <BookOpen className="size-8 text-muted-foreground/50" />
      </div>
    );
  }
  return (
    <img src={src} alt={alt} loading="lazy" className="aspect-video w-full bg-muted object-cover" />
  );
}

function CourseCard({ course }: { course: CourseraCourse }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md">
      <CourseImage src={course.image} alt={course.title} />

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone="solid">{course.type_label}</Pill>
          {course.level_label && <Pill>{course.level_label}</Pill>}
          {course.in_coursera_plus && <Pill tone="outline">Coursera Plus</Pill>}
          {course.badges.map((badge) => (
            <Pill key={badge} tone="outline">
              {badge}
            </Pill>
          ))}
        </div>

        <div>
          {course.partners.length > 0 && (
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {course.partners.join(" · ")}
            </p>
          )}
          <h3 className="text-[15px] font-semibold leading-snug">
            <a
              href={course.course_url}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:underline"
            >
              {course.title}
            </a>
          </h3>
        </div>

        {course.description && (
          <p className="text-[13px] leading-relaxed text-muted-foreground">{course.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5" />
            <span className="font-medium text-foreground">
              {course.rating != null ? course.rating.toFixed(1) : "—"}
            </span>
            {course.rating_count != null && <span>({formatCount(course.rating_count)})</span>}
          </span>
          {course.duration_label && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {course.duration_label}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <GraduationCap className="size-3.5" />
            {course.type_label}
          </span>
        </div>

        {course.skills.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {course.skills.slice(0, 5).map((skill) => (
              <Pill key={skill}>{skill}</Pill>
            ))}
            {course.skills.length > 5 && (
              <Pill tone="outline">+{course.skills.length - 5} more</Pill>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// The search page ships per-facet value counts alongside the results, so this
// summarises the result set without costing another request.
const FACET_LABELS: Record<string, string> = {
  partners: "Top providers",
  topic: "Top topics",
  skills: "Most in-demand skills",
  productDifficultyLevel: "Levels",
  productDuration: "Durations",
  cost: "Pricing",
  toolSoftwareSkillNames: "Tools covered",
};

function FacetSummary({ facets }: { facets: CourseraCoursesResponse["facets"] }) {
  const entries = Object.entries(facets).filter(([name]) => name in FACET_LABELS);
  if (entries.length === 0) return null;

  return (
    <Panel title="What this search returned" description="Straight from the result set.">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(([name, values]) => (
          <div key={name}>
            <p className="dash-mono-label">{FACET_LABELS[name] ?? name}</p>
            <ul className="mt-2 space-y-1.5">
              {values.slice(0, 5).map((entry) => (
                <li key={entry.value} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-muted-foreground">{entry.value}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground/80">
                    {formatCount(entry.count)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  mock_interview: "Mock interviews",
  english_training: "English training",
  gd_training: "Group discussions",
  aplr: "Aptitude practice",
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}

/**
 * Weakness segments as links rather than buttons: the whole screen is driven by
 * the `?q=` search param, so each segment is just a link that sets it. Clicking
 * the active one pins the search, and "weakest first" puts it back to automatic.
 */
function WeaknessPicker({
  segments,
  activeQuery,
  isAuto,
  profile,
}: {
  segments: CourseWeaknessSegment[];
  activeQuery: string | undefined;
  isAuto: boolean;
  profile: CandidateProfile | null;
}) {
  if (segments.length === 0) return null;

  return (
    <Panel
      title="Built from your training"
      description="Your weakest areas, straight from your interview and self-training scores."
      className="mb-8"
    >
      <div className="flex flex-wrap gap-2">
        {segments.map((segment) => {
          const isActive = segment.query === activeQuery;
          return (
            <Link
              key={segment.key}
              to="/candidate/courses"
              search={{ q: segment.query }}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-foreground hover:bg-muted",
              )}
            >
              {segment.label}
              <span className={cn("font-mono", isActive ? "opacity-80" : "text-muted-foreground")}>
                {segment.score}%
              </span>
            </Link>
          );
        })}
        {!isAuto && (
          <Link
            to="/candidate/courses"
            search={{}}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <Target className="size-3.5" />
            Back to weakest
          </Link>
        )}
      </div>

      <ProfileSnapshot profile={profile} activeQuery={activeQuery} />
    </Panel>
  );
}

const PROFILE_GROUPS: { label: string; values: (profile: CandidateProfile) => string[] }[] = [
  { label: "Skills", values: (profile) => profile.skills },
  { label: "Job roles", values: (profile) => profile.preferred_roles },
  { label: "Extracurricular", values: (profile) => profile.extracurricular_activities },
];

/**
 * What the candidate has on their profile, so the courses below can be read
 * against the role they are actually targeting rather than a generic search.
 * Each entry links to the same `?q=` search the weakness chips drive, so a
 * profile skill and a weakness segment are interchangeable ways to search.
 */
function ProfileSnapshot({
  profile,
  activeQuery,
}: {
  profile: CandidateProfile | null;
  activeQuery: string | undefined;
}) {
  if (!profile) return null;

  // The profile endpoint serialises these tag columns straight from the row, so
  // an empty profile arrives as `null` rather than `[]`. Treat anything that
  // isn't a list as empty instead of letting `.filter` throw and take the page
  // down with it.
  const groups = PROFILE_GROUPS.map((group) => {
    const values = group.values(profile);
    return { label: group.label, values: Array.isArray(values) ? values.filter(Boolean) : [] };
  }).filter((group) => group.values.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="mt-5 grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-3">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="dash-mono-label">{group.label}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {group.values.map((value) => (
              <Link
                key={value}
                to="/candidate/courses"
                search={{ q: value }}
                aria-current={value === activeQuery ? "true" : undefined}
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                  value === activeQuery
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground hover:bg-muted",
                )}
              >
                {value}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Explains why the current search was chosen, and what the scores actually were. */
function FocusPanel({
  segment,
  activeQuery,
  isAuto,
}: {
  segment: CourseWeaknessSegment | null;
  activeQuery: string | undefined;
  isAuto: boolean;
}) {
  if (!segment) {
    if (isAuto) return null;
    return (
      <Panel
        title="Custom search"
        description="This search is not tied to a tracked weakness."
        className="mb-8"
      >
        <p className="text-sm text-muted-foreground">
          Showing courses for <span className="font-medium text-foreground">{activeQuery}</span>.
          Pick one of your weak spots above to go back to a personalised search.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title={segment.label}
      description={segment.blurb}
      className="mb-8"
      action={
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {isAuto ? "weakest area" : "selected"}
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-40">
          <Bar value={segment.score} />
        </div>
        <p className="text-sm">
          <span className="font-mono font-semibold">{segment.score}%</span>
          <span className="text-muted-foreground">
            {" "}
            average across {segment.sample_size} score{segment.sample_size === 1 ? "" : "s"} from{" "}
            {segment.sources.map(sourceLabel).join(", ").toLowerCase()}
          </span>
        </p>
      </div>

      {segment.evidence.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {segment.evidence.map((line) => (
            <li key={line} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
              {line}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function CoursesPage() {
  const navigate = useNavigate();
  const { q } = Route.useSearch();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<CourseraCoursesResponse | null>(null);
  const [segments, setSegments] = useState<CourseWeaknessSegment[]>([]);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  // Held until the segments land, so the grid is fetched once with the right
  // query instead of fetching the default and immediately refetching.
  const [segmentsResolved, setSegmentsResolved] = useState(false);

  // Candidates only. Institution staff are sent to their own chat screen.
  useEffect(() => {
    let cancelled = false;
    me()
      .then(async (current) => {
        if (cancelled) return;
        if (!current) {
          void navigate({ to: "/candidate/auth", search: { mode: "login" }, replace: true });
          return;
        }
        if (current.role !== "student") {
          void navigate({ to: "/client/chat", replace: true });
          return;
        }
        if (current.profile_complete === false) {
          void navigate({ to: "/candidate/onboarding", replace: true });
          return;
        }
        setUser(current);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : null);
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Tracked weaknesses decide the query. The backend already orders them weakest
  // first, so segments[0] is the gap worth attacking next.
  // The candidate's own skills, target roles and activities, shown alongside the
  // weakness chips. A failure here is not worth an error state on this page.
  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    getProfile()
      .then((result) => {
        if (!cancelled) setProfile(result.profile ?? null);
      })
      .catch(() => {
        // Purely additive context, so it can be missing without breaking the page.
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    courseSegments()
      .then((result) => {
        if (!cancelled) setSegments(result.segments ?? []);
      })
      .catch(() => {
        // Weakness tracking is an enhancement, never a gate: if it fails we fall
        // back to the neutral default search rather than showing an error page.
      })
      .finally(() => {
        if (!cancelled) setSegmentsResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  // An explicit ?q= wins, so a pinned or typed search always overrides the
  // automatic pick and the URL stays the single source of truth.
  const activeQuery = q ?? segments[0]?.query;
  const isAuto = q === undefined;
  const activeSegment = segments.find((segment) => segment.query === activeQuery) ?? null;

  useEffect(() => {
    if (status !== "ready" || !segmentsResolved) return;
    let cancelled = false;
    // Drop the previous result set so the skeletons show while the new query
    // is scraped, instead of leaving stale courses on screen.
    setData(null);
    setErrorMessage(null);
    getCourses(activeQuery)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : null);
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [status, segmentsResolved, activeQuery]);

  if (status === "loading") return <GateLoading />;

  if (status === "error" || !user) return <GateError message={errorMessage} />;

  const courses = data?.courses ?? [];
  const isScraping = data === null;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppNavHeader
        sticky
        left={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void navigate({ to: "/candidate/learning", replace: true })}
              className="grid size-8 cursor-pointer place-items-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Back to Learning"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="grid size-9 place-items-center rounded-lg bg-foreground text-background">
              <BookOpen className="size-4" />
            </span>
            <p className="text-sm font-semibold leading-tight">Courses</p>
          </div>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Upskill for placements
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Courses worth your time.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Every course below comes straight from Coursera&rsquo;s own catalogue, so the ratings,
            durations and skills are the real ones. The search starts from the weakest spots found
            in your interviews and self-training, so the first thing you see is what will help you
            most.
          </p>
        </div>

        {segments.length > 0 && (
          <WeaknessPicker
            segments={segments}
            activeQuery={activeQuery}
            isAuto={isAuto}
            profile={profile}
          />
        )}

        {segments.length === 0 && segmentsResolved && (
          <Panel
            title="No weak spots tracked yet"
            description="Courses are showing a general search for now."
            className="mb-8"
          >
            <p className="text-sm text-muted-foreground">
              Finish a mock interview or a self-training session and this page will pick courses
              that target whatever you scored lowest on. You can also search directly by adding{" "}
              <span className="font-mono text-xs text-foreground">?q=your topic</span> to the
              address.
            </p>
          </Panel>
        )}

        <FocusPanel segment={activeSegment} activeQuery={activeQuery} isAuto={isAuto} />

        {data && (
          <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Showing {data.count} results for &ldquo;{data.query}&rdquo;
            {data.total_results != null && ` · ${formatCount(data.total_results)} available`}
          </p>
        )}

        {isScraping ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                aria-hidden
                className="h-80 animate-pulse rounded-2xl border border-border bg-card"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id || course.course_url} course={course} />
              ))}
            </div>

            {courses.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
                No courses came back for this search. Try again in a little while.
              </p>
            )}

            {data && <div className="mt-10">{<FacetSummary facets={data.facets} />}</div>}
          </>
        )}

        <p className="mt-10 flex items-center gap-1.5 text-xs text-muted-foreground/70">
          Course data sourced live from Coursera
          <ArrowUpRight className="size-3" />
        </p>
      </main>
    </div>
  );
}
