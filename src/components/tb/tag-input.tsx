import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";

const defaultLabelClass =
  "mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase";

/**
 * Chip-style list input: type and press Enter (or comma) to add a tag, Backspace
 * on an empty input removes the last one, and the ✕ on a chip removes just that
 * one. Duplicates are dropped case-insensitively.
 */
export function TagInput({
  id,
  label,
  placeholder,
  hint,
  value,
  onChange,
  disabled,
  labelClassName = defaultLabelClass,
}: {
  id: string;
  label: string;
  placeholder?: string;
  hint?: ReactNode;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  labelClassName?: string;
}) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    const parts = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) {
      onChange([
        ...value,
        ...parts.filter((p) => !value.some((v) => v.toLowerCase() === p.toLowerCase())),
      ]);
    }
    setText("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !text && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function removeAt(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <div className="rounded-xl border border-input bg-card px-3 py-2.5 focus-within:ring-2 focus-within:ring-ring/25">
        <div className="flex flex-wrap items-center gap-1.5">
          {value.map((item, idx) => (
            <span
              key={`${item}-${idx}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 pl-2.5 pr-1 py-1 text-[11px] font-medium"
            >
              {item}
              <button
                type="button"
                aria-label={`Remove ${item}`}
                onClick={() => removeAt(idx)}
                disabled={disabled}
                className="grid size-4 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            id={id}
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => commit()}
            placeholder={value.length === 0 ? placeholder : "Add another…"}
            className="min-w-32 flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed"
          />
        </div>
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
