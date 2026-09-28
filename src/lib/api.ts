import { setCollegeName } from "@/lib/branding";

const API_BASE = ((import.meta.env["VITE_API_URL"] as string | undefined) ?? "").replace(
  /\/+$/,
  "",
);

// Every account has exactly one Role: Student (candidate) or Institution Staff.
// Note: candidates and students are the same in this project.
export type UserType = "student" | "institution_staff";

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  avatar?: string;
  institution: string | null;
  institution_logo?: string;
  role: UserType;
  profile_complete?: boolean;
  missing_fields?: string[];
  profile?: unknown;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1] ?? "") : null;
}

// A stalled request used to leave the white "Loading…" screen up forever. Every
// fetch now aborts after a while and surfaces a retryable error instead.
const DEFAULT_TIMEOUT_MS = 20_000;
// LLM-backed endpoints can legitimately take well over the default timeout.
const LONG_TIMEOUT_MS = 90_000;

export type ApiFetchOptions = RequestInit & { timeoutMs?: number };

async function apiFetch<T>(path: string, init?: ApiFetchOptions): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    const csrfToken = readCookie("csrftoken");
    if (csrfToken) {
      headers.set("X-CSRFToken", csrfToken);
    }
  }

  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { timeoutMs: _omitted, ...requestInit } = init ?? {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = requestInit.signal
    ? AbortSignal.any([requestInit.signal, controller.signal])
    : controller.signal;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...requestInit,
      headers,
      credentials: "include",
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError" && !requestInit.signal?.aborted) {
      throw new ApiError(0, "The server took too long to respond. Please try again.");
    }
    throw new ApiError(0, "Could not reach the server. Is the backend running?");
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let payload: Record<string, unknown> = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // non-JSON response body
    }
  }

  if (!res.ok) {
    const detail =
      typeof payload["detail"] === "string" ? payload["detail"] : `Request failed (${res.status}).`;
    throw new ApiError(res.status, detail);
  }

  return payload as T;
}

async function ensureCsrfCookie(): Promise<void> {
  await apiFetch<{ ok: boolean }>("/api/auth/csrf/");
}

export async function signup(body: {
  institutionName: string;
  fullName: string;
  email: string;
  password: string;
  userType: UserType;
}): Promise<AuthUser> {
  await ensureCsrfCookie();
  const data = await apiFetch<{ user: AuthUser }>("/api/auth/signup/", {
    method: "POST",
    body: JSON.stringify(body),
  });
  setCollegeName(data.user.institution);
  return data.user;
}

export async function login(body: {
  email: string;
  password: string;
  userType: UserType;
}): Promise<AuthUser> {
  await ensureCsrfCookie();
  const data = await apiFetch<{ user: AuthUser }>("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify(body),
  });
  setCollegeName(data.user.institution);
  return data.user;
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await ensureCsrfCookie();
  await apiFetch<{ ok: boolean }>("/api/auth/change-password/", {
    method: "POST",
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  });
}

export async function logout(): Promise<void> {
  await ensureCsrfCookie();
  await apiFetch<{ ok: boolean }>("/api/auth/logout/", { method: "POST" });
  setCollegeName(null);
}

export async function deleteAccount(password?: string): Promise<void> {
  await ensureCsrfCookie();
  await apiFetch<{ ok: boolean }>("/api/auth/delete-account/", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  setCollegeName(null);
}

export async function me(): Promise<AuthUser | null> {
  try {
    const data = await apiFetch<{ user: AuthUser | null }>("/api/auth/me/");
    if (!data.user) {
      setCollegeName(null);
      return null;
    }
    setCollegeName(data.user.institution);
    return data.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      setCollegeName(null);
      return null;
    }
    throw error;
  }
}

// The signed-in student's own candidate profile id, or null for a non-candidate
// (institution staff) or an account whose profile row is still missing.
// Screens that are scoped to "my profile" resolve their ids from here so the
// URL never has to carry the viewer's own id around.
export function ownCandidateId(user: AuthUser | null | undefined): string | null {
  if (!user) return null;
  const profile = user.profile as { candidate_id?: string } | null | undefined;
  return profile?.candidate_id ?? null;
}

export type GdPanelist = { name: string; gender: "female" | "male" };

// The 6 AI members (3 Indian women + 3 Indian men) picked by Gemini 2.5 Flash
// Lite for a GD round; the student joins as the 7th member on the client.
export async function gdPanelists(): Promise<GdPanelist[]> {
  const data = await apiFetch<{ panelists: GdPanelist[] }>("/api/gd/panelists/");
  return data.panelists ?? [];
}

export type GdChatMessage = { name: string; content: string };

// Ask Gemini 2.5 Flash Lite for ONE next GD message. The entire transcript is
// sent each time so the reply continues the discussion as it stands; the
// student's name lets panelists acknowledge their points by name.
export async function gdChat(body: {
  topic: string;
  speaker: string;
  student?: string;
  transcript?: { name: string; content: string }[];
}): Promise<GdChatMessage> {
  const data = await apiFetch<{ message: GdChatMessage }>("/api/gd/chat/", {
    method: "POST",
    body: JSON.stringify(body),
    timeoutMs: LONG_TIMEOUT_MS,
  });
  return data.message ?? { name: body.speaker, content: "" };
}

// A fresh GD topic for a new round. The backend skips topics the student has
// already discussed in saved rounds (cheap logical match, no model call) and
// only asks Gemini once the canned bank is exhausted.
export async function gdTopic(): Promise<string> {
  const data = await apiFetch<{ topic: string }>("/api/gd/topic/");
  return data.topic ?? "";
}

export type GdCompleteBody = {
  topic: string;
  participants: { name: string; gender: string; is_user: boolean }[];
  transcript: { name: string; content: string; from: string }[];
};

// Persist a finished GD round — even a near-empty one — so every topic a
// student trains on is recorded and repeats are avoided on the next round. The
// round is scored server-side from the transcript, and the saved round comes
// back so the client renders the real criteria instead of inventing its own.
export async function gdComplete(
  body: GdCompleteBody,
): Promise<{ id: string; session: GdTrainingRecord }> {
  const data = await apiFetch<{ id: string; session: GdTrainingRecord }>("/api/gd/complete/", {
    method: "POST",
    body: JSON.stringify(body),
    timeoutMs: LONG_TIMEOUT_MS,
  });
  return data;
}

// Fire-and-forget GD save that keeps working when the tab closes (pagehide /
// beforeunload), so a round abandoned mid-way is still persisted.
export function gdCompleteKeepalive(body: GdCompleteBody): void {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  const csrfToken = readCookie("csrftoken");
  if (csrfToken) headers.set("X-CSRFToken", csrfToken);
  try {
    void fetch(`${API_BASE}/api/gd/complete/`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers,
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    // The tab is going away; this is a final best-effort flush.
  }
}

export type GdTrainingRecord = {
  id: string;
  title: string;
  topic: string;
  status: "active" | "completed";
  phase: string;
  duration_minutes: number;
  ended_at: string | null;
  grade: string;
  overall_score: number;
  criteria: { label: string; score: number }[];
  strengths: string[];
  improvement_areas: string[];
  created_at: string;
  updated_at: string;
  message_count: number;
  participants?: { name: string; gender: string; is_user: boolean }[];
  overall_summary?: string;
  transcript?: {
    role: "user" | "assistant";
    speaker: string;
    content: string;
    created_at?: string | null;
  }[];
};

// Every GD round a student completes is saved on the backend; list them
// newest first for the history page.
export async function gdList(): Promise<GdTrainingRecord[]> {
  const data = await apiFetch<{ sessions: GdTrainingRecord[] }>("/api/gd/history/");
  return data.sessions ?? [];
}

// Full detail (roster, AI summary and transcript) for one saved GD round.
export async function gdDetail(id: string): Promise<GdTrainingRecord> {
  const data = await apiFetch<{ session: GdTrainingRecord }>(`/api/gd/${id}/`);
  return data.session;
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  translation?: string;
  id?: number;
};

export type ServerChatMessage = ChatMessage & {
  id: number;
  created_at: string;
};

export type ChatSessionSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
};

