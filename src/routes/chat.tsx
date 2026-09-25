import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Bot,
  BriefcaseBusiness,
  Check,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Dumbbell,
  FileText,
  GraduationCap,
  Loader2,
  LogOut,
  Map,
  MessageSquare,
  Mic,
  Plus,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import { AppNavHeader, AppNavIconButton } from "@/components/tb/app-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Typewriter } from "@/components/chat/rich-text";
import {
  chat,
  chatSessionDetail,
  chatSessions,
  deleteChatSession,
  getCandidateRoadmap,
  getNotifications,
  getProfile,
  me,
  summarizeChatSession,
  transcribeAudio,
  translateTexts,
  type AuthUser,
  type ChatMessage,
  type ProfileRanks,
} from "@/lib/api";
import { broadcasts } from "@/lib/data";
import { cn } from "@/lib/utils";
import { LogoutConfirmDialog } from "@/components/logout-confirm";
import { GateError, GateLoading } from "@/components/load-state";

const title = "TalentBro | Student Chat";
const description = "Chat with TalentBro, your AI placement-prep coach.";

function userInstitution(u: AuthUser): string {
  if (u.institution) return u.institution;
  const profile = u.profile as { college?: string } | null | undefined;
  return profile?.college ?? "";
}

export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>): { prompt?: string } => {
    const p = typeof search["prompt"] === "string" ? search["prompt"] : undefined;
    return p ? { prompt: p } : {};
  },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ChatPage,
});

const STORAGE_SESSIONS = "tb.chat.sessions";
const STORAGE_ACTIVE = "tb.chat.activeId";

type ChatSession = {
  id: string;
  serverId: string | null;
  title: string;
  createdAt: number;
  updatedAt?: number;
  messages: ChatMessage[];
  olderAvailable?: boolean;
  loadingOlder?: boolean;
};

type StudentProfile = {
  name?: string;
  college?: string;
  department?: string;
  program?: string;
  cgpa?: number | null;
  expected_ctc?: number | null;
  preferred_roles?: string[];
  preferred_locations?: string[];
  preferred_language?: string;
  skills?: string[];
  projects?: string[];
  internships?: string[];
  placement_status?: string;
};

const DEFAULT_SUGGESTIONS = [
  "Explain DFS and BFS with a simple example",
  "Quiz me on 5 OOP interview questions",
  "How do I answer Tell me about yourself?",
  "Review my resume summary",
];

const ROADMAP_PROMPT = "Help me with an appropriate Roadmap for this month";

// Static new-chat screen copy that is translated for non-English profiles so the
// empty state feels native. Order matches the translation response slice.
const NEW_CHAT_READY = "Ready when you are.";
const NEW_CHAT_DESC =
  "Your AI placement-prep coach. Ask me anything about interviews, resumes, DSA, management, aptitude or communication — I'm here to get you placement ready.";
const NEW_CHAT_PLACEHOLDER = "Ask TalentBro anything…";
const NEW_CHAT_COPY = [NEW_CHAT_READY, NEW_CHAT_DESC, NEW_CHAT_PLACEHOLDER];

type I18nBundle = {
  lang: string;
  slot: number;
  copy: string[];
  suggestions: string[];
};

const SUGGESTION_POOL = [
  "Explain the difference between DFS and BFS with a simple example",
  "Quiz me on 5 OOP interview questions",
  "What are the 3 most common sorting algorithms and when do you use each?",
  "Walk me through a binary search on a sorted array",
  "Give me an easy example of dynamic programming",
  "Explain SQL joins with a practical example",
  "How do I answer Tell me about yourself?",
  "Practice the STAR method for a teamwork question",
  "Ask me and correct my response to 'What is your greatest weakness?'",
  "Give me 5 aptitude practice questions with explanations",
  "Help me draft a professional summary for my resume",
  "What should I say when asked about my salary expectations?",
  "Give me 5 common HR round questions and how to answer them",
  "Tell me the biggest mistakes students make in interviews",
  "Give me 5 management interview questions and how to answer them",
];

const ROLE_BASED = [
  (r: string) => `Prepare me for a ${r} interview`,
  (r: string) => `What technical questions do ${r} roles usually get?`,
  (r: string) => `Mock interview me for a ${r} position`,
];

const DEPT_BASED = [
  (d: string) => `What questions are asked for ${d} roles in campus placement?`,
  (d: string) => `Which companies hire for ${d} and what do they look for?`,
];

const SKILL_BASED = [
  (s: string) => `Test me on ${s} with 5 questions`,
  (s: string) => `How do I improve my ${s} skills for placements?`,
];

const SUGGESTION_SLOT_MS = 2 * 60 * 60 * 1000;

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
    preferred_locations: list(p["preferred_locations"]),
    preferred_language: str(p["preferred_language"]),
    skills: list(p["skills"]),
    projects: list(p["projects"]),
    internships: list(p["internships"]),
    placement_status: str(p["placement_status"]),
  };
}

function buildSuggestions(
  rawProfile: unknown,
  slot = Math.floor(Date.now() / SUGGESTION_SLOT_MS),
): string[] {
  const profile = toProfile(rawProfile);
  const seed = slot;
  const out: string[] = [];

  const role = pick(profile.preferred_roles ?? [], seed, 1);
  if (role) {
    const fn = pick(ROLE_BASED, seed, 2);
    if (fn) out.push(fn(role));
  }

  const skill = pick(profile.skills ?? [], seed, 3);
  if (out.length < 2 && skill) {
    const fn = pick(SKILL_BASED, seed, 4);
    if (fn) out.push(fn(skill));
  }

  if (out.length < 3 && profile.department) {
    const fn = pick(DEPT_BASED, seed, 5);
    if (fn) out.push(fn(profile.department));
  }

  const pool = SUGGESTION_POOL.slice();
  const first = seed % pool.length;
  let i = first;
  while (out.length < 4 && pool.length > 0) {
    const idx = i % pool.length;
    const s = pool[idx];
    if (s && !out.includes(s)) out.push(s);
    pool.splice(idx, 1);
    i = (idx + 1) % (pool.length + 1);
  }

  return out.length >= 4 ? out.slice(0, 4) : [...out, ...DEFAULT_SUGGESTIONS].slice(0, 4);
}

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());

