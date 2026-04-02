#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { courtInputSchema } from "./court/schemas.js";
import { formatVerdictSummary, prosecuteCommit, requireBetterSubject } from "./court/shared.js";
import { CourtInput, CourtVerdict } from "./court/types.js";

type CommandName = "manual" | "commit-msg" | "pre-push" | "install-hooks";

interface ParsedArgs {
  command: CommandName;
  options: Record<string, string | boolean>;
}

interface CommitRecord {
  sha: string;
  subject: string;
  body?: string;
  diff: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "manual", ...rest] = argv;
  if (!["manual", "commit-msg", "pre-push", "install-hooks"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    i += 1;
  }

  return {
    command: command as CommandName,
    options
  };
}

function asString(options: Record<string, string | boolean>, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}

function runGit(args: string[], cwd = process.cwd()): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8"
  }).trimEnd();
}

function readFileText(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function parseMessageFile(filePath: string): { subject: string; body?: string } {
  const content = readFileText(filePath).replace(/\r\n/g, "\n");
  const lines = content
    .split("\n")
    .filter((line, index, arr) => !(index > 0 && index === arr.length - 1 && line === ""));
  const subject = lines[0]?.trim() ?? "";
  const body = lines.slice(1).join("\n").trim();
  return {
    subject,
    body: body || undefined
  };
}

function getStagedDiff(): string {
  return runGit(["diff", "--cached", "--patch", "--minimal"]);
}

function getCommitRecord(sha: string): CommitRecord {
  const rawMessage = runGit(["log", "-1", "--format=%s%n%n%b", sha]);
  const [subjectLine, ...rest] = rawMessage.split("\n");
  return {
    sha,
    subject: subjectLine.trim(),
    body: rest.join("\n").trim() || undefined,
    diff: runGit(["show", "--format=", "--patch", sha])
  };
}

function parsePushStdin(stdinText: string): Array<{
  localRef: string;
  localSha: string;
  remoteRef: string;
  remoteSha: string;
}> {
  return stdinText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
      if (!localRef || !localSha || !remoteRef || !remoteSha) {
        throw new Error(`Malformed pre-push input line: ${line}`);
      }
      return { localRef, localSha, remoteRef, remoteSha };
    });
}

function isZeroSha(sha: string): boolean {
  return /^0+$/.test(sha);
}

function listCommitsForPush(localSha: string, remoteSha: string): string[] {
  if (isZeroSha(localSha)) return [];
  if (isZeroSha(remoteSha)) {
    const output = runGit(["rev-list", "--reverse", localSha, "--not", "--all"]);
    return output ? output.split(/\r?\n/).filter(Boolean) : [localSha];
  }

  const output = runGit(["rev-list", "--reverse", `${remoteSha}..${localSha}`]);
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}

function printVerdict(verdict: CourtVerdict, prefix?: string): void {
  const output = prefix ? `${prefix}\n${formatVerdictSummary(verdict)}` : formatVerdictSummary(verdict);
  process.stdout.write(`${output}\n`);
}

function judgeInput(input: CourtInput, mode: "manual" | "commit-msg" | "pre-push"): CourtVerdict {
  if (mode === "manual" || mode === "pre-push") {
    return prosecuteCommit(input);
  }

  return requireBetterSubject(input);
}

function handleManual(options: Record<string, string | boolean>): number {
  const diff = asString(options, "diff-file")
    ? readFileText(path.resolve(process.cwd(), asString(options, "diff-file")!))
    : asString(options, "diff")
      ?? (options["diff-stdin"] ? fs.readFileSync(0, "utf8") : getStagedDiff());

  const input = courtInputSchema.parse({
    subject: asString(options, "subject") ?? "",
    body: asString(options, "body"),
    diff,
    pr_body: asString(options, "pr-body"),
    style: asString(options, "style"),
    language: asString(options, "language")
  });

  const verdict = judgeInput(input, "manual");
  printVerdict(verdict);
  return verdict.verdict === "convicted" ? 1 : 0;
}

function handleCommitMsg(options: Record<string, string | boolean>): number {
  const messageFile = asString(options, "message-file");
  if (!messageFile) {
    throw new Error("--message-file is required for commit-msg mode");
  }

  const message = parseMessageFile(path.resolve(process.cwd(), messageFile));
  const verdict = judgeInput(
    {
      subject: message.subject,
      body: message.body,
      diff: getStagedDiff(),
      style: "judge",
      language: "en"
    },
    "commit-msg"
  );

  printVerdict(verdict, "[commit-msg] Warning-only mode");
  return 0;
}

function handlePrePush(options: Record<string, string | boolean>): number {
  const stdinText = options.stdin ? fs.readFileSync(0, "utf8") : "";
  const refs = parsePushStdin(stdinText);
  const failures: string[] = [];

  for (const ref of refs) {
    const commits = listCommitsForPush(ref.localSha, ref.remoteSha);
    for (const sha of commits) {
      const commit = getCommitRecord(sha);
      const verdict = judgeInput(
        {
          subject: commit.subject,
          body: commit.body,
          diff: commit.diff,
          style: "prosecutor",
          language: "en"
        },
        "pre-push"
      );
      printVerdict(verdict, `[pre-push] ${sha} ${ref.localRef} -> ${ref.remoteRef}`);
      if (verdict.verdict === "convicted") {
        failures.push(`${sha}: ${verdict.rewritten_subject ?? verdict.sentence}`);
      }
    }
  }

  if (failures.length > 0) {
    process.stderr.write(`Push rejected by Commit Message Court:\n- ${failures.join("\n- ")}\n`);
    return 1;
  }

  return 0;
}

function handleInstallHooks(): number {
  runGit(["config", "core.hooksPath", ".githooks"]);
  process.stdout.write("Configured git core.hooksPath to .githooks\n");
  return 0;
}

export async function runCli(argv: string[]): Promise<number> {
  const { command, options } = parseArgs(argv);

  if (command === "install-hooks") return handleInstallHooks();
  if (command === "commit-msg") return handleCommitMsg(options);
  if (command === "pre-push") return handlePrePush(options);
  return handleManual(options);
}

if (process.argv[1] && (process.argv[1].endsWith("cli.ts") || process.argv[1].endsWith("cli.js"))) {
  runCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