export type ChatSession = ChatSessionSummary & {
  messages: ServerChatMessage[];
  older_available?: boolean;
};

export type ChatResponse = {
  reply: string;
  session_id: string;
  title: string;
  translation?: string;
  preferred_language?: string;
};

export async function chat(
  message: string,
  sessionId?: string | null,
  title?: string | null,
): Promise<ChatResponse> {
  const body: Record<string, string> = { message };
  if (sessionId) body["session_id"] = sessionId;
  if (title) body["title"] = title;
  return apiFetch<ChatResponse>("/api/chat/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify(body),
  });
}

export async function communicationTrainingChat(
  message: string,
  sessionId?: string | null,
): Promise<ChatResponse> {
  const body: Record<string, string> = { message };
  if (sessionId) body["session_id"] = sessionId;
  if (!sessionId) body["title"] = "Communication Training";
  return apiFetch<ChatResponse>("/api/chat/communication/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify(body),
  });
}

export type CommunicationTrainingTurns = {
  role: "user" | "assistant";
  content: string;
};

export type CommunicationTrainingTurnsResponse = {
  session_id: string;
  title: string;
};

export async function communicationTrainingAppendTurns(
  sessionId: string | null,
  turns: CommunicationTrainingTurns[],
): Promise<CommunicationTrainingTurnsResponse> {
  const body: Record<string, unknown> = { turns };
  if (sessionId) body["session_id"] = sessionId;
  else body["title"] = "Communication Training";
  return apiFetch<CommunicationTrainingTurnsResponse>("/api/chat/communication/turns/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify(body),
  });
}

export async function communicationTrainingFinalize(sessionId: string): Promise<{
  ok: boolean;
  session_id: string;
  analyzed: boolean;
}> {
  return apiFetch("/api/chat/communication/finalize/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({ session_id: sessionId }),
  });
}

// Fire-and-forget finalize that keeps working when the tab is closed, so a
// sudden browser close still tells the backend to lock the transcript and run
// the Gemini 2.5 Flash Lite analysis. Used from pagehide/beforeunload where a
// normal fetch may be cancelled.
export function finalizeCommunicationTrainingKeepalive(sessionId: string): void {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  const csrfToken = readCookie("csrftoken");
  if (csrfToken) headers.set("X-CSRFToken", csrfToken);
  try {
    void fetch(`${API_BASE}/api/chat/communication/finalize/`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers,
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(() => {});
  } catch {
    // The tab is going away; this is a final best-effort flush.
  }
}

export type CommunicationTrainingSession = {
  id: string;
  title: string;
  status: "active" | "completed";
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
  clarity: number;
  fluency: number;
  grammar: number;
  vocabulary: number;
  pronunciation: number;
  confidence: number;
  answer_structure: number;
  relevance: number;
  speaking_rate: number;
  pause_frequency: number;
  average_pause_duration: number;
  filler_words: number;
  repeated_words: number;
  sentence_restarts: number;
  intonation: number;
  speech_rhythm: number;
  voice_modulation: number;
  listening_skills: number;
  response_quality: number;
  professional_tone: number;
  conversational_skills: number;
  vocabulary_diversity: number;
  grammar_error_count: number;
  pronunciation_accuracy: number;
  communication_score: number;
  workplace_communication_readiness: number;
  interview_readiness: number;
  improvement_rate: number;
  recurring_mistakes: string;
  strengths: string;
  areas_for_improvement: string;
  ai_recommendations: string;
  practice_priorities: string;
  transcript?: { role: "user" | "assistant"; content: string; created_at: string }[];
};

export async function communicationTrainingList(): Promise<CommunicationTrainingSession[]> {
  const payload = await apiFetch<{ sessions: CommunicationTrainingSession[] }>(
    "/api/chat/communication/history/",
  );
  return payload.sessions ?? [];
}

export async function communicationTrainingDetail(
  sessionId: string,
): Promise<CommunicationTrainingSession> {
  const payload = await apiFetch<{ session: CommunicationTrainingSession }>(
    `/api/chat/communication/${sessionId}/`,
  );
  return payload.session;
}

export type EnglishTrainingMistake = {
  turn_index: number;
  category: string;
  original: string;
  corrected: string;
  explanation: string;
};

export type EnglishTrainingSession = {
  id: string;
  title: string;
  status: "active" | "completed";
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
  clarity: number;
  structure: number;
  grammar: number;
  vocabulary: number;
  spelling: number;
  conciseness: number;
  task_focus: number;
  professional_tone: number;
  writing_score: number;
  strengths: string;
  areas_for_improvement: string;
  ai_recommendations: string;
  recurring_mistakes: string;
  mistakes: EnglishTrainingMistake[];
  mistake_count: number;
  transcript?: { role: "user" | "assistant"; content: string; created_at: string }[];
};

export async function englishTrainingList(): Promise<EnglishTrainingSession[]> {
  const payload = await apiFetch<{ sessions: EnglishTrainingSession[] }>(
    "/api/speaking-skills/history/",
  );
  return payload.sessions ?? [];
}

export async function englishTrainingSessionDetail(
  sessionId: string,
): Promise<EnglishTrainingSession> {
  const payload = await apiFetch<{ session: EnglishTrainingSession }>(
    `/api/speaking-skills/${sessionId}/`,
  );
  return payload.session;
}

export type EnglishTrainingRecord = {
  practice_count: number;
  last_practiced_at: string | null;
  created_at: string;
  updated_at: string;
  clarity: number;
  structure: number;
  grammar: number;
  vocabulary: number;
  spelling: number;
  conciseness: number;
  task_focus: number;
  professional_tone: number;
  writing_score: number;
  strengths: string;
  areas_for_improvement: string;
  ai_recommendations: string;
  recurring_mistakes: string;
  transcript?: { role: "user" | "assistant"; content: string; created_at: string }[];
};

export async function englishTrainingDetail(): Promise<EnglishTrainingRecord> {
  const payload = await apiFetch<{ record: EnglishTrainingRecord }>("/api/speaking-skills/");
  return payload.record;
}

export type EnglishTrainingStartResponse = {
  reply: string;
  reused: boolean;
  session_id: string;
  record: EnglishTrainingRecord;
};

export async function englishTrainingStart(): Promise<EnglishTrainingStartResponse> {
  await ensureCsrfCookie();
  return apiFetch<EnglishTrainingStartResponse>("/api/speaking-skills/start/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({}),
  });
}

export async function englishTrainingChat(message: string): Promise<ChatResponse> {
  return apiFetch<ChatResponse>("/api/speaking-skills/chat/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({ message }),
  });
}

export async function englishTrainingAppendTurns(
  turns: CommunicationTrainingTurns[],
): Promise<void> {
  await apiFetch<{ ok: boolean }>("/api/speaking-skills/turns/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({ turns }),
  });
}

export async function englishTrainingFinalize(): Promise<{
  ok: boolean;
  analyzed: boolean;
}> {
  return apiFetch<{ ok: boolean; analyzed: boolean }>("/api/speaking-skills/finalize/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({}),
  });
}

