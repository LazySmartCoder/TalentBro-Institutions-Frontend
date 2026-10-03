import { useEffect, useRef, useState } from "react";
import { renderMarkdown } from "@/components/chat/markdown";

// A reply is revealed over a bounded number of ~60fps frames rather than one
// character every 12ms. A 4,000-character answer used to need 48 seconds of
// animation, re-parsing the whole markdown and re-reading scrollHeight 83 times
// a second, which saturated the main thread: the page froze and the typing
// appeared to stall. Now short and long replies both finish in about a second.
const FRAME_MS = 16;
const MIN_FRAMES = 24;
const MAX_FRAMES = 90;
// Reading scrollHeight right after a write forces a synchronous layout, so the
// follow-scroll runs a few times a second rather than on every frame.
const SCROLL_EVERY_FRAMES = 4;

export function Typewriter({
  text,
  active,
  onTick,
  onDone,
  className,
}: {
  text: string;
  active: boolean;
  onTick?: () => void;
  onDone?: () => void;
  className?: string;
}) {
  const total = text.length;
  const [shown, setShown] = useState(active ? 0 : total);
  const finished = useRef(!active);

  // Switching the animation off mid-flight must never leave a half-printed
  // bubble on screen, so snap to the whole text whenever `active` goes false.
  useEffect(() => {
    if (!active) setShown(total);
  }, [active, total]);

  useEffect(() => {
    if (!active || finished.current) return;
    const totalFrames = Math.min(Math.max(Math.ceil(total / 3), MIN_FRAMES), MAX_FRAMES);
    const perFrame = Math.max(1, Math.ceil(total / totalFrames));
    let count = 0;
    let frame = 0;
    setShown(0);
    const id = setInterval(() => {
      count = Math.min(total, count + perFrame);
      frame += 1;
      setShown(count);
      if (frame % SCROLL_EVERY_FRAMES === 0) onTick?.();
      if (count >= total) {
        clearInterval(id);
        finished.current = true;
        onTick?.();
        onDone?.();
      }
    }, FRAME_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, text]);

  const typing = active && !finished.current;
  const cursor = typing ? (
    <span
      className="ml-0.5 inline-block w-1 animate-pulse bg-muted-foreground align-baseline"
      style={{ height: "1em" }}
    />
  ) : null;
  return (
    <div className={className ?? "whitespace-pre-wrap break-words"}>
      {renderMarkdown(text.slice(0, shown), cursor)}
    </div>
  );
}