// ---- Live browser voice input (Web Speech API), tuned like the communication
// training so spoken words appear as you speak and a stuck recognizer gets
// recycled instead of silently swallowing your speech. A MediaRecorder +
// backend-transcription path is kept as the fallback for browsers without STT.
const VOICE_STT_LANGS = ["en-IN", "en-GB", "en-US"];
const VOICE_AUTO_STOP_MS = 3000; // commit only after ~3s of sustained silence
const VOICE_MAX_MS = 60000; // hard cap for a single monologue
const VOICE_TALK_RMS = 0.06; // analyser RMS that counts as a person speaking
const VOICE_SPEAK_SILENT_MS = 3000; // speaking non-stop but no transcript → recycle
const VOICE_RESULT_IDLE_MS = 12000; // no transcript at all while listening → recycle
const VOICE_REBUILD_COOLDOWN_MS = 4000; // don't recycle twice within this window
const VOICE_SAMPLE_MS = 80; // analyser sampling period

const TITLE_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "so",
  "for",
  "of",
  "to",
  "in",
  "on",
  "at",
  "with",
  "without",
  "how",
  "what",
  "why",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "whose",
  "can",
  "could",
  "would",
  "should",
  "will",
  "shall",
  "may",
  "might",
  "do",
  "does",
  "did",
  "is",
  "are",
  "am",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "not",
  "please",
  "help",
  "me",
  "my",
  "i",
  "you",
  "your",
  "it",
  "this",
  "that",
  "these",
  "those",
]);