// Fire-and-forget finalize that keeps working when the tab is closed, so a
// sudden browser close still tells the backend to re-run Maya's speaking
// analysis over the single EnglishTraining record. Idempotent, so a retry on
// the next page load is harmless.
export function finalizeEnglishTrainingKeepalive(): void {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  const csrfToken = readCookie("csrftoken");
  if (csrfToken) headers.set("X-CSRFToken", csrfToken);
  try {
    void fetch(`${API_BASE}/api/speaking-skills/finalize/`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers,
      body: JSON.stringify({}),
    }).catch(() => {});
  } catch {
    // The tab is going away; this is a final best-effort flush.
  }
}

export type APLRCategory =
  | "quantitative"
  | "logical_reasoning"
  | "verbal"
  | "data_interpretation"
  | "puzzle"
  | "miscellaneous";

export type APLRTrainingStatus = "active" | "solved" | "gave_up";

export type APLRTrainingSession = {
  id: string;
  title: string;
  category: APLRCategory;
  category_label: string;
  question: string;
  answer: string;
  solution: string;
  status: APLRTrainingStatus;
  attempts: number;
  hints_used: number;
  points_awarded: number;
  star_rating: number;
  solved_at: string | null;
  created_at: string;
  updated_at: string;
  transcript?: {
    role: "user" | "assistant";
    content: string;
    created_at: string;
  }[];
};

export type APLRStartResponse = {
  session: APLRTrainingSession;
  message: string;
};

export type APLRChatResponse = {
  session_id: string;
  reply: string;
  solved: boolean;
  gave_up: boolean;
  closed: boolean;
  points_awarded: number;
  star_rating: number;
};

export async function aplrStart(body?: {
  category?: APLRCategory | "";
}): Promise<APLRStartResponse> {
  return apiFetch<APLRStartResponse>("/api/aplr/start/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({ category: body?.category ?? "" }),
  });
}

export async function aplrChat(sessionId: string, message: string): Promise<APLRChatResponse> {
  return apiFetch<APLRChatResponse>("/api/aplr/chat/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({ session_id: sessionId, message }),
  });
}

export async function aplrSkip(sessionId?: string): Promise<{
  ok: boolean;
  skipped: string | number;
  was_active?: boolean;
}> {
  return apiFetch("/api/aplr/skip/", {
    method: "POST",
    body: JSON.stringify(sessionId ? { session_id: sessionId } : {}),
  });
}

// Fire-and-forget skip that keeps working when the tab is closed, so leaving
// mid-question still marks the unanswered question as skipped/gave-up.
export function aplrSkipKeepalive(sessionId: string): void {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  const csrfToken = readCookie("csrftoken");
  if (csrfToken) headers.set("X-CSRFToken", csrfToken);
  try {
    void fetch(`${API_BASE}/api/aplr/skip/`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers,
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(() => {});
  } catch {
    // The tab is going away; this is a final best-effort flush.
  }
}

export async function aplrList(): Promise<APLRTrainingSession[]> {
  const data = await apiFetch<{ sessions: APLRTrainingSession[] }>("/api/aplr/history/");
  return data.sessions ?? [];
}

export async function aplrDetail(sessionId: string): Promise<APLRTrainingSession> {
  const data = await apiFetch<{ session: APLRTrainingSession }>(`/api/aplr/${sessionId}/`);
  return data.session;
}

export type TechnicalCategory =
  "basics" | "arrays_strings" | "searching_sorting" | "recursion" | "algorithms" | "debugging";

export type TechnicalTrainingStatus = "active" | "solved" | "gave_up";

export type TechnicalTrainingSession = {
  id: string;
  title: string;
  category: TechnicalCategory;
  category_label: string;
  question: string;
  answer: string;
  solution: string;
  status: TechnicalTrainingStatus;
  attempts: number;
  hints_used: number;
  points_awarded: number;
  star_rating: number;
  solved_at: string | null;
  created_at: string;
  updated_at: string;
  transcript?: {
    role: "user" | "assistant";
    content: string;
    created_at: string;
  }[];
};

export type TechnicalStartResponse = {
  session: TechnicalTrainingSession;
  message: string;
};

export type TechnicalChatResponse = {
  session_id: string;
  reply: string;
  solved: boolean;
  gave_up: boolean;
  closed: boolean;
  points_awarded: number;
  star_rating: number;
};

export async function technicalStart(body?: {
  category?: TechnicalCategory | "";
}): Promise<TechnicalStartResponse> {
  return apiFetch<TechnicalStartResponse>("/api/technical/start/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({ category: body?.category ?? "" }),
  });
}

export async function technicalChat(
  sessionId: string,
  message: string,
): Promise<TechnicalChatResponse> {
  return apiFetch<TechnicalChatResponse>("/api/technical/chat/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({ session_id: sessionId, message }),
  });
}

export async function technicalSkip(sessionId?: string): Promise<{
  ok: boolean;
  skipped: string | number;
  was_active?: boolean;
}> {
  return apiFetch("/api/technical/skip/", {
    method: "POST",
    body: JSON.stringify(sessionId ? { session_id: sessionId } : {}),
  });
}

// Fire-and-forget skip that keeps working when the tab is closed, so leaving
// mid-question still marks the unanswered question as skipped/gave-up.
export function technicalSkipKeepalive(sessionId: string): void {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  const csrfToken = readCookie("csrftoken");
  if (csrfToken) headers.set("X-CSRFToken", csrfToken);
  try {
    void fetch(`${API_BASE}/api/technical/skip/`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers,
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(() => {});
  } catch {
    // The tab is going away; this is a final best-effort flush.
  }
}

export async function technicalList(): Promise<TechnicalTrainingSession[]> {
  const data = await apiFetch<{ sessions: TechnicalTrainingSession[] }>("/api/technical/history/");
  return data.sessions ?? [];
}

export async function technicalDetail(sessionId: string): Promise<TechnicalTrainingSession> {
  const data = await apiFetch<{ session: TechnicalTrainingSession }>(
    `/api/technical/${sessionId}/`,
  );
  return data.session;
}

export type DSACategory =
  | "arrays_strings"
  | "linked_lists"
  | "stacks_queues"
  | "hash_maps"
  | "trees"
  | "graphs"
  | "searching_sorting"
  | "dynamic_programming";

export type DSATrainingStatus = "active" | "solved" | "gave_up";

export type DSATrainingSession = {
  id: string;
  title: string;
  category: DSACategory;
  category_label: string;
  question: string;
  answer: string;
  solution: string;
  status: DSATrainingStatus;
  attempts: number;
  hints_used: number;
  points_awarded: number;
  star_rating: number;
  solved_at: string | null;
  created_at: string;
  updated_at: string;
  transcript?: {
    role: "user" | "assistant";
    content: string;
    created_at: string;
  }[];
};

export type DSAStartResponse = {
  session: DSATrainingSession;
  message: string;
};

export type DSAChatResponse = {
  session_id: string;
  reply: string;
  solved: boolean;
  gave_up: boolean;
  closed: boolean;
  points_awarded: number;
  star_rating: number;
};

export async function dsaStart(body?: { category?: DSACategory | "" }): Promise<DSAStartResponse> {
  return apiFetch<DSAStartResponse>("/api/dsa/start/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({ category: body?.category ?? "" }),
  });
}

export async function dsaChat(sessionId: string, message: string): Promise<DSAChatResponse> {
  return apiFetch<DSAChatResponse>("/api/dsa/chat/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({ session_id: sessionId, message }),
  });
}

export async function dsaSkip(sessionId?: string): Promise<{
  ok: boolean;
  skipped: string | number;
  was_active?: boolean;
}> {
  return apiFetch("/api/dsa/skip/", {
    method: "POST",
    body: JSON.stringify(sessionId ? { session_id: sessionId } : {}),
  });
}

