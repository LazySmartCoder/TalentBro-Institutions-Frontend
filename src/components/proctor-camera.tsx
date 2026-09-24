import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { CameraOff, ScanEye } from "lucide-react";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const AWAY_LIMIT_MS = 3_000;
const BLINK_GRACE_MS = 1_000;
const CALIB_SAMPLES = 55;

const OFF_CENTER_X = 0.05;
const OFF_CENTER_Y = 0.07;
const YAW_THRESHOLD = 0.03;
const PITCH_DEV = 0.02;
// Deliberately roomy: glancing around the chat room while thinking is normal.
// Tightened a touch from the defaults so the tracker still catches real
// inattention without punishing a natural read-then-answer rhythm.
const GAZE_THRESHOLD = 0.11;
const GAZE_VERTICAL = 0.045;
// The interview timer/countdown lives at the top of the screen, so checking it
// is normal and must not count as inattention. This extra slack applies ONLY to
// upward glances (eyes and/or head): looking down or sideways stays as strict
// as before. The eye/head metrics grow negative when the gaze goes up.
const UP_GAZE_EXTRA = 0.05;

type Pt = { x: number; y: number };

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

type EyeInfo = {
  cx: number;
  cy: number;
  ix: number;
  iy: number;
  gx: number;
  gy: number;
  w: number;
};

const eyeInfo = (lm: Pt[], outer: number, inner: number, irisIdx: number): EyeInfo | null => {
  const o = lm[outer];
  const i = lm[inner];
  const ir = lm[irisIdx];
  if (!o || !i || !ir) return null;
  const w = dist(o, i);
  if (w === 0) return null;
  const cx = (o.x + i.x) / 2;
  const cy = (o.y + i.y) / 2;
  return {
    cx,
    cy,
    ix: ir.x,
    iy: ir.y,
    gx: (ir.x - cx) / w,
    gy: (ir.y - cy) / w,
    w,
  };
};

const eyesInfo = (lm: Pt[]): EyeInfo[] => {
  const eyes = [eyeInfo(lm, 33, 133, 468), eyeInfo(lm, 263, 362, 473)];
  return eyes.filter((e): e is EyeInfo => e !== null);
};

const RIGHT_EYE = [33, 160, 158, 133, 153, 144] as const;
const LEFT_EYE = [362, 385, 387, 263, 373, 380] as const;

const ear = (lm: Pt[], idx: readonly [number, number, number, number, number, number]): number => {
  const a = lm[idx[0]];
  const b = lm[idx[1]];
  const c = lm[idx[2]];
  const d = lm[idx[3]];
  const e = lm[idx[4]];
  const f = lm[idx[5]];
  if (!a || !b || !c || !d || !e || !f) return 0;
  return (dist(a, b) + dist(c, d)) / (2 * dist(e, f));
};

const eyeAspect = (lm: Pt[]) => Math.min(ear(lm, RIGHT_EYE), ear(lm, LEFT_EYE));

function faceBox(lm: Pt[]) {
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  for (const p of lm) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
}

type Metrics = {
  box: { minX: number; maxX: number; minY: number; maxY: number; w: number; h: number };
  fx: number;
  fy: number;
  yaw: number;
  pitch: number;
  eyes: EyeInfo[];
  ex: number;
  ey: number;
};

function readFace(face: Pt[]): Metrics | null {
  const box = faceBox(face);
  if (box.w <= 0 || box.h <= 0) return null;
  const faceCx = (box.minX + box.maxX) / 2;
  const faceCy = (box.minY + box.maxY) / 2;
  const nose = face[1];
  const lOuter = face[33];
  const rOuter = face[263];
  const eyeLineY = lOuter && rOuter ? (lOuter.y + rOuter.y) / 2 : faceCy;
  const eyes = eyesInfo(face);
  // Track the eyeballs, not the nose: the pointer is anchored to the midpoint
  // between the two eyes so the tracker (and the drawn cursor) follows the eyes.
  let ex = faceCx;
  let ey = faceCy;
  if (eyes.length > 0) {
    ex = eyes.reduce((s, e) => s + e.cx, 0) / eyes.length;
    ey = eyes.reduce((s, e) => s + e.cy, 0) / eyes.length;
  }
  return {
    box,
    fx: ex - 0.5,
    fy: ey - 0.5,
    yaw: nose ? (nose.x - faceCx) / box.w : 0,
    pitch: nose ? (nose.y - eyeLineY) / box.h : 0,
    eyes,
    ex,
    ey,
  };
}

