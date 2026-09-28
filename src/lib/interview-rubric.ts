// The 34-dimension interview rubric, grouped into the eight areas the product
// reports on. The keys are the rubric's own display names, which is what both
// the per-interview analysis payload (`metrics[].dimension`) and the history
// rollup (`analysis.dimensions`) key their percentages by.
//
// This is the single source of truth on purpose: the per-interview report and
// the cross-interview history both group dimensions through this map, so a
// change to the rubric grouping lands in one place and the two views can never
// drift apart.
export const INTERVIEW_CATEGORIES: Record<string, string[]> = {
  Communication: [
    "Communication Skills",
    "Verbal Fluency",
    "Conciseness",
    "Vocabulary",
    "Listening",
    "Ability to Structure an Answer",
  ],
  "Critical Thinking": [
    "Clarity of Thought",
    "Analytical & Problem-Solving Ability",
    "Logical Reasoning",
    "Ability to Defend an Opinion",
  ],
  Knowledge: ["Knowledge & Awareness", "Subject Knowledge", "General Awareness"],
  "Presence & Attitude": ["Confidence", "Personality & Presence", "Attitude", "Energy"],
  "Leadership & Influence": ["Leadership & Initiative", "Ability to Influence", "Ambition"],
  "Emotional Intelligence": [
    "Emotional Maturity",
    "Self-Awareness",
    "Empathy",
    "Conflict Management",
  ],
  "Teamwork & Values": [
    "Teamwork & Interpersonal Skills",
    "Integrity & Values",
    "Respect for Others",
    "Responsibility",
    "Discipline",
  ],
  "Growth & Adaptability": [
    "Motivation & Fit",
    "Curiosity",
    "Creativity",
    "Adaptability",
    "Learning Orientation",
  ],
};

/**
 * Reduce one interview's dimension percentages to a score per category.
 *
 * Only dimensions actually present in `dimensions` are averaged, which matters
 * because the API omits the ones the stored analysis has no evidence for.
 * Treating a missing dimension as zero would quietly understate every category
 * the panel did not get to, which is missing data rather than a failure.
 */
export function categoryBreakdown(dimensions: Record<string, number>) {
  return Object.entries(INTERVIEW_CATEGORIES).map(([category, names]) => {
    const present = names
      .map((name) => dimensions[name])
      .filter((value): value is number => typeof value === "number");
    return {
      category,
      score: present.length
        ? Math.round(present.reduce((sum, value) => sum + value, 0) / present.length)
        : 0,
      dimensions: present.length,
    };
  });
}