// Fire-and-forget skip that keeps working when the tab is closed, so leaving
// mid-question still marks the unanswered question as skipped/gave-up.
export function dsaSkipKeepalive(sessionId: string): void {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  const csrfToken = readCookie("csrftoken");
  if (csrfToken) headers.set("X-CSRFToken", csrfToken);
  try {
    void fetch(`${API_BASE}/api/dsa/skip/`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers,
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(() => {});
  } catch {
    // The tab is going away; this is a final best-effort flush.
  }
}

export async function dsaList(): Promise<DSATrainingSession[]> {
  const data = await apiFetch<{ sessions: DSATrainingSession[] }>("/api/dsa/history/");
  return data.sessions ?? [];
}

export async function dsaDetail(sessionId: string): Promise<DSATrainingSession> {
  const data = await apiFetch<{ session: DSATrainingSession }>(`/api/dsa/${sessionId}/`);
  return data.session;
}

export type BasicMathCategory =
  | "addition_subtraction"
  | "multiplication_division"
  | "fractions_decimals"
  | "percentage"
  | "ratio_average"
  | "mental_math";

export type BasicMathTrainingStatus = "active" | "solved" | "gave_up";

export type BasicMathTrainingSession = {
  id: string;
  title: string;
  category: BasicMathCategory;
  category_label: string;
  question: string;
  answer: string;
  solution: string;
  status: BasicMathTrainingStatus;
  attempts: number;
  hints_used: number;
  points_awarded: number;
  star_rating: number;
  solved_at: string | null;
  created_at: string;
  updated_at: string;
  transcript?: {
    role: "user" | "assistant";
    content: string;
    created_at: string;
  }[];
};

export type BasicMathStartResponse = {
  session: BasicMathTrainingSession;
  message: string;
};

export type BasicMathChatResponse = {
  session_id: string;
  reply: string;
  solved: boolean;
  gave_up: boolean;
  closed: boolean;
  points_awarded: number;
  star_rating: number;
};

export async function basicMathStart(body?: {
  category?: BasicMathCategory | "";
}): Promise<BasicMathStartResponse> {
  return apiFetch<BasicMathStartResponse>("/api/basic-math/start/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({ category: body?.category ?? "" }),
  });
}

export async function basicMathChat(
  sessionId: string,
  message: string,
): Promise<BasicMathChatResponse> {
  return apiFetch<BasicMathChatResponse>("/api/basic-math/chat/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({ session_id: sessionId, message }),
  });
}

export async function basicMathSkip(sessionId?: string): Promise<{
  ok: boolean;
  skipped: string | number;
  was_active?: boolean;
}> {
  return apiFetch("/api/basic-math/skip/", {
    method: "POST",
    body: JSON.stringify(sessionId ? { session_id: sessionId } : {}),
  });
}

// Fire-and-forget skip that keeps working when the tab is closed, so leaving
// mid-question still marks the unanswered question as skipped/gave-up.
export function basicMathSkipKeepalive(sessionId: string): void {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  const csrfToken = readCookie("csrftoken");
  if (csrfToken) headers.set("X-CSRFToken", csrfToken);
  try {
    void fetch(`${API_BASE}/api/basic-math/skip/`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers,
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(() => {});
  } catch {
    // The tab is going away; this is a final best-effort flush.
  }
}

export async function basicMathList(): Promise<BasicMathTrainingSession[]> {
  const data = await apiFetch<{ sessions: BasicMathTrainingSession[] }>("/api/basic-math/history/");
  return data.sessions ?? [];
}

export async function basicMathDetail(sessionId: string): Promise<BasicMathTrainingSession> {
  const data = await apiFetch<{ session: BasicMathTrainingSession }>(
    `/api/basic-math/${sessionId}/`,
  );
  return data.session;
}

// ── Situational Problem Solving Skills (Management) ──────────────────────

export type SituationalCategory =
  | "workplace_conflict"
  | "leadership_dilemma"
  | "team_management"
  | "decision_making"
  | "ethical_dilemma"
  | "crisis_management";

export type SituationalTrainingStatus = "active" | "solved" | "gave_up";

export type SituationalTrainingSession = {
  id: string;
  title: string;
  category: SituationalCategory;
  category_label: string;
  question: string;
  answer: string;
  solution: string;
  status: SituationalTrainingStatus;
  attempts: number;
  hints_used: number;
  points_awarded: number;
  star_rating: number;
  solved_at: string | null;
  created_at: string;
  updated_at: string;
  transcript?: {
    role: "user" | "assistant";
    content: string;
    created_at: string;
  }[];
};

export type SituationalStartResponse = {
  session: SituationalTrainingSession;
  message: string;
};

export type SituationalChatResponse = {
  session_id: string;
  reply: string;
  solved: boolean;
  gave_up: boolean;
  closed: boolean;
  points_awarded: number;
  star_rating: number;
};

export async function situationalStart(body?: {
  category?: SituationalCategory | "";
}): Promise<SituationalStartResponse> {
  return apiFetch<SituationalStartResponse>("/api/situational/start/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({ category: body?.category ?? "" }),
  });
}

export async function situationalChat(
  sessionId: string,
  message: string,
): Promise<SituationalChatResponse> {
  return apiFetch<SituationalChatResponse>("/api/situational/chat/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({ session_id: sessionId, message }),
  });
}

export async function situationalSkip(sessionId?: string): Promise<{
  ok: boolean;
  skipped: string | number;
  was_active?: boolean;
}> {
  return apiFetch("/api/situational/skip/", {
    method: "POST",
    body: JSON.stringify(sessionId ? { session_id: sessionId } : {}),
  });
}

// Fire-and-forget skip that keeps working when the tab is closed, so leaving
// mid-question still marks the unanswered question as skipped/gave-up.
export function situationalSkipKeepalive(sessionId: string): void {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  const csrfToken = readCookie("csrftoken");
  if (csrfToken) headers.set("X-CSRFToken", csrfToken);
  try {
    void fetch(`${API_BASE}/api/situational/skip/`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers,
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(() => {});
  } catch {
    // The tab is going away; this is a final best-effort flush.
  }
}

export async function situationalList(): Promise<SituationalTrainingSession[]> {
  const data = await apiFetch<{ sessions: SituationalTrainingSession[] }>(
    "/api/situational/history/",
  );
  return data.sessions ?? [];
}

export async function situationalDetail(sessionId: string): Promise<SituationalTrainingSession> {
  const data = await apiFetch<{ session: SituationalTrainingSession }>(
    `/api/situational/${sessionId}/`,
  );
  return data.session;
}

export async function transcribeAudio(audioBytes: ArrayBuffer, mime: string): Promise<string> {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Content-Type", mime);
  const csrfToken = readCookie("csrftoken");
  if (csrfToken) headers.set("X-CSRFToken", csrfToken);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/chat/communication/transcribe/`, {
      method: "POST",
      headers,
      credentials: "include",
      body: audioBytes,
    });
  } catch {
    throw new ApiError(0, "Could not reach the server. Is the backend running?");
  }

  const data: Record<string, unknown> = await res.json();
  if (!res.ok)
    throw new ApiError(res.status, (data["detail"] as string) || "Transcription failed.");
  return ((data["text"] as string) ?? "").trim();
}

export interface TtsVoice {
  key: string;
  voice: string;
}

export async function ttsVoices(): Promise<TtsVoice[]> {
  const data = await apiFetch<{ voices: TtsVoice[]; default: string }>("/api/chat/tts/voices/");
  return data.voices;
}

export async function ttsGenerate(text: string, voice?: string): Promise<string> {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  const csrfToken = readCookie("csrftoken");
  if (csrfToken) headers.set("X-CSRFToken", csrfToken);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/chat/tts/`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ text, voice: voice ?? "" }),
    });
  } catch {
    throw new ApiError(0, "Could not reach the server.");
  }
  if (res.status === 503) throw new ApiError(503, "TTS unavailable");
  if (!res.ok) {
    const data: Record<string, unknown> = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (data["detail"] as string) || "TTS failed.");
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export type TtsWordTiming = { offset: number; startMs: number };

