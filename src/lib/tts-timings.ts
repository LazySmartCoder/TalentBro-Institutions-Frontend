import type { TtsWordTiming } from "@/lib/api";

/**
 * Turn the backend's `(char_offset, start_ms)` WordBoundary pairs into a plain
 * array holding the start time of every word in `text`.
 *
 * The TTS service announces a token the instant it begins speaking it, so each
 * timing is attached to the transcript word whose span contains that char
 * offset. Words the engine didn't announce (rare escapes, punctuation splits)
 * are interpolated from their labelled neighbours, which is why the result
 * always has exactly one entry per word.
 *
 * Returns null when the backend had no timings at all — callers then fall back
 * to their own estimate.
 */
export function alignWordTimesMs(
  text: string,
  pairs: ReadonlyArray<TtsWordTiming>,
): number[] | null {
  if (!pairs.length) return null;
  const starts = wordStartOffsets(text);
  if (!starts.length) return null;
  const times: (number | null)[] = new Array(starts.length).fill(null);
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

/** The word ordinal that has started by `nowMs`, or -1 before the first one. */
export function wordIndexAt(wordTimesMs: number[], nowMs: number): number {
  let w = 0;
  while (w < wordTimesMs.length && (wordTimesMs[w] ?? Infinity) <= nowMs) w += 1;
  return w - 1;
}

/**
 * The char offsets at which each word of `text` starts. Lets a char position
 * (a speech-boundary event, or an audio-progress estimate) be turned into the
 * word ordinal a transcript should highlight.
 */
export function wordStartOffsets(text: string): number[] {
  const starts: number[] = [];
  const re = /\S+/g;
  for (;;) {
    const match = re.exec(text);
    if (!match) break;
    starts.push(match.index);
  }
  return starts;
}

/** Map a char offset to the ordinal of the word containing it. */
export function wordIndexForChar(starts: readonly number[], idx: number): number {
  if (!starts.length) return -1;
  let w = 0;
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i]!;
    if (s > idx) break;
    w = i;
  }
  return w;
}
