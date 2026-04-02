import { renderVerdictOpinion } from "./render.js";
import {
  CourtInput,
  CourtLanguage,
  CourtStyle,
  CourtVerdict,
  DiffSummary,
  EvidenceItem,
  Verdict
} from "./types.js";

const VAGUE_SUBJECTS = [
  /^(fix|update|change|misc|stuff|final|temp|wip)[\s._-]*$/i,
  /^fix stuff$/i,
  /^misc$/i,
  /^final(?:[_-]?final)*(?:[_-]?real)*$/i,
  /^updates?$/i
];

const CONVENTIONAL_SUBJECT =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9./_-]+\))?!?: .+/i;

const RISKY_FILE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /auth|login|session|token|permission|acl/i, reason: "auth pathway touched" },
  { pattern: /config|env|settings|package\.json|lock/i, reason: "configuration changed" },
  { pattern: /migrat|schema|sql/i, reason: "data contract changed" }
];

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function normalizeLanguage(language?: CourtLanguage): CourtLanguage {
  return language ?? "en";
}

function normalizeStyle(style?: CourtStyle): CourtStyle {
  return style ?? "judge";
}

function parseDiff(diff: string): DiffSummary {
  const files: string[] = [];
  const hunkAnchors: Array<{ file: string; line: number }> = [];
  const riskyAnchors: Array<{ file: string; line: number; reason: string }> = [];
  const keywords: string[] = [];

  let currentFile = "unknown";
  let added = 0;
  let removed = 0;

  for (const line of diff.split(/\r?\n/)) {
    const fileMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[2];
      files.push(currentFile);
      for (const risk of RISKY_FILE_PATTERNS) {
        if (risk.pattern.test(currentFile)) {
          riskyAnchors.push({ file: currentFile, line: 1, reason: risk.reason });
        }
      }
      continue;
    }

    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      const lineNumber = Number(hunkMatch[1]);
      hunkAnchors.push({ file: currentFile, line: lineNumber });
      for (const risk of RISKY_FILE_PATTERNS) {
        if (risk.pattern.test(currentFile)) {
          riskyAnchors.push({ file: currentFile, line: lineNumber, reason: risk.reason });
        }
      }
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      added += 1;
      const lowered = line.toLowerCase();
      if (lowered.includes("auth")) keywords.push("auth");
      if (lowered.includes("error")) keywords.push("error handling");
      if (lowered.includes("token")) keywords.push("token");
      if (lowered.includes("cache")) keywords.push("cache");
      if (lowered.includes("test(") || lowered.includes("describe(") || lowered.includes("expect(")) {
        keywords.push("tests");
      }
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      removed += 1;
    }
  }

  const hasTests = files.some((file) => /(^|\/|\\)(test|tests|spec|__tests__)\b/i.test(file))
    || diff.split(/\r?\n/).some((line) => /^\+.*\b(test|describe|it|expect)\(/i.test(line));

  return {
    files: unique(files),
    added,
    removed,
    hunkAnchors,
    hasTests,
    riskyAnchors,
    keywords: unique(keywords)
  };
}

function inferType(summary: DiffSummary): string {
  if (summary.hasTests && summary.files.every((file) => /test|spec/i.test(file))) return "test";
  if (summary.files.some((file) => /docs?|readme/i.test(file))) return "docs";
  if (summary.files.some((file) => /auth|login|session|token/i.test(file))) return "fix";
  if (summary.files.some((file) => /package\.json|lock|config|env/i.test(file))) return "chore";
  if (summary.added > summary.removed) return "feat";
  return "refactor";
}

function inferScope(summary: DiffSummary): string {
  const preferred = summary.files.find((file) => /auth|login|session|token|config|env|api|test/i.test(file));
  const base = (preferred ?? summary.files[0] ?? "repo").split(/[\\/]/).pop() ?? "repo";
  return base.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase() || "repo";
}

function inferSummary(summary: DiffSummary): string {
  if (summary.keywords.includes("auth")) return "clarify authentication behavior";
  if (summary.keywords.includes("tests")) return "cover the changed behavior with tests";
  if (summary.files.some((file) => /config|env/i.test(file))) return "align project configuration";
  if (summary.files.length === 1) {
    const base = summary.files[0].split(/[\\/]/).pop() ?? summary.files[0];
    return `update ${base}`;
  }
  return "align the implementation with the actual code changes";
}

function buildRewrites(input: CourtInput, summary: DiffSummary): Pick<
  CourtVerdict,
  "rewritten_subject" | "rewritten_body" | "rewritten_pr_body"
> {
  const rewrittenSubject = `${inferType(summary)}(${inferScope(summary)}): ${inferSummary(summary)}`;
  const rewrittenBody = [
    "Why:",
    `- Replace the vague subject "${input.subject}" with a traceable change summary.`,
    "",
    "What:",
    `- ${inferSummary(summary)}.`,
    `- Touches ${summary.files.length || 1} file(s) with ${summary.added} additions and ${summary.removed} removals.`,
    "",
    "Validation:",
    summary.hasTests ? "- Existing or updated tests are included in the diff." : "- Test coverage should be added or cited before merge."
  ].join("\n");
  const rewrittenPrBody = [
    "## Summary",
    `- ${inferSummary(summary)}`,
    "",
    "## Evidence",
    `- Files changed: ${summary.files.join(", ") || "unknown"}`,
    `- Tests included: ${summary.hasTests ? "yes" : "no"}`,
    "",
    "## Review Notes",
    "- Confirm the subject line reflects the user-visible behavior or risk area."
  ].join("\n");

  return {
    rewritten_subject: rewrittenSubject,
    rewritten_body: rewrittenBody,
    rewritten_pr_body: rewrittenPrBody
  };
}

