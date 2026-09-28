import type { PillarRank, PillarRanks } from "@/lib/api";

export type PillarKey = keyof PillarRanks;

// The two independently ranked practice surfaces. Mock-interview and
// self-training standings are computed over separate cohorts, so a candidate's
// rank in one is never the other's number in disguise.
export const PERF_PILLARS: { key: PillarKey; label: string; short: string; route: string }[] = [
  { key: "mock_interview", label: "Mock Interview", short: "Mock", route: "/mock-interview" },
  { key: "self_training", label: "Self-Training", short: "Training", route: "/self-training" },
];

// Compact variant for tight spots (the chat header).
export const PILLAR_RANK_CHIPS = PERF_PILLARS.map((pillar) => ({
  key: pillar.key,
  label: pillar.short,
}));

export function emptyPillarRanks(): PillarRanks {
  return { mock_interview: null, self_training: null };
}

export function pillarStanding(
  pillars: PillarRanks | null | undefined,
  key: PillarKey,
): PillarRank | null {
  return pillars?.[key] ?? null;
}

// "#4 of 27" — the cohort the rank was actually earned in, never a mixed one.
export function formatPillarRank(standing: PillarRank | null | undefined): string {
  if (!standing || standing.rank == null) return "—";
  return standing.total > 0 ? `#${standing.rank} of ${standing.total}` : `#${standing.rank}`;
}
