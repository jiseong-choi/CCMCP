import { CourtLanguage, CourtStyle, CourtVerdict } from "./types.js";

function heading(style: CourtStyle, language: CourtLanguage): string {
  if (language === "ko") {
    if (style === "judge") return "판결문";
    if (style === "prosecutor") return "공소 의견서";
    return "변론 요지서";
  }

  if (style === "judge") return "Court Opinion";
  if (style === "prosecutor") return "Prosecution Brief";
  return "Defense Pleading";
}

function intro(style: CourtStyle, verdict: CourtVerdict, language: CourtLanguage): string {
  if (language === "ko") {
    if (style === "judge") {
      return `본 법정은 피고의 커밋 제목을 심리한 결과 ${verdict.verdict} 판결을 선고한다.`;
    }
    if (style === "prosecutor") {
      return `검찰은 피고의 커밋이 팀 히스토리를 혼탁하게 했다고 보고 ${verdict.verdict} 의견을 제출한다.`;
    }
    return `변호인은 피고의 의도가 완전히 무가치하지는 않았음을 주장하나, 현재 점수는 ${verdict.score}점이다.`;
  }

  if (style === "judge") {
    return `This court finds the defendant commit ${verdict.verdict}.`;
  }
  if (style === "prosecutor") {
    return `The prosecution submits that this commit polluted the record and merits a ${verdict.verdict} finding.`;
  }
  return `The defense concedes some disorder, but notes the commit still scored ${verdict.score} points.`;
}

export function renderVerdictOpinion(
  verdict: CourtVerdict,
  style: CourtStyle,
  language: CourtLanguage
): string {
  const evidenceLines = verdict.evidence
    .slice(0, 3)
    .map((item) => `- ${item.label}: ${item.excerpt} (${item.rationale})`)
    .join("\n");
  const actionLines = verdict.required_actions.map((item) => `- ${item}`).join("\n");

  return [
    `# ${heading(style, language)}`,
    intro(style, verdict, language),
    language === "ko" ? `평점: ${verdict.score}/100` : `Score: ${verdict.score}/100`,
    language === "ko"
      ? `주요 혐의: ${verdict.charges.join(", ") || "없음"}`
      : `Charges: ${verdict.charges.join(", ") || "none"}`,
    language === "ko" ? "증거 목록" : "Exhibits",
    evidenceLines || "- None",
    language === "ko" ? `형량: ${verdict.sentence}` : `Sentence: ${verdict.sentence}`,
    language === "ko" ? "집행 조건" : "Required actions",
    actionLines || "- None"
  ].join("\n\n");
}
