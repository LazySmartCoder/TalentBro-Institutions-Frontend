import { useEffect, useRef, useState } from "react";
import { AudioLines, Loader2, Mic } from "lucide-react";
import { GridField } from "@/components/graphics";
import { ProctorCamera } from "@/components/proctor-camera";
import { usePanelVoice, type PanelVoiceControls } from "@/lib/panel-voice";

type Member = {
  id: string;
  name: string;
  role: string;
  mark: string;
  ai: boolean;
  img?: string;
};

const members: Member[] = [
  {
    id: "albert",
    name: "Albert",
    role: "Technical Architect",
    mark: "A",
    ai: true,
    img: "/Panelists/Albert.png",
  },
  {
    id: "peter",
    name: "Peter",
    role: "Management & Leadership",
    mark: "P",
    ai: true,
    img: "/Panelists/Peter.png",
  },
  {
    id: "daniel",
    name: "Daniel",
    role: "Decision Science",
    mark: "D",
    ai: true,
    img: "/Panelists/Daniel.png",
  },
  {
    id: "maya",
    name: "Maya",
    role: "Communication & HR",
    mark: "M",
    ai: true,
    img: "/Panelists/Maya.png",
  },
  {
    id: "ada",
    name: "Ada",
    role: "Analytical & Logical Thinking",
    mark: "Ad",
    ai: true,
    img: "/Panelists/Ada.png",
  },
  {
    id: "carl",
    name: "Carl",
    role: "Behavioral Intelligence",
    mark: "C",
    ai: true,
    img: "/Panelists/Carl.png",
  },
  { id: "atlas", name: "Atlas", role: "Integrity Monitor", mark: "At", ai: true, img: "/Panelists/Atlas.jpg" },
  { id: "you", name: "You", role: "Candidate", mark: "CA", ai: false },
];

const byId = (id: string) => members.find((m) => m.id === id) ?? members[members.length - 1]!;

// Every panelist speaks Indian English on Edge TTS — Atlas (the host) included
// — so the whole panel carries one familiar accent for the candidate. Each
// short-name is verified in the backend gender map; the only male/female
// Indian voices this Edge endpoint actually serves are en-IN-PrabhatNeural and
// the "neerja" family, so the panel maps directly to those (no American or
// British accents, and no wasted retries on unavailable voices). Maya keeps
// the same warm "neerja" voice she uses in Communication Training.
const PANELIST_EDGE_VOICE: Record<string, string> = {
  albert: "en-IN-PrabhatNeural", // Indian male
  peter: "en-IN-PrabhatNeural", // Indian male
  daniel: "en-IN-PrabhatNeural", // Indian male
  carl: "en-IN-PrabhatNeural", // Indian male
  atlas: "en-IN-PrabhatNeural", // Indian male host
  maya: "neerja", // en-IN female — same as the comm coach
  ada: "neerja", // en-IN female
};

const PANELIST_GENDER: Record<string, "male" | "female"> = {
  albert: "male",
  peter: "male",
  daniel: "male",
  carl: "male",
  atlas: "male",
  maya: "female",
  ada: "female",
};

const DEFAULT_EDGE_VOICE = "en-IN-PrabhatNeural";

// GD-style ice break: the moment a session starts we let the room settle for
// a beat before the opening welcome is read aloud, so Atlas never starts
// talking the instant the user lands.
const ICE_BREAK_MS = 400;

export function panelistEdgeVoice(speaker: string): string {
  return PANELIST_EDGE_VOICE[speaker] ?? DEFAULT_EDGE_VOICE;
}

// Browser-voice fallback for each panelist's gender, so a slow/unavailable
// Edge clip never leaves the panel silent. Indian English is preferred first
// (Windows natural voices expose "Aneesh" / "Neerja" in en-IN), then a
// same-gender British/US voice — the panel never drifts to a randomly
// gendered, non-Indian accent unless the OS genuinely has no Indian voice.
function panelistBrowserVoice(speaker: string): SpeechSynthesisVoice | undefined {
  const voices =
    typeof window.speechSynthesis !== "undefined" ? window.speechSynthesis.getVoices() : [];
  const gender = PANELIST_GENDER[speaker] ?? "male";
  const isMatch = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    if (gender === "female") {
      return (
        n.includes("female") ||
        n.includes("neerja") ||
        n.includes("kavya") ||
        n.includes("reema") ||
        n.includes("priya") ||
        n.includes("isha") ||
        n.includes("samantha") ||
        n.includes("zira") ||
        n.includes("tessa") ||
        n.includes("moira")
      );
    }
    return (
      n.includes("male") ||
      n.includes("prabhat") ||
      n.includes("aarav") ||
      n.includes("arjun") ||
      n.includes("aneesh") ||
      n.includes("daniel") ||
      n.includes("ryan") ||
      n.includes("christopher") ||
      n.includes("david") ||
      n.includes("mark")
    );
  };
  const byLang = (lang: string) =>
    voices.find((v) => v.lang.toLowerCase().startsWith(lang) && isMatch(v));
  const indian = byLang("en-in");
  if (indian) return indian;
  return (
    byLang("en-gb") ?? byLang("en-us") ?? voices.find((v) => v.lang.startsWith("en") && isMatch(v))
  );
}

