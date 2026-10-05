/**
 * A drive's fit against the signed-in candidate's profile.
 *
 * Shared by both candidate-side drive surfaces - the Drives tab and the
 * per-company Drives section - because a student comparing recruiters has to be
 * reading the same meter on both, and a second copy is how the two pages quietly
 * drift apart.
 *
 * The number itself is counted on the server (`_drive_profile_match` in
 * Backend/TalentBroIns/views.py) so the meter cannot disagree with the API; this
 * only draws the percentage it is handed.
 */

/**
 * What the meter's number was measured against.
 *
 * - `skills`: the drive listed required/preferred skills.
 * - `eligibility`: the drive listed no skills, so the number falls back to the
 *   branch / course / CGPA bar the drive or its company declares.
 * - `none`: neither was declared, so there is nothing to measure. The meter still
 *   renders - three cards in a row should look alike - but empty and neutral,
 *   because "nobody wrote a requirement down" is not "you match nothing".
 */
export type SkillMatchBasis = "skills" | "eligibility" | "none" | null | undefined;

const METER_WIDTH = "w-28";

/** Fill and figure colours per basis. "none" is deliberately not green. */
const METER_TONE: Record<
  NonNullable<SkillMatchBasis>,
  { fill: string; value: string; label: string }
> = {
  skills: { fill: "bg-emerald-500", value: "text-emerald-600", label: "Skill match" },
  eligibility: {
    fill: "bg-emerald-500",
    value: "text-emerald-600",
    label: "Profile match",
  },
  none: { fill: "bg-muted-foreground/40", value: "text-muted-foreground", label: "Not specified" },
};

export function SkillMatchMeter({
  percent,
  basis,
  className,
}: {
  /** 0-100, or null when the drive declares nothing to measure against. */
  percent: number | null;
  basis: SkillMatchBasis;
  className?: string;
}) {
  const tone = METER_TONE[basis ?? "none"];
  // Clamped so a stray value above 100 cannot overflow the track.
  const value = Math.max(0, Math.min(100, percent ?? 0));
  const measured = typeof percent === "number";
  const caption = measured ? tone.label : "Not specified";
  return (
    <div
      role="img"
      aria-label={
        measured
          ? `${value} percent ${tone.label.toLowerCase()}`
          : "No requirements recorded for this drive"
      }
      title={
        measured
          ? `${value}% of this drive's ${
              basis === "eligibility" ? "eligibility criteria" : "skills"
            } are met by your profile`
          : "This drive has no skills or eligibility criteria recorded"
      }
      className={className ?? `flex ${METER_WIDTH} shrink-0 flex-col gap-1.5`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
          {caption}
        </span>
        <span className={`font-mono text-xs font-bold tabular-nums ${tone.value}`}>
          {measured ? `${value}%` : "—"}
        </span>
      </div>
      {/* The track stays visible when unmeasured so the meter's footprint does
          not change between cards in the same list. */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {measured && (
          <div
            className={`h-full rounded-full ${tone.fill} transition-[width] duration-500 ease-out`}
            style={{ width: `${value}%` }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The drive's required skills, with the ones the profile already covers picked
 * out in green. Rendered next to the meter so the percentage is a number the
 * student can account for rather than an unexplained score.
 */
export function RequiredSkillChips({
  skills,
  matched,
}: {
  skills: string[];
  matched: string[] | undefined;
}) {
  if (skills.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {skills.map((skill) => {
        const covered = (matched ?? []).includes(skill);
        return (
          <span
            key={skill}
            className={
              covered
                ? "rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
                : "rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
            }
          >
            {skill}
          </span>
        );
      })}
    </div>
  );
}
