import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Mic, RotateCcw, Send, Square, Users } from "lucide-react";
import { AppNavHeader } from "@/components/tb/app-nav";
import {
  gdChat,
  gdComplete,
  gdCompleteKeepalive,
  gdPanelists,
  gdTopic,
  me,
  ttsGenerate,
  type AuthUser,
  type GdCompleteBody,
  type GdPanelist,
} from "@/lib/api";
import { GateError, GateLoading } from "@/components/load-state";
import { cn } from "@/lib/utils";

const title = "TalentBro | Group Discussion";
const description = "Live 6-member group discussion practice round with AI peers.";

export const Route = createFileRoute("/gd-room")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: GdRoom,
});

type MemberKey = `m${number}`;
type Speaker = MemberKey | "system" | "you";
type Phase = "opening" | "live" | "ended";

type GDMsg = { id: number; from: Speaker; text: string; time: string };

type Member = { key: MemberKey; name: string; gender: "female" | "male"; voice: string };

// Last-resort roster when the backend is unreachable, so the round can still
// start offline. The real names come from Gemini 2.5 Flash Lite via the API.
const FALLBACK_PANELISTS: GdPanelist[] = [
  { name: "Ananya", gender: "female" },
  { name: "Diya", gender: "female" },
  { name: "Kavya", gender: "female" },
  { name: "Arjun", gender: "male" },
  { name: "Rohan", gender: "male" },
  { name: "Vivaan", gender: "male" },
];

const TOPICS = [
  "Is AI a net positive or a net threat to jobs in India?",
  "Should remote work become the default for IT companies?",
  "Are fast-food chains responsible for rising lifestyle diseases among youth?",
  "Is the four-day work week a realistic goal for Indian companies?",
  "Should social media be strictly regulated to curb misinformation?",
  "Is the gig economy a boon or a trap for young workers?",
  "Should coding be a compulsory subject in schools?",
  "Is electric mobility ready to lead India's transport future?",
];

const ROUND_SECONDS = 15 * 60;

// Live voice input (Web Speech API) tuneables, matching the chat composer.
const VOICE_STT_LANGS = ["en-IN", "en-GB", "en-US"];
const VOICE_AUTO_STOP_MS = 3000; // commit after ~3s of sustained silence
const VOICE_MAX_MS = 60000; // hard cap for a single monologue
const VOICE_REBUILD_COOLDOWN_MS = 4000; // don't recycle the recognizer too fast

// Minimum gap between AI panelist lines so replies never land back-to-back.
const MIN_AI_GAP_MS = 3500;

// The student holds the floor this long; if they stay silent, AI panelists
// carry the discussion on without them.
const USER_WAIT_MS = 10_000;

// The round starts with a 10s ice-break window where the floor is the
// student's alone. No topic announcement — just a visible countdown.
const ICE_BREAK_SECONDS = 10;

const CRITERIA_LABELS = [
  "Content Quality",
  "Reasoning",
  "Communication",
  "Confidence",
  "Teamwork",
  "Initiative",
  "Active Listening",
  "Build / Challenge",
];

type GdResult = {
  criteria: { label: string; score: number }[];
  overall: number;
  grade: string;
  strengths: string[];
  improvementAreas: string[];
};

// Indian voice pools so every panelist sounds local to the GD context. Only
// the en-IN voices edge-tts reliably serves are used (NeerjaExpressive and
// Neerja female, Prabhat male); the backend re-checks and never falls back
// onto a different-gender voice.
const FEMALE_VOICES = ["en-IN-NeerjaExpressiveNeural", "en-IN-NeerjaNeural"];
const MALE_VOICES = ["en-IN-PrabhatNeural"];

function toMembers(panelists: GdPanelist[]): Member[] {
  const femalePool = [...FEMALE_VOICES];
  const malePool = [...MALE_VOICES];
  const list = panelists.slice(0, 6);
  while (list.length < 6) list.push(FALLBACK_PANELISTS[list.length]!);
  return list.map((p, i) => {
    const isMale = p.gender === "male";
    const pool = isMale ? malePool : femalePool;
    // Never serve a voice of the wrong gender, even if the roster is skewed.
    const defaultVoice = isMale ? MALE_VOICES[0]! : FEMALE_VOICES[0]!;
    const voice = pool.shift() ?? defaultVoice;
    return { key: `m${i}` as MemberKey, name: p.name, gender: p.gender, voice };
  });
}

const CANNED_OPENER_A =
  "I think remote work should definitely be the default for IT companies. It offers real flexibility and opens up a much wider talent pool.";
