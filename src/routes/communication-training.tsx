import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  AudioLines,
  History,
  Lightbulb,
  Loader2,
  MessageSquareText,
  Mic,
} from "lucide-react";
import { AppNavHeader } from "@/components/tb/app-nav";
import { browserAIStatus, createBrowserSession, type BrowserAISession } from "@/lib/browser-ai";
import {
  ApiError,
  communicationTrainingAppendTurns,
  communicationTrainingChat,
  communicationTrainingFinalize,
  communicationTrainingList,
  finalizeCommunicationTrainingKeepalive,
  me,
  ttsGenerateWithTimings,
  type AuthUser,
  type ChatResponse,
  type CommunicationTrainingSession,
} from "@/lib/api";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { GateError, GateLoading, useQuoteSplash } from "@/components/load-state";

const title = "TalentBro | Communication Skills";
const description =
  "Practice spoken English and communication skills by talking out loud with your AI coach, Maya.";

export const Route = createFileRoute("/communication-training")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: CommunicationTrainingPage,
});

// Decorative flowing sound waves behind Maya's mic — pure frontend, no backend.
// A 240-unit sine tile repeated twice in a 480-wide viewBox; `tb-slide-x` moves
// the whole strip by -50% (exactly one tile) so the flow loops seamlessly.
function buildWavePath(amp: number, base: number, cycles = 2): string {
  const pts: string[] = [];
  for (let x = 0; x <= 240; x += 10) {
    pts.push(`${x} ${Math.round(base + amp * Math.sin((x / 240) * Math.PI * 2 * cycles))}`);
  }
  return `M${pts.join(" L")}`;
}

const FLOWING_WAVES: {
  stroke: string;
  opacity: string;
  amp: number;
  base: number;
  top: string;
  duration: string;
  delay: string;
}[] = [
  {
    stroke: "#38bdf8",
    opacity: "0.25",
    amp: 22,
    base: 62,
    top: "0.4rem",
    duration: "14s",
    delay: "0s",
  },
  {
    stroke: "#22d3ee",
    opacity: "0.18",
    amp: 13,
    base: 42,
    top: "1.6rem",
    duration: "9s",
    delay: "-4s",
  },
  {
    stroke: "#818cf8",
    opacity: "0.16",
    amp: 30,
    base: 80,
    top: "0rem",
    duration: "18s",
    delay: "-9s",
  },
];

const WELCOME_MESSAGE =
  "Hey! I'm Maya — your communication coach. I can see you through the camera. Tap the mic button once to let me hear you, then just talk to me — hands-free from then on. Stand tall, smile, and let's practice!";

// Spoke when the student has practice history, tailoring the opening to what
// Maya found in their latest finished session so each visit picks up where the
// last one left off.
function buildIceBreaker(last: CommunicationTrainingSession | null): string {
  if (!last) return WELCOME_MESSAGE;
  const score = last.communication_score ?? 0;
  const fields: { key: keyof CommunicationTrainingSession; label: string }[] = [
    { key: "clarity", label: "clarity" },
    { key: "fluency", label: "fluency" },
    { key: "grammar", label: "grammar" },
    { key: "vocabulary", label: "vocabulary" },
    { key: "pronunciation", label: "pronunciation" },
    { key: "confidence", label: "confidence" },
    { key: "answer_structure", label: "answer structure" },
    { key: "intonation", label: "intonation" },
    { key: "professional_tone", label: "professional tone" },
    { key: "conversational_skills", label: "conversational flow" },
  ];
  let weakest = fields[0]!;
  let strongest = fields[0]!;
  for (const f of fields) {
    const v = Number(last[f.key]) || 0;
    if (v < (Number(last[weakest.key]) || 0)) weakest = f;
    if (v > (Number(last[strongest.key]) || 0)) strongest = f;
  }
  const scoreNote =
    score >= 80
      ? `Amazing work last session — you hit ${score} out of 100.`
      : score >= 50
        ? `Last session you scored ${score} out of 100.`
        : `Last session you scored ${score} out of 100.`;
  const focusSource = (
    last.areas_for_improvement ||
    last.ai_recommendations ||
    last.recurring_mistakes ||
    ""
  ).trim();
  const firstGoal = focusSource.split(/[.!?]/)[0]?.trim();
  const focusNote = firstGoal
    ? `Today, let's build on that — ${firstGoal.charAt(0).toLowerCase()}${firstGoal.slice(1)}.`
    : `Let's keep sharpening your ${weakest.label}, and keep up that strong ${strongest.label}.`;
  return `Hey, welcome back! ${scoreNote} ${strongest.label} was your standout strength. ${focusNote} I can see you through the camera — talk to me whenever you're ready.`;
}

type ChatMsg = {
  id: string;
  role: "user" | "mentor";
  text: string;
};

// Maya's spoken line. While it is being read aloud, `activeWord` is the ordinal
// of the word currently being spoken (driven by live speech-boundary / audio
// progress events), and that word lights up in real time. Uses the same /\S+/
// segmentation the voice loop uses, so ordinals always line up.
function MayaText({ text, activeWord }: { text: string; activeWord: number }) {
  if (typeof activeWord !== "number" || activeWord < 0) {
    return <>{text}</>;
  }
  let ord = -1;
  return (
    <>
      {text.split(/(\s+)/).map((part, i) => {
        if (/^\s+$/.test(part)) return <span key={i}>{part}</span>;
        ord += 1;
        return (
          <span
            key={i}
            className={
              ord === activeWord
                ? "rounded-[2px] bg-sky-500/30 text-foreground transition-colors duration-150"
                : undefined
            }
          >
            {part}
          </span>
        );
      })}
    </>
  );
}

// Map exact Edge word timings back onto the transcript. Each timing is
// (char offset in the reply text, ms when that word starts in the clip). A
// word the engine didn't label is interpolated from the nearest labelled
// neighbours, so a missing timing never leaves the transcript dark. Returns
// null when no timings are available (older backend) so callers keep their
// linear-progress fallback.
function alignWordTimesMs(
  text: string,
  pairs: ReadonlyArray<{ offset: number; startMs: number }>,
): number[] | null {
  if (!pairs.length) return null;
  const starts: number[] = [];
  const re = /\S+/g;
  for (;;) {
    const m = re.exec(text);
    if (!m) break;
    starts.push(m.index);
  }
  const times: (number | null)[] = new Array(starts.length).fill(null);
  // The service announces a token the moment it starts speaking it: attach
  // each timing to the transcript word whose span contains that char offset.
  for (const { offset, startMs } of pairs) {
    let w = starts.length - 1;
    while (w >= 0 && starts[w]! > offset) w -= 1;
    if (w < 0) continue;
    const end = w + 1 < starts.length ? starts[w + 1]! : text.length;
    if (offset < end && (times[w] === null || startMs < times[w]!)) {
      times[w] = startMs;
    }
  }
  // Fill unlabelled words from the nearest labelled neighbours.
  let prev = -1;
  let prevMs = 0;
  for (let i = 0; i < times.length; i++) {
    if (times[i] === null) continue;
    if (prev >= 0) {
      for (let k = prev + 1; k < i; k++) {
        const f = (k - prev) / (i - prev);
        times[k] = Math.round(prevMs + f * (times[i]! - prevMs));
      }
    }
    prev = i;
    prevMs = times[i]!;
  }
  for (let i = prev + 1; i < times.length; i++) times[i] = prevMs;
  return times.map((t) => t ?? 0);
}

type FlowState = "idle" | "listening" | "thinking" | "speaking";
type SttMode = "browser" | "recorder";

// Hands-free loop (ChatGPT-voice style): everything runs in the browser.
const IDLE_AUTO_SEND_MS = 2400; // auto-submit after ~2.4s of user silence
const SPEECHEND_FLUSH_MS = 2400; // same 2.4s silence buffer after the recognizer sees a pause
const REARM_DELAY_MS = 350; // pause before re-opening the mic after Maya speaks
const SPEECH_WATCHDOG_MIN_MS = 3000; // safety in case speechSynthesis.onend stalls
const SPEECH_WATCHDOG_MS_PER_CHAR = 120;
const SPEECH_WATCHDOG_MARGIN_MS = 4000; // grace so the watchdog never cuts a live reply
// How long to wait for the Neerja (Edge TTS) clip before switching to the fast
// local female voice so Maya never hangs silent after a reply is ready.
const NEERJA_GRACE_MS = 1200;
const SR_LANGS = ["en-IN", "en-GB", "en-US"]; // live STT locales, best first

// Maya's voice — always Neerja, a warm Indian-English female voice on Edge TTS.
const MAYA_VOICE = "neerja";