// Per-speaker delivery offsets. Edge serves just one usable Indian male voice,
// so pitch/rate are what distinguish the male panelists from each other. The
// backend clamps both to a natural range and ignores anything invalid.
export type TtsVoiceStyle = { pitchHz?: number; ratePct?: number };

// Same synthesis as ttsGenerate, but asks the backend for the exact start time
// of every word (WordBoundary metadata returned in the X-Word-Times header).
// This lets realtime transcript highlights track the clip precisely instead of
// approximating progress linearly. wordTimes is empty when the backend can't
// provide timings; callers then keep their own fallback.
export async function ttsGenerateWithTimings(
  text: string,
  voice?: string,
  style?: TtsVoiceStyle,
): Promise<{ url: string; wordTimes: TtsWordTiming[] }> {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  const csrfToken = readCookie("csrftoken");
  if (csrfToken) headers.set("X-CSRFToken", csrfToken);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/chat/tts/`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({
        text,
        voice: voice ?? "",
        boundaries: true,
        pitch: style?.pitchHz ?? 0,
        rate: style?.ratePct ?? 0,
      }),
    });
  } catch {
    throw new ApiError(0, "Could not reach the server.");
  }
  if (res.status === 503) throw new ApiError(503, "TTS unavailable");
  if (!res.ok) {
    const data: Record<string, unknown> = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (data["detail"] as string) || "TTS failed.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const raw = res.headers.get("X-Word-Times");
  const wordTimes: TtsWordTiming[] = [];
  if (raw) {
    for (const part of raw.split(",")) {
      const sep = part.indexOf(":");
      if (sep <= 0) continue;
      const offset = Number(part.slice(0, sep));
      const startMs = Number(part.slice(sep + 1));
      if (Number.isFinite(offset) && Number.isFinite(startMs)) {
        wordTimes.push({ offset, startMs });
      }
    }
  }
  return { url, wordTimes };
}

export async function chatSessions(): Promise<ChatSessionSummary[]> {
  const data = await apiFetch<{ sessions: ChatSessionSummary[] }>("/api/chat/sessions/");
  return data.sessions;
}

export async function chatSessionDetail(id: string, before?: number | null): Promise<ChatSession> {
  const query = before ? `?before=${before}` : "";
  const data = await apiFetch<{ session: ChatSession }>(`/api/chat/sessions/${id}/${query}`);
  return data.session;
}

export async function deleteChatSession(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/chat/sessions/${id}/`, { method: "DELETE" });
}

export async function summarizeChatSession(
  sessionId?: string | null,
): Promise<{ summary: string | null; changed: string[] }> {
  const body: Record<string, string> = {};
  if (sessionId) body["session_id"] = sessionId;
  return apiFetch<{ summary: string | null; changed: string[] }>("/api/chat/summarize/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify(body),
  });
}

export type RoadmapSelfTrainingModule = {
  required: boolean;
  sessions_per_week?: number;
  focus_areas?: string[];
  notes?: string;
};

export type CandidateRoadmap = {
  id: string;
  source_session: string | null;
  status: string;
  timeline_target: string;
  target_date: string | null;
  company_target: string[];
  goal_statement: string;
  mocks_required: number;
  daily_practice_session_duration: number;
  self_training_required: Record<string, RoadmapSelfTrainingModule>;
  roadmap: Record<string, unknown>;
  summary: string;
  created_at: string;
  updated_at: string;
};

export async function getCandidateRoadmap(): Promise<CandidateRoadmap | null> {
  try {
    const data = await apiFetch<{ roadmap: CandidateRoadmap }>("/api/roadmap/");
    return data.roadmap ?? null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function translateTexts(texts: string[], targetLanguage?: string): Promise<string[]> {
  const body: Record<string, unknown> = { texts };
  if (targetLanguage) body["target_language"] = targetLanguage;
  const data = await apiFetch<{ translations: string[] }>("/api/chat/translate/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify(body),
  });
  return data.translations ?? [];
}

export type OnboardingResponse = {
  reply: string;
  profile_data: Record<string, unknown>;
  summary: string | null;
  complete: boolean;
};

export async function onboardChat(
  messages: ChatMessage[],
  profileData: Record<string, unknown>,
): Promise<OnboardingResponse> {
  return apiFetch<OnboardingResponse>("/api/chat/onboard/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({ messages, profile_data: profileData }),
  });
}

export async function completeOnboarding(
  profileData: Record<string, unknown>,
  messages?: ChatMessage[],
): Promise<CandidateProfilePayload> {
  return apiFetch<CandidateProfilePayload>("/api/chat/complete-onboarding/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({ profile_data: profileData, messages }),
  });
}

export type IdVerificationCheck = {
  matched: boolean;
  detail: string;
};

export type IdVerificationResult = {
  extracted: {
    name: string | null;
    registration_number: string | null;
    college: string | null;
  };
  checks: {
    name: IdVerificationCheck;
    registration_number: IdVerificationCheck;
    college?: IdVerificationCheck;
  };
  all_matched: boolean;
};

export async function verifyIdCard(body: {
  ocr_text: string;
  name: string;
  registration_number: string;
  college?: string;
}): Promise<IdVerificationResult> {
  return apiFetch<IdVerificationResult>("/api/auth/verify-id-card/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify(body),
  });
}

export type CandidateProfile = {
  candidate_id: string;
  phone: string;
  date_of_birth: string | null;
  gender: string;
  college: string;
  department: string;
  program: string;
  start_year: number | null;
  end_year: number | null;
  cgpa: number | null;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  /** The professional headline synced from LinkedIn; editable by the candidate. */
  bio: string;
  skills: string[];
  certifications: string[];
  projects: unknown[];
  internships: unknown[];
  preferred_roles: string[];
  preferred_locations: string[];
  preferred_language: string;
  expected_ctc: number | null;
  time_spent: number;
  personal_email: string;
  placement_status: string;
  placement_eligible: boolean;
  first_name: string;
  middle_name: string;
  last_name: string;
  full_name: string;
};

export type ProfileStats = {
  chat_sessions: number;
  chat_messages: number;
};

export type PerformanceModule = {
  key: string;
  label: string;
  score: number;
};

export type PerformanceComponents = {
  score: number;
  coverage: number;
  mock_interview: number | null;
  mock_interviews: number;
  self_training: number | null;
  chat: number | null;
  chat_messages: number;
  chat_sessions: number;
  modules: PerformanceModule[];
};

export type PillarRank = {
  score: number | null;
  rank: number | null;
  total: number;
  department_rank: number | null;
  department_total: number;
};

// Each pillar is ranked over its own cohort — mock-interview and self-training
// standings never move each other, and neither one is the composite score.
export type PillarRanks = {
  mock_interview: PillarRank | null;
  self_training: PillarRank | null;
};

export type ProfileRanks = {
  score: number | null;
  department: number | null;
  overall: number | null;
  total: number;
  department_total: number;
  pillars: PillarRanks;
};

export type CandidateProfilePayload = {
  user: {
    id: number;
    email: string;
    name: string;
    avatar?: string;
    first_name: string;
    date_joined: string;
    last_login: string | null;
  };
  profile: CandidateProfile | null;
  ranks: ProfileRanks;
  performance: PerformanceComponents | null;
  stats: ProfileStats;
  profile_complete: boolean;
  missing_fields: string[];
};

export async function getProfile(): Promise<CandidateProfilePayload> {
  return apiFetch<CandidateProfilePayload>("/api/auth/profile/");
}

