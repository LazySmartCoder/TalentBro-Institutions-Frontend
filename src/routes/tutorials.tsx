import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, GraduationCap, Play, RefreshCw } from "lucide-react";
import { AppNavHeader } from "@/components/tb/app-nav";
import {
  me,
  chatSessions,
  chatSessionDetail,
  mockInterviews,
  mockInterviewAnalysis,
  type AuthUser,
  type MockInterviewAnalysis,
} from "@/lib/api";
import { GateError, GateLoading } from "@/components/load-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const title = "TalentBro | Tutorials";
const description =
  "Personalized video tutorials picked for you based on your recent interviews and conversations.";

export const Route = createFileRoute("/tutorials")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: TutorialsPage,
});

type StudentProfile = {
  name?: string;
  college?: string;
  department?: string;
  program?: string;
  cgpa?: number | null;
  expected_ctc?: number | null;
  preferred_roles?: string[];
  skills?: string[];
  projects?: string[];
  internships?: string[];
  certification?: string[];
  certification_names?: string[];
  placement_status?: string;
};

function toProfile(raw: unknown): StudentProfile {
  if (!raw || typeof raw !== "object") return {};
  const p = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const list = (v: unknown) => (Array.isArray(v) ? v.map((i) => String(i)).filter(Boolean) : []);
  return {
    name: str(p["name"]),
    college: str(p["college"]),
    department: str(p["department"]),
    program: str(p["program"]),
    cgpa: typeof p["cgpa"] === "number" ? p["cgpa"] : null,
    expected_ctc: typeof p["expected_ctc"] === "number" ? p["expected_ctc"] : null,
    preferred_roles: list(p["preferred_roles"]),
    skills: list(p["skills"]),
    projects: list(p["projects"]),
    internships: list(p["internships"]),
    certification: list(p["certification_names"] ?? p["certifications"]),
    placement_status: str(p["placement_status"]),
  };
}

type Topic = {
  title: string;
  query: string;
  reason: string;
  kind: "domain" | "weakness";
  gap?:
    | "skills"
    | "certifications"
    | "projects"
    | "internships"
    | "experience"
    | "roles"
    | "cgpa"
    | "intent"
    | "ctc";
  evidence?: string;
};

type Flaw = { id: string; label: string; detail: string };

const DOMAIN_TOPICS: Record<string, Topic[]> = {
  bba: [
    {
      title: "Marketing",
      query: "marketing interview questions placements",
      reason: "Your program and career focus",
      kind: "domain",
    },
    {
      title: "Finance",
      query: "finance basics for interviews",
      reason: "Your program and career focus",
      kind: "domain",
    },
    {
      title: "Business Communication",
      query: "business communication skills",
      reason: "Your program and career focus",
      kind: "domain",
    },
  ],
  cse: [
    {
      title: "Data Structures & Algorithms",
      query: "DSA for campus placements",
      reason: "Your core technical domain",
      kind: "domain",
    },
    {
      title: "System Design",
      query: "system design interview basics",
      reason: "Your core technical domain",
      kind: "domain",
    },
  ],
  it: [
    {
      title: "Data Structures & Algorithms",
      query: "DSA for campus placements",
      reason: "Your core technical domain",
      kind: "domain",
    },
    {
      title: "SQL & Databases",
      query: "SQL interview questions",
      reason: "Your core technical domain",
      kind: "domain",
    },
  ],
  default_technical: [
    {
      title: "Coding Interview Prep",
      query: "programming interview preparation",
      reason: "Your technical profile",
      kind: "domain",
    },
    {
      title: "Core Engineering Interview",
      query: "core engineering interview questions for placements",
      reason: "Your technical profile",
      kind: "domain",
    },
    {
      title: "Aptitude & Reasoning",
      query: "aptitude test preparation for placements",
      reason: "Common placement round",
      kind: "domain",
    },
  ],
  default: [
    {
      title: "Placement Preparation",
      query: "campus placement preparation",
      reason: "Personalized for you",
      kind: "domain",
    },
    {
      title: "Resume Building for Freshers",
      query: "how to write a strong resume for campus placement",
      reason: "Personalized for you",
      kind: "domain",
    },
    {
      title: "Group Discussion & Interview",
      query: "group discussion tips and HR interview preparation",
      reason: "Common selection round",
      kind: "domain",
    },
    {
      title: "Aptitude & Reasoning",
      query: "aptitude test preparation for placements",
      reason: "Common placement round",
      kind: "domain",
    },
  ],
};

