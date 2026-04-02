export type CourtStyle = "judge" | "prosecutor" | "defense";
export type CourtLanguage = "en" | "ko";
export type Verdict = "approved" | "probation" | "convicted";

export interface CourtInput {
  subject: string;
  body?: string;
  diff: string;
  pr_body?: string;
  style?: CourtStyle;
  language?: CourtLanguage;
}

export interface EvidenceItem {
  label: string;
  excerpt: string;
  rationale: string;
}

export interface CourtVerdict {
  verdict: Verdict;
  score: number;
  charges: string[];
  findings: string[];
  evidence: EvidenceItem[];
  sentence: string;
  required_actions: string[];
  rewritten_subject?: string;
  rewritten_body?: string;
  rewritten_pr_body?: string;
  rendered_opinion: string;
}

export interface DiffSummary {
  files: string[];
  added: number;
  removed: number;
  hunkAnchors: Array<{ file: string; line: number }>;
  hasTests: boolean;
  riskyAnchors: Array<{ file: string; line: number; reason: string }>;
  keywords: string[];
}