export async function updateProfile(
  body: Record<string, unknown>,
): Promise<CandidateProfilePayload> {
  return apiFetch<CandidateProfilePayload>("/api/auth/profile/", {
    method: "PATCH",
    // Saving may trigger a slow LinkedIn-photo fetch on the server, so use the
    // long timeout reserved for LLM-backed endpoints.
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify(body),
  });
}

export type InstitutionMeta = {
  name: string;
  departments: string[];
};

export async function searchInstitutions(query: string): Promise<InstitutionMeta[]> {
  const data = await apiFetch<{ institutions: InstitutionMeta[] }>(
    `/api/institutions/?q=${encodeURIComponent(query)}`,
  );
  return data.institutions;
}

export async function institutionCompanies(): Promise<string[]> {
  const data = await apiFetch<{ companies: string[] }>("/api/institutions/companies/");
  return data.companies;
}

export async function candidateCompanies(): Promise<string[]> {
  const data = await apiFetch<{ companies: string[] }>("/api/candidate/companies/");
  return data.companies;
}

export type Institution = {
  name: string;
  institution_type: string;
  website: string;
  email_domain: string;
  address: string;
  city: string;
  state: string;
  pin_code: string;
  logo?: string;
  placement_department_name: string;
  placement_office_email: string;
  approximate_student_strength: number | null;
};

export type ClientProfile = {
  id: number;
  institution_name: string | null;
  full_name: string;
  official_email: string;
  avatar?: string;
  mobile_number: string;
  designation: string;
  employee_staff_id: string;
  access: "beta" | "master";
  has_master_access: boolean;
  institution?: Institution;
};

export async function clientOnboarding(body: Record<string, unknown>): Promise<AuthUser> {
  const data = await apiFetch<{ user: AuthUser }>("/api/auth/client-onboarding/", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.user;
}

export type MockInterviewStatus = "active" | "completed" | "not_scored";
export type MockInterviewDuration = "short" | "standard" | "long";
export type PanelistId = "atlas" | "maya" | "albert" | "peter" | "daniel" | "ada" | "carl";

export type MockInterview = {
  id: string;
  company_name: string;
  role: string;
  questions: string[];
  duration: MockInterviewDuration;
  panelists: PanelistId[];
  panelist_response: Record<PanelistId, string>;
  suspection: number;
  status: MockInterviewStatus;
  created_at: string;
  updated_at: string;
  message_count: number;
};

export type ServerMockMessage = ChatMessage & {
  panelist?: string;
  tone?: string;
  created_at: string;
};

export type MockInterviewDetail = MockInterview & {
  messages: ServerMockMessage[];
  analysis?: MockInterviewAnalysis | null;
};

export type MockInterviewAnalysisMetric = {
  dimension: string;
  description: string;
  percentage: number;
};

export type MockInterviewSwot = {
  strengths: string;
  weaknesses: string;
  opportunities: string;
  threats: string;
};

export type MockInterviewAnalysis = {
  id: string;
  company_name: string;
  role: string;
  created_at: string;
  // Moderated score for the interview, or null when the candidate never gave
  // enough real answers for one to exist. Never derive a score client-side.
  overall_score: number | null;
  scored_dimensions: number;
  total_dimensions: number;
  metrics: MockInterviewAnalysisMetric[];
  swot: MockInterviewSwot;
};

export type MockInterviewStartResponse = {
  interview: MockInterviewDetail;
  reply: string;
  panelist: string;
};

// One interview as the history rollup sees it. `analysis` is null whenever the
// interview was never scored, which is different from scoring zero.
export type MockInterviewStatsEntry = MockInterview & {
  user_turns: number;
  assistant_turns: number;
  user_words: number;
  // Midpoint of the exchange count this interview's length was briefed for, so
  // a short session is never judged against a long session's target.
  target_exchanges: number;
  analysis: {
    overall_score: number;
    scored_dimensions: number;
    total_dimensions: number;
    // Keyed by the rubric's display name, and only for dimensions the stored
    // analysis carries evidence for, so the client can group them into its own
    // categories without fetching each interview's full report.
    dimensions: Record<string, number>;
  } | null;
};

// The whole mock-interview record reduced to counts and means on the server.
// Nothing in here is generated: opening the history never calls the model, and
// every score it reports was written when the interview was finalised.
export type MockInterviewStats = {
  totals: {
    interviews: number;
    completed: number;
    not_scored: number;
    active: number;
    scored: number;
    violations: number;
    user_turns: number;
    assistant_turns: number;
    user_words: number;
    companies: number;
    roles: number;
  };
  tones: { positive: number; neutral: number; negative: number };
  // Newest first.
  interviews: MockInterviewStatsEntry[];
  by_company: {
    name: string;
    interviews: number;
    avg_user_turns: number;
    avg_score: number | null;
    scored: number;
  }[];
  by_role: {
    name: string;
    interviews: number;
    avg_user_turns: number;
    avg_score: number | null;
    scored: number;
  }[];
};

export async function startMockInterview(body: {
  company_name: string;
  role?: string;
  questions: string[];
  questionText?: string;
  duration?: MockInterviewDuration;
  panelists?: PanelistId[];
}): Promise<MockInterviewStartResponse> {
  return apiFetch<MockInterviewStartResponse>("/api/interview/start/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({
      company_name: body.company_name,
      role: body.role ?? "",
      questions: body.questionText
        ? body.questionText
            .split(/\n+/)
            .map((q) => q.trim())
            .filter(Boolean)
        : body.questions,
      duration: body.duration ?? "standard",
      panelists: body.panelists ?? [],
    }),
  });
}

export async function replyMockInterview(
  interviewId: string,
  answer: string,
): Promise<{
  reply: string;
  panelist: string;
  done: boolean;
  tone?: string;
  analysis?: MockInterviewAnalysis | null;
}> {
  return apiFetch<{
    reply: string;
    panelist: string;
    done: boolean;
    tone?: string;
    analysis?: MockInterviewAnalysis | null;
  }>("/api/interview/reply/", {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({ interview_id: interviewId, answer }),
  });
}

export async function resumeMockInterview(interviewId: string): Promise<{
  reply: string;
  panelist: string;
  done: boolean;
  tone?: string;
}> {
  return apiFetch<{
    reply: string;
    panelist: string;
    done: boolean;
    tone?: string;
  }>(`/api/interview/${interviewId}/resume/`, {
    method: "POST",
    timeoutMs: LONG_TIMEOUT_MS,
  });
}

export async function mockInterviews(): Promise<MockInterview[]> {
  const data = await apiFetch<{ interviews: MockInterview[] }>("/api/interview/");
  return data.interviews;
}

export async function mockInterviewDetail(id: string): Promise<MockInterviewDetail> {
  const data = await apiFetch<{ interview: MockInterviewDetail }>(`/api/interview/${id}/`);
  return data.interview;
}

export async function mockInterviewAnalysis(id: string): Promise<MockInterviewAnalysis | null> {
  const data = await apiFetch<{ analysis: MockInterviewAnalysis | null }>(
    `/api/interview/${id}/analysis/`,
  );
  return data.analysis;
}