const GAP_TOPICS: Record<string, Topic> = {
  skills: {
    title: "Communication & Soft Skills",
    query: "communication skills for interviews freshers",
    reason: "Helps you speak clearly and connect with interviewers in HR and technical rounds",
    kind: "weakness",
    gap: "skills",
    evidence:
      "Your profile lists no skills, so there is nothing concrete to discuss in HR and technical rounds yet.",
  },
  certifications: {
    title: "Certifications & Online Courses",
    query: "top certifications for campus placements",
    reason: "Helps you prove your skills with recognized qualifications",
    kind: "weakness",
    gap: "certifications",
    evidence:
      "You haven't added any certifications, which are the quickest way to prove self-driven learning to recruiters.",
  },
  projects: {
    title: "Resume & Personal Projects",
    query: "how to build projects for resume campus placement",
    reason: "Helps you build real projects that make recruiters shortlist you",
    kind: "weakness",
    gap: "projects",
    evidence:
      "Recruiters screen for projects before the first round; a blank project history is the biggest shortlist killer.",
  },
  internships: {
    title: "Internships & Work Experience",
    query: "how to get internship for college students freshers",
    reason: "Helps you land work-ready experience recruiters look for first",
    kind: "weakness",
    gap: "internships",
    evidence:
      "An internship is the strongest single proof of work-readiness, and yours is currently an empty field.",
  },
  roles: {
    title: "Career Direction & Ideal Role",
    query: "which job role should I choose after graduation",
    reason: "Helps you pick a target role so your prep has a clear direction",
    kind: "weakness",
    gap: "roles",
    evidence:
      "Without a chosen target role, there is no clear path to prep for, so interviews feel unfocused.",
  },
  cgpa: {
    title: "Boost Your Academic Marks",
    query: "how to improve CGPA and academic performance",
    reason: "Helps you raise your marks to clear the CGPA cutoff companies set",
    kind: "weakness",
    gap: "cgpa",
    evidence:
      "Many companies set a CGPA cutoff, and yours is below it, which blocks you from even being evaluated on other strengths.",
  },
  intent: {
    title: "Aptitude & Placement Basics",
    query: "campus placement aptitude preparation strategy",
    reason: "Helps you clear the aptitude round that filters most campus drives",
    kind: "weakness",
    gap: "intent",
    evidence:
      "An aptitude round is the first filter in almost every campus drive, so covering this base protects your selection chances.",
  },
  ctc: {
    title: "Salary Negotiation Basics",
    query: "how to negotiate salary as a fresher",
    reason: "Helps you negotiate a fair starting salary instead of leaving money on the table",
    kind: "weakness",
    gap: "ctc",
    evidence:
      "Without a target expected salary you walk into offers underprepared to negotiate your worth.",
  },
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dailySeed(): number {
  const now = new Date();
  const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.floor(localMidnight / DAY_MS);
}

function hashSeed(seed: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  return h >>> 0;
}

function pick<T>(arr: T[], seed: number, salt: number): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[((hashSeed(seed + salt) % arr.length) + arr.length) % arr.length];
}

function matchesDomain(text: string, patterns: string[]): boolean {
  const t = text.toLowerCase();
  return patterns.some((p) => t.includes(p));
}

