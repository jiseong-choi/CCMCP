import { CourtInput, CourtVerdict } from "./types.js";
import { evaluateCourtCase } from "./analyze.js";

export function prosecuteCommit(input: CourtInput): CourtVerdict {
  return evaluateCourtCase({ ...input, style: input.style ?? "prosecutor" });
}

export function requireBetterSubject(input: CourtInput): CourtVerdict {
  const verdict = evaluateCourtCase({ ...input, style: input.style ?? "judge" });
  return {
    ...verdict,
    required_actions: verdict.required_actions.includes("Replace the subject with a concrete action and scope.")
      ? verdict.required_actions
      : ["Replace the subject with a concrete action and scope.", ...verdict.required_actions],
    rewritten_subject: verdict.rewritten_subject ?? evaluateCourtCase({ ...input, style: "judge" }).rewritten_subject
  };
}

export function renderVerdict(input: CourtInput): CourtVerdict {
  return evaluateCourtCase({ ...input, style: input.style ?? "judge" });
}

export function formatVerdictSummary(verdict: CourtVerdict): string {
  const lines = [
    verdict.rendered_opinion,
    "",
    `Verdict: ${verdict.verdict}`,
    `Score: ${verdict.score}`
  ];

  if (verdict.rewritten_subject) {
    lines.push(`Suggested subject: ${verdict.rewritten_subject}`);
  }

  return lines.join("\n");
}
