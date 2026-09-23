import { useEffect, useRef, useState } from "react";
import { renderMarkdown } from "@/components/chat/markdown";

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
  const [shown, setShown] = useState(active ? 0 : text.length);
  const finished = useRef(!active);

  useEffect(() => {
    if (!active || finished.current) return;
    let i = 0;
    setShown(0);
    const id = setInterval(() => {
      i += 1;
      setShown(i);
      onTick?.();
      if (i >= text.length) {
        clearInterval(id);
        finished.current = true;
        onDone?.();
      }
    }, 12);
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