function resolveDomainProfile(
  profile: StudentProfile,
): "bba" | "cse" | "it" | "technical" | "default" {
  const dept = (profile.department ?? "").toLowerCase();
  const program = (profile.program ?? "").toLowerCase();
  const roles = (profile.preferred_roles ?? []).join(" ").toLowerCase();
  if (matchesDomain(`${dept} ${program}`, ["bba", "ba ", "management", "business"])) {
    return "bba";
  }
  if (matchesDomain(roles, ["sde", "software", "developer", "engineer"])) {
    return "cse";
  }
  if (
    matchesDomain(`${dept} ${program}`, [
      "computer",
      "cse",
      "cs ",
      "information",
      "it ",
      "software",
    ])
  ) {
    return "cse";
  }
  if (
    matchesDomain(`${dept} ${program}`, [
      "ece",
      "electrical",
      "electronics",
      "mech",
      "civil",
      "engineering",
    ])
  ) {
    return "technical";
  }
  return "default";
}

const DOMAIN_LIST: Record<string, Topic[]> = {
  bba: DOMAIN_TOPICS["bba"]!,
  cse: DOMAIN_TOPICS["cse"]!,
  it: DOMAIN_TOPICS["it"]!,
  technical: DOMAIN_TOPICS["default_technical"]!,
  default: DOMAIN_TOPICS["default"]!,
};

function detectGaps(profile: StudentProfile): Flaw[] {
  const flaws: Flaw[] = [];
  const add = (gap: string) => {
    const t = GAP_TOPICS[gap];
    if (t) flaws.push({ id: gap, label: t.title, detail: t.evidence ?? "" });
  };

  if ((profile.skills ?? []).length < 2 && (profile.certification ?? []).length < 1) add("skills");
  if ((profile.certification ?? []).length < 1) add("certifications");
  if ((profile.projects ?? []).length < 1) add("projects");
  if ((profile.internships ?? []).length < 1) add("internships");
  if ((profile.preferred_roles ?? []).length < 1) add("roles");
  if (typeof profile.cgpa === "number" && profile.cgpa < 7) add("cgpa");
  if (!profile.placement_status) add("intent");
  if (profile.expected_ctc == null) add("ctc");

  return flaws;
}

function buildTopics(profile: StudentProfile): Topic[] {
  const seed = dailySeed();
  // Start from the concrete gaps, one topic per distinct gap (no dupes, no aptitude spam).
  const gaps = detectGaps(profile);
  const topics: Topic[] = gaps.map((g) => GAP_TOPICS[g.id]).filter((t): t is Topic => Boolean(t));

  // Always add one domain topic for career-relevant context.
  const pool = DOMAIN_LIST[resolveDomainProfile(profile)] ?? DOMAIN_TOPICS["default"] ?? [];
  const domainTopic = pick(pool, seed, 6);
  if (domainTopic) topics.push(domainTopic);

  const seedOwn: Topic[] = [];
  // If nothing concrete was found, fall back to rounded placement basics.
  if (gaps.length === 0) {
    seedOwn.push(
      pick(
        GAP_TOPICS["skills"] && GAP_TOPICS["intent"]
          ? [GAP_TOPICS["skills"]!, GAP_TOPICS["intent"]!]
          : [],
        seed,
        7,
      ) ?? GAP_TOPICS["intent"]!,
      GAP_TOPICS["projects"]!,
    );
  }

  const all = [...topics, ...seedOwn];
  const seen = new Set<string>();
  const deduped = all.filter((t) => (seen.has(t.title) ? false : (seen.add(t.title), true)));
  return deduped.slice(0, 3);
}

type Video = {
  videoId: string;
  title: string;
  channel: string;
  publishedAt: string;
  thumbnailUrl: string;
  why: string;
};

type Section = {
  topic: Topic;
  videos: Video[];
  loading: boolean;
  error: string;
};

const YT_BASE = "https://www.googleapis.com/youtube/v3/search";