const CANNED_OPENER_B =
  "Hey everyone, I'd build on that — the flexibility is genuine, but we should also ask who carries the cost before making it the default.";

function continuationLine(topic: string, used: string[] = []): string {
  const bank = [
    `Building on that, here's another angle on ${topic}.`,
    "Fair point. But let's also ask who actually bears the cost here.",
    "That's a strong observation. Can you break it down with one example?",
    "I'd push back slightly \u2014 does that still hold in smaller towns?",
    "Good. Now can we separate the facts from the assumptions in that claim?",
    "Let's test that against one everyday situation before we commit to it.",
  ];
  const available = bank.filter((line) => !used.includes(line));
  const pool = available.length ? available : bank;
  return pool[Math.floor(Math.random() * pool.length)] ?? "";
}

// Escape user-supplied panelist names so they are safe inside a RegExp.
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function configureResult(userMsgs: number): GdResult {
  const base = Math.min(58 + userMsgs * 3, 82);
  const criteria = CRITERIA_LABELS.map((label) => ({
    label,
    score: Math.min(100, Math.max(0, Math.round(base + Math.random() * 12 - 6))),
  }));
  const overall = Math.round(criteria.reduce((s, c) => s + c.score, 0) / criteria.length);
  const grade =
    overall >= 85 ? "Excellent" : overall >= 70 ? "Good" : overall >= 50 ? "Average" : "Needs work";
  const sorted = [...criteria].sort((a, b) => b.score - a.score);
  return {
    criteria,
    overall,
    grade,
    strengths: sorted.slice(0, 3).map((c) => c.label),
    improvementAreas: sorted
      .slice(-3)
      .reverse()
      .map((c) => c.label),
  };
}

function formatClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function AvatarEl({
  img,
  name,
  initials,
  ring = false,
  className,
}: {
  img: string | undefined;
  name: string;
  initials: string;
  ring?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center overflow-hidden rounded-full text-[10px] font-semibold tracking-[0.1em]",
        ring && "ring-2 ring-orange-400/70 ring-offset-2 ring-offset-card",
        img ? "" : "border border-border bg-background text-muted-foreground",
        className,
      )}
    >
      {img ? <img src={img} alt={name} className="h-full w-full object-cover" /> : initials}
    </span>
  );
}

function TypingBubbles() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </div>
  );
}