export async function deleteMockInterview(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/interview/${id}/`, { method: "DELETE" });
}

export async function completeMockInterview(id: string): Promise<MockInterview> {
  const data = await apiFetch<{ interview: MockInterview }>(`/api/interview/${id}/`, {
    method: "PATCH",
    timeoutMs: LONG_TIMEOUT_MS,
    body: JSON.stringify({ status: "completed" }),
  });
  return data.interview;
}

// Fire-and-forget end that keeps working when the tab is closed, so a sudden
// browser close still tells the backend to lock the interview as completed and
// auto-fill the analysis / panelist feedback — exactly the same as ending it
// through the UI. The backend finalizer is idempotent, so a later retry is harmless.
export function completeMockInterviewKeepalive(id: string): void {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  const csrfToken = readCookie("csrftoken");
  if (csrfToken) headers.set("X-CSRFToken", csrfToken);
  try {
    void fetch(`${API_BASE}/api/interview/${id}/`, {
      method: "PATCH",
      credentials: "include",
      keepalive: true,
      headers,
      body: JSON.stringify({ status: "completed" }),
    }).catch(() => {});
  } catch {
    // The tab is going away; this is a final best-effort flush.
  }
}

export async function recordViolation(id: string): Promise<MockInterview> {
  const data = await apiFetch<{ interview: MockInterview }>(`/api/interview/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ suspection: true }),
  });
  return data.interview;
}

/**
 * One request for everything the interview history screen shows. The server
 * reduces the candidate's whole record to counts and means, so this stays a
 * single cheap read instead of fanning out one analysis call per interview.
 *
 * Deliberately a plain GET against `/api/interview/stats/` and NOT a loop over
 * `mockInterviewAnalysis()`: that endpoint generates an analysis on read when
 * one is missing, which would spend model time and invent numbers the
 * candidate never earned. This one only ever reads what is already stored.
 */
export async function mockInterviewStats(): Promise<MockInterviewStats> {
  const data = await apiFetch<{
    totals: MockInterviewStats["totals"];
    tones: MockInterviewStats["tones"];
    interviews: MockInterviewStatsEntry[];
    by_company: MockInterviewStats["by_company"];
    by_role: MockInterviewStats["by_role"];
  }>("/api/interview/stats/");
  return {
    totals: data.totals,
    tones: data.tones,
    interviews: data.interviews,
    by_company: data.by_company,
    by_role: data.by_role,
  };
}

export type NotificationSender = "Placement Cell" | "TalentBro Platform";

export type NotificationItem = {
  id: string;
  sender: NotificationSender;
  title: string;
  body: string;
  pinned: boolean;
  important: boolean;
  read: boolean;
  time: string;
  created_at: string;
  redirect_path: string;
};

export async function getNotifications(): Promise<{
  notifications: NotificationItem[];
  unread: number;
}> {
  return apiFetch<{ notifications: NotificationItem[]; unread: number }>("/api/notifications/");
}