const PANELIST_JUDGING: Record<string, { title: string; judges: string[]; tip: string }> = {
  atlas: {
    title: "Session Host & Integrity Monitor",
    judges: [
      "Overall session flow and structure",
      "Interview integrity and fairness",
      "Time management and pacing",
      "Final assessment and wrap-up",
    ],
    tip: "Atlas ensures the interview stays on track. He will step in if anything goes off course.",
  },
  maya: {
    title: "Communication & HR",
    judges: [
      "Communication clarity and articulation",
      "Behavioural responses and situational judgement",
      "Teamwork and interpersonal skills",
      "Handling workplace conflicts and pressure",
      "HR and cultural fit assessment",
    ],
    tip: "Maya wants real examples from your life — not textbook answers. Be specific about your experiences.",
  },
  albert: {
    title: "Technical Architect",
    judges: [
      "Technical depth and domain knowledge",
      "System design and architecture thinking",
      "Implementation understanding — not just definitions",
      "Problem-solving approach to technical challenges",
      "Ability to explain complex concepts simply",
    ],
    tip: "Albert expects you to explain things in your own words. He values 'can you actually do it?' over 'do you know the words'.",
  },
  peter: {
    title: "Management & Leadership",
    judges: [
      "Leadership initiative and ownership",
      "Team management and decision-making",
      "Handling disagreements with authority",
      "Taking responsibility vs following instructions",
      "Prioritisation under pressure",
    ],
    tip: "Peter looks for real ownership — not just compliance. He wants to see if you can lead, not just follow.",
  },
  daniel: {
    title: "Decision Science & Analytics",
    judges: [
      "Data-driven thinking and analytical reasoning",
      "Product sense and domain awareness",
      "Quantitative decision-making",
      "Impact measurement — real numbers, not vague claims",
      "Evidence-based judgment",
    ],
    tip: "Daniel expects concrete numbers and metrics. 'I improved performance' is not enough — by how much? What was the baseline?",
  },
  ada: {
    title: "Analytical & Logical Thinking",
    judges: [
      "Structured problem-solving approach",
      "Logical reasoning and clarity of thought",
      "Handling ambiguity and uncertainty",
      "Breaking complex problems into components",
      "Quality of reasoning process, not just the answer",
    ],
    tip: "Ada is less interested in the final answer and more interested in HOW you think. Explain your reasoning out loud.",
  },
  carl: {
    title: "Behavioral Intelligence & Cultural Fit",
    judges: [
      "Self-awareness and honesty",
      "Adaptability and learning orientation",
      "Values and work ethic",
      "Handling personal challenges and failures",
      "Genuine motivation vs performative answers",
    ],
    tip: "Carl listens between the lines. He values honesty and self-awareness over polished, rehearsed answers.",
  },
};

export type PanelMsg = { id: number; from: string; text: string; time: string };