function sentenceFor(verdict: Verdict, language: CourtLanguage): string {
  if (language === "ko") {
    if (verdict === "approved") return "무죄. 병합 가능하되 기록은 보존한다.";
    if (verdict === "probation") return "집행유예. 제목과 설명을 정리한 뒤 재심 없이 진행 가능.";
    return "유죄. 즉시 제목과 설명을 재작성하고 테스트 근거를 제출할 것.";
  }

  if (verdict === "approved") return "Acquitted. The record may stand.";
  if (verdict === "probation") return "Probation. Rewrite the narrative before merge.";
  return "Convicted. Rewrite the subject, explain the change, and produce testable evidence.";
}

function buildFindings(
  input: CourtInput,
  summary: DiffSummary
): { score: number; charges: string[]; findings: string[]; requiredActions: string[]; evidence: EvidenceItem[] } {
  let score = 100;
  const charges: string[] = [];
  const findings: string[] = [];
  const requiredActions: string[] = [];
  const evidence: EvidenceItem[] = [];
  const subject = input.subject.trim();
  const normalizedBody = input.body?.trim() ?? "";
  const normalizedPr = input.pr_body?.trim() ?? "";

  if (VAGUE_SUBJECTS.some((pattern) => pattern.test(subject))) {
    score -= 45;
    charges.push("vague subject line");
    findings.push(`The subject "${subject}" fails to describe what changed.`);
    requiredActions.push("Replace the subject with a concrete action and scope.");
  }

  if (!CONVENTIONAL_SUBJECT.test(subject)) {
    score -= 15;
    charges.push("non-conventional title");
    findings.push("The subject does not follow a traceable Conventional Commit shape.");
    requiredActions.push("Use <type>(<scope>): <summary> format.");
  }

  if (subject.length < 12) {
    score -= 10;
    charges.push("underspecified narrative");
    findings.push("The subject is too short to survive blame, changelog, or release notes.");
  }

  if (summary.files.length > 2 && !normalizedBody) {
    score -= 10;
    charges.push("missing commit body");
    findings.push("Multiple files changed without a body explaining why.");
    requiredActions.push("Add a short body covering why, what, and validation.");
  }

  if (summary.riskyAnchors.length > 0) {
    score -= 10;
    charges.push("high-risk area touched");
    const anchor = summary.riskyAnchors[0];
    findings.push(`Risky code paths were changed in ${anchor.file}.`);
    evidence.push({
      label: "Exhibit B",
      excerpt: `${anchor.file} line ${anchor.line}`,
      rationale: anchor.reason
    });
  }

  if (!summary.hasTests && (summary.riskyAnchors.length > 0 || summary.added + summary.removed > 20)) {
    score -= 20;
    charges.push("missing test evidence");
    findings.push("The diff shows meaningful change but no accompanying test evidence.");
    requiredActions.push("Add or cite tests that prove the change.");
    evidence.unshift({
      label: "Exhibit A",
      excerpt: "No updated test file found in the submitted diff.",
      rationale: "material change without supporting validation"
    });
  }

  if (summary.hasTests) {
    evidence.unshift({
      label: "Exhibit A",
      excerpt: "Test-related changes are present in the diff.",
      rationale: "the defendant submitted at least some validation"
    });
  }

  if (!normalizedPr && input.pr_body !== undefined) {
    score -= 5;
    charges.push("empty PR description");
    findings.push("A PR body field was provided but contains no usable review context.");
  }

  if (!summary.files.length) {
    score -= 15;
    charges.push("unparseable diff");
    findings.push("The server could not identify changed files from the diff format.");
    requiredActions.push("Provide a unified diff with file headers.");
  } else {
    evidence.push({
      label: "Exhibit C",
      excerpt: summary.files.slice(0, 3).join(", "),
      rationale: `${summary.files.length} file(s) changed`
    });
  }

  return {
    score: clampScore(score),
    charges: unique(charges),
    findings,
    requiredActions: unique(requiredActions),
    evidence: evidence.slice(0, 4)
  };
}

export function evaluateCourtCase(input: CourtInput): CourtVerdict {
  const style = normalizeStyle(input.style);
  const language = normalizeLanguage(input.language);
  const summary = parseDiff(input.diff);
  const { score, charges, findings, requiredActions, evidence } = buildFindings(input, summary);
  const verdict: Verdict = score >= 80 ? "approved" : score >= 60 ? "probation" : "convicted";
  const rewrites = buildRewrites(input, summary);

  const result: CourtVerdict = {
    verdict,
    score,
    charges,
    findings,
    evidence,
    sentence: sentenceFor(verdict, language),
    required_actions:
      verdict === "approved" ? requiredActions.filter((item) => item !== "Add or cite tests that prove the change.") : requiredActions,
    rewritten_subject: verdict === "approved" ? undefined : rewrites.rewritten_subject,
    rewritten_body: verdict === "approved" ? undefined : rewrites.rewritten_body,
    rewritten_pr_body: verdict === "approved" ? undefined : rewrites.rewritten_pr_body,
    rendered_opinion: ""
  };

  result.rendered_opinion = renderVerdictOpinion(result, style, language);
  return result;
}

export function renderOnly(input: CourtInput): CourtVerdict {
  return evaluateCourtCase(input);
}