function GdRoom() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [topic, setTopic] = useState<string>(
    () => TOPICS[Math.floor(Math.random() * TOPICS.length)] ?? TOPICS[0]!,
  );
  const [phase, setPhase] = useState<Phase>("opening");
  const [messages, setMessages] = useState<GDMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [left, setLeft] = useState(ROUND_SECONDS);
  const [iceBreak, setIceBreak] = useState(false);
  const [iceLeft, setIceLeft] = useState(0);
  const [result, setResult] = useState<GdResult | null>(null);

  const idRef = useRef(0);
  const userMsgsRef = useRef(0);
  const runTokenRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const transcriptRef = useRef<{ name: string; content: string; from?: string }[]>([]);
  const lastSpeakAtRef = useRef(Date.now());
  const lastUserMsgAtRef = useRef(Date.now());
  const draftRef = useRef("");
  const forcedSpeakerRef = useRef<MemberKey | null>(null);
  const fallbackUsedRef = useRef<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingAudioRef = useRef<HTMLAudioElement[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ---- Voice input (live browser STT, like the chat composer) — spoken words
  // land in the draft so they can be reviewed before sending. ----
  const [recording, setRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const micReady =
    typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sttLangsRef = useRef<string[]>(VOICE_STT_LANGS);
  const sttLangIdxRef = useRef(0);
  const sttActiveRef = useRef(false); // a live STT session is currently open
  const sttStopRef = useRef(false); // true once we asked the engine to stop — blocks auto-restart
  const sttFinalsRef = useRef(""); // committed (final) words while listening
  const sttInterimsRef = useRef(""); // live partial words while listening
  const sttBaseRef = useRef(""); // typed text already in the draft when recording started
  const autoStopTimerRef = useRef<number | null>(null);
  const maxLenTimerRef = useRef<number | null>(null);
  const lastResultAtRef = useRef(0);
  const lastRebuildAtRef = useRef(0);
  const recordingRef = useRef(false); // mirrors `recording` for the AI loop guards

  // Refs mirroring the current round so a save can happen even after the page
  // tears down (back nav, tab close) without depending on stale state.
  const topicRef = useRef(topic);
  const membersRef = useRef<Member[]>([]);
  const userRef = useRef<AuthUser | null>(null);
  const startedRef = useRef(false);
  const savedRef = useRef(false);
  topicRef.current = topic;
  membersRef.current = members;
  userRef.current = user;

  function sleep(ms: number) {
    return new Promise<void>((resolve) => {
      const t = window.setTimeout(resolve, ms);
      timersRef.current.push(t);
    });
  }

  function clearTimers() {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }

  function stopSpeech() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    pendingAudioRef.current = [];
  }

  // Speak a member line via TTS. Resolves ONLY when playback finishes (or the
  // audio fails), so the next line is never generated while someone is still
  // talking — no voice collisions.
  async function playSpeech(voice: string, text: string): Promise<void> {
    if (!voice || !text) return;
    let url = "";
    try {
      url = await ttsGenerate(text, voice);
      if (!url) return;
      stopSpeech();
      const audio = new Audio(url);
      audioRef.current = audio;
      await new Promise<void>((resolve) => {
        const done = () => {
          audio.removeEventListener("ended", done);
          audio.removeEventListener("error", done);
          resolve();
        };
        audio.addEventListener("ended", done, { once: true });
        audio.addEventListener("error", done, { once: true });
        audio.play().catch(() => {
          // Autoplay blocked — hold it and resume on the next user gesture.
          pendingAudioRef.current.push(audio);
        });
      });
    } catch {
      // TTS unavailable — show the line silently.
    } finally {
      if (url) URL.revokeObjectURL(url);
      if (audioRef.current && audioRef.current.paused) audioRef.current = null;
    }
  }

  function addMsg(from: Speaker, text: string) {
    idRef.current += 1;
    lastSpeakAtRef.current = Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: idRef.current,
        from,
        text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    if (from !== "system") {
      transcriptRef.current.push({ name: speakerName(from), content: text, from });
    }
  }

  const speakerName = (from: Speaker) =>
    from === "you"
      ? user?.name || "Student"
      : (members.find((m) => m.key === from)?.name ?? "Member");

  function startOpening() {
    runTokenRef.current += 1;
    const token = runTokenRef.current;
    startedRef.current = true;
    clearTimers();
    stopSpeech();
    setMessages([]);
    transcriptRef.current = [];
    userMsgsRef.current = 0;
    fallbackUsedRef.current = [];
    setResult(null);
    setLeft(ROUND_SECONDS);
    setIceBreak(true);
    setIceLeft(ICE_BREAK_SECONDS);
    setPhase("opening");
    setBusy(false);
    draftRef.current = "";
    lastUserMsgAtRef.current = Date.now();
    void (async () => {
      // Ice-break window: the floor is the student's alone. If they stay
      // silent, the panel members open the discussion instead.
      if (token !== runTokenRef.current) return;
      await sleep(ICE_BREAK_SECONDS * 1000);
      if (token !== runTokenRef.current) return;
      setIceBreak(false);

      // If the student is mid-recording, wait for them to finish before the AI
      // openers speak over their mic.
      while (recordingRef.current) {
        if (token !== runTokenRef.current) return;
        await sleep(300);
      }

      const openerA = members.find((m) => m.gender === "female") ?? members[0];
      const openerB = members.find((m) => m.gender === "male") ?? members[1];
      const openers = [openerA, openerB].filter((m): m is Member => Boolean(m));
      if (openers[0]) {
        let aText = CANNED_OPENER_A;
        try {
          const a = await gdChat({
            topic,
            speaker: openers[0]!.name,
            student: user?.name || "Student",
            transcript: [...transcriptRef.current],
          });
          if (a.content) aText = a.content;
        } catch {
          // keep canned opening
        }
        if (token !== runTokenRef.current) return;
        addMsg(openers[0].key, aText);
        await playSpeech(openers[0].voice, aText);
        if (token !== runTokenRef.current) return;
      }
      if (openers[1]) {
        await sleep(MIN_AI_GAP_MS - 500);
        let bText = CANNED_OPENER_B;
        try {
          const b = await gdChat({
            topic,
            speaker: openers[1]!.name,
            student: user?.name || "Student",
            transcript: [...transcriptRef.current],
          });
          if (b.content) bText = b.content;
        } catch {
          // keep canned opening
        }
        if (token !== runTokenRef.current) return;
        addMsg(openers[1].key, bText);
        await playSpeech(openers[1].voice, bText);
      }
      if (token !== runTokenRef.current) return;
      // The ice-break floor is done; let the live loop carry the discussion.
      lastUserMsgAtRef.current = Date.now() - USER_WAIT_MS;
      draftRef.current = "";
      setBusy(false);
      setPhase("live");
    })();
  }

  function endRound() {
    runTokenRef.current += 1;
    clearTimers();
    stopSpeech();
    setPhase("ended");
    setBusy(true);
    const finalResult = configureResult(userMsgsRef.current);
    setResult(finalResult);
    void saveRound(finalResult);
  }

  // Persist the round to the backend. Guarded by savedRef so end, page exit and
  // tab close each try exactly once.
  async function saveRound(result: GdResult) {
    if (savedRef.current) return;
    savedRef.current = true;
    const studentName = userRef.current?.name || "Student";
    const participants: GdCompleteBody["participants"] = [
      ...membersRef.current.map((m) => ({ name: m.name, gender: m.gender, is_user: false })),
      { name: studentName, gender: "", is_user: true },
    ];
    const transcript: GdCompleteBody["transcript"] = transcriptRef.current.map((t) => ({
      name: t.name,
      content: t.content,
      from: t.from ?? "",
    }));
    try {
      await gdComplete({
        topic: topicRef.current,
        participants,
        transcript,
        result,
      });
    } catch {
      savedRef.current = false;
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || phase === "ended") return;
    setDraft("");
    draftRef.current = "";
    // If the student calls out a specific panelist (e.g. "come again rahul"),
    // that panelist must be the one who responds next.
    const regex = members.map((m) => escapeRegex(m.name)).join("|");
    const mention = regex ? text.match(new RegExp(`\\b(${regex})\\b`, "i")) : null;
    forcedSpeakerRef.current =
      (mention && members.find((m) => m.name.toLowerCase() === mention[1]!.toLowerCase())?.key) ||
      null;
    userMsgsRef.current += 1;
    lastUserMsgAtRef.current = Date.now();
    addMsg("you", text);
  }

  // ---- Voice input — live browser STT that streams spoken words into the
  // draft, same behaviour as the chat composer. ----

  function getRecognitionInstance(): SpeechRecognitionLike | null {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    return SR ? new SR() : null;
  }

  function startMicRecording() {
    if (!micReady) {
      setRecordingError("Voice input isn't supported in this browser. Use Chrome or Edge.");
      return;
    }
    setRecordingError(null);
    setRecording(true);
    sttStopRef.current = false;
    sttActiveRef.current = true;
    sttFinalsRef.current = "";
    sttInterimsRef.current = "";
    sttBaseRef.current = draft.trim();
    lastResultAtRef.current = Date.now();
    lastRebuildAtRef.current = 0;
    sttLangsRef.current = VOICE_STT_LANGS;
    sttLangIdxRef.current = 0;
    // Don't let a panelist talk over the student while they record.
    stopSpeech();
    if (maxLenTimerRef.current !== null) window.clearTimeout(maxLenTimerRef.current);
    maxLenTimerRef.current = window.setTimeout(() => {
      maxLenTimerRef.current = null;
      if (sttActiveRef.current && !sttStopRef.current) stopMicRecording();
    }, VOICE_MAX_MS);
    spawnSttRecognition("init");
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
    if (!rec) {
      stopMicRecording();
      setRecordingError("Live voice isn't supported in this browser. Use Chrome or Edge.");
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

    instance.onresult = (event: SpeechRecognitionEventLike) => {
      lastResultAtRef.current = Date.now();
      if (!sttActiveRef.current || sttStopRef.current) return;
      let finals = "";
      let interims = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result?.[0]?.transcript ?? "";
        if (result?.isFinal) finals += text;
        else interims += text;
      }
      if (finals) sttFinalsRef.current = (sttFinalsRef.current + " " + finals).trim();
      sttInterimsRef.current = interims.trim();
      scheduleAutoStop();
      applySttToDraft();
    };

    if (typeof instance.onspeechend !== "undefined" || "onspeechend" in (instance as object)) {
      instance.onspeechend = () => {
        // User stopped talking — commit shortly instead of dragging on.
        lastResultAtRef.current = Date.now();
        if (sttActiveRef.current && !sttStopRef.current) scheduleAutoStop();
      };
    }

    instance.onerror = (event: SpeechRecognitionErrorEventLike) => {
      lastResultAtRef.current = Date.now();
      const code = event.error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        stopMicRecording();
        setRecordingError("Microphone access is blocked. Tap the mic button and choose Allow.");
      } else if (
        code === "language-not-supported" &&
        sttLangIdxRef.current < sttLangsRef.current.length - 1
      ) {
        sttLangIdxRef.current += 1;
        // The failed recognizer is dead — set the next valid language and stand
        // up a completely fresh instance by bypassing the rebuild cooldown so
        // the mic resumes listening right away.
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
      }
    };

    instance.onend = () => {
      lastResultAtRef.current = Date.now();
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
      if (sttFinalsRef.current || sttInterimsRef.current) stopMicRecording();
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

  function liveSttText(): string {
    return [sttFinalsRef.current, sttInterimsRef.current].filter(Boolean).join(" ").trim();
  }

  // Keep the spoken words flowing *into the draft* in real time, prefixed by
  // whatever was already typed before recording so voice input appends to it.
  function applySttToDraft() {
    const spoken = liveSttText();
    const base = sttBaseRef.current.trim();
    setDraft(spoken ? (base ? `${base} ${spoken}` : spoken) : base);
  }

  // Finalise a live session: drop the engine, put the spoken words into the
  // draft (without sending) so they can be reviewed before pressing send.
  function commitLiveStt() {
    const text = liveSttText();
    sttActiveRef.current = false;
    sttStopRef.current = true;
    clearAutoStop();
    clearMaxTimer();
    recognitionRef.current = null;
    setRecording(false);
    sttFinalsRef.current = "";
    sttInterimsRef.current = "";
    if (text) {
      const base = sttBaseRef.current.trim();
      setDraft(base ? `${base} ${text}` : text);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    sttBaseRef.current = "";
  }

  // Manually stop the live session (mic tap, page leave, everything else).
  // Flips the mic off and commits spoken text synchronously — no waiting for
  // the recognizer's asynchronous onend, so the tap feels instant.
  function stopMicRecording() {
    clearAutoStop();
    clearMaxTimer();
    if (!sttActiveRef.current && !recognitionRef.current) {
      setRecording(false);
      return;
    }
    sttStopRef.current = true;
    sttActiveRef.current = false;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    commitLiveStt();
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
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

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
        let panelists: GdPanelist[] = [];
        let chosenTopic = "";
        const [panelistRes, topicRes] = await Promise.allSettled([gdPanelists(), gdTopic()]);
        if (panelistRes.status === "fulfilled") panelists = panelistRes.value;
        if (topicRes.status === "fulfilled" && topicRes.value) chosenTopic = topicRes.value;
        if (cancelled) return;
        setUser(current);
        if (chosenTopic) setTopic(chosenTopic);
        setMembers(toMembers(panelists.length ? panelists : FALLBACK_PANELISTS));
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

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  // Browsers block autoplay until the user interacts; resume any GD speech
  // that was held back on the first pointer/key interaction.
  useEffect(() => {
    const retry = () => {
      const pending = [...pendingAudioRef.current];
      pendingAudioRef.current = [];
      for (const a of pending) void a.play().catch(() => {});
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") return;
      retry();
    };
    window.addEventListener("pointerdown", retry);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    startOpening();
    return () => {
      runTokenRef.current += 1;
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // A round is saved no matter how it ends — end button, timer run-out, back
  // navigation, or closing the tab. Short/silent rounds are saved too.
  useEffect(() => {
    const flush = () => {
      if (savedRef.current || !startedRef.current) return;
      savedRef.current = true;
      const studentName = userRef.current?.name || "Student";
      const result = configureResult(userMsgsRef.current);
      gdCompleteKeepalive({
        topic: topicRef.current,
        participants: [
          ...membersRef.current.map((m) => ({ name: m.name, gender: m.gender, is_user: false })),
          { name: studentName, gender: "", is_user: true },
        ],
        transcript: transcriptRef.current.map((t) => ({
          name: t.name,
          content: t.content,
          from: t.from ?? "",
        })),
        result,
      });
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  useEffect(() => {
    if (phase === "ended") return;
    const id = window.setInterval(() => {
      setLeft((prev) => Math.max(0, prev - 1));
      if (iceBreak) setIceLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, iceBreak]);

  useEffect(() => {
    if (phase === "live" && left <= 0) endRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase]);

  useEffect(() => {
    if (phase !== "live") return;
    const token = runTokenRef.current;
    let cancelled = false;
    let lastKey: MemberKey | null = null;
    let timer: number | undefined;

    const tick = async () => {
      if (cancelled || runTokenRef.current !== token) return;

      // The student is recording their point — hold the discussion until done.
      if (recordingRef.current) {
        timer = window.setTimeout(() => void tick(), 400);
        return;
      }

      // The moment the student starts typing, hold the discussion and give
      // them the floor first.
      if (draftRef.current.trim().length > 0) {
        timer = window.setTimeout(() => void tick(), 600);
        return;
      }

      // After the student's last line (or round start) hold up to USER_WAIT_MS
      // so they get a fair chance to speak before the AI members continue.
      const holdMs = lastUserMsgAtRef.current + USER_WAIT_MS - Date.now();
      if (holdMs > 0) {
        timer = window.setTimeout(() => void tick(), holdMs + 50);
        return;
      }

      const gap = Date.now() - lastSpeakAtRef.current;
      if (gap < MIN_AI_GAP_MS) {
        timer = window.setTimeout(() => void tick(), MIN_AI_GAP_MS - gap);
        return;
      }

      const candidates = members.filter((m) => m.key !== lastKey);
      const forced = forcedSpeakerRef.current;
      let speaker: Member | undefined;
      if (forced) {
        forcedSpeakerRef.current = null;
        speaker = members.find((m) => m.key === forced);
      } else {
        speaker = candidates[Math.floor(Math.random() * candidates.length)];
      }
      if (!speaker) return;
      lastKey = speaker.key;
      const startedAt = Date.now();
      setThinking(true);
      // Generate the line. If Gemini returns something already said recently
      // (or the offline bank would), retry once so no member repeats verbatim.
      let text = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        text = "";
        try {
          const g = await gdChat({
            topic,
            speaker: speaker.name,
            student: user?.name || "Student",
            transcript: [...transcriptRef.current],
          });
          if (g.content) text = g.content;
        } catch {
          // fall back to the canned line so the discussion never stalls
        }
        if (!text) {
          text = continuationLine(topic, fallbackUsedRef.current);
          if (text) fallbackUsedRef.current.push(text);
        }
        const recentTexts = transcriptRef.current
          .slice(-3)
          .map((t) => t.content.trim().toLowerCase());
        const collides = Boolean(text) && recentTexts.includes(text.trim().toLowerCase());
        if (!collides) break;
        text = "";
      }
      if (!text) text = continuationLine(topic);
      setThinking(false);
      if (cancelled || runTokenRef.current !== token) return;
      // The student typed or sent something while this line was generating;
      // drop it and hand the floor back to them.
      if (draftRef.current.trim().length > 0 || lastUserMsgAtRef.current > startedAt) {
        timer = window.setTimeout(() => void tick(), 600);
        return;
      }
      addMsg(speaker.key, text);
      // Speak the line to completion before the next response is generated,
      // so two members never talk over each other.
      await playSpeech(speaker.voice, text);
      if (cancelled || runTokenRef.current !== token) return;
      timer = window.setTimeout(() => void tick(), MIN_AI_GAP_MS + 500 + Math.random() * 2000);
    };

    timer = window.setTimeout(() => void tick(), 1000);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, thinking]);

  useEffect(() => {
    if (phase !== "ended") inputRef.current?.focus();
  }, [phase, busy, messages]);

  if (status === "loading") return <GateLoading />;

  if (status === "error" || !user) return <GateError message={errorMessage} />;

  const name = user.name || "Student";
  const youInitials = name.slice(0, 2).toUpperCase();
  const memberBy = (from: MemberKey) => members.find((m) => m.key === from);
  const personName = (from: Speaker) =>
    from === "you" ? name : (memberBy(from as MemberKey)?.name ?? "Member");
  const personImg = (_from: Speaker) => undefined;
  const personInitials = (from: Speaker) =>
    from === "you" ? youInitials : personName(from).slice(0, 2).toUpperCase();

  const inRoom: { from: Speaker; name: string; role: string; img: string | undefined }[] = [
    ...members.map((m) => ({
      from: m.key as Speaker,
      name: m.name,
      role: "Participant",
      img: undefined,
    })),
    { from: "you", name, role: "You", img: undefined },
  ];

  const canEnd = phase === "live" && userMsgsRef.current >= 2;

  return (
    <div className="relative flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-1/4 size-96 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute -right-20 bottom-1/4 size-80 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <AppNavHeader
        current="self-training"
        left={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void navigate({ to: "/gd-training", replace: true })}
              className="grid size-8 cursor-pointer place-items-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Back to instructions"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="relative grid size-9 place-items-center rounded-lg bg-foreground text-background">
              <Users className="size-4" />
              <span className="absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-background bg-emerald-500" />
            </span>
            <span>
              <p className="text-sm font-semibold leading-tight">Group Discussion</p>
              <p className="text-[11px] text-muted-foreground">Live practice round</p>
            </span>
          </div>
        }
      />

      {phase === "opening" && iceBreak && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 overflow-hidden bg-background px-6 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 top-1/4 size-96 rounded-full bg-orange-500/10 blur-3xl" />
            <div className="absolute -right-20 bottom-1/4 size-80 rounded-full bg-sky-500/10 blur-3xl" />
          </div>
          <p className="relative font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Group Discussion · Today&rsquo;s topic
          </p>
          <h1 className="relative max-w-3xl text-balance text-3xl font-semibold leading-snug tracking-tight sm:text-4xl">
            &ldquo;{topic}&rdquo;
          </h1>
          <p className="relative max-w-md text-sm leading-relaxed text-muted-foreground">
            Take a moment to think of your opening point. The discussion starts automatically once
            the countdown ends.
          </p>
          <div className="relative mt-2 flex flex-col items-center gap-2">
            <span className="font-mono text-5xl font-semibold tabular-nums text-foreground">
              {iceLeft}s
            </span>
            <div className="h-1 w-56 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-orange-500 ease-linear"
                style={{
                  width: `${(iceLeft / ICE_BREAK_SECONDS) * 100}%`,
                  transition: "width 1s linear",
                }}
              />
            </div>
          </div>
        </div>
      )}

      <main className="relative mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 pb-4 sm:px-6">
        <div className="flex min-h-0 flex-1 gap-4">
          <aside className="hidden w-72 shrink-0 flex-col gap-4 py-4 md:flex">
            <div className="rounded-2xl border border-border bg-card/70 p-4 backdrop-blur">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Today's topic
              </p>
              <p className="mt-1.5 text-[13px] font-medium leading-relaxed">"{topic}"</p>
            </div>
            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-card/70 p-4 backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  In discussion
                </p>
                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
                </span>
              </div>
              <ul className="mt-3 space-y-1.5 overflow-y-auto">
                {inRoom.map((p) => (
                  <li
                    key={p.from}
                    className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-accent"
                  >
                    <AvatarEl
                      img={p.img}
                      name={p.name}
                      initials={p.name.slice(0, 2).toUpperCase()}
                      ring={p.from === "you"}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">{p.name}</span>
                      <span className="block truncate text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                        {p.role}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto rounded-xl border border-dashed border-border bg-background/60 p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Round rules
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Speak in points · back each with a reason · let others get their turn.
                </p>
              </div>
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card/70 backdrop-blur">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold tracking-tight">"{topic}"</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {phase === "opening"
                    ? "Ice-break \u2014 say your opening point"
                    : phase === "live"
                      ? "Discussion live"
                      : "Round complete"}
                </p>
              </div>
              {phase !== "ended" && (
                <div className="flex shrink-0 items-center gap-2">
                  {iceBreak && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-mono text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                      <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Ice-break · {iceLeft}s
                    </span>
                  )}
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs tabular-nums",
                      left <= 60
                        ? "border-red-500/50 text-red-600"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {phase === "opening" && <Loader2 className="size-3 animate-spin" />}
                    {formatClock(left)}
                  </span>
                  {canEnd && (
                    <button
                      type="button"
                      onClick={endRound}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-foreground px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground transition-colors hover:bg-foreground hover:text-background"
                    >
                      <Square className="size-3" />
                      End round
                    </button>
                  )}
                </div>
              )}
            </div>

            {phase === "ended" && result ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                <Scorecard
                  result={result}
                  name={name}
                  onReplay={startOpening}
                  onBack={() => void navigate({ to: "/gd-training", replace: true })}
                />
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
                  <div className="mx-auto max-w-2xl space-y-3.5">
                    {messages.map((m, i) => {
                      const prev = messages[i - 1];
                      const first = !prev || prev.from !== m.from;
                      const isYou = m.from === "you";
                      const isSystem = m.from === "system";
                      if (isSystem) {
                        return (
                          <div key={m.id} className="flex justify-center py-1 animate-rise">
                            <div className="max-w-md rounded-2xl border border-border bg-background/80 px-4 py-2.5 text-center text-xs leading-relaxed text-muted-foreground">
                              {m.text}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "flex w-full gap-2.5 animate-rise",
                            isYou && "flex-row-reverse",
                          )}
                        >
                          {first ? (
                            <AvatarEl
                              img={personImg(m.from)}
                              name={personName(m.from)}
                              initials={personInitials(m.from)}
                              className="mt-1"
                            />
                          ) : (
                            <span className="w-9 shrink-0" />
                          )}
                          <div
                            className={cn(
                              "flex min-w-0 max-w-[80%] flex-col sm:max-w-[70%]",
                              isYou && "items-end",
                            )}
                          >
                            {first && (
                              <p
                                className={cn(
                                  "mb-1 flex items-baseline gap-2 text-xs font-medium",
                                  isYou && "flex-row-reverse",
                                )}
                              >
                                {personName(m.from)}
                                <span className="text-[10px] font-normal uppercase tracking-[0.15em] text-muted-foreground">
                                  {m.time}
                                </span>
                              </p>
                            )}
                            <div
                              className={cn(
                                "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                                isYou
                                  ? "rounded-br-md bg-foreground text-background"
                                  : "rounded-bl-md border border-border bg-card text-foreground",
                              )}
                            >
                              {m.text}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {busy && phase !== "ended" && (
                      <div className="flex w-full items-end gap-2.5">
                        <span className="w-9 shrink-0" />
                        <div className="mb-3 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 shadow-sm">
                          <TypingBubbles />
                        </div>
                      </div>
                    )}
                    <div ref={endRef} />
                  </div>
                </div>

                <div className="border-t border-border px-4 py-3 sm:px-5">
                  <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-border bg-background/80 p-2 pl-4 backdrop-blur focus-within:border-foreground/50">
                    <textarea
                      ref={inputRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                      rows={1}
                      disabled={busy || phase === "ended"}
                      placeholder={
                        recording
                          ? "Listening…"
                          : phase === "opening"
                            ? "Ice-break \u2014 make your opening point…"
                            : busy
                              ? "The group is discussing…"
                              : "Share your point…"
                      }
                      className="max-h-32 min-h-10 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (recording) stopMicRecording();
                        else startMicRecording();
                      }}
                      disabled={!micReady || busy || phase === "ended"}
                      aria-label={recording ? "Stop recording" : "Record voice"}
                      className={cn(
                        "grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-border text-foreground transition-colors hover:bg-muted",
                        recording && "border-red-500/40 bg-red-500/10 text-red-500",
                        !micReady && "cursor-not-allowed opacity-40",
                      )}
                    >
                      {recording ? (
                        <Square className="size-3.5 fill-current" />
                      ) : (
                        <Mic className="size-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={!draft.trim()}
                      aria-label="Send"
                      className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-foreground text-background transition-all hover:opacity-90 disabled:opacity-40"
                    >
                      <Send className="size-4" />
                    </button>
                  </div>
                  <p
                    className={cn(
                      "mx-auto mt-1.5 max-w-2xl text-center text-[10px] uppercase tracking-[0.2em]",
                      recordingError ? "text-red-500" : "text-muted-foreground",
                    )}
                  >
                    {recordingError ??
                      (recording
                        ? "Recording… tap the mic to stop"
                        : "Enter to send · end the round once you've made 2+ points")}
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Scorecard({
  result,
  name,
  onReplay,
  onBack,
}: {
  result: GdResult;
  name: string;
  onReplay: () => void;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Round complete
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{name}, here's how you did:</p>
        <div
          className="mx-auto mt-5 grid size-36 place-items-center rounded-full"
          style={{
            background: `conic-gradient(var(--foreground) ${Math.round(result.overall * 3.6)}deg, var(--muted) 0deg)`,
          }}
        >
          <div className="grid size-28 place-items-center rounded-full bg-card">
            <span>
              <span className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight">
                {result.overall}
              </span>
              <span className="ml-1 text-xs text-muted-foreground">/100</span>
            </span>
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold">{result.grade}</p>
        <div className="mt-5 space-y-2 text-left">
          {result.criteria.map((c) => (
            <div key={c.label} className="flex items-center gap-3">
              <span className="w-36 shrink-0 text-xs">{c.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{ width: `${c.score}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums">
                {c.score}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400">
            Strengths
          </p>
          <ul className="mt-3 space-y-2">
            {result.strengths.map((s) => (
              <li key={s} className="flex items-start gap-2 text-[13px]">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-amber-600 dark:text-amber-400">
            Work on
          </p>
          <ul className="mt-3 space-y-2">
            {result.improvementAreas.map((s) => (
              <li key={s} className="flex items-start gap-2 text-[13px]">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onReplay}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-foreground px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors hover:bg-foreground hover:text-background"
        >
          <RotateCcw className="size-3" />
          Play again
        </button>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex cursor-pointer items-center rounded-full border border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          Back to instructions
        </button>
      </div>
    </div>
  );
}