// Mic waveform sampling (frontend-only; the Web Speech API transcribes). The
// analyser proves the mic is hearing the user, so its RMS is the ground truth
// the STT watchdog cross-checks against: if the user is clearly speaking but
// the recognizer returns no transcript, the recognizer is broken and gets
// recycled (a stuck instance rarely recovers when re-started in place).
const SILENCE_INTERVAL_MS = 80; // analyser sampling period
const WAVE_RMS_THRESHOLD = 0.015; // analyser RMS that counts as mic audio (lights the waves)
// The recognizer needs at least this loudness to count as a person genuinely
// talking (well above ambient room noise ~0.015–0.03). Ground truth for the
// STT watchdog — never trigger a recycle from mere background hum.
const STT_TALK_RMS = 0.06;
const SPEECH_RECENT_MS = 1500; // a reading counts as "speaking now" up to this long after the last peak
const STT_SPEAK_SILENT_MS = 3000; // speaking non-stop with zero results → recycle recognizer
const STT_RESULT_IDLE_MS = 12000; // no transcript at all while listening → recycle recognizer
const STT_REBUILD_COOLDOWN_MS = 4000; // don't recycle twice within this window

// Selfie-cam smile check via the MediaPipe "mouthSmile" blendshape (0 = neutral,
// ~0.3+ = light smile, ~0.6+ = wide/exaggerated). 0.4 accepts a normal genuine
// smile without demanding an exaggerated one.
const SELFIE_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const SELFIE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const SMILE_THRESHOLD = 0.4;
const SMILE_SETTLE_MS = 300; // keep smiling this long before accepting it
const SMILE_LOST_MS = 800; // how long the smile can drop before asking again

// Sessions that were told to finalize but never got confirmed by the backend
// are persisted to sessionStorage so a dropped/keepalive/mid-flight finalize is
// retried on the next page load — never silently left "active".
const FINALIZE_QUEUE_KEY = "tb:comm-training-finalize";