async function searchVideos(query: string, maxResults = 8): Promise<Video[]> {
  const key = (import.meta.env["VITE_YOUTUBE_API_KEY"] as string | undefined) ?? "";
  if (!key) throw new Error("missing-key");

  const url = `${YT_BASE}?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(query)}&key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`youtube-${res.status}`);
  const data = (await res.json()) as {
    items?: {
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        publishedAt?: string;
        thumbnails?: { medium?: { url?: string }; high?: { url?: string } };
      };
    }[];
  };
  return (data.items ?? [])
    .map((it) => ({
      videoId: it.id?.videoId ?? "",
      title: it.snippet?.title ?? "",
      channel: it.snippet?.channelTitle ?? "",
      publishedAt: it.snippet?.publishedAt ?? "",
      thumbnailUrl: it.snippet?.thumbnails?.high?.url ?? it.snippet?.thumbnails?.medium?.url ?? "",
      why: "",
    }))
    .filter((v) => v.videoId);
}

function describeWhy(topic: Topic, profile: StudentProfile): string {
  const name = profile.name?.split(" ")[0] || "you";
  if (topic.kind === "weakness" && topic.evidence) {
    return topic.evidence;
  }
  const role = profile.preferred_roles?.[0];
  switch (topic.title) {
    case "Marketing":
      return `Your profile is aligned with marketing-focused roles${role ? ` like ${role}` : ""}, so these explainers map directly to what interviewers probe in that domain.`;
    case "Finance":
      return `Your program/career focus leans finance${role ? ` (${role})` : ""}; these cover the fundamentals recruiters expect you to already know.`;
    case "Business Communication":
      return `Strong business communication is what sells ${name} in case discussions and HR rounds, and these drills sharpen exactly that.`;
    case "Data Structures & Algorithms":
      return role
        ? `Your preferred role (${role}) is technically assessed through DSA, so these are the exact patterns interviewers draw from.`
        : `Technical roles are screened with DSA, so these cover the patterns most likely to appear in your rounds.`;
    case "System Design":
      return `Beyond coding, your target roles expect system design thinking — these walk through the blueprint interviewers ask for.`;
    case "SQL & Databases":
      return `Database queries come up in almost every technical screen for your profile; these give the preparations most asked.`;
    case "Coding Interview Prep":
      return `Your technical profile means a coding round is near-certain; these mirror the problem types used to shortlist.`;
    case "Aptitude & Reasoning":
    case "Aptitude & Logical Reasoning":
      return `Aptitude is the universal first filter in campus placement drives, so building this directly protects your selection chances.`;
    case "Placement Preparation":
      return `This package matches the full placement pipeline for ${name}, turning an unfocused prep into a guided path.`;
    default:
      return `These pick the most relevant material for ${name}'s current profile and placement stage.`;
  }
}

const CHAT_GAP_KEYWORDS: Record<string, string[]> = {
  skills: [
    "communication",
    "soft skill",
    "english",
    "speak",
    "speaking",
    "confidence",
    "fluency",
    "hr round",
  ],
  certifications: ["certification", "certificate", "online course", "udemy", "coursera", "roadmap"],
  projects: ["project", "resume", "portfolio", "github", "build project", "side project"],
  internships: ["internship", "experience", "job", "fresher job"],
  roles: ["which role", "job role", "career", "what should i do", "choose"],
  cgpa: ["cgpa", "marks", "grade", "gpa", "academic", "backlog", "percentage"],
  intent: [
    "aptitude",
    "reasoning",
    "quant",
    "logical",
    "placement",
    "campus drive",
    "written test",
  ],
  ctc: ["salary", "ctc", "negotiate", "package"],
};

const CHAT_DOMAIN_TOPICS: Topic[] = [
  {
    title: "Data Structures & Algorithms",
    query: "DSA interview preparation for placements",
    reason: "You asked about this in your chats",
    kind: "domain",
  },
  {
    title: "SQL & Databases",
    query: "SQL interview questions and practice",
    reason: "You asked about this in your chats",
    kind: "domain",
  },
  {
    title: "System Design",
    query: "system design interview basics",
    reason: "You asked about this in your chats",
    kind: "domain",
  },
  {
    title: "Aptitude & Logical Reasoning",
    query: "aptitude logical reasoning placement practice",
    reason: "You asked about this in your chats",
    kind: "domain",
  },
  {
    title: "Communication & Soft Skills",
    query: "communication skills for interviews english",
    reason: "You asked about this in your chats",
    kind: "domain",
  },
  {
    title: "Marketing & Finance Basics",
    query: "marketing and finance basics for interviews",
    reason: "You asked about this in your chats",
    kind: "domain",
  },
];

