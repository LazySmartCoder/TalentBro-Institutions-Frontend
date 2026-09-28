import { useCallback, useEffect, useRef, useState } from "react";
import { ttsGenerateWithTimings, type TtsVoiceStyle } from "@/lib/api";
import {
  alignWordTimesMs,
  wordIndexAt,
  wordIndexForChar,
  wordStartOffsets,
} from "@/lib/tts-timings";

// Hands-free voice engine for the mock-interview panel, modelled on the
// communication-training loop: each panelist speaks in their own voice through
// Edge TTS (with a browser-voice fallback). The turn order is strictly
// panelist → user → panelist → user. The microphone is acquired as soon as the
// room goes live and its stream is held open for the whole session — only the
// recognizer and the level meter are switched off while a panelist speaks, so
// the candidate never has to unlock or re-grant the mic mid-interview.

const SR_LANGS = ["en-IN", "en-GB", "en-US"] as const;
const IDLE_AUTO_SEND_MS = 2200; // auto-submit after the user stops talking
const SPEECHEND_FLUSH_MS = 2200; // same buffer after the recognizer sees a pause
const REARM_DELAY_MS = 300; // pause before re-opening the mic after speech
const SILENCE_INTERVAL_MS = 80; // analyser sampling period
const STT_TALK_RMS = 0.06; // loudness that counts as the user genuinely talking
const SPEECH_RECENT_MS = 1500; // a reading counts as "speaking now" for this long
const STT_SPEAK_SILENT_MS = 3000; // speaking with zero results → recycle recognizer
const STT_RESULT_IDLE_MS = 12000; // no transcript at all while listening → recycle
const STT_REBUILD_COOLDOWN_MS = 4000;
const SPEECH_WATCHDOG_MIN_MS = 4000;
const SPEECH_WATCHDOG_MS_PER_CHAR = 110;
const SPEECH_WATCHDOG_MARGIN_MS = 5000;
// How long to wait for the backend Edge clip before switching to the browser
// voice — matched to the comm-training flow (where this exact behaviour is
// proven): Edge is primary, the browser voice takes over almost instantly if
// Edge is slow, so the panel is never a beat late.
const EDGE_GRACE_MS = 1200;
// The very first line of a session (Atlas's opening welcome) gets a much
// longer Edge window. A cold Edge server takes 1.5–4s to synthesize a full
// welcome, and on a freshly-mounted page the browser-voice fallback can be
// silently broken — green "Speaking" with no sound at all. Like the GD room,
// which has no handoff timer, we simply wait for Edge here so the first line
// is always actually heard; everything after the first line keeps the fast
// 1200ms handoff proven elsewhere.
const EDGE_FIRST_LINE_GRACE_MS = 6000;

export type PanelFlow = "idle" | "listening" | "speaking" | "thinking";

export type PanelVoice = {
  supported: boolean;
  flow: PanelFlow;
  listening: boolean;
  speaking: string | null;
  // Which message (by id) is currently being read aloud — lets the timeline
  // highlight exactly the transcript line that is speaking, even if the same
  // panelist speaks twice in a row.
  speakingId: number | null;
  // Index of the word currently being spoken (-1 when nothing is speaking),
  // emitted in real time so the transcript can highlight it word-by-word.
  wordIndex: number;
  interim: string;
  captured: string;
  micLevel: number;
  waves: boolean;
  // Set while the panel can't reach any usable voice (Edge failed AND the
  // browser has no TTS voices) — surfaced in the composer so a silent room is
  // diagnosed instead of confusing.
  voiceTrouble: boolean;
  // True while a clip is waiting on the user's first tap/click because the
  // browser blocked its autoplay (the GD-style held-clip mechanism). Surfaced
  // so the composer can say "tap anywhere" instead of pretending to speak.
  awaitedTap: boolean;
  error: string;
  status: string;
};

export type PanelVoiceControls = PanelVoice & {
  speak: (text: string, speaker: string, id?: number) => void;
  toggle: () => void;
  pause: () => void;
};

type QueueItem = { text: string; speaker: string; id?: number };