function readFinalizeQueue(): string[] {
  try {
    const raw = window.sessionStorage.getItem(FINALIZE_QUEUE_KEY);
    const arr = JSON.parse(raw ?? "[]");
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeFinalizeQueue(ids: string[]): void {
  try {
    window.sessionStorage.setItem(FINALIZE_QUEUE_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // noop — best-effort only.
  }
}

function queueFinalize(sid: string): void {
  writeFinalizeQueue([...readFinalizeQueue(), sid]);
}

function dequeueFinalize(sid: string): void {
  writeFinalizeQueue(readFinalizeQueue().filter((x) => x !== sid));
}

function buildMayaSystemPrompt(name: string): string {
  return `You are Maya, a warm and encouraging English & communication coach at TalentBro, helping a student practice spoken English and communication skills before campus placements.

RULES:
- Keep every reply SHORT and SPOKEN-STYLE: 2-4 conversational sentences. This reply will be read aloud by a text-to-speech voice, so write for the ear, not the page. No lists, no bullet points, no markdown.
- Gently correct obvious grammar, pronunciation hints or vocabulary mistakes in a positive, human way, then keep the conversation moving with a question.
- Ask one short follow-up question at the end so the spoken conversation keeps flowing.
- If the student speaks in Hindi or Hinglish, respond mainly in natural Indian English with a little warmth, mirroring their level and slowly uplifting it.
- If the student asks for a full mock HR/GD/self-introduction, play along as the interviewer, keeping your turns brief.

Student name: ${name}.`;
}

function getRecognition(): SpeechRecognitionLike | null {
  const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  return SR ? new SR() : null;
}

function pickGoogleVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const isFemale = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    return (
      n.includes("female") ||
      n.includes("neerja") ||
      n.includes("priya") ||
      n.includes("isha") ||
      n.includes("samantha") ||
      n.includes("karen") ||
      n.includes("moira") ||
      n.includes("tessa") ||
      n.includes("zira")
    );
  };
  function femaleVoice(lang: string) {
    return voices.find((v) => v.lang.toLowerCase().startsWith(lang) && isFemale(v));
  }
  return (
    femaleVoice("en-in") ??
    femaleVoice("en-gb") ??
    femaleVoice("en-us") ??
    voices.find((v) => v.lang.startsWith("en") && isFemale(v))
  );
}

function CommunicationTrainingPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { splash, splashDone } = useQuoteSplash();

  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: "welcome", role: "mentor", text: WELCOME_MESSAGE },
  ]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [flow, setFlow] = useState<FlowState>("idle");
  const [captured, setCaptured] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [diag, setDiag] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [waves, setWaves] = useState(false);
  const [needMicTap, setNeedMicTap] = useState(false); // Chrome needs one tap to grant the mic
  const [smiling, setSmiling] = useState(false); // selfie cam: is the student smiling
  const [smileReady, setSmileReady] = useState(false); // selfie cam: smile model loaded
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null); // Maya message being read aloud right now
  const [speakingWord, setSpeakingWord] = useState(-1); // word of that message currently being spoken

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const smilingRef = useRef(false);
  const smileHoldMsRef = useRef(0);
  const smileLostMsRef = useRef(0);
  const userRef = useRef<AuthUser | null>(null);
  const leftScrollRef = useRef<HTMLDivElement | null>(null);
  const rightScrollRef = useRef<HTMLDivElement | null>(null);

  const capturedRef = useRef("");
  const interimRef = useRef("");
  const flowRef = useRef<FlowState>("idle");
  const messagesRef = useRef<ChatMsg[]>(messages);
  const sessionIdRef = useRef<string | null>(null);
  const wavesRef = useRef(false);
  const autoLoopRef = useRef(true);
  const waitingForUserRef = useRef(false);
  const sttBlockedRef = useRef(false); // block STT during thinking/speaking
  const submitInFlightRef = useRef(false); // prevent double-submission of the same speech
  const finalizedRef = useRef(false); // session end was already flushed to the backend

  // Live (browser) speech recognition refs.
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sttModeRef = useRef<SttMode>("browser");
  const micLockedRef = useRef(true); // true until getUserMedia succeeds once per page load
  const camStreamRef = useRef<MediaStream | null>(null); // selfie-cam feed — stopped hard on leave
  const aliveRef = useRef(true); // false once the page is left — blocks late timers re-arming mic/voice
  const startedRef = useRef(false);
  const startAttemptAtRef = useRef(0);
  const lastResultAtRef = useRef(0);
  const networkErrorsRef = useRef(0);
  const idleTimerRef = useRef<number | null>(null);
  const srLangIdxRef = useRef(0);

  // Mic waveform refs (frontend-only — no recording/uploading happens here).
  const recStreamRef = useRef<MediaStream | null>(null);
  const recAudioCtxRef = useRef<AudioContext | null>(null);
  const recAnalyserRef = useRef<AnalyserNode | null>(null);
  const recTimerRef = useRef<number | null>(null);

  // On-device AI (Gemini Nano) session — instant, frontend-only replies.
  const browserSessionRef = useRef<BrowserAISession | null>(null);
  const browserAIAvailableRef = useRef(false);

  // Auto re-arm + TTS watchdog timers.
  const rearmTimerRef = useRef<number | null>(null);
  const speechWatchdogRef = useRef<number | null>(null);
  // Completed callback of the currently playing TTS (so a late onended/onerror
  // from an old clip can't re-fire the loop) + a turn counter so a newer user
  // utterance always supersedes an older one that's still being generated.
  const speechDoneRef = useRef<(() => void) | null>(null);
  const turnGenRef = useRef(0);
  // Realtime highlight state for the line Maya is reading aloud: which message
  // (by id) is speaking, the char offset each word starts at, the word ordinal
  // currently being spoken, and the duration-estimate timer that keeps the
  // word lights moving even when no boundary events fire.
  const speakingMsgIdRef = useRef<string | null>(null);
  const wordStartsRef = useRef<number[]>([]);
  const wordIndexRef = useRef(-1);
  const wordTimerRef = useRef<number | null>(null);
  // STT health: last recognizer event (start/result/error/end) and the last time
  // the analyser actually heard the mic (ground truth for "user is talking")
  // plus when the recognizer instance was last recycled. The watchdog compares
  // the last two to call out a recognizer that is running but silent.
  const lastSttEventRef = useRef(0);
  const lastSpeechMsRef = useRef(0);
  const lastRebuildAtRef = useRef(0);

  // Edge TTS (Neerja) playback — the warm Indian-English female voice for Maya.
  const ttsPlayerRef = useRef<HTMLAudioElement | null>(null);
  const ttsObjectUrlRef = useRef<string | null>(null);
  const ttsFetchAbortRef = useRef<AbortController | null>(null);

  messagesRef.current = messages;
  sessionIdRef.current = sessionId;
  flowRef.current = flow;
  userRef.current = user;

  // Recording the char offset of every word in the line Maya is reading, so a
  // live charIndex (speech-boundary event or audio progress) maps to the word
  // ordinal the transcript highlights in real time.
  function prepareWords(text: string) {
    const starts: number[] = [];
    const re = /\S+/g;
    for (;;) {
      const match = re.exec(text);
      if (!match) break;
      starts.push(match.index);
    }
    wordStartsRef.current = starts;
  }

  function emitWordForChar(idx: number) {
    const starts = wordStartsRef.current;
    if (starts.length === 0) return;
    let w = -1;
    for (let i = 0; i < starts.length; i++) {
      const s = starts[i];
      if (s === undefined || s > idx) break;
      w = i;
    }
    const next = w < 0 ? 0 : w;
    if (next === wordIndexRef.current) return;
    // Never regress: when two sources (speech boundaries + a duration estimate)
    // both update the word, allowing the index to drift backwards makes the
    // highlight flicker between two words. Only forward motion is visible.
    if (next < wordIndexRef.current) return;
    wordIndexRef.current = next;
    setSpeakingWord(next);
  }

  function stopWordTimer() {
    if (wordTimerRef.current !== null) {
      window.clearInterval(wordTimerRef.current);
      wordTimerRef.current = null;
    }
  }

  // Keep the newest message in each transcript column visible.
  useEffect(() => {
    if (leftScrollRef.current) leftScrollRef.current.scrollTop = leftScrollRef.current.scrollHeight;
  }, [messages, flow]);
  useEffect(() => {
    if (rightScrollRef.current)
      rightScrollRef.current.scrollTop = rightScrollRef.current.scrollHeight;
  }, [messages, flow, captured, interim]);

  // The session ends the moment the user leaves (button, navigation, or closing
  // the tab). Tell the backend to lock the transcript and generate the Gemini
  // analysis: a normal POST on unmount, and a keepalive request on
  // pagehide/beforeunload so even a sudden browser close flushes it. The
  // session id is queued until the backend confirms, so a failure is retried on
  // the next page load instead of leaving the session "active" forever.
  function confirmFinalize(sid: string) {
    communicationTrainingFinalize(sid)
      .then((res) => {
        if (res && res.ok) dequeueFinalize(sid);
      })
      .catch((err: unknown) => {
        // The backend discards sessions with fewer than 4 exchanges, so a
        // retried id for one of those comes back "not found" — that's a
        // discarded session, not a failure, so stop retrying it. Anything else
        // stays queued (and the stale-session sweep is the ultimate fallback).
        if (err instanceof ApiError && err.status === 404) {
          dequeueFinalize(sid);
          return;
        }
        // Keep it queued — retried on the next page load.
      });
  }

  function finalizeSession(keepalive: boolean) {
    const sid = sessionIdRef.current;
    if (!sid || finalizedRef.current) return;
    finalizedRef.current = true;
    queueFinalize(sid);
    if (keepalive) {
      // Fire-and-forget from pagehide/beforeunload — the queued id survives in
      // sessionStorage and is retried on the next page load if this is dropped.
      finalizeCommunicationTrainingKeepalive(sid);
    } else {
      confirmFinalize(sid);
    }
  }

  useEffect(() => {
    const onUnload = () => finalizeSession(true);
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
      finalizeSession(false);
    };
  }, []);

  function applyWaves(active: boolean) {
    if (wavesRef.current === active) return;
    wavesRef.current = active;
    setWaves(active);
  }

  // ---- Camera feed (always on) ----

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((s) => {
        stream = s;
        if (!videoRef.current) {
          // The page was already left while the camera was starting — drop it.
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        videoRef.current.srcObject = s;
        camStreamRef.current = s;
      })
      .catch(() => {});
    return () => {
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      camStreamRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Selfie-cam smile detection. MediaPipe blendshapes drive a "Smile!" prompt
  // that stays on the cam until the student shows a normal smile (not an
  // exaggerated one), then hides until the smile drops away again.
  useEffect(() => {
    let disposed = false;
    let raf = 0;
    let lm: FaceLandmarker | null = null;

    const tick = () => {
      const video = videoRef.current;
      if (!disposed && lm && video && video.readyState >= 2) {
        const res = lm.detectForVideo(video, performance.now());
        const bs = res.faceBlendshapes?.[0]?.categories;
        let smile = 0;
        if (bs) {
          let sl = 0;
          let sr = 0;
          for (const cat of bs) {
            if (cat.categoryName === "mouthSmileLeft") sl = cat.score;
            else if (cat.categoryName === "mouthSmileRight") sr = cat.score;
          }
          smile = (sl + sr) / 2;
        }
        if (smilingRef.current) {
          if (smile >= SMILE_THRESHOLD) {
            smileLostMsRef.current = 0;
          } else {
            smileLostMsRef.current += 50;
            if (smileLostMsRef.current >= SMILE_LOST_MS) {
              smilingRef.current = false;
              setSmiling(false);
            }
          }
        } else if (smile >= SMILE_THRESHOLD) {
          smileHoldMsRef.current += 50;
          if (smileHoldMsRef.current >= SMILE_SETTLE_MS) {
            smilingRef.current = true;
            setSmiling(true);
            smileHoldMsRef.current = 0;
          }
        } else {
          smileHoldMsRef.current = 0;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    void (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(SELFIE_WASM);
        lm = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: SELFIE_MODEL },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
        });
        if (disposed) {
          lm.close();
          return;
        }
        setSmileReady(true);
        raf = requestAnimationFrame(tick);
      } catch {
        // Landmarker failed to load — the smile prompt just stays hidden.
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      lm?.close();
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

  useEffect(() => {
    if (typeof window.speechSynthesis === "undefined") return;
    window.speechSynthesis.getVoices();
    const onVoices = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", onVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
  }, []);

  // Tear down mic/speech/analyser/camera and every timer on unmount, and flag
  // the page disposed so a late TTS watchdog or re-arm timer can never re-open
  // the microphone or keep talking after the student has left the page.
  useEffect(() => {
    return () => {
      aliveRef.current = false;
      if (rearmTimerRef.current !== null) window.clearTimeout(rearmTimerRef.current);
      if (speechWatchdogRef.current !== null) window.clearTimeout(speechWatchdogRef.current);
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
      stopRecorderInternals();
      stopCamera();
      stopTtsMedia();
      stopWordTimer();
      if (typeof window.speechSynthesis !== "undefined") window.speechSynthesis.cancel();
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {
          // noop
        }
        recognitionRef.current = null;
      }
      speechDoneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set up the on-device conversation session (Gemini Nano) so replies are
  // generated entirely in the browser with no server round-trip.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      const isAvailable = await browserAIStatus();
      if (cancelled) return;
      if (isAvailable !== "readily") {
        browserAIAvailableRef.current = false;
        return;
      }
      browserAIAvailableRef.current = true;
      setDiag("On-device AI ready — responses will be instant.");
      const session = await createBrowserSession(
        buildMayaSystemPrompt(userRef.current?.name ?? "student"),
      );
      if (cancelled) {
        session?.destroy();
        return;
      }
      if (session) {
        browserSessionRef.current?.destroy();
        browserSessionRef.current = session;
      }
    })();
    return () => {
      cancelled = true;
      browserSessionRef.current?.destroy();
      browserSessionRef.current = null;
    };
  }, [user]);

  // ---- Live speech recognition setup (browser-only, frontend) ----

  useEffect(() => {
    let rec: SpeechRecognitionLike | null = getRecognition();
    if (!rec) {
      setError(
        "Hands-free voice needs Chrome or Edge. Please open this page in Chrome or Edge so Maya can listen without touching the screen.",
      );
      return;
    }

    // Every handler targets the current instance via the `rec` closure, so the
    // same handlers can be re-attached verbatim to a fresh recognizer after a
    // recycle.
    const bindHandlers = (instance: SpeechRecognitionLike) => {
      instance.continuous = true;
      instance.interimResults = true;
      instance.maxAlternatives = 3;
      instance.lang = SR_LANGS[srLangIdxRef.current] ?? "en-IN";

      instance.onstart = () => {
        console.log(
          "[maya-flow] rec.onstart — browser STT actually started. flowRef=",
          flowRef.current,
          "sttBlocked=",
          sttBlockedRef.current,
        );
        // Chrome auto-restarts the recognizer after rec.stop() when
        // continuous=true. Stop it only when the loop is intentionally closed
        // (blocked or paused). During thinking/speaking we KEEP the mic open so
        // the user can interrupt Maya at any time.
        if (sttBlockedRef.current) {
          console.log("[maya-stt] auto-restart blocked — flow=", flowRef.current);
          try {
            rec?.stop();
          } catch {
            /* noop */
          }
          applyWaves(false);
          return;
        }
        // When idle, Chrome may auto-restart after a turn. If the hands-free loop
        // is still running, lift straight back to 'listening'.
        if (flowRef.current === "idle") {
          if (!autoLoopRef.current) {
            try {
              rec?.stop();
            } catch {
              /* noop */
            }
            applyWaves(false);
            return;
          }
          autoLoopRef.current = true;
          flowRef.current = "listening";
          setFlow("listening");
        }
        startedRef.current = true;
        lastSttEventRef.current = Date.now();
        applyWaves(false);
        setDiag("");
        console.log("[maya-stt] live recognition started");
      };

      if (
        typeof instance.onspeechstart !== "undefined" ||
        "onspeechstart" in (instance as object)
      ) {
        instance.onspeechstart = () => {
          console.log("[maya-stt] speechstart — audio detected");
        };
      }

      instance.onresult = (event: SpeechRecognitionEventLike) => {
        startedRef.current = true;
        networkErrorsRef.current = 0;
        lastResultAtRef.current = Date.now();
        lastSttEventRef.current = Date.now();
        setDiag("");
        // If the recognizer restarted while the loop is closed, ignore it.
        if (sttBlockedRef.current || flowRef.current === "idle") {
          applyWaves(false);
          return;
        }
        // While Maya is speaking, the recognizer can pick up HER OWN voice
        // through the speakers (acoustic echo). Never treat that as the student
        // speaking — drop it completely. A real interruption is detected from
        // the echo-cancelled mic waveform in sampleAnalyser() instead.
        if (flowRef.current === "speaking") {
          applyWaves(false);
          return;
        }
        let finals = "";
        let interims = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result?.[0]?.transcript ?? "";
          if (result?.isFinal) finals += text;
          else interims += text;
        }
        if (finals) {
          console.log("[maya-stt] final:", finals);
          capturedRef.current = (capturedRef.current + " " + finals).trim();
          setCaptured(capturedRef.current);
        }
        interimRef.current = interims.trim();
        setInterim(interimRef.current);
        if (interimRef.current) console.log("[maya-stt] interim:", interimRef.current);
        if (finals || interims.trim()) applyWaves(true);
        if (capturedRef.current || interims.trim()) {
          if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
          idleTimerRef.current = window.setTimeout(() => {
            void submitCaptured();
          }, IDLE_AUTO_SEND_MS);
        }
      };

      // When the user stops talking, submit quickly instead of waiting out the
      // whole idle window, so words show up on the transcript right away.
      if (typeof instance.onspeechend !== "undefined" || "onspeechend" in (instance as object)) {
        instance.onspeechend = () => {
          console.log("[maya-stt] user stopped speaking — flushing in", SPEECHEND_FLUSH_MS + "ms");
          if (
            flowRef.current !== "idle" &&
            !sttBlockedRef.current &&
            (capturedRef.current.trim() || interimRef.current.trim())
          ) {
            if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
            idleTimerRef.current = window.setTimeout(
              () => void submitCaptured(),
              SPEECHEND_FLUSH_MS,
            );
          }
        };
      }

      instance.onerror = (event: SpeechRecognitionErrorEventLike) => {
        const code = event.error;
        lastSttEventRef.current = Date.now();
        console.log("[maya-flow] rec.onerror — code:", code, "| flow=", flowRef.current);
        if (code === "not-allowed" || code === "service-not-allowed") {
          if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
          autoLoopRef.current = false;
          stopRecorderInternals();
          setNeedMicTap(true);
          setError(
            "Microphone access is blocked. Tap the mic button and choose Allow — then Maya keeps listening hands-free.",
          );
          setDiag("");
          waitingForUserRef.current = true;
          setFlow("idle");
        } else if (code === "no-speech") {
          setDiag("");
          // Engine timed out after silence — if words were already captured,
          // submit them now instead of waiting for the idle timer.
          if (
            flowRef.current !== "idle" &&
            !sttBlockedRef.current &&
            (capturedRef.current.trim() || interimRef.current.trim())
          ) {
            if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
            idleTimerRef.current = window.setTimeout(
              () => void submitCaptured(),
              SPEECHEND_FLUSH_MS,
            );
          }
        } else if (code === "audio-capture") {
          setDiag("No microphone found. Check your mic and speaker settings.");
        } else if (code === "language-not-supported") {
          if (srLangIdxRef.current < SR_LANGS.length - 1) {
            srLangIdxRef.current += 1;
            try {
              instance.lang = SR_LANGS[srLangIdxRef.current] ?? "en-IN";
            } catch {
              // noop
            }
            setDiag("Live speech switched language — keep talking.");
          } else {
            setDiag("This browser's live speech isn't ideal.");
          }
        } else if (code === "network") {
          // The speech service blipped. A fresh instance is stood up by the
          // watchdog if no transcripts follow.
          networkErrorsRef.current += 1;
          setDiag("Voice recognition hiccup — the mic stays open, just say it again.");
        } else if (code === "aborted") {
          // Expected — we aborted the session ourselves to refresh it.
          setDiag("");
        } else {
          setDiag(code ? `Speech error: ${code}` : "");
        }
      };

      instance.onend = () => {
        console.log(
          "[maya-flow] rec.onend — flow=",
          flowRef.current,
          "sttMode=",
          sttModeRef.current,
        );
        lastSttEventRef.current = Date.now();
        applyWaves(false);
        if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
        // If the engine ended with recognized speech still waiting on the
        // silence-submit timer (Chrome can kill the session mid-window), submit
        // it now instead of silently dropping the user's words.
        if (
          flowRef.current !== "idle" &&
          !sttBlockedRef.current &&
          (capturedRef.current.trim() || interimRef.current.trim())
        ) {
          console.log("[maya-stt] recognizer ended with pending speech — submitting");
          void submitCaptured();
          return;
        }
        // The engine ended on its own while we should still be listening — keep
        // listening with a FRESH instance so it can never quietly die. Chrome
        // does not reliably auto-restart after error/silence ends. Skipped when
        // we closed the loop ourselves (blocked / never-started) or when a spawn
        // is already in flight (this onend then came from our own abort()).
        if (sttModeRef.current === "browser" && startedRef.current && !sttBlockedRef.current) {
          spawnRecognizer("onend");
        }
      };
    };

    // Attach the handlers to the initial instance. It is started by
    // startListening() the moment a user gesture (or the hands-free re-arm)
    // opens the mic.
    bindHandlers(rec);
    recognitionRef.current = rec;

    // A recognizer that has silently stopped transcribing almost never recovers
    // when the SAME instance is re-started, so a stuck one is always recycled to
    // a brand-new instance. `spawnRecognizer` aborts the old one, builds a fresh
    // one with the same handlers and starts listening immediately. It is guarded
    // by a cooldown and a single-flight flag so the watchdog can't pile spawns.
    let spawning = false;
    const spawnRecognizer = (cause: string) => {
      if (spawning) return;
      const now = Date.now();
      if (cause !== "init" && now - lastRebuildAtRef.current < STT_REBUILD_COOLDOWN_MS) return;
      if (sttBlockedRef.current || flowRef.current !== "listening") return;
      spawning = true;
      lastRebuildAtRef.current = now;
      try {
        rec?.abort();
      } catch {
        // noop
      }
      rec = getRecognition();
      if (!rec) {
        spawning = false;
        return;
      }
      bindHandlers(rec);
      recognitionRef.current = rec;
      startedRef.current = false;
      lastResultAtRef.current = Date.now();
      console.log("[maya-stt] spawning fresh recognizer —", cause);
      try {
        rec.start();
      } catch {
        // noop — the watchdog retries after the cooldown.
      }
      spawning = false;
    };

    // STT health watchdog. Ground truth for "is the student talking" is the live
    // mic waveform (analyser RMS in sampleAnalyser), which is independent of the
    // speech service. If the student is clearly speaking but no transcript comes
    // back, or the recognizer has gone totally quiet, recycle it so "listening"
    // always really transcribes.
    const watchdog = window.setInterval(() => {
      if (sttModeRef.current !== "browser") return;
      if (flowRef.current !== "listening" || sttBlockedRef.current) return;
      const now = Date.now();
      if (!startedRef.current) {
        // Chrome needs one gesture to unlock the mic; after that, re-starts are
        // silent. If a start still never landed, stand up a fresh instance.
        if (micLockedRef.current) {
          if (now - startAttemptAtRef.current > 2000) {
            setDiag("Tap the mic button once for instant live speech.");
          }
          return;
        }
        if (now - lastRebuildAtRef.current >= STT_REBUILD_COOLDOWN_MS) {
          console.log("[maya-stt] watchdog — recognizer never started, respawning");
          spawnRecognizer("never-started");
        }
        return;
      }
      const speakingNow =
        lastSpeechMsRef.current !== 0 && now - lastSpeechMsRef.current < SPEECH_RECENT_MS;
      // Student clearly speaking (waves proof) but no transcript for a while →
      // the recognizer is stuck, not the mic. Recycle it.
      if (speakingNow && now - lastResultAtRef.current >= STT_SPEAK_SILENT_MS) {
        console.log("[maya-stt] watchdog — speaking but silent, respawning");
        spawnRecognizer("speaking-but-silent");
        return;
      }
      // Backstop: no transcript at all while listening for a long time.
      if (now - lastResultAtRef.current >= STT_RESULT_IDLE_MS) {
        console.log("[maya-stt] watchdog — recognizer quiet too long, respawning");
        spawnRecognizer("quiet-timeout");
      }
    }, 3000);

    return () => {
      window.clearInterval(watchdog);
      try {
        rec?.abort();
      } catch {
        // noop
      }
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
      stopTtsMedia();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start the hands-free loop as soon as the page is ready. The opening
  // ice breaker adapts to the student's last finished session so the first
  // thing Maya says picks up where the previous conversation left off. Also
  // retried when the page is restored from the browser's back/forward cache.
  function beginHandsFreeLoop() {
    // Re-arm the page guard. After an abrupt close, flags like `aliveRef` are
    // latched off by the teardown — but a fresh mount or a browser back/forward
    // cache restore must ALWAYS be able to restart the loop from scratch.
    aliveRef.current = true;
    console.log("[maya-flow] preparing ice breaker");
    void (async () => {
      let iceBreaker = WELCOME_MESSAGE;
      try {
        const list = await communicationTrainingList();
        const last = list
          .filter((s) => s.finalized_at && s.communication_score > 0)
          .sort(
            (a, b) =>
              new Date(b.finalized_at ?? 0).getTime() - new Date(a.finalized_at ?? 0).getTime(),
          )[0];
        iceBreaker = buildIceBreaker(last ?? null);
      } catch {
        iceBreaker = WELCOME_MESSAGE;
      }
      // A fresh page/BFCache session always starts a NEW live session — never
      // reuses a finalized/left one.
      sessionIdRef.current = null;
      finalizedRef.current = false;
      setSessionId(null);
      setMessages([{ id: "welcome", role: "mentor", text: iceBreaker }]);
      console.log("[maya-flow] speaking ice breaker, then will rearm");
      if (typeof window.speechSynthesis !== "undefined") {
        speakingMsgIdRef.current = "welcome";
        setSpeakingMsgId("welcome");
        flowRef.current = "speaking";
        setFlow("speaking");
        speakReply(iceBreaker, () => {
          console.log("[maya-flow] ice breaker finished — opening the mic (or asking for a tap)");
          speakingMsgIdRef.current = null;
          setSpeakingMsgId(null);
          flowRef.current = "idle";
          setFlow("idle");
          waitingForUserRef.current = true;
          // Try to open the mic hands-free. If the permission was already
          // granted on this origin it just works; otherwise this fails and the
          // "Tap to begin" prompt takes over (it needs ONE tap in Chrome).
          setNeedMicTap(true);
          void startListening();
        });
      } else {
        console.log("[maya-flow] no speechSynthesis — going straight to listening");
        startListening();
      }
    })();
  }

  useEffect(() => {
    if (status !== "ready" || !splashDone) return;
    const t = window.setTimeout(beginHandsFreeLoop, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, splashDone]);

  // Retry any finalize that was never confirmed (dropped keepalive, failed
  // request, tab crash) right when the page comes back up.
  useEffect(() => {
    if (status !== "ready") return;
    const pending = readFinalizeQueue();
    for (const sid of pending) confirmFinalize(sid);
  }, [status]);

  // Browser back/forward cache restore ("back to the page" without a reload):
  // the in-memory session, mic, camera and audio are stale — the old session is
  // finalized and the page is hard-reloaded so it ALWAYS opens freshly instead
  // of resuming a half-frozen state.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      console.log(
        "[maya-flow] BFCache restore detected — tearing everything down and reopening fresh",
      );
      stopTtsMedia();
      stopRecorderInternals();
      stopCamera();
      if (typeof window.speechSynthesis !== "undefined") window.speechSynthesis.cancel();
      aliveRef.current = false;
      finalizeSession(false);
      window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Hands-free loop control ----

  function startListening() {
    if (!aliveRef.current) return;
    console.log(
      "[maya-flow] startListening() called. flowRef=",
      flowRef.current,
      "sttMode=",
      sttModeRef.current,
      "waitingForUser=",
      waitingForUserRef.current,
    );
    if (
      flowRef.current === "listening" ||
      flowRef.current === "thinking" ||
      flowRef.current === "speaking"
    ) {
      console.log("[maya-flow] startListening BLOCKED — flow is", flowRef.current);
      return;
    }
    autoLoopRef.current = true;
    capturedRef.current = "";
    interimRef.current = "";
    setCaptured("");
    setInterim("");
    applyWaves(false);
    setError("");
    setDiag("");
    startedRef.current = false;
    startAttemptAtRef.current = Date.now();
    lastResultAtRef.current = Date.now();
    waitingForUserRef.current = false;
    sttBlockedRef.current = false;
    submitInFlightRef.current = false;
    // 1) Open the mic purely for the live waveform (no uploading — this is a
    //    frontend-only feature; the words come from the browser's speech
    //    recognizer below).
    void openMicWaves();
    // 2) Browser web speech recognition — transcribes in the frontend itself.
    //    It needs a user gesture once (a mic tap), which also unlocks the mic.
    const rec = recognitionRef.current;
    if (rec) {
      networkErrorsRef.current = 0;
      try {
        rec.abort();
      } catch {
        // noop
      }
      try {
        rec.lang = SR_LANGS[srLangIdxRef.current] ?? "en-IN";
      } catch {
        // noop
      }
      try {
        rec.start();
      } catch {
        // Only ask for a tap when the mic genuinely isn't open yet (first
        // load / permission revoked). If it was already unlocked, this was a
        // transient failure — the watchdog re-arms it silently.
        if (micLockedRef.current) {
          setNeedMicTap(true);
          setDiag("Tap the mic button once so Maya can hear you.");
        }
      }
    }
  }

  function stopRec() {
    sttBlockedRef.current = true;
    stopRecorderInternals();
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        // noop
      }
    }
  }

  // Shared end-of-speech handler. The browser recognizer's final words are the
  // source of truth — everything happens in the frontend.
  function finalizeCapture() {
    const text = capturedRef.current.trim() || interimRef.current.trim();
    if (!text) {
      // Nothing recognised yet — stay listening; the recognizer drives when
      // the user finishes talking.
      return;
    }
    console.log("[maya-stt] live speech captured:", text);
    submitInFlightRef.current = true;
    capturedRef.current = "";
    interimRef.current = "";
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    setCaptured("");
    setInterim("");
    // Shut the mic off until Maya has finished speaking. No interruptions —
    // the mic is re-enabled only after her reply ends (see presentReply→rearm).
    sttBlockedRef.current = true;
    stopRecorderInternals();
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        // noop
      }
    }
    finishTurn(text);
  }

  function finishTurn(text: string) {
    applyWaves(false);
    setMicLevel(0);
    flowRef.current = "thinking";
    setFlow("thinking");
    console.log("[maya-stt] transcribed & answering:", text);
    void sendToMentor(text);
  }

  function submitCaptured() {
    console.log(
      "[maya-flow] submitCaptured() → finalizeCapture. text=",
      `"${capturedRef.current.trim() || interimRef.current.trim()}"`,
    );
    finalizeCapture();
  }

  function scheduleRearm() {
    console.log(
      "[maya-flow] scheduleRearm() — will re-check in",
      REARM_DELAY_MS + "ms. flowRef=",
      flowRef.current,
      "autoLoop=",
      autoLoopRef.current,
    );
    if (rearmTimerRef.current !== null) window.clearTimeout(rearmTimerRef.current);
    rearmTimerRef.current = window.setTimeout(() => {
      rearmTimerRef.current = null;
      if (!aliveRef.current) return;
      console.log(
        "[maya-flow] rearm timer fired. flowRef=",
        flowRef.current,
        "autoLoop=",
        autoLoopRef.current,
        "waitingForUser=",
        waitingForUserRef.current,
      );
      if (micLockedRef.current) {
        // Chrome won't open the mic without a user gesture. Show the tap
        // prompt instead of silently retrying (which can never succeed).
        setNeedMicTap(true);
        return;
      }
      if (!autoLoopRef.current) {
        waitingForUserRef.current = true;
        console.log("[maya-flow] rearm: autoLoop off — waiting for user. waitingForUserRef=true");
        return;
      }
      if (flowRef.current === "idle") {
        console.log("[maya-flow] rearm: flow idle & autoLoop on — starting to listen NOW");
        startListening();
      } else {
        console.log("[maya-flow] rearm: flow is NOT idle — skipping", flowRef.current);
      }
    }, REARM_DELAY_MS);
  }

  function presentReply(reply: string) {
    console.log("[maya-flow] presentReply → speaking. Then idle → rearm");
    console.log("[maya] reply:", reply);
    const id = `m-${Date.now()}`;
    setMessages((prev) => [...prev, { id, role: "mentor", text: reply }]);
    speakingMsgIdRef.current = id;
    setSpeakingMsgId(id);
    setFlow("speaking");
    speakReply(reply, () => {
      console.log("[maya-flow] TTS done — idle, will rearm. autoLoop=", autoLoopRef.current);
      speakingMsgIdRef.current = null;
      setSpeakingMsgId(null);
      flowRef.current = "idle";
      setFlow("idle");
      waitingForUserRef.current = autoLoopRef.current;
      scheduleRearm();
    });
  }

  // On-device first; backend only if the browser has no built-in model.
  async function sendToMentor(text: string) {
    const gen = ++turnGenRef.current;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text }]);
    const local = browserSessionRef.current;
    if (local) {
      try {
        const reply = (await local.prompt(text)).trim();
        // A newer user utterance superseded this one — don't speak a stale reply.
        if (gen !== turnGenRef.current) return;
        if (reply) {
          presentReply(reply);
          // On-device replies never reach the backend chat endpoint, so push
          // both turns to the stored transcript so nothing is lost.
          try {
            const res = await communicationTrainingAppendTurns(sessionIdRef.current, [
              { role: "user", content: text },
              { role: "assistant", content: reply },
            ]);
            if (!sessionIdRef.current) setSessionId(res.session_id);
          } catch {
            // Best-effort: keepalive finalize on pagehide still locks whatever
            // the backend has seen so far.
          }
          return;
        }
      } catch {
        browserSessionRef.current?.destroy();
        browserSessionRef.current = null;
        browserAIAvailableRef.current = false;
        if (gen !== turnGenRef.current) return;
      }
    }
    try {
      const res: ChatResponse = await communicationTrainingChat(text, sessionIdRef.current);
      if (gen !== turnGenRef.current) return;
      if (!sessionIdRef.current) setSessionId(res.session_id);
      presentReply(res.reply);
    } catch (err) {
      if (gen !== turnGenRef.current) return;
      const msg = err instanceof Error ? err.message : "Could not reach your coach right now.";
      console.log("[maya] error:", msg);
      setError(msg);
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "mentor", text: msg }]);
      waitingForUserRef.current = true;
      flowRef.current = "idle";
      setFlow("idle");
      scheduleRearm();
    }
  }

  function stopTtsMedia() {
    ttsFetchAbortRef.current?.abort();
    ttsFetchAbortRef.current = null;
    if (ttsPlayerRef.current) {
      try {
        ttsPlayerRef.current.pause();
      } catch {
        // noop
      }
      ttsPlayerRef.current = null;
    }
    if (ttsObjectUrlRef.current) {
      URL.revokeObjectURL(ttsObjectUrlRef.current);
      ttsObjectUrlRef.current = null;
    }
    if (typeof window.speechSynthesis !== "undefined") window.speechSynthesis.cancel();
  }

  // Maya speaks in Neerja (en-IN-NeerjaExpressiveNeural) via the backend Edge
  // TTS — a warm Indian-English female voice. The response is generated and
  // passed in only AFTER the user's prompt has been fully recognised &
  // transcribed, so she never speaks from a partial prompt. If Edge TTS is
  // slow/unavailable, fall back to the browser voice so the user is never left
  // in silence.
  function speakReply(text: string, onEnd: () => void): void {
    // Prime the realtime word highlight for this line (see emitWordForChar).
    prepareWords(text);
    wordIndexRef.current = -1;
    setSpeakingWord(-1);

    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      if (speechDoneRef.current === done) speechDoneRef.current = null;
      if (speechWatchdogRef.current !== null) {
        window.clearTimeout(speechWatchdogRef.current);
        speechWatchdogRef.current = null;
      }
      stopWordTimer();
      wordIndexRef.current = -1;
      setSpeakingWord(-1);
      stopTtsMedia();
      onEnd();
    };
    speechDoneRef.current = done;

    const stillCurrent = () => speechDoneRef.current === done;
    const fallbackBrowser = () => {
      if (!stillCurrent()) return;
      if (typeof window.speechSynthesis === "undefined") {
        done();
        return;
      }
      const synth = window.speechSynthesis;
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const voice = pickGoogleVoice();
      if (voice) utter.voice = voice;
      utter.rate = 1.15;
      utter.pitch = 1.0;
      // Realtime word highlight for the browser path. Exact boundary events
      // are the source of truth; the estimate never moves before the engine
      // has actually started (utter.onstart), so the highlight can't lead the
      // audio the way an open-ended timer did. The estimate only takes over if
      // boundaries stall for a beat, always continuing from the last exact
      // position so it never jumps the highlight forward.
      const estMs = Math.max(2000, text.length * 90);
      let speechStartAt = 0;
      let lastBoundaryAt = 0;
      let lastBoundaryChar = -1;
      stopWordTimer();
      wordTimerRef.current = window.setInterval(() => {
        if (!speechStartAt) return;
        const haveBoundaries = lastBoundaryChar >= 0;
        if (haveBoundaries && Date.now() - lastBoundaryAt < 900) return;
        const baseChar = haveBoundaries ? lastBoundaryChar : 0;
        const baseAt = haveBoundaries ? lastBoundaryAt : speechStartAt;
        const est = baseChar + ((Date.now() - baseAt) / estMs) * text.length;
        emitWordForChar(Math.floor(est));
      }, 180);
      utter.onstart = () => {
        speechStartAt = Date.now();
        lastBoundaryAt = speechStartAt;
      };
      utter.onboundary = (e: SpeechSynthesisEvent) => {
        if (typeof e.charIndex === "number" && e.charIndex >= 0) {
          lastBoundaryAt = Date.now();
          lastBoundaryChar = e.charIndex;
          emitWordForChar(e.charIndex);
        }
      };
      utter.onend = () => done();
      utter.onerror = () => done();
      synth.speak(utter);
    };

    // Stall backstop: only force-finish if NOTHING is audible. While the Edge
    // audio element is playing or the browser voice is speaking, keep waiting —
    // Maya always gets to finish her sentence.
    const scheduleWatchdog = (): void => {
      if (speechWatchdogRef.current !== null) {
        window.clearTimeout(speechWatchdogRef.current);
      }
      const waitMs =
        Math.max(SPEECH_WATCHDOG_MIN_MS, text.length * SPEECH_WATCHDOG_MS_PER_CHAR) +
        SPEECH_WATCHDOG_MARGIN_MS;
      speechWatchdogRef.current = window.setTimeout(() => {
        speechWatchdogRef.current = null;
        const player = ttsPlayerRef.current;
        const ttsLive = player !== null && !player.paused && !player.ended;
        const synthLive =
          typeof window.speechSynthesis !== "undefined" && window.speechSynthesis.speaking;
        if (ttsLive || synthLive) {
          scheduleWatchdog();
          return;
        }
        done();
      }, waitMs);
    };
    scheduleWatchdog();

    const controller = new AbortController();
    ttsFetchAbortRef.current = controller;
    // Hybrid voice: Neerja is the primary voice, but if the server takes too
    // long to synthesise it, start the fast local female voice so the reply is
    // always spoken almost as soon as it is generated.
    const failTimer = window.setTimeout(() => {
      if (!stillCurrent()) return;
      controller.abort();
      fallbackBrowser();
    }, NEERJA_GRACE_MS);

    void (async () => {
      try {
        const { url, wordTimes } = await ttsGenerateWithTimings(text, MAYA_VOICE);
        if (controller.signal.aborted) {
          URL.revokeObjectURL(url);
          return;
        }
        window.clearTimeout(failTimer);
        const audio = new Audio(url);
        audio.preload = "auto";
        ttsPlayerRef.current = audio;
        ttsObjectUrlRef.current = url;
        // Realtime word highlight from the clip's own playback progress. When
        // the backend returned exact per-word start times, the highlight can
        // only appear once the audio actually reaches that word — it never runs
        // ahead of the browser processing the clip.
        const wordTimesMs = alignWordTimesMs(text, wordTimes);
        const updateFromTime = () => {
          if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
          if (wordTimesMs) {
            const t = audio.currentTime * 1000;
            let w = 0;
            while (w < wordTimesMs.length && (wordTimesMs[w] ?? Infinity) <= t) w += 1;
            const next = w - 1;
            if (next < 0) {
              wordIndexRef.current = -1;
              setSpeakingWord(-1);
              return;
            }
            if (next === wordIndexRef.current) return;
            wordIndexRef.current = next;
            setSpeakingWord(next);
            return;
          }
          const p = Math.min(1, audio.currentTime / audio.duration);
          emitWordForChar(Math.floor(p * text.length));
        };
        audio.addEventListener("timeupdate", updateFromTime);
        audio.onended = () => done();
        audio.onerror = () => {
          if (ttsObjectUrlRef.current) {
            URL.revokeObjectURL(ttsObjectUrlRef.current);
            ttsObjectUrlRef.current = null;
          }
          fallbackBrowser();
        };
        await audio.play();
      } catch {
        if (!stillCurrent()) return;
        if (!controller.signal.aborted) window.clearTimeout(failTimer);
        fallbackBrowser();
      }
    })();
  }

  function toggleListen() {
    console.log(
      "[maya-flow] toggleListen clicked. flow=",
      flowRef.current,
      "waitingForUser=",
      waitingForUserRef.current,
    );
    if (flowRef.current === "listening") {
      // Manual override — pause the auto loop.
      console.log("[maya-flow] toggleListen → PAUSING (user asked to stop)");
      autoLoopRef.current = false;
      if (rearmTimerRef.current !== null) window.clearTimeout(rearmTimerRef.current);
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
      stopRec();
      applyWaves(false);
      setCaptured("");
      setInterim("");
      setDiag("Paused — tap the mic to resume hands-free.");
      waitingForUserRef.current = true;
      console.log("[maya-flow] toggleListen → idle. waitingForUser=true");
      flowRef.current = "idle";
      setFlow("idle");
    } else if (flowRef.current === "idle") {
      console.log("[maya-flow] toggleListen → STARTING (mic tap = the gesture Chrome needs)");
      waitingForUserRef.current = false;
      autoLoopRef.current = true;
      submitInFlightRef.current = false;
      setError("");
      setDiag("");
      startListening();
    }
  }

  function stopEverything() {
    autoLoopRef.current = false;
    submitInFlightRef.current = false;
    if (rearmTimerRef.current !== null) window.clearTimeout(rearmTimerRef.current);
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    if (speechWatchdogRef.current !== null) window.clearTimeout(speechWatchdogRef.current);
    stopRec();
    stopTtsMedia();
    stopCamera();
    flowRef.current = "idle";
    setFlow("idle");
    finalizeSession(false);
    void navigate({ to: "/self-training", replace: true });
  }

  // ---- Waveform from the real mic signal ----

  function sampleAnalyser(analyser: AnalyserNode | null, minRms = 0.015) {
    let rms = 0;
    if (analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i]! - 128) / 128;
        sum += v * v;
      }
      rms = Math.sqrt(sum / data.length);
    }
    setMicLevel(Math.min(1, rms / 0.35));
    applyWaves(rms > minRms);
    // Ground truth for "is the user speaking": the live echo-cancelled mic
    // waveform, judged at clear-voice loudness (not room hum). The STT watchdog
    // uses this to detect a recognizer that is running but silently failing to
    // transcribe.
    if (flowRef.current === "listening" && !sttBlockedRef.current && rms >= STT_TALK_RMS) {
      lastSpeechMsRef.current = Date.now();
    } else {
      lastSpeechMsRef.current = 0;
    }
    return rms;
  }

  // ---- Mic waveform (frontend-only; transcription is the browser's Web Speech API) ----

  function stopRecorderInternals() {
    if (recTimerRef.current !== null) {
      window.clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    if (recAudioCtxRef.current) {
      void recAudioCtxRef.current.close().catch(() => {});
      recAudioCtxRef.current = null;
    }
    recAnalyserRef.current = null;
    if (recStreamRef.current) {
      recStreamRef.current.getTracks().forEach((t) => t.stop());
      recStreamRef.current = null;
    }
    applyWaves(false);
    setMicLevel(0);
  }

  // Stop the always-on selfie cam so the camera light goes out the moment the
  // student leaves the page (explicit back button or any unmount).
  function stopCamera() {
    const feed = videoRef.current?.srcObject as MediaStream | null;
    feed?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
  }

  // Open the mic purely for the live waveform. Transcription itself is done
  // entirely in the frontend by the browser's Web Speech recognizer.
  async function openMicWaves() {
    if (!aliveRef.current) return;
    console.log("[maya-flow] openMicWaves() — opening the mic for the waveform");
    stopRecorderInternals();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (flowRef.current === "thinking" || flowRef.current === "speaking") {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      recStreamRef.current = stream;
      micLockedRef.current = false;
      setNeedMicTap(false);

      let audioCtx: AudioContext | null = null;
      let analyser: AnalyserNode | null = null;
      try {
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        recAudioCtxRef.current = audioCtx;
        recAnalyserRef.current = analyser;
      } catch {
        recAudioCtxRef.current = null;
        recAnalyserRef.current = null;
      }

      autoLoopRef.current = true;
      capturedRef.current = "";
      interimRef.current = "";
      setCaptured("");
      setInterim("");
      applyWaves(false);
      setError("");
      setDiag("");
      flowRef.current = "listening";
      setFlow("listening");

      if (recTimerRef.current === null) {
        recTimerRef.current = window.setInterval(() => {
          sampleAnalyser(recAnalyserRef.current);
        }, SILENCE_INTERVAL_MS);
      }
      console.log("[maya-stt] mic open — waveform live, words from browser speech");
    } catch {
      micLockedRef.current = true;
      autoLoopRef.current = false;
      waitingForUserRef.current = true;
      flowRef.current = "idle";
      setFlow("idle");
      setNeedMicTap(true);
      setError(
        "Tap the mic button once to let Maya hear you — then she keeps listening hands-free.",
      );
    }
  }

  if (!splashDone) return splash;

  if (status === "loading") {
    return <GateLoading />;
  }

  if (status === "error" || !user) {
    return <GateError message={errorMessage} />;
  }

  const listening = flow === "listening";
  const caption = error || diag || interim || captured;

  return (
    <div className="fixed inset-0 flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Deco communication environment */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-80 w-[46rem] -translate-x-1/2 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute top-1/4 -left-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute right-[-8rem] top-1/3 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/4 h-64 w-64 rounded-full bg-teal-400/10 blur-3xl" />
        <svg
          className="absolute left-1/2 top-0 h-[320px] w-[48rem] -translate-x-1/2 text-border"
          viewBox="0 0 800 320"
          fill="none"
          stroke="currentColor"
        >
          {/* Radiating sound rings from Maya's mic */}
          {Array.from({ length: 6 }).map((_, i) => (
            <circle
              key={i}
              cx="400"
              cy="160"
              r={24 + i * 27}
              strokeWidth="1"
              strokeDasharray="3 6"
            />
          ))}
          <circle cx="400" cy="160" r="10" className="fill-sky-500/40" stroke="none" />
          <circle cx="400" cy="160" r="3.5" className="fill-sky-500/70" stroke="none" />
          {/* Plosive sound-wave dots travelling out along the rings */}
          {Array.from({ length: 18 }).map((_, i) => {
            const band = i % 6;
            const r = 42 + band * 27;
            const a = (Math.PI * 2 * i) / 18;
            return (
              <circle
                key={i}
                cx={400 + r * Math.cos(a)}
                cy={160 + r * Math.sin(a)}
                r="3.5"
                strokeWidth="1"
                className="text-sky-500/30"
              />
            );
          })}
          {/* Floating speech bubbles */}
          {(
            [
              [96, 56, 168, 48],
              [640, 44, 168, 48],
              [84, 214, 150, 42],
              [616, 224, 176, 42],
            ] as const
          ).map(([x, y, w, h]) => (
            <g key={`${x}-${y}`} className="text-muted-foreground/40">
              <rect x={x} y={y} width={w} height={h} rx={h / 2} strokeWidth="1.2" />
              <path
                d={`M ${x + 22} ${y + h} l -10 14 l 15 -14`}
                fill="currentColor"
                stroke="none"
                opacity="0.3"
              />
              <line
                x1={x + 36}
                y1={y + h / 2}
                x2={x + w - 36}
                y2={y + h / 2}
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity="0.5"
              />
            </g>
          ))}
        </svg>
      </div>
      <AppNavHeader
        sticky
        left={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={stopEverything}
              className="grid size-8 cursor-pointer place-items-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Leave Self Training"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="grid size-9 place-items-center rounded-lg bg-foreground text-background">
              <Mic className="size-4" />
            </span>
            <span>
              <p className="text-sm font-semibold leading-tight">Communication Skills</p>
            </span>
          </div>
        }
      />

      <main className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 gap-4 px-4 pb-40 pt-4">
          {/* Left column: AI (Maya) messages */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-sky-500/20 bg-card/50 shadow-lg shadow-sky-500/5 backdrop-blur">
            <div className="border-b border-sky-500/15 bg-gradient-to-r from-sky-500/10 to-transparent px-4 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-500">
                <span className="size-1.5 rounded-full bg-sky-500" />
                Maya (AI Coach)
              </p>
            </div>
            <div ref={leftScrollRef} className="flex-1 overflow-y-auto p-4 no-scrollbar">
              <div className="flex flex-col gap-3">
                {messages
                  .filter((m) => m.role === "mentor")
                  .map((m) => {
                    const isSpeaking = flow === "speaking" && speakingMsgId === m.id;
                    return (
                      <article key={m.id} className="flex items-start gap-2.5">
                        <img
                          src="/Panelists/Maya.png"
                          alt="Maya"
                          className="mt-1 size-8 shrink-0 rounded-full object-cover"
                        />
                        <div
                          className={`max-w-[90%] rounded-2xl rounded-tl-sm border px-3.5 py-2.5 text-sm leading-relaxed transition-all duration-150 ${
                            isSpeaking
                              ? "border-sky-400/60 bg-sky-500/10 shadow-md shadow-sky-500/20"
                              : "border-border bg-background"
                          }`}
                        >
                          <MayaText text={m.text} activeWord={isSpeaking ? speakingWord : -1} />
                        </div>
                      </article>
                    );
                  })}
                {flow === "thinking" && (
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <img
                      src="/Panelists/Maya.png"
                      alt="Maya"
                      className="size-8 shrink-0 rounded-full object-cover"
                    />
                    <Loader2 className="size-4 animate-spin" />
                    Maya is thinking…
                  </div>
                )}
                {flow === "speaking" && (
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <img
                      src="/Panelists/Maya.png"
                      alt="Maya"
                      className="size-8 shrink-0 rounded-full object-cover"
                    />
                    Maya is speaking…
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center: Video + Mic */}
          <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-4">
            {/* Rotating dashed "sound scope" rings around the camera feed */}
            <div className="pointer-events-none absolute inset-[-12px] hidden md:block">
              <div className="absolute inset-0 animate-[spin_16s_linear_infinite] rounded-[30px] border border-dashed border-sky-400/25" />
              <div className="absolute inset-4 animate-[spin_24s_linear_infinite_reverse] rounded-[26px] border border-dashed border-cyan-400/15" />
            </div>
            <div className="relative h-full w-full rounded-[18px] bg-gradient-to-br from-sky-500/70 via-indigo-500/40 to-cyan-400/70 p-px shadow-2xl shadow-sky-500/25">
              <div className="relative h-full w-full overflow-hidden rounded-[17px] bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full -scale-x-100 object-cover"
                />
                <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur-sm">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-70" />
                    <span className="relative inline-flex size-2 rounded-full bg-sky-400" />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-white/80">
                    Maya is watching
                  </span>
                </div>
                {smileReady && !smiling && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30">
                    <div className="rounded-2xl bg-black/55 px-5 py-2.5 text-center shadow-xl backdrop-blur-sm">
                      <p className="animate-pulse text-xl font-semibold text-white">Smile!</p>
                      <p className="mt-1 text-xs leading-relaxed text-white/85">
                        Just a normal smile — that's all Maya needs
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Floating graphic badges around the feed */}
            <div className="pointer-events-none absolute -left-2 top-12 z-20 hidden animate-pulse-soft lg:block">
              <div className="flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-background/85 px-3 py-1.5 shadow-lg shadow-sky-500/15 backdrop-blur">
                <AudioLines className="size-3.5 text-sky-500" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Hands-free
                </span>
              </div>
            </div>
            <div
              className="pointer-events-none absolute -right-2 top-1/3 z-20 hidden animate-pulse-soft lg:block"
              style={{ animationDelay: "0.9s" }}
            >
              <div className="flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-background/85 px-3 py-1.5 shadow-lg shadow-cyan-500/15 backdrop-blur">
                <MessageSquareText className="size-3.5 text-cyan-500" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Keep it flowing
                </span>
              </div>
            </div>
          </div>

          {/* Right column: User messages */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-indigo-500/20 bg-card/50 shadow-lg shadow-indigo-500/5 backdrop-blur">
            <div className="border-b border-indigo-500/15 bg-gradient-to-l from-indigo-500/10 to-transparent px-4 py-2.5">
              <p className="flex items-center justify-end gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-500">
                You
                <span className="size-1.5 rounded-full bg-indigo-500" />
              </p>
            </div>
            <div ref={rightScrollRef} className="flex-1 overflow-y-auto p-4 no-scrollbar">
              <div className="flex flex-col gap-3">
                {messages
                  .filter((m) => m.role === "user")
                  .map((m) => (
                    <article key={m.id} className="flex justify-end">
                      <div className="max-w-[90%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground">
                        {m.text}
                      </div>
                    </article>
                  ))}
                {flow === "listening" && (captured || interim) && (
                  <article className="flex justify-end">
                    <div className="max-w-[90%] rounded-2xl rounded-tr-sm bg-primary/60 px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground opacity-90">
                      {[captured, interim].filter(Boolean).join(" ")}
                      <span className="ml-0.5 opacity-70">…</span>
                    </div>
                  </article>
                )}
                {flow === "listening" && !captured && !interim && waves && (
                  <article className="flex justify-end">
                    <div className="flex items-center gap-2 rounded-2xl rounded-tr-sm border border-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
                        <span className="relative inline-flex size-2 rounded-full bg-sky-400" />
                      </span>
                      Hearing you — speak now…
                    </div>
                  </article>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center px-4">
          {caption ? (
            <p
              className={`max-w-md truncate rounded-full border bg-background/85 px-4 py-1.5 text-center text-xs backdrop-blur ${
                error ? "border-red-500/40 text-red-500" : "border-border text-muted-foreground"
              }`}
            >
              {caption}
            </p>
          ) : (
            <p className="max-w-md rounded-full border border-transparent px-4 py-1.5 text-center text-xs text-muted-foreground">
              {listening
                ? "Listening hands-free — just speak…"
                : needMicTap
                  ? "Tap the mic button below to let Maya hear you."
                  : flow === "idle" && waitingForUserRef.current
                    ? "Maya is ready — she'll listen automatically."
                    : ""}
            </p>
          )}
        </div>

        <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
          {listening && waves && (
            <div className="flex h-14 items-center gap-[3px]" aria-hidden="true">
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-gradient-to-t from-sky-500 to-cyan-400"
                  style={{
                    height: "100%",
                    animation: `tb-wave ${0.7 + (i % 5) * 0.09}s ease-in-out ${(i % 7) * 0.06}s infinite alternate`,
                    transformOrigin: "center",
                    animationDirection: "alternate",
                    transform: "scaleY(0.3)",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {needMicTap && flow === "idle" && (
          <div className="pointer-events-none absolute bottom-40 left-1/2 z-20 -translate-x-1/2">
            <button
              type="button"
              onClick={toggleListen}
              className="pointer-events-auto flex cursor-pointer flex-col items-center gap-2.5 rounded-3xl border-2 border-sky-500/50 bg-background/95 px-10 py-7 text-foreground shadow-2xl backdrop-blur transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              <span className="relative flex size-4" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-60" />
                <span className="relative inline-flex size-4 rounded-full bg-sky-500" />
              </span>
              <span className="grid size-12 place-items-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/30">
                <Mic className="size-6" />
              </span>
              <span className="text-sm font-semibold">Tap to speak to Maya</span>
              <span className="text-xs text-muted-foreground">
                One tap to allow the mic — then she listens hands-free.
              </span>
            </button>
          </div>
        )}

        {/* Wavy sound graphic — flowing sine lines behind the controls */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-28 overflow-hidden"
          aria-hidden="true"
        >
          {FLOWING_WAVES.map((w, i) => (
            <svg
              key={i}
              className="block h-24 w-[200%]"
              style={{
                position: "absolute",
                top: w.top,
                animation: `tb-slide-x ${w.duration} linear ${w.delay} infinite`,
              }}
              viewBox="0 0 480 96"
              preserveAspectRatio="none"
            >
              <path
                d={buildWavePath(w.amp, w.base)}
                stroke={w.stroke}
                strokeOpacity={w.opacity}
                strokeWidth="2"
                fill="none"
              />
              <path
                d={buildWavePath(w.amp, w.base)}
                stroke={w.stroke}
                strokeOpacity={w.opacity}
                strokeWidth="2"
                fill="none"
                transform="translate(240 0)"
              />
            </svg>
          ))}
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-6">
          {/* Concentric "voice rings" radiating behind the controls */}
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
            <svg
              width="300"
              height="220"
              viewBox="0 0 300 220"
              fill="none"
              stroke="currentColor"
              className="text-sky-500/25"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <circle
                  key={i}
                  cx="150"
                  cy="110"
                  r={30 + i * 26}
                  strokeWidth="1"
                  strokeDasharray="3 6"
                />
              ))}
              <circle cx="150" cy="110" r="4" className="fill-sky-500/40" stroke="none" />
              {Array.from({ length: 8 }).map((_, i) => {
                const a = (Math.PI * 2 * i) / 8;
                return (
                  <line
                    key={i}
                    x1={150 + 42 * Math.cos(a)}
                    y1={110 + 42 * Math.sin(a)}
                    x2={150 + 132 * Math.cos(a)}
                    y2={110 + 132 * Math.sin(a)}
                    strokeWidth="1"
                    className="text-sky-500/15"
                  />
                );
              })}
            </svg>
          </div>
          <div className="relative flex items-center gap-8">
            {/* History circle */}
            <button
              type="button"
              onClick={() => void navigate({ to: "/communication-training-history" })}
              className="pointer-events-auto relative flex size-16 cursor-pointer items-center justify-center rounded-full border-2 border-indigo-500/50 bg-gradient-to-br from-indigo-500/15 to-blue-500/5 text-indigo-600 shadow-lg shadow-indigo-500/20 backdrop-blur transition-all hover:from-indigo-500 hover:to-blue-500 hover:text-white active:scale-95"
              aria-label="Practice history"
            >
              <History className="size-5" />
            </button>

            {/* Mic circle */}
            <div className="relative">
              {listening && (
                <>
                  <span className="absolute -inset-3 animate-ping rounded-full bg-sky-500/25" />
                  <span className="absolute -inset-2 animate-pulse rounded-full bg-sky-500/15" />
                </>
              )}
              {needMicTap && flow === "idle" && (
                <span className="absolute -inset-2 animate-ping rounded-full bg-sky-500/25" />
              )}
              <button
                type="button"
                onClick={toggleListen}
                disabled={flow === "thinking" || flow === "speaking"}
                className={`pointer-events-auto grid size-16 cursor-pointer place-items-center rounded-full border-2 transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                  listening
                    ? "border-sky-500 bg-sky-500 text-white shadow-lg shadow-sky-500/30"
                    : needMicTap
                      ? "border-sky-500 bg-sky-500 text-white shadow-lg shadow-sky-500/30"
                      : "border-sky-500/50 bg-gradient-to-br from-sky-500/15 to-indigo-500/5 text-sky-500 shadow-lg shadow-sky-500/20 hover:from-sky-500 hover:to-indigo-500 hover:text-white"
                }`}
                aria-label={
                  needMicTap ? "Allow microphone and start listening" : "Resume listening"
                }
              >
                <Mic className="size-7" />
              </button>
            </div>

            {/* Tips circle */}
            <button
              type="button"
              onClick={() => void navigate({ to: "/communication-training-tips" })}
              className="pointer-events-auto relative flex size-16 cursor-pointer items-center justify-center rounded-full border-2 border-cyan-500/50 bg-gradient-to-br from-cyan-400/15 to-teal-500/5 text-cyan-600 shadow-lg shadow-cyan-500/20 backdrop-blur transition-all hover:from-cyan-400 hover:to-teal-500 hover:text-white active:scale-95"
              aria-label="Tips"
            >
              <Lightbulb className="size-5" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