type Baseline = {
  fx: number;
  fy: number;
  yaw: number;
  pitch: number;
  eyes: { gx: number; gy: number }[];
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function ProctorCamera({ onViolation }: { onViolation?: (() => void) | undefined }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trailRef = useRef<{ x: number; y: number; away: boolean }[]>([]);
  const awayMsRef = useRef(0);
  const closedMsRef = useRef(0);
  const fittingRef = useRef(true);
  const baselineRef = useRef<Baseline | null>(null);
  const calibRef = useRef({ fx: 0, fy: 0, yaw: 0, pitch: 0, gx0: 0, gy0: 0, gx1: 0, gy1: 0, n: 0 });
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  const [fitting, setFitting] = useState(true);
  const [progress, setProgress] = useState(0);
  const [tracking, setTracking] = useState(false);
  const [focus, setFocus] = useState<"focused" | "away">("focused");
  const [countdown, setCountdown] = useState(0);
  const [violations, setViolations] = useState(0);
  const [episodes, setEpisodes] = useState(0);
  const episodesRef = useRef(0);
  const [camError, setCamError] = useState<string | null>(null);

  // Phased tolerance: the first 5 looks-away are free ("happens", blue), 6-8
  // signal "break time?" (amber), and only the 9th look-away onward begins the
  // suspicion count and reports violations (saved to the DB in the app).
  const phase =
    focus === "away"
      ? episodes <= 5
        ? "happens"
        : episodes <= 8
          ? "break"
          : "away"
      : "focused";

  useEffect(() => {
    let disposed = false;
    let raf = 0;

    const tick = () => {
      const video = videoRef.current;
      const lm = faceLandmarkerRef.current;
      if (video && video.readyState >= 2 && lm && disposed === false) {
        const res = lm.detectForVideo(video, performance.now());
        const face = res.faceLandmarks?.[0] as Pt[] | undefined;
        const m = face && face.length > 0 ? readFace(face) : null;
        const eyes = m ? m.eyes : [];

        let away = true;

        if (fittingRef.current) {
          // Calibration: user looks at the screen; capture a fixed reference.
          if (m && eyes.length === 2) {
            const acc = calibRef.current;
            acc.fx += m.fx;
            acc.fy += m.fy;
            acc.yaw += m.yaw;
            acc.pitch += m.pitch;
            acc.gx0 += eyes[0]!.gx;
            acc.gy0 += eyes[0]!.gy;
            acc.gx1 += eyes[1]!.gx;
            acc.gy1 += eyes[1]!.gy;
            acc.n += 1;
            const pct = Math.min(1, acc.n / CALIB_SAMPLES);
            setProgress(pct);
            if (acc.n >= CALIB_SAMPLES) {
              baselineRef.current = {
                fx: acc.fx / acc.n,
                fy: acc.fy / acc.n,
                yaw: acc.yaw / acc.n,
                pitch: acc.pitch / acc.n,
                eyes: [
                  { gx: acc.gx0 / acc.n, gy: acc.gy0 / acc.n },
                  { gx: acc.gx1 / acc.n, gy: acc.gy1 / acc.n },
                ],
              };
              fittingRef.current = false;
              setFitting(false);
            }
          }
          away = false;
          closedMsRef.current = 0;
        } else if (m) {
          const open = eyeAspect(face!) >= 0.18;
          const b = baselineRef.current;

          if (!b) {
            away = true;
          } else {
            // Upward glances (toward the timer in the header) get the extra
            // leash; every other direction uses the plain thresholds.
            const upwardLeash = (delta: number) =>
              delta < 0 ? Math.abs(delta) <= UP_GAZE_EXTRA : false;

            const dFy = m.fy - b.fy;
            const dPitch = m.pitch - b.pitch;

            away =
              Math.abs(m.fx - b.fx) > OFF_CENTER_X ||
              (!upwardLeash(dFy) && Math.abs(dFy) > OFF_CENTER_Y) ||
              Math.abs(m.yaw - b.yaw) > YAW_THRESHOLD ||
              (!upwardLeash(dPitch) && Math.abs(dPitch) > PITCH_DEV) ||
              m.eyes.some((e, i) => {
                const baseGx = b.eyes[i]?.gx ?? e.gx;
                const baseGy = b.eyes[i]?.gy ?? e.gy;
                const dgx = e.gx - baseGx;
                const dgy = e.gy - baseGy;
                const dev = Math.hypot(dgx, dgy);
                if (dgy < 0) {
                  // Eye gaze has gone up — heading toward the timer/header.
                  return (
                    -dgy > GAZE_VERTICAL + UP_GAZE_EXTRA || dev > GAZE_THRESHOLD + UP_GAZE_EXTRA
                  );
                }
                return Math.abs(dgy) > GAZE_VERTICAL || dev > GAZE_THRESHOLD;
              });
          }

          if (open) closedMsRef.current = 0;
          else closedMsRef.current += 50;
          if (closedMsRef.current > BLINK_GRACE_MS) away = true;
        } else {
          closedMsRef.current = 0;
          away = true;
        }

        awayMsRef.current = away ? awayMsRef.current + 50 : 0;

        const trail = trailRef.current;
        if (m) {
          trail.push({ x: m.ex, y: m.ey, away });
          if (trail.length > 40) trail.shift();
        } else {
          trailRef.current.length = 0;
        }

        if (awayMsRef.current >= AWAY_LIMIT_MS) {
          awayMsRef.current = 0;
          episodesRef.current += 1;
          setEpisodes(episodesRef.current);
          if (episodesRef.current > 8) {
            setViolations((v) => v + 1);
            onViolationRef.current?.();
          }
        }

        setFocus((prev) =>
          prev === (away ? "away" : "focused") ? prev : away ? "away" : "focused",
        );
        setCountdown((prev) => {
          const next = away ? Math.ceil((AWAY_LIMIT_MS - awayMsRef.current) / 1000) : 0;
          return prev === next ? prev : next;
        });

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) {
          const W = video.videoWidth || 640;
          const H = video.videoHeight || 480;
          canvas.width = W;
          canvas.height = H;
          ctx.clearRect(0, 0, W, H);

          trail.forEach((p, i) => {
            const alpha = 0.25 + (0.75 * i) / Math.max(trail.length, 1);
            ctx.beginPath();
            ctx.arc(p.x * W, p.y * H, 3, 0, Math.PI * 2);
            ctx.fillStyle = p.away ? `rgba(239,68,68,${alpha})` : `rgba(34,197,94,${alpha})`;
            ctx.fill();
          });

          const b = baselineRef.current;
          eyes.forEach((e, i) => {
            const ex = e.cx * W;
            const ey = e.cy * H;
            const baseGx = b?.eyes[i]?.gx ?? 0;
            const baseGy = b?.eyes[i]?.gy ?? 0;
            const refX = (e.cx + baseGx * e.w) * W;
            const refY = (e.cy + baseGy * e.w) * H;
            const dev = Math.hypot(e.gx - baseGx, e.gy - baseGy);
            const vertDev = Math.abs(e.gy - baseGy);
            // Fixed drawing ramp (green when aligned → red when gaze drifts far).
            // These are visual-only maxima, kept independent of the (roomier)
            // violation thresholds above so the overlay still reads clearly.
            const ramp = Math.max(
              clamp01((dev - 0.18) / (0.05 - 0.18)),
              clamp01((vertDev - 0.09) / (0.02 - 0.09)),
            );

            ctx.strokeStyle = "rgba(148,163,184,0.5)";
            ctx.beginPath();
            ctx.arc(ex, ey, 4, 0, Math.PI * 2);
            ctx.stroke();

            if (b) {
              ctx.fillStyle = "rgba(148,163,184,0.7)";
              ctx.beginPath();
              ctx.arc(refX, refY, 2, 0, Math.PI * 2);
              ctx.fill();
              ctx.beginPath();
              ctx.moveTo(refX, refY);
              ctx.lineTo(e.ix * W, e.iy * H);
              ctx.strokeStyle = `rgba(34,197,94,${0.9 - ramp * 0.7})`;
              ctx.stroke();
            }

            ctx.beginPath();
            ctx.arc(e.ix * W, e.iy * H, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${239 - 205 * ramp},${68 + 129 * ramp},${68},0.95)`;
            ctx.fill();
          });

          // Pointer anchored on the eyeballs (midpoint between the eyes) so the
          // tracker visibly follows the eyes instead of the nose.
          if (m) {
            ctx.beginPath();
            ctx.arc(m.ex * W, m.ey * H, 5, 0, Math.PI * 2);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = away ? "rgba(239,68,68,0.9)" : "rgba(34,197,94,0.9)";
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(m.ex * W, m.ey * H, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = away ? "rgba(239,68,68,0.95)" : "rgba(34,197,94,0.95)";
            ctx.fill();
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false })
      .then((stream) => {
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err: unknown) => {
        if (disposed) return;
        setCamError(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera access was denied"
            : "Camera is unavailable",
        );
      });

    FilesetResolver.forVisionTasks(WASM_BASE)
      .then((fileset) =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        }),
      )
      .then((landmarker) => {
        if (disposed) {
          landmarker.close();
          return;
        }
        faceLandmarkerRef.current = landmarker;
        setTracking(true);
        raf = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (disposed) return;
        setTracking(false);
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      faceLandmarkerRef.current?.close();
    };
  }, []);

  const badgeCls =
    phase === "away"
      ? "border-red-500/50 bg-red-500/10 text-red-500"
      : phase === "break"
        ? "border-amber-500/50 bg-amber-500/10 text-amber-600"
        : phase === "happens"
          ? "border-sky-500/50 bg-sky-500/10 text-sky-600"
          : "border-border bg-background/80 text-muted-foreground";

  return (
    <div
      className="pointer-events-none absolute right-4 top-[3.9rem] z-30 w-52 overflow-hidden rounded-xl border border-border bg-background/85 shadow-lg backdrop-blur"
      aria-label="Proctor camera feed"
      title="Keep your eyes on the chat room at the centre of the screen — read it there and answer the panel."
    >
      <div className="relative flex h-36 items-center justify-center bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
        {camError && (
          <div className="relative z-10 px-3 text-center text-[10px] leading-relaxed text-white/70">
            <CameraOff className="mx-auto mb-1 size-4" />
            {camError}
          </div>
        )}
        {fitting && !camError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 px-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white">
              Look at the chat room
            </p>
            <p className="mt-1 text-[9px] leading-relaxed text-white/70">
              Keep your eyes on the conversation at the centre of the screen — that's where the
              panel talks and you read. Steady for a moment.
            </p>
            <div className="mt-2 h-1 w-full max-w-[8rem] overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-green-400 transition-[width] duration-150"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div
        className={`flex items-center justify-between gap-2 border-t border-border px-3 py-1.5 text-[10px] tracking-[0.15em] ${badgeCls}`}
      >
        <span className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              fitting
                ? "bg-amber-400"
                : phase === "away"
                  ? "bg-red-500"
                  : phase === "break"
                    ? "bg-amber-500"
                    : phase === "happens"
                      ? "bg-sky-500"
                      : "bg-green-500"
            }`}
          />
          {!tracking
            ? "CAMERA LIVE"
            : fitting
              ? `FOCUS ${Math.round(progress * 100)}%`
              : phase === "happens"
                ? "happens"
                : phase === "break"
                  ? "break time?"
                  : phase === "away"
                    ? `LOOKING AWAY ${countdown}s`
                    : "FOCUSED"}
        </span>
        <span className="flex items-center gap-1">
          <ScanEye className="size-3" />
          {violations}
        </span>
      </div>
    </div>
  );
}