export async function markNotificationsRead(notificationId?: string, all = false): Promise<void> {
  const body = all ? { all: true } : { notification_id: notificationId };
  await apiFetch<{ ok: boolean }>("/api/notifications/mark-read/", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// A broadcast authored by institution staff. The backend fans it out to the
// signed-in staff member's own feed; students receive it as a placement-cell
// notification.
export type BroadcastDraft = {
  title: string;
  body: string;
  pinned?: boolean;
  important?: boolean;
};

export async function createNotification(draft: BroadcastDraft): Promise<NotificationItem> {
  const data = await apiFetch<{ notification: NotificationItem }>("/api/notifications/", {
    method: "POST",
    body: JSON.stringify(draft),
  });
  return data.notification;
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await apiFetch(`/api/notifications/${encodeURIComponent(notificationId)}/`, { method: "DELETE" });
}

export type DriveCompanyTier = "super_dream" | "dream" | "core" | "mass";

export type PlacementCompany = {
  id: number;
  company_id: string;
  company_name: string;
  industry: string;
  company_description: string;
  job_roles: string[];
  eligible_courses: string[];
  eligible_branches: string[];
  minimum_cgpa: number | null;
  maximum_backlogs: number | null;
  graduation_year: number | null;
  required_skills: string[];
  preferred_skills: string[];
  salary_min: number | null;
  salary_max: number | null;
  work_location: string;
  work_mode: string;
  // Sum of the vacancies across the company's Drive rows. Zero when the
  // company has no drives yet.
  openings: number | null;
  drive_count: number | null;
  selection_rounds: string[];
  application_deadline: string | null;
  campus_visit_date: string | null;
  recruitment_status: string;
  placement_mode: string;
  offer_status: string;
  tier: DriveCompanyTier;
  institution: string | null;
  created_at: string;
  updated_at: string;
};

export async function getCompanies(): Promise<{ companies: PlacementCompany[]; count: number }> {
  return apiFetch<{ companies: PlacementCompany[]; count: number }>("/api/companies/");
}

// Every field the placement cell can record for a campus partner. The backend
// stores blanks as null, so an omitted key and an explicit null are equivalent —
// never send an empty string for a numeric/date field.
export type CompanyCreatePayload = {
  company_name: string;
  company_id?: string;
  industry?: string;
  company_description?: string;
  work_location?: string;
  work_mode?: string;
  placement_mode?: string;
  tier?: DriveCompanyTier;
  salary_min?: number | null;
  salary_max?: number | null;
  job_roles?: string[];
  eligible_courses?: string[];
  eligible_branches?: string[];
  required_skills?: string[];
  preferred_skills?: string[];
  selection_rounds?: string[];
  minimum_cgpa?: number | null;
  maximum_backlogs?: number | null;
  graduation_year?: number | null;
  recruitment_status?: string;
  offer_status?: string;
};

export async function createCompany(payload: CompanyCreatePayload): Promise<PlacementCompany> {
  const data = await apiFetch<{ company: PlacementCompany }>("/api/companies/create/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.company;
}

// ── Institution dashboards (staff side) ───────────────────────────────────

export type DashboardInstitution = {
  name: string;
  institution_type: string;
  website: string;
  email_domain: string;
  address: string;
  city: string;
  state: string;
  pin_code: string;
  logo?: string;
  placement_department_name: string;
  placement_office_email: string;
  approximate_student_strength: number | null;
  courses_offered: string[];
  departments: string[];
};

export type DashboardClient = {
  full_name: string;
  official_email: string;
  mobile_number: string;
  designation: string;
  employee_staff_id: string;
  access: "beta" | "master";
  is_master: boolean;
};

export type OverviewKpis = {
  total_students: number;
  eligible_students: number;
  placed: number;
  in_selection: number;
  applied: number;
  avg_cgpa: number | null;
  highest_cgpa: number | null;
  avg_expected_ctc: number | null;
  recruiters: number;
  active_drives: number;
  total_openings: number;
  super_dream: number;
  verified: number;
  unverified: number;
};

export type FunnelStage = { stage: string; value: number };
export type MonthlyPoint = { month: string; students: number };

export type DepartmentStat = {
  department: string;
  short: string;
  total: number;
  eligible: number;
  placed: number;
  rate: number;
  avg_cgpa: number;
  avg_expected_ctc: number;
};

export type InstitutionOverview = {
  institution: DashboardInstitution;
  client: DashboardClient | null;
  kpis: OverviewKpis;
  funnel: FunnelStage[];
  monthly: MonthlyPoint[];
  departments: DepartmentStat[];
  tiers: { tier: DriveCompanyTier; label: string; count: number }[];
  batch: { year: number; students: number };
};

export async function getInstitutionOverview(): Promise<InstitutionOverview> {
  return apiFetch<InstitutionOverview>("/api/institution/overview/");
}

export type PlacementStatus = "not_started" | "applying" | "shortlisted" | "placed";

export type StudentRecord = {
  id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  full_name: string;
  department: string | null;
  program: string | null;
  start_year: number | null;
  end_year: number | null;
  mobile_number: string;
  gender: string;
  cgpa: number | null;
  placement_status: PlacementStatus;
  // Already resolved server-side: the staff override when set, otherwise the
  // readiness rule (score >= 40). Never the raw column.
  placement_eligible: boolean;
  // The untouched override, so the UI can show whether a human pinned it.
  // null means "follows the readiness score".
  placement_eligible_override: boolean | null;
  skills: string[];
  preferred_roles: string[];
  preferred_locations: string[];
  preferred_language: string;
  expected_ctc: number | null;
  id_verified: boolean;
  account_status: string;
  created_at: string;
  performance_score: number | null;
  performance: PerformanceComponents | null;
  overall_rank: number | null;
  department_rank: number | null;
  overall_total: number;
  department_total: number;
  // Independent mock-interview and self-training standings, each ranked over
  // its own cohort.
  pillars: PillarRanks;
};

export type StudentsResponse = {
  students: StudentRecord[];
  // Rows matching the active filters, versus every candidate profile the
  // college has, so the UI can show the real student count alongside the view.
  count: number;
  total: number;
  // The institution's approximate student strength, which can exceed the number
  // of candidate profiles actually in the database.
  approximate_student_strength: number | null;
};

export type StudentsQuery = {
  q?: string;
  dept?: string;
  status?: string;
  min_cgpa?: number;
  eligible?: boolean;
  sort?: "name" | "cgpa" | "expected_ctc" | "performance";
};

export async function getStudents(query: StudentsQuery = {}): Promise<StudentsResponse> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.dept && query.dept !== "All") params.set("dept", query.dept);
  if (query.status && query.status !== "All") params.set("status", query.status);
  if (query.min_cgpa && query.min_cgpa > 0) params.set("min_cgpa", String(query.min_cgpa));
  if (query.eligible) params.set("eligible", "1");
  if (query.sort) params.set("sort", query.sort);
  const qs = params.toString();
  return apiFetch<StudentsResponse>(`/api/students/${qs ? `?${qs}` : ""}`);
}

export type LeaderboardStudent = StudentRecord & { is_self: boolean };

export type LeaderboardResponse = {
  institution: string;
  total: number;
  ranked: number;
  students: LeaderboardStudent[];
};

export async function getReadinessLeaderboard(): Promise<LeaderboardResponse> {
  return apiFetch<LeaderboardResponse>("/api/readiness/leaderboard/");
}

export type StudentMessage = {
  id: string;
  content: string;
  created_at: string;
  from_user_id: number;
  to_user_id: number;
  from_name: string;
  is_mine: boolean;
};

export type StudentMessagePeer = {
  id: string;
  full_name: string;
  department: string;
  program: string;
  start_year: number | null;
  end_year: number | null;
};

export type StudentMessagesResponse = {
  // candidate_id of the signed-in viewer — the screen is always backed by it.
  viewer_candidate_id: string | null;
  // candidate_id of the peer being viewed; equals viewer_candidate_id on self.
  student_id: string;
  is_self: boolean;
  peer: StudentMessagePeer;
  messages: StudentMessage[];
};

export async function studentMessages(studentId: string): Promise<StudentMessagesResponse> {
  return apiFetch<StudentMessagesResponse>(`/api/students/${studentId}/messages/`);
}

export async function sendStudentMessage(
  studentId: string,
  content: string,
): Promise<StudentMessage> {
  const data = await apiFetch<{ message: StudentMessage }>(`/api/students/${studentId}/messages/`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  return data.message;
}

export type DriveStatus = "Live" | "Upcoming" | "Completed" | "Cancelled";

export type PlacementDrive = {
  company_id: string;
  company_name: string;
  industry: string;
  roles: string[];
  ctc_min: number | null;
  ctc_max: number | null;
  tier: DriveCompanyTier;
  mode: string;
  location: string;
  application_deadline: string | null;
  campus_visit_date: string | null;
  status: DriveStatus;
  openings: number | null;
  eligible_courses: string[];
  eligible_branches: string[];
  minimum_cgpa: number | null;
  maximum_backlogs: number | null;
  required_skills: string[];
  selection_rounds: string[];
  placement_mode: string;
  offer_status: string;
  eligible_count: number;
};

export type DrivesData = {
  drives: PlacementDrive[];
  // How many company rows back the listing.
  count: number;
  // How many Drive records the signed-in staff's college has on file.
  drive_count: number;
};

export async function getDrives(): Promise<DrivesData> {
  return apiFetch<DrivesData>("/api/drives/");
}

export type TotalVacancies = {
  total_vacancies: number;
  drive_count: number;
  institution: string | null;
};

// Total vacancies across every drive of the signed-in staff's college.
// Pass a status ("upcoming" | "ongoing" | "completed" | "cancelled") to
// narrow it to that one status.
export async function getTotalVacancies(status?: string): Promise<TotalVacancies> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<TotalVacancies>(`/api/drives/total-vacancies/${query}`);
}

export type ReportsData = {
  kpis: {
    students: number;
    eligible: number;
    placed: number;
    rate: number;
    avg_expected_ctc: number | null;
    recruiters: number;
    openings: number;
  };
  monthly: MonthlyPoint[];
  depts: DepartmentStat[];
  industries: { industry: string; count: number }[];
  ctc_bands: { band: string; companies: number }[];
  tiers: { tier: DriveCompanyTier; label: string; count: number }[];
  batch: { year: number; students: number; verified: number; unverified: number };
};

export async function getReportsData(): Promise<ReportsData> {
  return apiFetch<ReportsData>("/api/reports/");
}

// ── Coursera courses (candidate /courses screen) ─────────────────────────────
// Scraped server-side from Coursera's public search page. The backend answers
// with the default "data science" search when `query` is omitted.

export type CourseraCourse = {
  id: string;
  title: string;
  description: string;
  image: string;
  course_url: string;
  tagline: string;
  partners: string[];
  partner_logos: string[];
  rating: number | null;
  rating_count: number | null;
  review_count: number | null;
  level: string;
  level_label: string;
  duration: string;
  duration_label: string;
  product_type: string;
  type_label: string;
  skills: string[];
  tools: string[];
  languages: string[];
  subtitle_languages: string[];
  is_free: boolean;
  is_credit_eligible: boolean;
  is_new: boolean;
  in_coursera_plus: boolean;
  badges: string[];
};

export type CourseraFacetValue = {
  value: string;
  count: number | null;
};

export type CourseraCoursesResponse = {
  query: string;
  count: number;
  total_results: number | null;
  total_pages: number | null;
  source: string;
  fetched_at: string;
  cached: boolean;
  courses: CourseraCourse[];
  facets: Record<string, CourseraFacetValue[]>;
};

export async function getCourses(query?: string): Promise<CourseraCoursesResponse> {
  const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
  // A cold request scrapes Coursera live, so allow more than the default budget.
  return apiFetch<CourseraCoursesResponse>(`/api/courses/${suffix}`, {
    timeoutMs: LONG_TIMEOUT_MS,
  });
}

/**
 * One tracked weakness area, e.g. "Communication & Soft Skills".
 *
 * `query` is the Coursera search phrase that addresses it, so the courses grid can
 * be driven straight from the segment the candidate picks. The buckets mirror the
 * ones the /tutorials screen uses, so the same label means the same thing on both.
 */
export type CourseWeaknessSegment = {
  key: string;
  label: string;
  query: string;
  blurb: string;
  /** Weakest recent score found, 0-100. Lower means a more urgent gap. */
  score: number;
  /** How many individual scores were averaged into `score`. */
  sample_size: number;
  /** Which training areas the evidence came from. */
  sources: string[];
  /** Short, human-readable reasons, strongest first. */
  evidence: string[];
};

export type CourseWeaknessSegmentsResponse = {
  /** Weakest first. Empty when the candidate has no tracked training data yet. */
  segments: CourseWeaknessSegment[];
  count: number;
};

export async function courseSegments(): Promise<CourseWeaknessSegmentsResponse> {
  return apiFetch<CourseWeaknessSegmentsResponse>("/api/courses/segments/");
}