export function usePanelVoice(opts: {
  enabled: boolean;
  edgeVoiceFor: (speaker: string) => string;
  // Per-speaker delivery offsets so panelists sharing one Edge voice (there is
  // only one usable Indian male voice) still sound like different people.
  voiceStyleFor: (speaker: string) => TtsVoiceStyle;
  browserVoiceFor: (speaker: string) => SpeechSynthesisVoice | undefined;
  onTranscript: (text: string) => void;
}): PanelVoiceControls {
  const edgeVoiceRef = useRef(opts.edgeVoiceFor);
  const voiceStyleRef = useRef(opts.voiceStyleFor);
  const browserVoiceRef = useRef(opts.browserVoiceFor);
  const onTranscriptRef = useRef(opts.onTranscript);
  edgeVoiceRef.current = opts.edgeVoiceFor;
  voiceStyleRef.current = opts.voiceStyleFor;
  browserVoiceRef.current = opts.browserVoiceFor;
  onTranscriptRef.current = opts.onTranscript;

  const supported =
    typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const [flow, setFlow] = useState<PanelFlow>("idle");
  const [interim, setInterim] = useState("");
  const [captured, setCaptured] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [waves, setWaves] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [wordIndex, setWordIndex] = useState(-1);
  const [voiceTrouble, setVoiceTrouble] = useState(false);
  const [awaitedTap, setAwaitedTap] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const enabledRef = useRef(opts.enabled);
  enabledRef.current = opts.enabled;

  const apiRef = useRef<{
    speak: (text: string, speaker: string, id?: number) => void;
    toggle: () => void;
    pause: () => void;
    resume: () => void;
    warm: () => void;
    setEnabled: (v: boolean) => void;
  }>({
    speak: () => {},
    toggle: () => {},
    pause: () => {},
    resume: () => {},
    warm: () => {},
    setEnabled: () => {},
  });

  useEffect(() => {
    let disposed = false;

    const flowRef: { current: PanelFlow } = { current: "idle" };
    const capturedRef = { current: "" };
    const interimRef = { current: "" };
    const wavesRef = { current: false };
    const micLockedRef = { current: true };
    const startedRef = { current: false };
    const speakingRef = { current: false };
    const speakingSpeakerRef = { current: null as string | null };
    const queueRef: { current: QueueItem[] } = { current: [] };
    // The first line spoken after this room mounts (Atlas's opening welcome)
    // is allowed a long Edge stopwatch — see EDGE_FIRST_LINE_GRACE_MS. It flips
    // false as soon as any line has been spoken, so every later line keeps the
    // fast proven handoff.
    const firstLinePendingRef = { current: true };
    const sttBlockedRef = { current: false };
    const srLangIdxRef = { current: 0 };
    const idleTimerRef = { current: null as number | null };
    const rearmTimerRef = { current: null as number | null };
    const micRetryTimerRef = { current: null as number | null };
    const micRetryRef = { current: 0 };
    const lastRebuildAtRef = { current: 0 };
    const lastResultAtRef = { current: 0 };
    const lastSpeechMsRef = { current: 0 };

    let recognition: SpeechRecognitionLike | null = null;
    let spawning = false;

    let recStream: MediaStream | null = null;
    let recAudioCtx: AudioContext | null = null;
    let recAnalyser: AnalyserNode | null = null;
    let recTimer: number | null = null;

    let ttsAudio: HTMLAudioElement | null = null;
    let ttsUrl: string | null = null;
    let ttsAbort: AbortController | null = null;
    let ttsWatchdog: number | null = null;
    let ttsWordPoll: number | null = null;
    let ttsDone: (() => void) | null = null;

    // Clips whose play() was blocked by the browser autoplay policy. The first
    // interaction anywhere on the page replays them — the same pattern the GD
    // room uses, where a held clip resolves the moment the user taps/clicks.
    const pendingGestureSounds = new Set<HTMLAudioElement>();

    const retryGesturePlay = () => {
      for (const a of [...pendingGestureSounds]) {
        void a.play().catch(() => {
          // still blocked — wait for the next real gesture
        });
      }
    };
    const onGestureKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") return;
      retryGesturePlay();
    };
    window.addEventListener("pointerdown", retryGesturePlay);
    window.addEventListener("keydown", onGestureKey);

    // Realtime word-highlighting state: the text currently being spoken plus
    // the char offset each word starts at, so an incoming charIndex (from a
    // speech boundary event or an audio-time estimate) maps to a word ordinal.
    const spokenTextRef = { current: "" };
    const wordStartsRef = { current: [] as number[] };
    const wordIndexRef = { current: -1 };
    const estimateTimerRef = { current: null as number | null };

    function prepareWords(text: string) {
      wordStartsRef.current = wordStartOffsets(text);
      spokenTextRef.current = text;
      wordIndexRef.current = -1;
      setWordIndex(-1);
    }

    function emitWord(ordinal: number) {
      if (ordinal < 0) {
        if (wordIndexRef.current !== -1) {
          wordIndexRef.current = -1;
          setWordIndex(-1);
        }
        return;
      }
      if (ordinal !== wordIndexRef.current) {
        wordIndexRef.current = ordinal;
        setWordIndex(ordinal);
      }
    }

    function emitWordForChar(idx: number) {
      const starts = wordStartsRef.current;
      if (starts.length === 0) return;
      emitWord(wordIndexForChar(starts, idx));
    }

    const setFlowBoth = (next: PanelFlow) => {
      flowRef.current = next;
      setFlow(next);
    };

    const applyWaves = (active: boolean) => {
      if (wavesRef.current === active) return;
      wavesRef.current = active;
      setWaves(active);
    };

    // ---- mic waveform (frontend-only; words come from the Web Speech API) ----

    function sampleAnalyser() {
      // The stream stays open across turns, so never let the panelist's own
      // voice (picked up through the speakers) drive the meter or the
      // "user is talking" signal.
      if (speakingRef.current || currentFlow() === "speaking") return;
      let rms = 0;
      if (recAnalyser) {
        const data = new Uint8Array(recAnalyser.frequencyBinCount);
        recAnalyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = ((data[i] ?? 128) - 128) / 128;
          sum += v * v;
        }
        rms = Math.sqrt(sum / data.length);
      }
      setMicLevel(Math.min(1, rms / 0.35));
      applyWaves(rms > 0.015);
      if (flowRef.current === "listening" && !sttBlockedRef.current && rms >= STT_TALK_RMS) {
        lastSpeechMsRef.current = Date.now();
      } else {
        lastSpeechMsRef.current = 0;
      }
    }

    function stopMicInternals() {
      if (recTimer !== null) {
        window.clearInterval(recTimer);
        recTimer = null;
      }
      if (micRetryTimerRef.current !== null) {
        window.clearTimeout(micRetryTimerRef.current);
        micRetryTimerRef.current = null;
      }
      if (recAudioCtx) {
        void recAudioCtx.close().catch(() => {});
        recAudioCtx = null;
      }
      recAnalyser = null;
      if (recStream) {
        recStream.getTracks().forEach((t) => t.stop());
        recStream = null;
      }
      applyWaves(false);
      setMicLevel(0);
    }

    // While a panelist is speaking the recognizer must be stopped, but the
    // captured stream deliberately stays open. Tearing it down between turns
    // and renegotiating it is exactly what used to lose the mic, so the panel
    // simply holds the stream and only mutes the level meter.
    function holdMicForSpeech() {
      if (recTimer !== null) {
        window.clearInterval(recTimer);
        recTimer = null;
      }
      applyWaves(false);
      setMicLevel(0);
    }

    // Never surface a "tap to allow" dead end: a failure here is either
    // transient (the device was busy, the context was interrupted) or a denial
    // the browser has already cached. Retry quietly with backoff so the mic
    // comes back on its own the moment it can.
    function scheduleMicRetry() {
      if (disposed) return;
      if (micRetryTimerRef.current !== null) return;
      const delay = Math.min(4000, 500 * 2 ** Math.min(micRetryRef.current, 3));
      micRetryRef.current += 1;
      micRetryTimerRef.current = window.setTimeout(() => {
        micRetryTimerRef.current = null;
        if (disposed) return;
        void openMic();
      }, delay);
    }

    // Idempotent: the stream is normally already open, in which case this only
    // restarts the level meter and returns immediately.
    async function openMic(): Promise<boolean> {
      if (disposed) return false;
      if (recStream && recStream.active) {
        micLockedRef.current = false;
        if (micRetryTimerRef.current !== null) {
          window.clearTimeout(micRetryTimerRef.current);
          micRetryTimerRef.current = null;
        }
        micRetryRef.current = 0;
        if (recTimer === null) {
          recTimer = window.setInterval(sampleAnalyser, SILENCE_INTERVAL_MS);
        }
        return true;
      }
      // Either nothing is open yet, or the stream the browser handed us has
      // since ended (device unplugged, track muted). Drop the dead handles
      // before asking for a new one so no context is left dangling.
      stopMicInternals();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return false;
        }
        recStream = stream;
        micLockedRef.current = false;
        micRetryRef.current = 0;
        setError("");
        if (micRetryTimerRef.current !== null) {
          window.clearTimeout(micRetryTimerRef.current);
          micRetryTimerRef.current = null;
        }
        try {
          recAudioCtx = new AudioContext();
          const source = recAudioCtx.createMediaStreamSource(stream);
          recAnalyser = recAudioCtx.createAnalyser();
          recAnalyser.fftSize = 512;
          source.connect(recAnalyser);
        } catch {
          recAudioCtx = null;
          recAnalyser = null;
        }
        if (recTimer === null) {
          recTimer = window.setInterval(sampleAnalyser, SILENCE_INTERVAL_MS);
        }
        return true;
      } catch {
        micLockedRef.current = true;
        scheduleMicRetry();
        return false;
      }
    }

    // ---- TTS (Edge voice per speaker, browser voice fallback) ----

    function stopTts() {
      ttsAbort?.abort();
      ttsAbort = null;
      if (estimateTimerRef.current !== null) {
        window.clearInterval(estimateTimerRef.current);
        estimateTimerRef.current = null;
      }
      if (ttsWordPoll !== null) {
        window.clearInterval(ttsWordPoll);
        ttsWordPoll = null;
      }
      if (ttsAudio) {
        try {
          ttsAudio.pause();
        } catch {
          // noop
        }
        ttsAudio = null;
      }
      if (ttsUrl) {
        URL.revokeObjectURL(ttsUrl);
        ttsUrl = null;
      }
      // Only cancel the browser speech queue when something is actually
      // speaking — unconditional cancel() calls are a known way to wedge
      // Chrome's speechSynthesis into silent failure.
      if (typeof window.speechSynthesis !== "undefined" && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    }

    function finishSpeech() {
      if (ttsWatchdog !== null) {
        window.clearTimeout(ttsWatchdog);
        ttsWatchdog = null;
      }
      stopTts();
      speakingRef.current = false;
      speakingSpeakerRef.current = null;
      setSpeaking(null);
      setSpeakingId(null);
      wordIndexRef.current = -1;
      setWordIndex(-1);
      drain();
    }

    function speakBrowser(text: string, speaker: string, done: () => void) {
      if (typeof window.speechSynthesis === "undefined") {
        console.warn(
          "[panel-voice] this browser has no speechSynthesis — no fallback voice available",
        );
        done();
        return;
      }
      prepareWords(text);
      const synth = window.speechSynthesis;
      const utter = new SpeechSynthesisUtterance(text);
      const selectVoice = () => {
        const voice = browserVoiceRef.current(speaker);
        if (voice) utter.voice = voice;
      };
      selectVoice();
      const voiceCount = synth.getVoices().length;
      console.log(
        `[panel-voice] browser voices: ${voiceCount}, chosen = ${
          utter.voice ? `${utter.voice.name} (${utter.voice.lang})` : "default"
        }`,
      );
      if (!utter.voice && voiceCount === 0) {
        // Voices load asynchronously — pick a gender-matching one when ready.
        const onVoices = () => {
          synth.removeEventListener("voiceschanged", onVoices);
          if (!utter.voice) selectVoice();
        };
        synth.addEventListener("voiceschanged", onVoices);
      }
      // Mirror the panelist's Edge pitch/rate offsets so a browser fallback
      // still sounds like the same person, just via a different engine. Web
      // Speech uses multipliers (1 = normal) rather than Hz/percent, so the
      // offsets are scaled down and kept gentle.
      const style = voiceStyleRef.current(speaker);
      const pitchHz = style.pitchHz ?? 0;
      const ratePct = style.ratePct ?? 0;
      utter.rate = Math.max(0.5, Math.min(1.6, 1.15 * (1 + ratePct / 200)));
      utter.pitch = Math.max(0.6, Math.min(1.6, 1 + pitchHz / 120));

      let said = false;
      const end = () => {
        if (said) return;
        said = true;
        if (estimateTimerRef.current !== null) {
          window.clearInterval(estimateTimerRef.current);
          estimateTimerRef.current = null;
        }
        done();
      };

      // Realtime word highlight for the browser path. Exact boundary events are
      // the source of truth; the estimate never moves before the engine has
      // actually started (utter.onstart), so the highlight can't lead the audio
      // the way an open-ended timer did. The estimate only takes over if
      // boundaries stall for a beat, always continuing from the last exact
      // position so it never jumps the highlight forward.
      const estMs = Math.max(2000, text.length * 90);
      let speechStartAt = 0;
      let lastBoundaryAt = 0;
      let lastBoundaryChar = -1;
      if (estimateTimerRef.current !== null) window.clearInterval(estimateTimerRef.current);
      estimateTimerRef.current = window.setInterval(() => {
        if (!speechStartAt) return;
        const haveBoundaries = lastBoundaryChar >= 0;
        if (haveBoundaries && Date.now() - lastBoundaryAt < 900) return;
        const baseChar = haveBoundaries ? lastBoundaryChar : 0;
        const baseAt = haveBoundaries ? lastBoundaryAt : speechStartAt;
        const est = baseChar + ((Date.now() - baseAt) / estMs) * text.length;
        emitWordForChar(Math.floor(est));
      }, 180);
      utter.onboundary = (e: SpeechSynthesisEvent) => {
        if (typeof e.charIndex === "number" && e.charIndex >= 0) {
          lastBoundaryAt = Date.now();
          lastBoundaryChar = e.charIndex;
          emitWordForChar(e.charIndex);
        }
      };
      utter.onstart = () => {
        speechStartAt = Date.now();
        lastBoundaryAt = speechStartAt;
        setVoiceTrouble(false);
      };
      utter.onend = end;
      utter.onerror = end;

      // Mirrors the proven communication-training fallback: cancel() then
      // speak() immediately in the same tick, brisk rate.
      synth.cancel();
      try {
        synth.speak(utter);
      } catch {
        end();
      }
    }

    function speakItem(item: QueueItem) {
      speakingRef.current = true;
      speakingSpeakerRef.current = item.speaker;
      setSpeaking(item.speaker);
      setSpeakingId(item.id ?? null);
      // The backend strips the text before synthesizing it and reports word
      // offsets against that stripped copy, so speak, index and align against
      // the same string — otherwise every offset would be shifted.
      const line = item.text.trim();
      prepareWords(line);
      setFlowBoth("speaking");
      closeForSpeech();

      let finished = false;
      let fellBack = false;
      let awaitingGesture = false;
      setVoiceTrouble(false);
      const done = () => {
        if (finished) return;
        finished = true;
        if (ttsDone === done) ttsDone = null;
        finishSpeech();
      };
      ttsDone = done;

      const stillCurrent = () => ttsDone === done;
      const voicesEmpty = () =>
        typeof window.speechSynthesis !== "undefined" &&
        window.speechSynthesis.getVoices().length === 0;
      const fallbackBrowser = () => {
        if (!stillCurrent() || fellBack) return;
        fellBack = true;
        if (voicesEmpty()) {
          setVoiceTrouble(true);
          console.warn(
            `[panel-voice] Edge failed and the browser has no TTS voices — nothing can speak audibly. Check that the app server is running and the OS has an English voice.`,
          );
        }
        console.log(
          `[panel-voice] falling back to browser voice for "${item.speaker}" (${item.text.slice(0, 40)}…)`,
        );
        speakBrowser(line, item.speaker, done);
      };

      console.log(`[panel-voice] speaking as "${item.speaker}": ${item.text.slice(0, 60)}…`);

      const scheduleWatchdog = () => {
        if (ttsWatchdog !== null) window.clearTimeout(ttsWatchdog);
        const waitMs =
          Math.max(SPEECH_WATCHDOG_MIN_MS, line.length * SPEECH_WATCHDOG_MS_PER_CHAR) +
          SPEECH_WATCHDOG_MARGIN_MS;
        ttsWatchdog = window.setTimeout(() => {
          ttsWatchdog = null;
          if (awaitingGesture) {
            // The clip is blocked until the user interacts — keep waiting
            // instead of silently finishing a line that was never heard.
            scheduleWatchdog();
            return;
          }
          const ttsLive = ttsAudio !== null && !ttsAudio.paused && !ttsAudio.ended;
          const synthLive =
            typeof window.speechSynthesis !== "undefined" && window.speechSynthesis.speaking;
          if (ttsLive || synthLive) {
            scheduleWatchdog();
            return;
          }
          if (!fellBack) {
            console.warn(
              `[panel-voice] watchdog: no audible speaker ("${item.speaker}") — finishing line`,
            );
          }
          done();
        }, waitMs);
      };
      scheduleWatchdog();

      const controller = new AbortController();
      ttsAbort = controller;
      const firstLineGrace = firstLinePendingRef.current;
      firstLinePendingRef.current = false;
      const graceMs = firstLineGrace ? EDGE_FIRST_LINE_GRACE_MS : EDGE_GRACE_MS;
      const failTimer = window.setTimeout(() => {
        if (!stillCurrent()) return;
        controller.abort();
        console.warn(
          `[panel-voice] Edge TTS for "${item.speaker}" exceeded ${graceMs}ms grace — falling back to browser voice`,
        );
        fallbackBrowser();
      }, graceMs);

      void (async () => {
        let audio: HTMLAudioElement | null = null;
        try {
          const { url, wordTimes } = await ttsGenerateWithTimings(
            line,
            edgeVoiceRef.current(item.speaker),
            voiceStyleRef.current(item.speaker),
          );
          if (!stillCurrent() || controller.signal.aborted) {
            URL.revokeObjectURL(url);
            return;
          }
          window.clearTimeout(failTimer);
          audio = new Audio(url);
          audio.preload = "auto";
          audio.volume = 1;
          audio.muted = false;
          ttsAudio = audio;
          ttsUrl = url;
          // Realtime word highlight for the Edge path. The backend returns the
          // exact start time of every word, so the highlight can only move once
          // the clip has actually reached that word. Spreading it evenly over
          // the characters instead would race ahead of the voice through the
          // pauses at punctuation and then never catch up.
          const wordTimesMs = alignWordTimesMs(line, wordTimes);
          const updateFromTime = () => {
            if (!audio) return;
            if (wordTimesMs) {
              const next = wordIndexAt(wordTimesMs, audio.currentTime * 1000);
              if (next < 0) {
                emitWord(-1);
                return;
              }
              emitWord(next);
              return;
            }
            // No timings from the backend: keep a proportional estimate so the
            // highlight still tracks the voice rather than freezing.
            if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
            const p = Math.min(1, audio.currentTime / audio.duration);
            emitWordForChar(Math.floor(p * line.length));
          };
          audio.addEventListener("timeupdate", updateFromTime);
          // timeupdate only fires roughly four times a second, which is too
          // coarse to land on individual words. Poll while the clip plays.
          const wordPoll = window.setInterval(() => {
            if (!audio || audio.paused || audio.ended) return;
            updateFromTime();
          }, 60);
          const stopWordPoll = () => {
            window.clearInterval(wordPoll);
            if (ttsWordPoll !== null) ttsWordPoll = null;
          };
          ttsWordPoll = wordPoll;
          audio.addEventListener("ended", stopWordPoll);
          audio.addEventListener("error", stopWordPoll);
          audio.onended = () => done();
          audio.onerror = () => {
            if (ttsUrl) {
              URL.revokeObjectURL(ttsUrl);
              ttsUrl = null;
            }
            fallbackBrowser();
          };
          try {
            await audio.play();
            setVoiceTrouble(false);
          } catch (err) {
            if (!stillCurrent()) return;
            const name = (err as { name?: string } | null)?.name;
            const blocked = name === "NotAllowedError" || name === "AbortError";
            if (!blocked) {
              window.clearTimeout(failTimer);
              fallbackBrowser();
              return;
            }
            // Browsers block the very first play() until the page has seen a
            // user gesture. Same fix as the GD room: hold this exact clip in
            // pendingGestureSounds and the pointer/key handlers above replay
            // it the instant any interaction lands — a gesture that cannot be
            // blocked — instead of switching to browser speech, which can be
            // silently broken on a cold start too.
            console.warn(
              `[panel-voice] first play blocked for "${item.speaker}" — will speak on your first tap/click`,
            );
            awaitingGesture = true;
            pendingGestureSounds.add(audio);
            setAwaitedTap(true);
            const el: HTMLAudioElement = audio;
            let gestureErrored = false;
            await new Promise<void>((resolve) => {
              const finish = () => {
                pendingGestureSounds.delete(el);
                window.clearInterval(poll);
                el.removeEventListener("play", onPlay);
                el.removeEventListener("error", onError);
                setAwaitedTap(false);
                resolve();
              };
              const onPlay = () => finish();
              const onError = () => {
                gestureErrored = true;
                finish();
              };
              const poll = window.setInterval(() => {
                if (!stillCurrent()) finish();
              }, 200);
              el.addEventListener("play", onPlay, { once: true });
              el.addEventListener("error", onError, { once: true });
            });
            awaitingGesture = false;
            if (gestureErrored) {
              window.clearTimeout(failTimer);
              fallbackBrowser();
              return;
            }
            if (!stillCurrent()) return;
          }
        } catch (err) {
          if (!stillCurrent()) return;
          window.clearTimeout(failTimer);
          if (!fellBack) {
            console.warn(
              `[panel-voice] Edge TTS failed for "${item.speaker}":`,
              err instanceof Error ? err.message : err,
            );
            fallbackBrowser();
          }
        }
      })();
    }

    function drain() {
      if (disposed) return;
      if (speakingRef.current) return;
      const next = queueRef.current.shift();
      if (next) {
        speakItem(next);
        return;
      }
      // Nothing left to say — hand the floor back to the candidate.
      if (enabledRef.current && flowRef.current !== "idle") {
        scheduleRearm();
      } else if (flowRef.current === "speaking") {
        setFlowBoth("idle");
      }
    }

    // ---- STT (browser Web Speech API, auto-arming) ----

    function closeForSpeech() {
      sttBlockedRef.current = true;
      holdMicForSpeech();
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      if (recognition) {
        try {
          recognition.stop();
        } catch {
          // noop
        }
      }
    }

    function submitCaptured() {
      const text = capturedRef.current.trim() || interimRef.current.trim();
      capturedRef.current = "";
      interimRef.current = "";
      setCaptured("");
      setInterim("");
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      sttBlockedRef.current = true;
      holdMicForSpeech();
      if (recognition) {
        try {
          recognition.stop();
        } catch {
          // noop
        }
      }
      if (!text) {
        setFlowBoth("idle");
        return;
      }
      setFlowBoth("thinking");
      onTranscriptRef.current(text);
    }

    function scheduleRearm() {
      if (disposed) return;
      if (rearmTimerRef.current !== null) window.clearTimeout(rearmTimerRef.current);
      setFlowBoth("idle");
      rearmTimerRef.current = window.setTimeout(() => {
        rearmTimerRef.current = null;
        if (disposed || speakingRef.current) return;
        if (!enabledRef.current) return;
        // startListening re-acquires the mic itself, so a stream that dropped
        // mid-answer is simply reopened — never a reason to stop listening.
        startListening();
      }, REARM_DELAY_MS);
    }

    function bind(instance: SpeechRecognitionLike) {
      instance.continuous = true;
      instance.interimResults = true;
      instance.maxAlternatives = 3;
      instance.lang = SR_LANGS[srLangIdxRef.current] ?? "en-IN";

      instance.onstart = () => {
        if (sttBlockedRef.current || speakingRef.current) {
          try {
            instance.stop();
          } catch {
            // noop
          }
          return;
        }
        startedRef.current = true;
        lastResultAtRef.current = Date.now();
        applyWaves(false);
        setError("");
      };

      instance.onresult = (event: SpeechRecognitionEventLike) => {
        startedRef.current = true;
        lastResultAtRef.current = Date.now();
        if (sttBlockedRef.current || flowRef.current !== "listening") return;
        let finals = "";
        let interims = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result?.[0]?.transcript ?? "";
          if (result?.isFinal) finals += text;
          else interims += text;
        }
        if (finals) {
          capturedRef.current = (capturedRef.current + " " + finals).trim();
          setCaptured(capturedRef.current);
        }
        interimRef.current = interims.trim();
        setInterim(interimRef.current);
        if (finals || interims.trim()) applyWaves(true);
        if (capturedRef.current || interimRef.current) {
          if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
          idleTimerRef.current = window.setTimeout(submitCaptured, IDLE_AUTO_SEND_MS);
        }
      };

      if (typeof instance.onspeechend !== "undefined" || "onspeechend" in (instance as object)) {
        instance.onspeechend = () => {
          if (
            flowRef.current === "listening" &&
            !sttBlockedRef.current &&
            (capturedRef.current.trim() || interimRef.current.trim())
          ) {
            if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
            idleTimerRef.current = window.setTimeout(submitCaptured, SPEECHEND_FLUSH_MS);
          }
        };
      }

      instance.onerror = (event: SpeechRecognitionErrorEventLike) => {
        const code = event.error;
        if (code === "not-allowed" || code === "service-not-allowed") {
          // A hard denial. Re-open the stream quietly in case it recovers, and
          // say only what is true — the mic is blocked at the browser level.
          micLockedRef.current = true;
          setFlowBoth("idle");
          setError("Your browser is blocking microphone access for this site.");
        } else if (code === "no-speech") {
          if (capturedRef.current.trim() || interimRef.current.trim()) {
            if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
            idleTimerRef.current = window.setTimeout(submitCaptured, SPEECHEND_FLUSH_MS);
          }
        } else if (code === "audio-capture") {
          setError("No microphone found. Check your mic and speaker settings.");
        } else if (code === "language-not-supported") {
          if (srLangIdxRef.current < SR_LANGS.length - 1) {
            srLangIdxRef.current += 1;
            try {
              instance.lang = SR_LANGS[srLangIdxRef.current] ?? "en-IN";
            } catch {
              // noop
            }
          }
        }
      };

      instance.onend = () => {
        applyWaves(false);
        if (
          flowRef.current === "listening" &&
          !sttBlockedRef.current &&
          (capturedRef.current.trim() || interimRef.current.trim())
        ) {
          submitCaptured();
          return;
        }
        if (
          !disposed &&
          startedRef.current &&
          !sttBlockedRef.current &&
          flowRef.current === "listening"
        ) {
          spawnRecognizer("onend");
        }
      };
    }

    function spawnRecognizer(cause: string) {
      if (spawning) return;
      if (cause !== "init" && Date.now() - lastRebuildAtRef.current < STT_REBUILD_COOLDOWN_MS) {
        return;
      }
      if (sttBlockedRef.current || flowRef.current !== "listening") return;
      const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (!SR) return;
      spawning = true;
      lastRebuildAtRef.current = Date.now();
      try {
        recognition?.abort();
      } catch {
        // noop
      }
      recognition = new SR();
      bind(recognition);
      startedRef.current = false;
      lastResultAtRef.current = Date.now();
      if (!startRecognizer() && micLockedRef.current) scheduleMicRetry();
      spawning = false;
      void cause;
    }

    // Starting the recognizer can fail for a transient reason that has nothing
    // to do with permissions: the previous session's stop()/abort() resolves
    // asynchronously, so a start() in the same tick throws InvalidStateError.
    // That must never be reported as a blocked mic, or the panel silently stops
    // listening and demands a tap.
    function startRecognizer(): boolean {
      if (!recognition) return false;
      try {
        recognition.start();
        return true;
      } catch {
        return false;
      }
    }

    // Read through a call so the flow can't be narrowed across an await: while
    // getUserMedia is pending, a panelist line can start or the room can pause.
    const currentFlow = (): PanelFlow => flowRef.current;

    async function startListening() {
      if (disposed || speakingRef.current) return;
      if (!enabledRef.current) return;
      if (currentFlow() === "listening") return;
      capturedRef.current = "";
      interimRef.current = "";
      setCaptured("");
      setInterim("");
      applyWaves(false);
      setError("");
      startedRef.current = false;
      lastResultAtRef.current = Date.now();
      lastSpeechMsRef.current = 0;
      sttBlockedRef.current = false;
      setFlowBoth("listening");

      // Open the mic BEFORE starting the recognizer: micLockedRef only becomes
      // trustworthy once this settles, and a failure here must not be mistaken
      // for a permission the user has to fix by tapping.
      await openMic();
      if (disposed || speakingRef.current || !enabledRef.current) {
        holdMicForSpeech();
        return;
      }
      if (currentFlow() !== "listening") {
        holdMicForSpeech();
        return;
      }

      const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (!SR) return;
      if (!recognition) {
        recognition = new SR();
        bind(recognition);
      }
      try {
        recognition.lang = SR_LANGS[srLangIdxRef.current] ?? "en-IN";
      } catch {
        // noop
      }
      try {
        recognition.abort();
      } catch {
        // noop
      }
      if (startRecognizer()) return;
      // Still tearing down the previous session — retry shortly. From there
      // onstart / the watchdog own the lifecycle.
      window.setTimeout(() => {
        if (disposed || speakingRef.current) return;
        if (currentFlow() !== "listening") return;
        startRecognizer();
      }, 150);
    }

    // Watchdog: the waveform is ground truth for "the user is talking". If the
    // recognizer is running but silent while the mic clearly hears speech,
    // recycle it so "listening" always really transcribes.
    const watchdog = window.setInterval(() => {
      if (disposed) return;
      if (flowRef.current !== "listening" || sttBlockedRef.current || speakingRef.current) return;
      const now = Date.now();
      if (!startedRef.current) {
        if (!micLockedRef.current && now - lastRebuildAtRef.current >= STT_REBUILD_COOLDOWN_MS) {
          spawnRecognizer("never-started");
        }
        return;
      }
      const speakingNow =
        lastSpeechMsRef.current !== 0 && now - lastSpeechMsRef.current < SPEECH_RECENT_MS;
      if (speakingNow && now - lastResultAtRef.current >= STT_SPEAK_SILENT_MS) {
        spawnRecognizer("speaking-but-silent");
        return;
      }
      if (now - lastResultAtRef.current >= STT_RESULT_IDLE_MS) {
        spawnRecognizer("quiet-timeout");
      }
    }, 3000);

    apiRef.current.speak = (text: string, speaker: string, id?: number) => {
      const clean = text.trim();
      if (!clean) return;
      const item: QueueItem = { text: clean, speaker };
      if (id !== undefined) item.id = id;
      queueRef.current.push(item);
      drain();
    };

    apiRef.current.toggle = () => {
      if (flowRef.current === "listening") {
        if (rearmTimerRef.current !== null) {
          window.clearTimeout(rearmTimerRef.current);
          rearmTimerRef.current = null;
        }
        sttBlockedRef.current = true;
        stopMicInternals();
        if (recognition) {
          try {
            recognition.stop();
          } catch {
            // noop
          }
        }
        setCaptured("");
        setInterim("");
        setFlowBoth("idle");
        return;
      }
      if (flowRef.current === "idle" || flowRef.current === "thinking") {
        setError("");
        enabledRef.current = true;
        startListening();
      }
    };

    apiRef.current.pause = () => {
      if (rearmTimerRef.current !== null) {
        window.clearTimeout(rearmTimerRef.current);
        rearmTimerRef.current = null;
      }
      if (flowRef.current === "listening") {
        sttBlockedRef.current = true;
        // Hold the stream: a break or the ice-break pause must not renegotiate
        // the mic, which is what used to drop it. The tracks are released when
        // the room unmounts.
        holdMicForSpeech();
        if (recognition) {
          try {
            recognition.stop();
          } catch {
            // noop
          }
        }
        setCaptured("");
        setInterim("");
      }
      if (flowRef.current !== "speaking") setFlowBoth("idle");
    };

    apiRef.current.resume = () => {
      if (disposed || speakingRef.current) return;
      if (queueRef.current.length > 0) return;
      if (flowRef.current === "listening" || flowRef.current === "speaking") return;
      scheduleRearm();
    };

    // Acquire the stream as soon as the room goes live rather than waiting for
    // the first turn: the mic is then already open and permitted before
    // anything is spoken, and it stays open for the whole interview.
    apiRef.current.warm = () => {
      void openMic();
    };

    apiRef.current.setEnabled = (v: boolean) => {
      enabledRef.current = v;
    };

    return () => {
      disposed = true;
      window.clearInterval(watchdog);
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
      if (rearmTimerRef.current !== null) window.clearTimeout(rearmTimerRef.current);
      if (micRetryTimerRef.current !== null) window.clearTimeout(micRetryTimerRef.current);
      if (ttsWatchdog !== null) window.clearTimeout(ttsWatchdog);
      window.removeEventListener("pointerdown", retryGesturePlay);
      window.removeEventListener("keydown", onGestureKey);
      for (const a of [...pendingGestureSounds]) {
        try {
          a.pause();
        } catch {
          // noop
        }
      }
      pendingGestureSounds.clear();
      stopMicInternals();
      stopTts();
      try {
        recognition?.abort();
      } catch {
        // noop
      }
      recognition = null;
      ttsDone = null;
      queueRef.current = [];
    };
  }, []);

  const enabled = opts.enabled;
  useEffect(() => {
    apiRef.current.setEnabled(enabled);
    if (!enabled) {
      apiRef.current.pause();
    } else {
      apiRef.current.warm();
      apiRef.current.resume();
    }
  }, [enabled]);

  const speak = useCallback((text: string, speaker: string, id?: number) => {
    apiRef.current.speak(text, speaker, id);
  }, []);
  const toggle = useCallback(() => {
    apiRef.current.toggle();
  }, []);
  const pause = useCallback(() => {
    apiRef.current.pause();
  }, []);

  return {
    supported,
    flow,
    listening: flow === "listening",
    speaking,
    speakingId,
    wordIndex,
    interim,
    captured,
    micLevel,
    waves,
    voiceTrouble,
    awaitedTap,
    error,
    status,
    speak,
    toggle,
    pause,
  };
}