function analyzeChat(texts: string[]): { gapIds: string[]; topics: Topic[] } {
  const gapIds: string[] = [];
  const topics: Topic[] = [];
  const lower = texts.join(" ").toLowerCase();

  for (const [gap, keywords] of Object.entries(CHAT_GAP_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) gapIds.push(gap);
  }

  const dsa = ["dsa", "data structure", "algorithm", "leetcode", "coding"];
  if (dsa.some((k) => lower.includes(k))) topics.push(CHAT_DOMAIN_TOPICS[0]!);
  const sql = ["sql", "database", "dbms", "query"];
  if (sql.some((k) => lower.includes(k))) topics.push(CHAT_DOMAIN_TOPICS[1]!);
  const sys = ["system design", "scalability", "architecture"];
  if (sys.some((k) => lower.includes(k))) topics.push(CHAT_DOMAIN_TOPICS[2]!);
  const aptitude = ["aptitude", "quant", "reasoning", "logical"];
  if (aptitude.some((k) => lower.includes(k))) topics.push(CHAT_DOMAIN_TOPICS[3]!);
  const comm = ["communication", "english", "speaking", "soft skill", "hr round"];
  if (comm.some((k) => lower.includes(k))) topics.push(CHAT_DOMAIN_TOPICS[4]!);
  const busi = ["marketing", "finance", "business", "management"];
  if (busi.some((k) => lower.includes(k))) topics.push(CHAT_DOMAIN_TOPICS[5]!);

  return { gapIds: [...new Set(gapIds)], topics };
}

const ANALYSIS_TOPICS: { keys: string[]; topic: Topic }[] = [
  {
    keys: ["communication", "verbal_fluency", "vocabulary", "listening", "conciseness"],
    topic: {
      title: "Communication & Soft Skills",
      query: "communication skills for interviews freshers",
      reason: "Low score in your recent interview analysis",
      kind: "weakness",
    },
  },
  {
    keys: ["subject_knowledge", "knowledge_awareness"],
    topic: {
      title: "Domain Knowledge & Awareness",
      query: "domain knowledge for interviews campus placement",
      reason: "Low score in your recent interview analysis",
      kind: "weakness",
    },
  },
  {
    keys: ["analytical_problem_solving", "logical_reasoning", "creativity", "clarity_of_thought"],
    topic: {
      title: "Analytical Thinking & Problem Solving",
      query: "analytical reasoning and problem solving for interviews",
      reason: "Low score in your recent interview analysis",
      kind: "weakness",
    },
  },
  {
    keys: ["ability_structure_answer", "ability_defend_opinion", "clarity_of_thought"],
    topic: {
      title: "Structured Interview Answers",
      query: "how to structure answers in interviews STAR method",
      reason: "Low score in your recent interview analysis",
      kind: "weakness",
    },
  },
  {
    keys: ["confidence", "personality_presence", "energy", "attitude"],
    topic: {
      title: "Confidence & Body Language",
      query: "confidence and body language for interviews",
      reason: "Low score in your recent interview analysis",
      kind: "weakness",
    },
  },
  {
    keys: ["leadership_initiative", "responsibility", "ownership"],
    topic: {
      title: "Leadership & Initiative",
      query: "leadership skills for campus placements",
      reason: "Low score in your recent interview analysis",
      kind: "weakness",
    },
  },
  {
    keys: ["teamwork_interpersonal_skills", "empathy", "conflict_management", "respect_for_others"],
    topic: {
      title: "Teamwork & Interpersonal Skills",
      query: "teamwork skills and conflict management for interviews",
      reason: "Low score in your recent interview analysis",
      kind: "weakness",
    },
  },
  {
    keys: ["motivation_fit", "ambition", "self_awareness", "learning_orientation"],
    topic: {
      title: "Interview Motivation & Role Fit",
      query: "how to answer why this company and role fit questions",
      reason: "Low score in your recent interview analysis",
      kind: "weakness",
    },
  },
  {
    keys: ["general_awareness", "curiosity"],
    topic: {
      title: "General Awareness & Current Affairs",
      query: "general awareness current affairs for interviews",
      reason: "Low score in your recent interview analysis",
      kind: "weakness",
    },
  },
];