function summarizeTitle(prompt: string, maxWords = 4): string {
  const cleaned = (prompt || "")
    .replace(/[`*_#[\]()>"'"]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[.,;:!?()]+|[.,;:!?()]+$/g, "").toLowerCase())
    .filter(Boolean);
  const meaningful = cleaned.filter((w) => !TITLE_STOPWORDS.has(w));
  const chosen = (meaningful.length ? meaningful : cleaned).slice(0, maxWords);
  const joined = chosen.join(" ");
  const titleText = joined ? joined.charAt(0).toUpperCase() + joined.slice(1) : joined;
  return titleText.length > 60 ? `${titleText.slice(0, 60)}…` : titleText;
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_SESSIONS);
    const parsed = raw ? (JSON.parse(raw) as ChatSession[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s) => ({
        ...s,
        serverId: s.serverId ?? null,
        updatedAt: s.updatedAt ?? s.createdAt,
      }))
      .filter((s) => !(s.title === "New chat" && s.messages.length === 0));
  } catch {
    return [];
  }
}

function ChatPage() {
  const navigate = useNavigate();
  const { prompt } = Route.useSearch();
  const promptRef = useRef(prompt);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ranks, setRanks] = useState<ProfileRanks>({
    score: null,
    department: null,
    overall: null,
    total: 0,
    department_total: 0,
  });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [roadmapChecking, setRoadmapChecking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [notifUnread, setNotifUnread] = useState(broadcasts.filter((n) => !n.read).length);
  const [suggestionSlot, setSuggestionSlot] = useState(() =>
    Math.floor(Date.now() / SUGGESTION_SLOT_MS),
  );
  const [i18n, setI18n] = useState<I18nBundle | null>(null);

  useEffect(() => {
    if (!user) return;
    const lang = toProfile(user.profile).preferred_language || "";
    if (!lang || lang === "english") {
      setI18n(null);
      return;
    }
    let cancelled = false;
    // Keep the new-chat screen friendly in the student's own language: translate
    // the generated suggestions plus the static copy together in one call. The
    // backend falls back to the English text, so a failed translate never blanks
    // the UI.
    const suggestions = buildSuggestions(user.profile, suggestionSlot);
    translateTexts([...suggestions, ...NEW_CHAT_COPY], lang)
      .then((all) => {
        if (cancelled) return;
        setI18n({
          lang,
          slot: suggestionSlot,
          suggestions: all.slice(0, suggestions.length),
          copy: all.slice(suggestions.length),
        });
      })
      .catch(() => {
        // Offline/translation down — stay with the previous bundle or English.
        if (!cancelled) setI18n((prev) => (prev?.lang === lang ? prev : null));
      });
    return () => {
      cancelled = true;
    };
  }, [user, suggestionSlot]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const slot = Math.floor(Date.now() / SUGGESTION_SLOT_MS);
      setSuggestionSlot((prev) => (prev === slot ? prev : slot));
    }, 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ---- Voice input — live browser STT first (like communication training);
  // MediaRecorder + backend transcription only as a fallback for browsers
  // without the Web Speech API (e.g. Firefox). ----
  const sttSupportedRef = useRef(
    typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  );
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sttLangsRef = useRef<string[]>(VOICE_STT_LANGS);
  const sttLangIdxRef = useRef(0);
  const sttActiveRef = useRef(false); // a live STT session is currently open
  const sttStopRef = useRef(false); // true once we asked the engine to stop — blocks auto-restart
  const sttFinalsRef = useRef(""); // committed (final) words while listening
  const sttInterimsRef = useRef(""); // live partial words while listening
  const sttBaseRef = useRef(""); // typed text already in the input when recording started
  const micUnlockedRef = useRef(false); // mic permission granted via getUserMedia
  const autoStopTimerRef = useRef<number | null>(null);
  const maxLenTimerRef = useRef<number | null>(null);
  const lastResultAtRef = useRef(0);
  const lastRebuildAtRef = useRef(0);
  const lastSpeechMsRef = useRef(0);

  // Mic waveform refs (frontend-only — proves the mic is live; the STT watchdog
  // cross-checks the waveform against a silent recognizer to recycle it).
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micTimerRef = useRef<number | null>(null);

  // MediaRecorder fallback refs (browsers without the Web Speech API).
  const recStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recMimeRef = useRef("audio/webm");
  const recCtxRef = useRef<AudioContext | null>(null);
  const recAnalyserRef = useRef<AnalyserNode | null>(null);
  const recIntervalRef = useRef<number | null>(null);
  const lastSpeechRef = useRef(0);
  const recStartRef = useRef(0);

  const [micReady, setMicReady] = useState(
    () =>
      typeof window !== "undefined" &&
      (!!(window.SpeechRecognition || window.webkitSpeechRecognition) ||
        (!!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== "undefined")),
  );

  const [animating, setAnimating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const loadingSessionId = useRef<string | null>(null);

  function copyMessage(content: string, index: number) {
    navigator.clipboard?.writeText(content).catch(() => {});
    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex((c) => (c === index ? null : c)), 1500);
  }

  function scrollToBottom(force = false) {
    const el = scrollRef.current;
    if (!el) return;
    if (force) {
      el.scrollTop = el.scrollHeight;
      stickToBottom.current = true;
      return;
    }
    if (!stickToBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 120;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distanceFromBottom < threshold;
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
        if (current.role !== "student") {
          void navigate({ to: "/institution-auth", search: { mode: "login" }, replace: true });
          return;
        }
        if (current.profile_complete === false) {
          void navigate({ to: "/onboarding", replace: true });
          return;
        }
        const local = loadSessions();
        let stored = local;
        try {
          const list = await chatSessions();
          const serverIds = new Set(list.map((x) => x.id));
          const serverSessions: ChatSession[] = list
            .filter((srv) => srv.message_count > 0)
            .map((srv) => {
              const existing = local.find((s) => s.serverId === srv.id || s.id === srv.id);
              const createdAt = new Date(srv.created_at).getTime();
              return {
                id: srv.id,
                serverId: srv.id,
                title:
                  existing && existing.title !== "New chat"
                    ? existing.title
                    : srv.title || "New chat",
                createdAt,
                updatedAt: new Date(srv.updated_at).getTime(),
                messages: existing?.messages ?? [],
              };
            });
          // Server is the source of truth for anything that has been assigned a
          // serverId: entries whose serverId is no longer listed were deleted
          // (here or on another device) and are stale ghosts — drop them. Only
          // keep truly local sessions that never reached the server.
          const locals = local.filter((s) => !s.serverId && !serverIds.has(s.id));
          stored = [...serverSessions, ...locals];
          persist(stored);
        } catch {
          // offline — keep local-only sessions
        }
        if (!cancelled) {
          persistActive("");
          if (promptRef.current) {
            setPendingPrompt(promptRef.current.trim());
          }
        }
        setUser(current);
        setStatus("ready");
        setLoaded(true);
        try {
          const payload = await getProfile();
          if (!cancelled) setRanks(payload.ranks);
        } catch {
          // ranks are optional — leave default
        }
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

  const activeSession = sessions.find((s) => s.id === activeId);
  const lastActiveRef = useRef(activeSession);
  lastActiveRef.current = activeSession;

  useEffect(() => {
    // End-of-session hook: leaving the chat page ends the active conversation,
    // so CRUD-update the candidate profile from whatever was discussed.
    return () => {
      const last = lastActiveRef.current;
      if (last?.serverId && last.messages.length > 0) {
        void summarizeChatSession(last.serverId).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingPrompt || !loaded) return;
    const text = pendingPrompt;
    setPendingPrompt("");
    void navigate({ to: "/chat", search: {}, replace: true });
    void sendMessage(text);
  }, [pendingPrompt, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    getNotifications()
      .then((data) => {
        if (!cancelled) setNotifUnread(data.unread);
      })
      .catch(() => {
        // Backend unavailable — keep the seed-based badge count.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    if (loaded && scrollRef.current && stickToBottom.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sessions, sending, activeId, loaded]);

  function sortRecent(a: ChatSession, b: ChatSession): number {
    return (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt);
  }

  function writeStorage(sorted: ChatSession[]) {
    try {
      localStorage.setItem(STORAGE_SESSIONS, JSON.stringify(sorted));
    } catch {
      // storage unavailable — keep in memory
    }
  }

  function persist(next: ChatSession[]) {
    const sorted = [...next].sort(sortRecent);
    setSessions(sorted);
    writeStorage(sorted);
  }

  function updateSession(id: string, updater: (s: ChatSession) => ChatSession) {
    setSessions((prev) => {
      const sorted = [...prev.map((s) => (s.id === id ? updater(s) : s))].sort(sortRecent);
      writeStorage(sorted);
      return sorted;
    });
  }

  function persistActive(id: string) {
    setActiveId(id);
    try {
      localStorage.setItem(STORAGE_ACTIVE, id);
    } catch {
      // ignore
    }
  }

  function startNewChat() {
    const prevActive = sessions.find((s) => s.id === activeId);
    if (prevActive?.serverId && prevActive.messages.length > 0) {
      void summarizeChatSession(prevActive.serverId).catch(() => {});
    }
    persistActive("");
    setError("");
    setAnimating(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function startRoadmapChat() {
    if (sending) return;
    startNewChat();
    void sendMessage(ROADMAP_PROMPT);
  }

  async function openRoadmap() {
    if (roadmapChecking || sending) return;
    setRoadmapChecking(true);
    try {
      const roadmap = await getCandidateRoadmap();
      if (roadmap) {
        void navigate({ to: "/roadmap-drill" });
        return;
      }
      startRoadmapChat();
    } catch {
      startRoadmapChat();
    } finally {
      setRoadmapChecking(false);
    }
  }

  function selectSession(id: string) {
    const session = sessions.find((s) => s.id === id);
    // Leaving the active chat ends it: refresh the profile from whatever was
    // discussed before switching. Fire-and-forget; merge-only on the server.
    const prevActive = sessions.find((s) => s.id === activeId);
    if (
      prevActive &&
      prevActive.id !== id &&
      prevActive.serverId &&
      prevActive.messages.length > 0
    ) {
      void summarizeChatSession(prevActive.serverId).catch(() => {});
    }
    persistActive(id);
    setError("");
    setAnimating(false);
    // Every tap on a past chat reloads its transcript from the server (paged,
    // newest first) so the screen always shows the full conversation — even
    // very long ones — instead of a stale local slice. Re-tapping the chat
    // that's already open is a no-op so it never clobbers in-flight state.
    if (session?.serverId && id !== activeId) {
      void loadTranscript(id, session.serverId);
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  // How many transcript pages (50 messages each) are fetched automatically when
  // a chat is opened. Longer chats keep working via the "Load earlier messages"
  // button once the cap is reached.
  const MAX_AUTO_LOAD_PAGES = 5;

  function toLocalMessage(m: {
    id: number;
    role: ChatMessage["role"];
    content: string;
    translation?: string | null;
  }): ChatMessage {
    return {
      role: m.role,
      content: m.content,
      ...(m.translation ? { translation: m.translation } : {}),
      id: m.id,
    };
  }

  async function loadTranscript(id: string, serverId: string) {
    if (loadingSessionId.current === id) return;
    loadingSessionId.current = id;
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) setLoadingSession(true);
    }, 120);
    try {
      let before: number | undefined;
      let loaded: ChatMessage[] = [];
      let olderAvailable = false;
      for (let page = 0; page < MAX_AUTO_LOAD_PAGES; page++) {
        const detail = await chatSessionDetail(serverId, before);
        const pageMessages = detail.messages.map(toLocalMessage);
        loaded = page === 0 ? pageMessages : [...pageMessages, ...loaded];
        olderAvailable = detail.older_available ?? false;
        if (!olderAvailable) break;
        const oldest = detail.messages[0];
        if (!oldest) break;
        if (page === MAX_AUTO_LOAD_PAGES - 1) break;
        before = oldest.id;
      }
      updateSession(id, (s) => ({
        ...s,
        messages: loaded,
        olderAvailable,
        loadingOlder: false,
      }));
      stickToBottom.current = true;
    } catch {
      // Keep the cached copy when the network is down — never blank the screen.
    } finally {
      settled = true;
      window.clearTimeout(timer);
      if (loadingSessionId.current === id) {
        loadingSessionId.current = null;
        setLoadingSession(false);
      }
    }
  }

  async function loadOlder(id: string) {
    const session = sessions.find((s) => s.id === id);
    const oldestId = session?.messages.find((m) => m.id != null)?.id;
    if (!session?.serverId || !oldestId || session.loadingOlder) return;
    updateSession(id, (s) => ({ ...s, loadingOlder: true }));
    try {
      const detail = await chatSessionDetail(session.serverId, oldestId);
      const older = detail.messages.map(toLocalMessage);
      updateSession(id, (s) => ({
        ...s,
        messages: [...older, ...s.messages],
        olderAvailable: detail.older_available ?? false,
        loadingOlder: false,
      }));
    } catch {
      updateSession(id, (s) => ({ ...s, loadingOlder: false }));
      setError("Couldn't load earlier messages. Check your connection and try again.");
    }
  }

  async function deleteSession(id: string) {
    const session = sessions.find((s) => s.id === id);
    if (session?.serverId) {
      try {
        await deleteChatSession(session.serverId);
      } catch {
        setError("Couldn't delete the chat. Check your connection and try again.");
        return;
      }
    }
    const next = sessions.filter((s) => s.id !== id);
    persist(next);
    if (activeId === id) {
      persistActive(next[0]?.id ?? "");
    }
  }

  async function sendMessage(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || sending || !user) return;

    const active = sessions.find((s) => s.id === activeId);
    const session: ChatSession = active ?? {
      id: uid(),
      title: "New chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      serverId: null,
      messages: [] as ChatMessage[],
    };

    const now = Date.now();
    const title = session.messages.length === 0 ? summarizeTitle(text) : session.title;

    const updated: ChatSession = {
      ...session,
      title,
      updatedAt: now,
      messages: [...session.messages, { role: "user", content: text }],
    };

    const next = active
      ? sessions.map((s) => (s.id === session.id ? updated : s))
      : [updated, ...sessions];
    persist(next);
    persistActive(session.id);
    setInput("");
    setError("");
    setSending(true);

    try {
      const sessionId = session.serverId;
      const {
        reply,
        translation,
        session_id,
        title: serverTitle,
        preferred_language,
      } = await chat(text, sessionId, session.messages.length === 0 ? title : null);
      if (preferred_language && preferred_language !== toProfile(user.profile).preferred_language) {
        setUser((u) => {
          if (!u) return u;
          const base =
            u.profile && typeof u.profile === "object"
              ? { ...(u.profile as Record<string, unknown>) }
              : {};
          return { ...u, profile: { ...base, preferred_language } };
        });
      }
      persist(
        next.map((s) =>
          s.id === session.id
            ? {
                ...s,
                serverId: session_id,
                title: session.messages.length === 0 ? serverTitle || title : s.title,
                messages: [
                  ...s.messages,
                  { role: "assistant", content: reply, translation: translation || "" },
                ],
              }
            : s,
        ),
      );
      setAnimating(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      persist(
        next.map((s) =>
          s.id === session.id
            ? { ...s, messages: [...s.messages, { role: "assistant", content: `⚠ ${message}` }] }
            : s,
        ),
      );
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void sendMessage();
    }
  }

  // ---- Voice input dispatch — live browser STT first, MediaRecorder +
  // backend transcription (Gemini via Groq Whisper) only as a fallback. The
  // recognised text lands *in the input* so it can be reviewed before send.
  async function startMicRecording() {
    if (!micReady) {
      setError("Voice input isn't supported in this browser. Use Chrome or Edge.");
      return;
    }
    if (sttSupportedRef.current) {
      startLiveStt();
      return;
    }
    await startRecorderFallback();
  }

  // ---- Live browser STT (the primary voice path) ----

  async function startLiveStt() {
    setError("");
    setRecording(true);
    setTranscribing(false);
    sttStopRef.current = false;
    sttActiveRef.current = true;
    sttFinalsRef.current = "";
    sttInterimsRef.current = "";
    sttBaseRef.current = input.trim();
    lastResultAtRef.current = Date.now();
    lastRebuildAtRef.current = 0;
    // Always transcribe into English regardless of the preferred profile
    // language — the transcript that lands in the input must stay in English.
    sttLangsRef.current = VOICE_STT_LANGS;
    sttLangIdxRef.current = 0;
    // Open the mic for the live waveform and WAIT for it to actually be granted
    // and live before starting the recognizer. Starting the browser recognizer
    // while the getUserMedia prompt/stream is still settling makes Chromium
    // start a recognizer that never delivers results (no onstart/onresult).
    const unlocked = await openMicWaves();
    if (!unlocked) {
      stopLiveStt(false);
      setError("Microphone access is blocked. Tap the mic button and choose Allow.");
      return;
    }
    if (!sttActiveRef.current || sttStopRef.current) return;
    // Hard cap: a single monologue never runs forever.
    if (maxLenTimerRef.current !== null) window.clearTimeout(maxLenTimerRef.current);
    maxLenTimerRef.current = window.setTimeout(() => {
      maxLenTimerRef.current = null;
      if (sttActiveRef.current && !sttStopRef.current) stopLiveStt(true);
    }, VOICE_MAX_MS);
    spawnSttRecognition("init");
  }

  function getRecognitionInstance(): SpeechRecognitionLike | null {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    return SR ? new SR() : null;
  }

  function spawnSttRecognition(cause: string) {
    const now = Date.now();
    if (cause === "init") {
      lastRebuildAtRef.current = now;
    } else {
      if (now - lastRebuildAtRef.current < VOICE_REBUILD_COOLDOWN_MS) return;
      lastRebuildAtRef.current = now;
    }
    const rec = getRecognitionInstance();
    console.log("[tb-chat-stt] spawn — cause=", cause, "instance=", !!rec);
    if (!rec) {
      stopLiveStt(false);
      setError("Live voice isn't supported in this browser. Use Chrome or Edge.");
      return;
    }
    try {
      recognitionRef.current?.abort();
    } catch {
      // noop
    }
    recognitionRef.current = rec;
    bindSttHandlers(rec);
    lastResultAtRef.current = Date.now();
    try {
      rec.start();
    } catch {
      // Already starting or not permitted — onerror/onend will sort it out.
    }
  }

  function bindSttHandlers(instance: SpeechRecognitionLike) {
    instance.continuous = true;
    instance.interimResults = true;
    instance.maxAlternatives = 3;
    try {
      instance.lang = sttLangsRef.current[sttLangIdxRef.current] ?? "en-IN";
    } catch {
      // Non-standard lang tag — the recognizer reports it via onerror.
    }

    instance.onstart = () => {
      console.log("[tb-chat-stt] onstart — recognizer is live");
    };

    instance.onresult = (event: SpeechRecognitionEventLike) => {
      lastResultAtRef.current = Date.now();
      console.log(
        "[tb-chat-stt] onresult — active=",
        sttActiveRef.current,
        "stop=",
        sttStopRef.current,
      );
      if (!sttActiveRef.current || sttStopRef.current) return;
      let finals = "";
      let interims = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result?.[0]?.transcript ?? "";
        if (result?.isFinal) finals += text;
        else interims += text;
      }
      console.log(
        "[tb-chat-stt] finals=",
        JSON.stringify(finals),
        "interims=",
        JSON.stringify(interims),
      );
      if (finals) sttFinalsRef.current = (sttFinalsRef.current + " " + finals).trim();
      sttInterimsRef.current = interims.trim();
      scheduleAutoStop();
      applySttToInput();
    };

    if (typeof instance.onspeechend !== "undefined" || "onspeechend" in (instance as object)) {
      instance.onspeechend = () => {
        // User stopped talking — commit shortly instead of dragging on.
        lastResultAtRef.current = Date.now();
        console.log("[tb-chat-stt] onspeechend");
        if (sttActiveRef.current && !sttStopRef.current) scheduleAutoStop();
      };
    }

    instance.onerror = (event: SpeechRecognitionErrorEventLike) => {
      lastResultAtRef.current = Date.now();
      const code = event.error;
      console.log("[tb-chat-stt] onerror — code=", code);
      if (code === "not-allowed" || code === "service-not-allowed") {
        stopLiveStt(false);
        setError("Microphone access is blocked. Tap the mic button and choose Allow.");
      } else if (
        code === "language-not-supported" &&
        sttLangIdxRef.current < sttLangsRef.current.length - 1
      ) {
        sttLangIdxRef.current += 1;
        // The failed recognizer is dead — set the next valid language and stand
        // up a completely fresh instance (bypassing the rebuild cooldown so the
        // mic resumes listening right away). Just mutating `lang` on a dead
        // instance never re-starts it.
        if (recognitionRef.current) {
          try {
            recognitionRef.current.lang = sttLangsRef.current[sttLangIdxRef.current] ?? "en-IN";
          } catch {
            // noop
          }
        }
        lastRebuildAtRef.current = 0;
        spawnSttRecognition("lang-retry");
      } else if (code === "no-speech") {
        // Engine timed out on silence — commit whatever was already said quickly.
        if (
          sttActiveRef.current &&
          !sttStopRef.current &&
          (sttFinalsRef.current || sttInterimsRef.current)
        ) {
          scheduleAutoStop();
        }
      } else {
        // network/aborted/audio-capture hiccups — the watchdog keeps the mic alive.
      }
    };

    instance.onend = () => {
      lastResultAtRef.current = Date.now();
      console.log(
        "[tb-chat-stt] onend — active=",
        sttActiveRef.current,
        "stop=",
        sttStopRef.current,
      );
      clearAutoStop();
      if (!sttActiveRef.current) return; // already stopped/committed
      if (sttStopRef.current) {
        commitLiveStt();
        return;
      }
      // The engine ended on its own while we still want to listen — stand up a
      // fresh instance so it can never quietly stop transcribing.
      spawnSttRecognition("onend");
    };
  }

  function scheduleAutoStop() {
    clearAutoStop();
    autoStopTimerRef.current = window.setTimeout(() => {
      autoStopTimerRef.current = null;
      if (!sttActiveRef.current || sttStopRef.current) return;
      if (sttFinalsRef.current || sttInterimsRef.current) {
        stopLiveStt(true);
      }
    }, VOICE_AUTO_STOP_MS);
  }

  function clearAutoStop() {
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }

  function clearMaxTimer() {
    if (maxLenTimerRef.current !== null) {
      window.clearTimeout(maxLenTimerRef.current);
      maxLenTimerRef.current = null;
    }
  }

  // Keep the spoken words (finals + live partials) flowing *into the input* in
  // real time, prefixed by whatever was already typed before recording so voice
  // input appends to rather than clobbers typed text.
  function liveSttText(): string {
    return [sttFinalsRef.current, sttInterimsRef.current].filter(Boolean).join(" ").trim();
  }

  function applySttToInput() {
    const spoken = liveSttText();
    const base = sttBaseRef.current.trim();
    setInput(spoken ? (base ? `${base} ${spoken}` : spoken) : base);
  }

  // Finalise a live session: drop the engine, put the spoken words *into the
  // input* (without sending) so they can be reviewed before pressing send.
  function commitLiveStt() {
    const text = [sttFinalsRef.current, sttInterimsRef.current].filter(Boolean).join(" ").trim();
    sttActiveRef.current = false;
    sttStopRef.current = true;
    clearAutoStop();
    clearMaxTimer();
    recognitionRef.current = null;
    stopMicWaves();
    setRecording(false);
    sttFinalsRef.current = "";
    sttInterimsRef.current = "";
    if (text) {
      const base = sttBaseRef.current.trim();
      setInput(base ? `${base} ${text}` : text);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    sttBaseRef.current = "";
  }

  // Manually stop the live session (mic tap, page leave, everything else).
  // Turns the mic off and commits spoken text synchronously — no waiting for
  // the recognizer's asynchronous onend, so the tap feels instant.
  function stopLiveStt(commit = true) {
    clearAutoStop();
    clearMaxTimer();
    stopMicWaves();
    if (!sttActiveRef.current && !recognitionRef.current) {
      setRecording(false);
      return;
    }
    sttStopRef.current = true;
    sttActiveRef.current = false;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (commit) {
      commitLiveStt();
    } else {
      setRecording(false);
      sttFinalsRef.current = "";
      sttInterimsRef.current = "";
      sttBaseRef.current = "";
    }
    // Fire-and-forget stop() so trailing finals still flush; the onend handler
    // sees sttActiveRef already false and returns without re-committing.
    if (rec) {
      try {
        rec.stop();
      } catch {
        // noop — the recognizer was already dead.
      }
    }
  }

  // STT health watchdog: if the student is clearly speaking (waveform proof)
  // but no transcript comes back, or the recognizer has gone totally quiet,
  // recycle it so "listening" always really transcribes.
  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      if (!sttActiveRef.current || sttStopRef.current) return;
      const now = Date.now();
      const talkingNow = now - lastSpeechMsRef.current < 1500;
      if (talkingNow && now - lastResultAtRef.current >= VOICE_SPEAK_SILENT_MS) {
        spawnSttRecognition("speaking-but-silent");
        return;
      }
      if (now - lastResultAtRef.current >= VOICE_RESULT_IDLE_MS) {
        spawnSttRecognition("quiet-timeout");
      }
    }, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  // ---- Mic waveform (frontend-only; words come from the browser's STT) ----

  async function openMicWaves(): Promise<boolean> {
    stopMicWaves();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micStreamRef.current = stream;
      micUnlockedRef.current = true;
      try {
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        micCtxRef.current = ctx;
        micAnalyserRef.current = analyser;
      } catch {
        micCtxRef.current = null;
        micAnalyserRef.current = null;
      }
      if (micTimerRef.current !== null) window.clearInterval(micTimerRef.current);
      micTimerRef.current = window.setInterval(() => {
        const an = micAnalyserRef.current;
        if (!an) return;
        const buf = new Uint8Array(an.fftSize);
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i]! - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        if (rms >= VOICE_TALK_RMS) lastSpeechMsRef.current = Date.now();
      }, VOICE_SAMPLE_MS);
      return true;
    } catch {
      micUnlockedRef.current = false;
      return false;
    }
  }

  function stopMicWaves() {
    if (micTimerRef.current !== null) {
      window.clearInterval(micTimerRef.current);
      micTimerRef.current = null;
    }
    if (micCtxRef.current) {
      void micCtxRef.current.close().catch(() => {});
      micCtxRef.current = null;
    }
    micAnalyserRef.current = null;
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
  }

  // ---- MediaRecorder fallback (browsers without the Web Speech API) — records
  // a clip, sends it to Gemini (Groq Whisper as server fallback), and puts the
  // transcript into the input without sending. ----
  async function startRecorderFallback() {
    setError("");
    setRecording(true);
    setTranscribing(false);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      setRecording(false);
      setError("Microphone access is blocked. Tap the mic button and choose Allow.");
      return;
    }
    const supported = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ].find((m) => window.MediaRecorder.isTypeSupported(m));
    const recorder = new MediaRecorder(stream, supported ? { mimeType: supported } : undefined);
    recMimeRef.current = recorder.mimeType || supported || "audio/webm";
    recChunksRef.current = [];
    recorderRef.current = recorder;

    recorder.addEventListener("dataavailable", (e) => {
      if (e.data && e.data.size > 0) recChunksRef.current.push(e.data);
    });
    recorder.addEventListener("stop", () => {
      stopRecorderTracks();
      void transcribeMicClip();
    });

    // Silence detection — auto-stop ~1.2s after the user stops talking.
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      recCtxRef.current = ctx;
      recAnalyserRef.current = analyser;
    } catch {
      recCtxRef.current = null;
      recAnalyserRef.current = null;
    }

    recStartRef.current = Date.now();
    lastSpeechRef.current = Date.now();
    recIntervalRef.current = window.setInterval(() => {
      const an = recAnalyserRef.current;
      if (an) {
        const buf = new Uint8Array(an.fftSize);
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i]! - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        if (rms > 0.018) lastSpeechRef.current = Date.now();
      }
      const rec = recorderRef.current;
      const silentFor = Date.now() - lastSpeechRef.current;
      const elapsed = Date.now() - recStartRef.current;
      if (rec && rec.state === "recording" && (silentFor > 1200 || elapsed > 30000)) {
        rec.stop(); // onstop → transcribeMicClip()
      }
    }, 80);

    recorder.start();
  }

  function stopRecorderTracks() {
    recStreamRef.current?.getTracks().forEach((t) => t.stop());
    recStreamRef.current = null;
    if (recIntervalRef.current !== null) {
      window.clearInterval(recIntervalRef.current);
      recIntervalRef.current = null;
    }
    if (recCtxRef.current) {
      void recCtxRef.current.close().catch(() => {});
      recCtxRef.current = null;
    }
    recAnalyserRef.current = null;
  }

  function stopMicRecording() {
    if (sttSupportedRef.current && sttActiveRef.current) {
      stopLiveStt(true);
      return;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    else stopRecorderTracks();
  }

  async function transcribeMicClip() {
    setRecording(false);
    setTranscribing(true);
    setError("");
    recorderRef.current = null;
    const chunks = recChunksRef.current;
    recChunksRef.current = [];
    try {
      if (chunks.length === 0) return;
      const blob = new Blob(chunks, { type: recMimeRef.current });
      const audioBytes = new Uint8Array(await blob.arrayBuffer());
      const text = await transcribeAudio(audioBytes.buffer as ArrayBuffer, recMimeRef.current);
      if (text) {
        setInput((prev) => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed} ${text}` : text;
        });
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't transcribe audio. Please try again.");
    } finally {
      setTranscribing(false);
    }
  }

  useEffect(() => {
    return () => {
      sttActiveRef.current = false;
      sttStopRef.current = true;
      clearAutoStop();
      clearMaxTimer();
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
        recognitionRef.current = null;
      }
      stopMicWaves();
      const frec = recorderRef.current;
      if (frec && frec.state !== "inactive") {
        try {
          frec.stop();
        } catch {
          /* ignore */
        }
      }
      stopRecorderTracks();
    };
  }, []);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  if (status === "loading") {
    return <GateLoading />;
  }

  if (status === "error" || !user) {
    return <GateError message={errorMessage} />;
  }

  const messages = activeSession?.messages ?? [];
  const prefLang = toProfile(user.profile).preferred_language || "";
  const showI18n = i18n && i18n.lang === prefLang && i18n.slot === suggestionSlot ? i18n : null;

  return (
    <div className="flex h-svh overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <div
        className={cn(
          "shrink-0 transition-[width] duration-200",
          sidebarOpen ? "w-[272px]" : "w-0",
        )}
      >
        <aside
          className={cn(
            "flex h-full flex-col overflow-hidden border-r border-border bg-card transition-transform duration-200",
            sidebarOpen ? "w-[272px] translate-x-0" : "w-0 -translate-x-full",
          )}
        >
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2.5">
              {user.institution_logo ? (
                <span className="grid size-8 place-items-center rounded-md bg-white">
                  <img
                    src={user.institution_logo}
                    alt={userInstitution(user) || "Institution"}
                    className="size-7 object-contain"
                  />
                </span>
              ) : (
                <span className="grid size-8 place-items-center rounded-md bg-foreground text-background">
                  <Bot className="size-4" />
                </span>
              )}
              <span>
                <p className="truncate text-sm font-semibold leading-tight">
                  {userInstitution(user) || "TalentBro"}
                </p>
                <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                  Student Dashboard
                </p>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {sidebarOpen ? (
                <ChevronsLeft className="size-4" />
              ) : (
                <ChevronsRight className="size-4" />
              )}
            </button>
          </div>

          <div className="px-3 pt-1">
            <nav className="space-y-0.5">
              <button
                type="button"
                onClick={() => void navigate({ to: "/mock-interview" })}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <BriefcaseBusiness className="size-4 shrink-0" />
                Mock Interview
              </button>
              <button
                type="button"
                onClick={() => void navigate({ to: "/tutorials" })}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <GraduationCap className="size-4 shrink-0" />
                Tutorials
              </button>
              <button
                type="button"
                onClick={() => void navigate({ to: "/self-training" })}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Dumbbell className="size-4 shrink-0" />
                Self Training
              </button>
              <button
                type="button"
                onClick={() => void navigate({ to: "/resume-builder" })}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <FileText className="size-4 shrink-0" />
                Resume
              </button>
              <button
                type="button"
                onClick={() => void openRoadmap()}
                disabled={roadmapChecking}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-70"
              >
                {roadmapChecking ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                ) : (
                  <Map className="size-4 shrink-0" />
                )}
                Roadmap
              </button>
            </nav>
          </div>

          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={startNewChat}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-transparent py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Plus className="size-4" /> New chat
            </button>
          </div>

          <div className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-3 pb-2 no-scrollbar">
            <p className="px-1.5 pb-1.5 pt-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              Chats
            </p>
            {sessions.length === 0 ? (
              <p className="px-1.5 text-xs text-muted-foreground">
                No chats yet — start a new conversation above.
              </p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 transition-colors",
                    s.id === activeId ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectSession(s.id)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-sm"
                  >
                    <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-[13px]">{s.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSession(s.id)}
                    aria-label={`Delete chat ${s.title}`}
                    className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-center gap-1 rounded-md transition-colors hover:bg-muted active:bg-muted">
              <button
                type="button"
                onClick={() => void navigate({ to: "/candidate-profile" })}
                aria-label="Open profile"
                title="Open profile"
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md p-1.5 text-left"
              >
                <Avatar className="size-8 rounded-md">
                  {user.avatar ? (
                    <AvatarImage src={user.avatar} alt={user.name || "Profile"} />
                  ) : null}
                  <AvatarFallback className="rounded-md bg-primary font-display text-xs font-bold text-primary-foreground">
                    {(user.name || user.email).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user.name || user.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </button>
              <LogoutConfirmDialog>
                <button
                  type="button"
                  aria-label="Sign out"
                  title="Sign out"
                  className="mr-1 shrink-0 cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <LogOut className="size-4" />
                </button>
              </LogoutConfirmDialog>
            </div>
          </div>
        </aside>
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AppNavHeader
          current="chat"
          unread={notifUnread}
          left={
            !sidebarOpen ? (
              <AppNavIconButton
                label="Open sidebar"
                onClick={() => setSidebarOpen(true)}
                className=""
              >
                <ChevronsRight className="size-5" />
              </AppNavIconButton>
            ) : undefined
          }
          center={
            <button
              type="button"
              onClick={() => void navigate({ to: "/leaderboard" })}
              title={
                ranks.score != null
                  ? `All Institute Rank #${ranks.overall ?? "—"} of ${ranks.total} · Readiness ${ranks.score.toFixed(1)}/100`
                  : "All Institute Rank within your college"
              }
              aria-label="Open college readiness leaderboard"
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent active:scale-[0.98]"
              style={{ pointerEvents: "auto" }}
            >
              <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-muted-foreground">
                AIR
              </span>
              <span className="font-mono text-sm font-bold tabular-nums tracking-tight text-foreground">
                {ranks.overall != null ? `#${ranks.overall}` : "—"}
              </span>
              {ranks.total != null && ranks.overall != null && (
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  / {ranks.total}
                </span>
              )}
              {ranks.score != null && (
                <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {ranks.score.toFixed(1)}
                </span>
              )}
            </button>
          }
        />

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={cn(
            "flex-1",
            messages.length === 0 ? "flex flex-col overflow-hidden" : "overflow-y-auto",
          )}
        >
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
            {loadingSession ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading transcript…</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Hi {user.name?.split(" ")[0] || "there"}, {showI18n?.copy[0] || NEW_CHAT_READY}
                </h1>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {showI18n?.copy[1] || NEW_CHAT_DESC}
                </p>
                <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
                  {(showI18n?.suggestions.length
                    ? showI18n.suggestions
                    : buildSuggestions(user?.profile, suggestionSlot)
                  ).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void sendMessage(suggestion)}
                      disabled={sending}
                      className="cursor-pointer rounded-lg border border-border bg-card px-4 py-3 text-left text-[13px] transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {activeSession && activeSession.olderAvailable && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => void loadOlder(activeSession.id)}
                      disabled={!!activeSession.loadingOlder}
                      className={cn(
                        "cursor-pointer rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        activeSession.loadingOlder &&
                          "cursor-wait opacity-70 hover:bg-card hover:text-muted-foreground",
                      )}
                    >
                      {activeSession.loadingOlder ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Loader2 className="size-3 animate-spin" /> Loading earlier…
                        </span>
                      ) : (
                        "Load earlier messages"
                      )}
                    </button>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "flex w-full min-w-0 flex-col",
                        m.role === "user" ? "items-end" : "items-start",
                      )}
                    >
                      <div
                        className={cn(
                          "w-fit max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%]",
                          m.role === "user"
                            ? "rounded-br-md bg-foreground text-background"
                            : "rounded-bl-md bg-card text-foreground",
                        )}
                      >
                        {m.role === "assistant" ? (
                          <div>
                            <Typewriter
                              text={m.translation || m.content}
                              active={animating && i === messages.length - 1}
                              onTick={scrollToBottom}
                              onDone={() => setAnimating(false)}
                            />
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          copyMessage(
                            m.role === "assistant" ? m.translation || m.content : m.content,
                            i,
                          )
                        }
                        aria-label={`Copy ${m.role === "user" ? "prompt" : "response"}`}
                        title="Copy"
                        className={cn(
                          "mt-1 flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100",
                          copiedIndex === i && "opacity-100",
                        )}
                        onMouseEnter={(e) => {
                          if (copiedIndex !== i) e.currentTarget.classList.add("opacity-100");
                        }}
                        onMouseLeave={(e) => {
                          if (copiedIndex !== i) e.currentTarget.classList.remove("opacity-100");
                        }}
                      >
                        {copiedIndex === i ? (
                          <>
                            <Check className="size-3" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className="flex gap-3">
                    <div className="rounded-2xl rounded-bl-md bg-card px-4 py-2.5">
                      <span
                        className="inline-block w-1 animate-pulse bg-muted-foreground align-baseline"
                        style={{ height: "1em" }}
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-md border border-red-500/40 bg-red-500/5 px-4 py-3 text-xs text-red-500">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border">
          <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:ring-2 focus-within:ring-ring/25">
              <textarea
                ref={inputRef}
                value={input}
                rows={1}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={showI18n?.copy[2] || NEW_CHAT_PLACEHOLDER}
                className="max-h-[180px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => {
                  if (transcribing) return;
                  if (recording) {
                    stopMicRecording();
                  } else {
                    void startMicRecording().catch((err) =>
                      setError(
                        err instanceof Error ? err.message : "Couldn't access the microphone.",
                      ),
                    );
                  }
                }}
                disabled={!micReady || transcribing}
                aria-label={
                  recording ? "Stop recording" : transcribing ? "Transcribing" : "Record voice"
                }
                className={cn(
                  "grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-border text-foreground transition-colors hover:bg-muted",
                  recording && "border-red-500/40 bg-red-500/10 text-red-500",
                  !micReady && "cursor-not-allowed opacity-40",
                )}
              >
                {transcribing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : recording ? (
                  <Square className="size-3.5 fill-current" />
                ) : (
                  <Mic className="size-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!input.trim() || sending}
                aria-label="Send message"
                className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-foreground text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="size-4" />
              </button>
            </div>
            <p className="mt-1.5 text-center font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              Chats accessible by placement cell. Impacts your profile. Be genuine.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
