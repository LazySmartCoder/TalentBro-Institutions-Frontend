/**
 * Monochrome line-art graphics. All strokes use currentColor so they inherit
 * the design-system foreground token — no hardcoded colors.
 */

export function GridField({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 800 400"
      fill="none"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id="tg-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" stroke="currentColor" strokeOpacity="0.16" strokeWidth="0.75" />
        </pattern>
        <radialGradient id="tg-fade" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="tg-mask">
          <rect width="800" height="400" fill="url(#tg-fade)" />
        </mask>
      </defs>
      <rect width="800" height="400" fill="url(#tg-grid)" mask="url(#tg-mask)" />
    </svg>
  );
}