function analysisToTopics(analyses: (MockInterviewAnalysis | null)[]): Topic[] {
  const found = new Map<string, { dim: string; pct: number; desc: string }>();
  for (const a of analyses) {
    if (!a || !a.metrics || a.metrics.length === 0) continue;
    const sorted = [...a.metrics].sort((x, y) => x.percentage - y.percentage);
    for (const m of sorted) {
      const dim = m.dimension.toLowerCase();
      for (const mapping of ANALYSIS_TOPICS) {
        if (mapping.keys.some((k) => dim.includes(k))) {
          const title = mapping.topic.title;
          const existing = found.get(title);
          if (!existing || m.percentage < existing.pct) {
            found.set(title, { dim: m.dimension, pct: m.percentage, desc: m.description });
          }
          break;
        }
      }
    }
  }
  // Sort by lowest score first, so rotation order reflects severity.
  const entries = [...found.entries()].sort((a, b) => a[1].pct - b[1].pct);
  return entries.map(([title, info]) => {
    const mapping = ANALYSIS_TOPICS.find((m) => m.topic.title === title)!;
    return {
      ...mapping.topic,
      evidence: `${info.dim}: you scored ${info.pct}%. ${info.desc}`,
    };
  });
}

const EMBED_BASE = "https://www.youtube-nocookie.com/embed";

function videoEmbedUrl(video: Video): string {
  return `${EMBED_BASE}/${video.videoId}?autoplay=1&rel=0&playsinline=1`;
}

function VideoCard({
  video,
  number,
  onPlay,
}: {
  video: Video;
  number: number;
  onPlay: (video: Video) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPlay(video)}
      className="group flex cursor-pointer flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <GraduationCap className="size-8" />
          </div>
        )}
        <span className="absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {number}
        </span>
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="grid size-12 place-items-center rounded-full bg-foreground/90 text-background shadow-lg transition-transform duration-200 group-hover:scale-110">
            <Play className="ml-0.5 size-5 fill-current" />
          </span>
        </span>
      </div>
      <div className="mt-2 min-w-0 flex-1">
        <p className="line-clamp-2 text-[14px] leading-snug font-medium text-foreground sm:text-[15px]">
          {video.title}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{video.channel}</p>
      </div>
    </button>
  );
}

function VideoSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="aspect-video w-full animate-pulse rounded-xl bg-muted" />
          <div className="mt-2 space-y-2">
            <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function VideoPlayerDialog({
  video,
  onOpenChange,
}: {
  video: Video | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(video)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(56rem,calc(100vw-1rem))] gap-3 border-border/60 p-3 sm:rounded-xl sm:p-4">
        {video && (
          <>
            <div className="overflow-hidden rounded-lg bg-black">
              <iframe
                key={video.videoId}
                src={videoEmbedUrl(video)}
                title={video.title}
                className="aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <DialogHeader className="pr-8 text-center sm:text-left">
              <DialogTitle className="line-clamp-2 text-sm leading-snug sm:text-base">
                {video.title}
              </DialogTitle>
              <DialogDescription className="truncate">{video.channel}</DialogDescription>
            </DialogHeader>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TutorialsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);

  useEffect(() => {
    if (!user || sections.length > 0) return;

    (async () => {
      const topics: Topic[] = [];

      // Pull analysis from the last 3 mock interviews and derive topics from weak scores.
      try {
        const interviews = await mockInterviews();
        const completed = interviews.filter((i) => i.status === "completed");
        const recent = completed.slice(0, 3);
        const analyses = await Promise.all(
          recent.map((i) => mockInterviewAnalysis(i.id).catch(() => null)),
        );
        const analysisTopics = analysisToTopics(analyses);
        // Rotate through the weak dimensions so each refresh surfaces a fresh
        // subset instead of always showing the same bottom few.
        const batchSize = 3;
        const start = (refreshKey * batchSize) % Math.max(1, analysisTopics.length);
        const rotated = [];
        for (let i = 0; i < analysisTopics.length; i++) {
          rotated.push(analysisTopics[(start + i) % analysisTopics.length]);
        }
        const seenFromAnalysis = new Set(topics.map((t) => t.title));
        for (const t of rotated.slice(0, batchSize)) {
          if (t && !seenFromAnalysis.has(t.title)) {
            topics.push(t);
            seenFromAnalysis.add(t.title);
          }
        }
      } catch {
        // analysis may be unavailable; chat-derived topics are still enough
      }

      // Pull the last 3 chat sessions and derive topics from what was asked.
      try {
        const sessions = await chatSessions();
        const recent = sessions.slice(0, 3);
        const details = await Promise.all(
          recent.map((s) => chatSessionDetail(s.id).catch(() => null)),
        );
        const chatTexts = details
          .filter((d): d is NonNullable<typeof d> => Boolean(d))
          .flatMap((d) => d.messages.filter((m) => m.role === "user").map((m) => m.content));
        if (chatTexts.length > 0) {
          const chat = analyzeChat(chatTexts);
          // Rotate through the chat topics so each refresh shows a fresh set.
          const chatTopics = chat.topics;
          const chatBatchSize = 3;
          const chatStart = (refreshKey * chatBatchSize) % Math.max(1, chatTopics.length);
          const chatRotated = [];
          for (let i = 0; i < chatTopics.length; i++) {
            chatRotated.push(chatTopics[(chatStart + i) % chatTopics.length]);
          }
          const seen = new Set(topics.map((t) => t.title));
          for (const t of chatRotated.slice(0, chatBatchSize)) {
            if (t && !seen.has(t.title)) {
              topics.push(t);
              seen.add(t.title);
            }
          }
        }
      } catch {
        // analysis-derived topics are enough if chat fetch fails
      }

      // Fallback to rounded placement basics if nothing was derived yet.
      if (topics.length === 0) {
        topics.push(...(DOMAIN_TOPICS["default"] ?? []).slice(0, 3));
      }

      const initial = topics.map((topic) => ({
        topic,
        videos: [],
        loading: true,
        error: "",
      }));
      setSections(initial);
      // Show at most 30 videos total, split proportionally; no minimum.
      const MAX = 30;
      const n = initial.length;
      const targets: number[] = [];
      initial.forEach((_, i) => {
        const base = Math.floor(MAX / n);
        targets.push(i < MAX % n ? base + 1 : base);
      });
      const results = await Promise.all(
        initial.map(async (section, index) => {
          try {
            const fetched = await searchVideos(section.topic.query, (targets[index] ?? 0) + 2);
            const videos = fetched.slice(0, targets[index]).map((v) => ({
              ...v,
              why: describeWhy(section.topic, toProfile(user?.profile)),
            }));
            return { topic: section.topic, videos, loading: false, error: "" };
          } catch (err) {
            return {
              topic: section.topic,
              videos: [],
              loading: false,
              error: String(err),
            };
          }
        }),
      );
      setSections(results);
      setRefreshing(false);
    })();
  }, [user, sections.length, refreshKey]);

  function refreshFeed() {
    setRefreshing(true);
    setSections([]);
    setRefreshKey((k) => k + 1);
  }

  async function retrySection(index: number) {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, loading: true, error: "" } : s)),
    );
    const topic = sections[index]?.topic;
    if (!topic) return;
    const profile = toProfile(user?.profile);
    try {
      const videos = (await searchVideos(topic.query)).map((v) => ({
        ...v,
        why: describeWhy(topic, profile),
      }));
      setSections((prev) =>
        prev.map((s, i) => (i === index ? { ...s, videos, loading: false } : s)),
      );
    } catch (err) {
      setSections((prev) =>
        prev.map((s, i) => (i === index ? { ...s, loading: false, error: String(err) } : s)),
      );
    }
  }

  useEffect(() => {
    let cancelled = false;
    me()
      .then(async (current) => {
        if (cancelled) return;
        if (!current) {
          void navigate({ to: "/candidate-auth", search: { mode: "login" }, replace: true });
          return;
        }
        if (current.profile_complete === false) {
          void navigate({ to: "/onboarding", replace: true });
          return;
        }
        setUser(current);
        if (!cancelled) setStatus("ready");
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

  if (status === "loading") {
    return <GateLoading />;
  }

  if (status === "error") {
    return <GateError message={errorMessage} />;
  }

  const hasKey = Boolean((import.meta.env["VITE_YOUTUBE_API_KEY"] as string | undefined) ?? "");

  const profile = toProfile(user?.profile);

  const videoOffsets: number[] = [];
  let cumulative = 0;
  for (const s of sections) {
    videoOffsets.push(cumulative);
    cumulative += s.videos.length;
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppNavHeader
        current="tutorials"
        sticky
        left={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void navigate({ to: "/chat", replace: true })}
              className="grid size-8 cursor-pointer place-items-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Back to Home"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="grid size-9 place-items-center rounded-lg bg-foreground text-background">
              <GraduationCap className="size-4" />
            </span>
            <span>
              <p className="text-sm font-semibold leading-tight">Tutorials</p>
            </span>
          </div>
        }
      />

      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
        <button
          type="button"
          onClick={refreshFeed}
          disabled={refreshing}
          className="flex w-full cursor-pointer items-center justify-center gap-2 bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:pointer-events-none disabled:opacity-40"
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh Tutorials"}
        </button>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {!hasKey ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <GraduationCap className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-4 text-base font-semibold">Waiting for a YouTube API key</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Set{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-[12px]">
                VITE_YOUTUBE_API_KEY
              </code>{" "}
              in your <code className="rounded bg-muted px-1.5 py-0.5 text-[12px]">.env</code> file
              and the personalized video list will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {sections.map((section, index) => (
              <section key={section.topic.query}>
                <div className="mb-4 flex items-start gap-2.5">
                  <span className="mt-1 h-4 w-1 shrink-0 rounded-full bg-foreground/80" />
                  <div>
                    <h2 className="text-lg font-semibold">{section.topic.title}</h2>
                    {describeWhy(section.topic, profile) && (
                      <p className="mt-1 text-[13px] leading-relaxed text-foreground/80">
                        {describeWhy(section.topic, profile)}
                      </p>
                    )}
                  </div>
                </div>

                {section.error === "missing-key" && (
                  <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Add{" "}
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[12px]">
                        VITE_YOUTUBE_API_KEY
                      </code>{" "}
                      to see videos.
                    </p>
                  </div>
                )}

                {section.error && section.error !== "missing-key" && (
                  <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">Couldn't load videos right now.</p>
                    <button
                      type="button"
                      onClick={() => void retrySection(index)}
                      className="mt-4 cursor-pointer rounded-md border border-foreground px-4 py-2 text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {section.loading && !section.error && <VideoSkeleton count={8} />}

                {!section.loading && !section.error && (
                  <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {section.videos.map((v, vi) => (
                      <VideoCard
                        key={v.videoId}
                        video={v}
                        number={(videoOffsets[index] ?? 0) + vi + 1}
                        onPlay={setActiveVideo}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </main>

      <VideoPlayerDialog
        video={activeVideo}
        onOpenChange={(open) => {
          if (!open) setActiveVideo(null);
        }}
      />
    </div>
  );
}