export function Avatar({ m, size = "md" }: { m: Member; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  return (
    <div
      className={`${dim} relative shrink-0 overflow-hidden rounded-full border ${
        m.ai ? "border-border" : "border-foreground bg-foreground"
      }`}
    >
      {m.img ? (
        <img src={m.img} alt={m.name} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[10px] tracking-[0.1em] text-muted-foreground">
          {m.mark}
        </span>
      )}
    </div>
  );
}

// Panelist message body. While a line is being read aloud, `activeWord` is the
// ordinal of the word currently being spoken (driven by live speech-boundary
// events / audio progress), and that word lights up in real time. Uses the same
// /\S+/ segmentation the voice engine uses, so ordinals always line up.
function MessageText({
  text,
  isAi,
  activeWord,
}: {
  text: string;
  isAi: boolean;
  activeWord: number | undefined;
}) {
  if (!isAi || typeof activeWord !== "number" || activeWord < 0) {
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
                ? "rounded-[2px] bg-foreground/15 text-foreground transition-colors duration-150"
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

export function PanelRoom({
  candidateName = "You",
  candidateAvatar,
  context = "Mock Interview",
  messages = [],
  loading = false,
  done = false,
  panelists,
  paused = false,
  breakLeft = 0,
  suspection = 0,
  onViolation,
  onSend,
  onExit,
  onViewAnalysis,
  durationMinutes,
  startedAt,
}: {
  candidateName?: string;
  candidateAvatar?: string | undefined;
  context?: string;
  messages?: PanelMsg[];
  loading?: boolean;
  done?: boolean;
  panelists?: string[] | undefined;
  paused?: boolean;
  breakLeft?: number;
  suspection?: number;
  onViolation?: (() => void) | undefined;
  onSend?: (text: string) => void;
  onExit?: () => void;
  onLockViolation?: () => void;
  onViewAnalysis?: () => void;
  durationMinutes?: number | undefined;
  startedAt?: string | undefined;
}) {
  const [draft, setDraft] = useState("");
  const [channel, setChannel] = useState<"live-interview" | "role-brief" | "feedback">(
    "live-interview",
  );
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // True for the first ICE_BREAK_MS of a mounted room: the mic stays closed and
  // nothing speaks, so a fresh session settles before the panel opens.
  const [iceBreak, setIceBreak] = useState(true);

  const startedMs = startedAt ? new Date(startedAt).getTime() : 0;
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!durationMinutes || !Number.isFinite(startedMs)) return;
    const iv = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, [durationMinutes, startedMs]);
  const timeLeft =
    durationMinutes && startedMs > 0
      ? Math.max(0, durationMinutes * 60_000 - (nowTick - startedMs))
      : null;
  const timeLeftLabel =
    timeLeft === null
      ? null
      : `${Math.floor(timeLeft / 60_000)}m ${String(Math.floor((timeLeft % 60_000) / 1000)).padStart(2, "0")}s`;

  const candidate: Member = {
    ...byId("you"),
    name: candidateName,
    mark: candidateName.slice(0, 2).toUpperCase(),
    ...(candidateAvatar ? { img: candidateAvatar } : {}),
  };

  const roomMembers = [
    candidate,
    ...members.filter((m) => m.ai && (panelists ? panelists.includes(m.id) : true)),
  ];
  const inRoomCount = roomMembers.filter((m) => m.ai).length;

  // Hands-free panel loop (comm-training style): every panelist's line is read
  // aloud in their own voice, then the mic re-opens automatically so the
  // candidate answers by voice. Strict turn order — panelist → you → panelist →
  // you — because the mic stays closed while any panelist is speaking and only
  // re-arms once the speech queue drains.
  const voice = usePanelVoice({
    enabled: !done && !paused && channel === "live-interview" && !iceBreak,
    edgeVoiceFor: panelistEdgeVoice,
    browserVoiceFor: panelistBrowserVoice,
    onTranscript: (text) => onSend?.(text),
  });

  // Which messages have already been read aloud, so a transcript is never
  // replayed on re-render (or spoken twice when history is loaded).
  const spokenRef = useRef<Set<number>>(new Set());
  const spokenInitRef = useRef(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const channelRef = useRef(channel);
  channelRef.current = channel;
  const doneRef = useRef(done);
  doneRef.current = done;
  const iceBreakRef = useRef(true);

  // On open, mark every existing line as read and voice the trailing block of
  // panelist lines still waiting for an answer — so rejoining a mid-interview
  // session (or opening a fresh one) is never silent, and the host/panelists
  // who spoke recently are actually heard through the same proven Edge→browser
  // path used for later lines. Like the GD room, the opening line is preceded
  // by a short ice break (ICE_BREAK_MS) so Atlas starts talking a beat after
  // the user lands. This timer is deliberately mount-once (NOT keyed on the
  // messages array, which the route reconstructs on every render), so no
  // re-render can cancel the pause or strand the room on the "getting ready"
  // placeholder with the welcome already on screen.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIceBreak(false);
      iceBreakRef.current = false;
      const view = messagesRef.current;
      if (view.length === 0) return; // late transcripts are voiced below
      if (spokenInitRef.current) return;
      spokenInitRef.current = true;
      view.forEach((m) => spokenRef.current.add(m.id));
      if (doneRef.current || channelRef.current !== "live-interview") return;
      let lastIdx = -1;
      view.forEach((m, i) => {
        if (m.from === "you") lastIdx = i;
      });
      view
        .filter((m, i) => i > lastIdx && m.from !== "you" && !m.text.startsWith("\u26a0"))
        .slice(-3)
        .forEach((m) => {
          if (view.indexOf(m) > lastIdx) voice.speak(m.text, m.from, m.id);
        });
    }, ICE_BREAK_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Transcripts that arrive after the ice-break pause (a session whose
  // messages were still being fetched) are voiced the moment they land.
  useEffect(() => {
    if (spokenInitRef.current || messages.length === 0) return;
    if (iceBreakRef.current) return;
    spokenInitRef.current = true;
    messages.forEach((m) => spokenRef.current.add(m.id));
    const lastUserIdx = messages.reduce((acc, m, i) => (m.from === "you" ? i : acc), -1);
    messages
      .filter((m, i) => i > lastUserIdx && m.from !== "you" && !m.text.startsWith("\u26a0"))
      .slice(-3)
      .forEach((m) => voice.speak(m.text, m.from, m.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // New panelist lines are spoken as they arrive, in queue order.
  useEffect(() => {
    if (done || channel !== "live-interview") return;
    for (const m of messages) {
      if (spokenRef.current.has(m.id)) continue;
      spokenRef.current.add(m.id);
      if (m.from === "you") continue;
      if (m.text.startsWith("\u26a0")) continue;
      voice.speak(m.text, m.from, m.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, channel, done]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const send = () => {
    const text = draft.trim();
    if (!text || loading) return;
    setDraft("");
    onSend?.(text);
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading, messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 128)}px`;
    }
  }, [draft]);

  return (
    <main className="tg-grain relative flex h-screen overflow-hidden bg-background text-foreground">
      <GridField className="pointer-events-none absolute inset-0 z-0 opacity-30" />

      {/* rail / channels */}
      <aside className="relative z-10 hidden w-60 shrink-0 flex-col border-r border-border md:flex">
        <div className="border-b border-border px-5 py-4">
          <p className="truncate font-[family-name:var(--font-display)] text-xl">{context}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Panel room
          </p>
        </div>
        <nav className="overflow-y-auto px-3 py-4 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <p className="px-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Channels
          </p>
          <ul className="mt-3 space-y-1">
            {[
              ["live-interview", "live-interview"],
              ["role-brief", "role-brief"],
              ...(done ? ([["feedback", "feedback"]] as const) : []),
            ].map(([id, label]) => (
              <li key={id}>
                <button
                  onClick={() => setChannel(id as typeof channel)}
                  className={`w-full rounded px-2 py-1.5 text-left transition-colors ${
                    channel === id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <span className="mr-1 opacity-60">#</span>
                  {label}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-6 px-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            In room — {inRoomCount}
          </p>
          <ul className="mt-3 space-y-1">
            {roomMembers.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded px-2 py-2 transition-colors hover:bg-accent"
              >
                <span className="relative">
                  <Avatar m={m} size="sm" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background bg-foreground" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs">{m.name}</span>
                  <span className="block truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {m.role}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-border px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Integrity monitoring on
        </div>
      </aside>

      {/* conversation */}
      <section className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-sm">
              <span className="opacity-50">#</span> {channel}
            </h1>
            <p className="truncate text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {context} · {channel === "role-brief" ? "panel introductions" : "panel in session"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline-flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground" />{" "}
              {timeLeftLabel ? `${timeLeftLabel} left` : "Recording"}
            </span>
            {onExit && (
              <button
                onClick={onExit}
                className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              >
                Exit
              </button>
            )}
          </div>
        </header>

        {channel === "role-brief" ? (
          <div className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="mx-auto max-w-3xl space-y-5">
              <div className="rounded-lg border border-border p-5">
                <p className="font-[family-name:var(--font-display)] text-2xl">Role Brief</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Meet the panel evaluating you. Each member focuses on different competencies —
                  they are looking for evidence, not perfection.
                </p>
              </div>

              {roomMembers
                .filter((m) => m.ai && m.id !== "you")
                .map((m) => {
                  const info = PANELIST_JUDGING[m.id];
                  if (!info) return null;
                  return (
                    <div key={m.id} className="rounded-lg border border-border p-5">
                      <div className="flex items-start gap-4">
                        <Avatar m={m} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{m.name}</p>
                          <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            {info.title}
                          </p>
                          <p className="mt-0.5 text-xs">{m.role}</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          Will evaluate
                        </p>
                        <ul className="space-y-1.5">
                          {info.judges.map((j, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm text-muted-foreground"
                            >
                              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground" />
                              {j}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className="mt-3 rounded bg-muted/50 px-3 py-2 text-xs italic text-muted-foreground">
                        {info.tip}
                      </p>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : channel === "feedback" ? (
          <div className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="mx-auto max-w-3xl space-y-5">
              <div className="rounded-lg border border-border p-5">
                <p className="font-[family-name:var(--font-display)] text-2xl">Feedback</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {done
                    ? "Your interview is complete. See how the panel evaluated your performance."
                    : "Feedback will be available after the interview is complete."}
                </p>
                {done && onViewAnalysis && (
                  <button
                    onClick={onViewAnalysis}
                    className="mt-4 rounded-lg border border-foreground px-5 py-2.5 text-[11px] uppercase tracking-[0.2em] transition-colors hover:bg-foreground hover:text-background"
                  >
                    See what panel thinks about you
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {paused && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                    Camera break
                  </p>
                  <div className="my-4 font-mono text-7xl font-bold tabular-nums text-foreground">
                    {Math.max(0, breakLeft)}
                  </div>
                  <p className="mx-auto max-w-xs px-4 text-center text-sm text-muted-foreground">
                    Keep your eyes on the chat room at the centre of the screen — that's where the
                    panel's questions and your answers appear. Take a minute to rest, and the
                    interview resumes automatically.
                  </p>
                  {suspection > 0 && (
                    <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-amber-600">
                      Suspecions: {suspection}
                    </p>
                  )}
                </div>
              )}
              <div className="mx-auto max-w-3xl space-y-5">
                <div className="rounded-lg border border-border p-4">
                  <p className="font-[family-name:var(--font-display)] text-2xl">
                    Welcome to your panel
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Five analysts, one conversation. The panel speaks each question aloud, then the
                    mic opens by itself — answer out loud and the panel moves forward.
                  </p>
                </div>

                {messages.map((m) => {
                  const who = m.from === "you" ? candidate : byId(m.from);
                  const isSpeaking =
                    m.from !== "you" && voice.speaking === m.from && voice.speakingId === m.id;
                  return (
                    <article
                      key={m.id}
                      className={`tg-reveal flex gap-3 ${
                        isSpeaking ? "rounded-lg bg-foreground/[0.04]" : ""
                      }`}
                    >
                      <span className="relative shrink-0">
                        <Avatar m={who} />
                        {isSpeaking && (
                          <span className="absolute -right-0.5 -bottom-0.5 flex size-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                            <span className="relative inline-flex size-2.5 rounded-full border border-background bg-emerald-400" />
                          </span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-baseline gap-2">
                          <span className="text-sm">{who.name}</span>
                          {who.ai && (
                            <span className="rounded border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                              AI
                            </span>
                          )}
                          {isSpeaking && (
                            <span className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.2em] text-emerald-600">
                              <AudioLines className="size-2.5" /> Speaking
                            </span>
                          )}
                          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            {m.time}
                          </span>
                        </p>
                        <p
                          className={`mt-1 text-sm leading-relaxed ${
                            who.ai ? "text-muted-foreground" : "text-foreground"
                          }`}
                        >
                          <MessageText
                            text={m.text}
                            isAi={who.ai}
                            activeWord={
                              isSpeaking && voice.wordIndex >= 0 ? voice.wordIndex : undefined
                            }
                          />
                        </p>
                      </div>
                    </article>
                  );
                })}

                {loading && (
                  <p className="flex items-center gap-2 pl-12 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Panel is thinking
                    <span
                      className="ml-0.5 inline-block w-1 animate-pulse bg-muted-foreground align-baseline"
                      style={{ height: "1em" }}
                    />
                  </p>
                )}
                <div ref={endRef} />
              </div>
            </div>

            <div className="border-t border-border px-4 py-4 sm:px-6">
              <div className="mx-auto max-w-3xl">
                {voice.supported ? (
                  <PanelVoiceComposer
                    voice={voice}
                    loading={loading}
                    done={done}
                    paused={paused}
                    iceBreak={iceBreak}
                  />
                ) : (
                  <div className="flex items-end gap-3">
                    <textarea
                      ref={inputRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      rows={1}
                      disabled={loading || done || paused}
                      placeholder={
                        done
                          ? "Interview finished."
                          : paused
                            ? "On a short break…"
                            : "Answer the panel…"
                      }
                      className="max-h-32 min-h-11 flex-1 resize-none rounded-lg border border-input bg-transparent px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground disabled:opacity-50"
                    />
                    <button
                      onClick={send}
                      disabled={!draft.trim() || loading || done || paused}
                      className="h-11 shrink-0 rounded-lg border border-foreground px-5 text-[11px] uppercase tracking-[0.2em] transition-colors hover:bg-foreground hover:text-background disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-foreground"
                    >
                      Send
                    </button>
                  </div>
                )}
              </div>
              <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {voice.supported
                  ? "Hands-free — the mic opens itself whenever a panelist finishes speaking"
                  : "Enter to send · Shift + Enter for a new line"}
              </p>
            </div>
          </>
        )}
      </section>

      {/* right spacer to preserve the previous frame ratio. The proctor camera
          lives in this reserved column on large screens so it never overlaps the
          chat; below lg the column collapses to zero width and the camera
          becomes a top-right corner overlay instead, exactly as before. */}
      <div className="relative z-10 w-0 lg:flex lg:w-60 lg:shrink-0">
        <ProctorCamera onViolation={onViolation} />
      </div>
    </main>
  );
}

function PanelVoiceComposer({
  voice,
  loading,
  done,
  paused,
  iceBreak,
}: {
  voice: PanelVoiceControls;
  loading: boolean;
  done: boolean;
  paused: boolean;
  iceBreak: boolean;
}) {
  const speaker = voice.speaking ? byId(voice.speaking) : null;
  const liveText = [voice.captured, voice.interim].filter(Boolean).join(" ");

  let caption = "";
  if (voice.error) caption = voice.error;
  else if (iceBreak) caption = "Panel is getting ready…";
  else if (voice.voiceTrouble)
    caption = "Panel voice unavailable — check your sound and that the app server is running.";
  else if (loading) caption = "Panel is putting together your next question…";
  else if (voice.awaitedTap) caption = "Tap anywhere to start the audio — then listen hands-free.";
  else if (voice.speaking && speaker) caption = `${speaker.name} is speaking…`;
  else if (liveText) caption = "";
  else if (done) caption = "Interview finished.";
  else if (paused) caption = "On a short break…";
  else if (voice.needMicTap)
    caption = "Tap the mic once to allow the mic — then listen hands-free.";
  else if (voice.listening) caption = "Listening — answer as soon as the panelist finishes.";
  else caption = "Hands-free — the mic opens automatically.";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-8 min-w-0 items-center justify-center px-2">
        {voice.error ? (
          <p className="max-w-full truncate text-xs text-red-500">{caption}</p>
        ) : liveText ? (
          <p className="max-w-md truncate rounded-full border border-border bg-card px-4 py-1.5 text-sm text-foreground">
            {liveText}
            <span className="ml-0.5 opacity-60">…</span>
          </p>
        ) : loading ? (
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {caption}
          </p>
        ) : (
          <p
            className={`max-w-md truncate text-center text-xs ${
              voice.listening ? "text-muted-foreground" : "text-muted-foreground/70"
            }`}
          >
            {caption}
          </p>
        )}
      </div>

      {voice.listening && voice.waves && !liveText && (
        <div className="flex h-8 items-center gap-[3px]" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-foreground/60"
              style={{
                height: "100%",
                animation: `tb-wave ${0.7 + (i % 5) * 0.09}s ease-in-out ${(i % 7) * 0.06}s infinite alternate`,
                transformOrigin: "center",
                transform: "scaleY(0.25)",
              }}
            />
          ))}
        </div>
      )}

      <div className="relative">
        {voice.listening && (
          <>
            <span className="absolute -inset-3 animate-ping rounded-full bg-foreground/25" />
            <span className="absolute -inset-2 animate-pulse rounded-full bg-foreground/15" />
          </>
        )}
        <button
          type="button"
          onClick={voice.toggle}
          disabled={loading || done || paused || iceBreak || !!voice.speaking}
          aria-label={voice.listening ? "Pause voice input" : "Start voice input"}
          className={`pointer-events-auto grid size-12 cursor-pointer place-items-center rounded-full border transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
            voice.listening
              ? "border-foreground bg-foreground text-background shadow-lg"
              : voice.needMicTap
                ? "border-foreground bg-foreground text-background shadow-lg"
                : "border-border bg-background text-muted-foreground hover:bg-foreground hover:text-background"
          }`}
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : <Mic className="size-5" />}
        </button>
      </div>
    </div>
  );
}
