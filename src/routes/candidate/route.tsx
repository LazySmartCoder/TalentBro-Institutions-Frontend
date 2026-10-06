import { createFileRoute, Outlet } from "@tanstack/react-router";

import { GateError, GateLoading } from "@/components/load-state";
import { CandidateGateContext, useCandidateGate } from "@/lib/candidate-gate";

/**
 * The gate for the whole candidate area.
 *
 * A directory `route.tsx` wraps every file in the directory without adding a URL
 * segment, so this one place decides whether a candidate may see any of it.
 * Individual pages still run their own `me()` checks for role and profile
 * completeness; what they would otherwise each have to remember is that a
 * candidate whose skills or job roles just changed cannot reach a single one of
 * them until the Skill Mapping interview is done.
 */
export const Route = createFileRoute("/candidate")({
  component: CandidateGateLayout,
});

function CandidateGateLayout() {
  const gate = useCandidateGate();
  const { status, message, redirecting } = gate;

  if (status === "error") return <GateError message={message} />;
  // Loading and redirecting both render the spinner rather than the child page:
  // rendering the child for the frame between "we know you are blocked" and "the
  // new URL has loaded" would flash exactly the content the gate keeps out.
  if (status === "loading" || redirecting) return <GateLoading />;

  // Published only once the answer is settled, so a child reading it never has
  // to ask the same question again or render a second loader of its own.
  return (
    <CandidateGateContext.Provider value={gate}>
      <Outlet />
    </CandidateGateContext.Provider>
  );
}
