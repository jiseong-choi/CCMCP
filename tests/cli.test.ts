import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8"
  }).trim();
}

function withCwd<T>(cwd: string, cb: () => T): T {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return cb();
  } finally {
    process.chdir(previous);
  }
}

async function withCwdAsync<T>(cwd: string, cb: () => Promise<T>): Promise<T> {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return await cb();
  } finally {
    process.chdir(previous);
  }
}

function createTempRepo(): { repoDir: string; remoteDir: string } {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "court-cli-"));
  const repoDir = path.join(base, "repo");
  const remoteDir = path.join(base, "remote.git");
  fs.mkdirSync(repoDir, { recursive: true });
  git(["init"], repoDir);
  git(["config", "user.name", "Court Tester"], repoDir);
  git(["config", "user.email", "court@example.com"], repoDir);
  fs.writeFileSync(path.join(repoDir, "README.md"), "# temp\n", "utf8");
  git(["add", "README.md"], repoDir);
  git(["commit", "-m", "docs(readme): add temp readme"], repoDir);
  git(["init", "--bare", remoteDir], repoDir);
  git(["remote", "add", "origin", remoteDir], repoDir);
  git(["push", "-u", "origin", "master"], repoDir);
  return { repoDir, remoteDir };
}

describe("CLI", () => {
  let tempRoot: string | undefined;

  beforeEach(() => {
    tempRoot = undefined;
  });

  afterEach(() => {
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("manual mode returns failure for convicted commit text", async () => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "court-manual-"));
    tempRoot = repoDir;
    const diffFile = path.join(repoDir, "change.diff");
    fs.writeFileSync(
      diffFile,
      `diff --git a/src/auth.ts b/src/auth.ts\n--- a/src/auth.ts\n+++ b/src/auth.ts\n@@ -1 +1,4 @@\n+throw new Error("bad");\n`,
      "utf8"
    );

    const code = await runCli(["manual", "--subject", "misc", "--diff-file", diffFile]);
    expect(code).toBe(1);
  });

  it("commit-msg mode warns but does not block", async () => {
    const { repoDir } = createTempRepo();
    tempRoot = path.dirname(repoDir);
    fs.writeFileSync(path.join(repoDir, "src.txt"), "change\n", "utf8");
    git(["add", "src.txt"], repoDir);
    const messageFile = path.join(repoDir, ".git", "COMMIT_EDITMSG");
    fs.writeFileSync(messageFile, "misc\n\nbody\n", "utf8");

    const code = await withCwdAsync(repoDir, () => runCli(["commit-msg", "--message-file", messageFile]));
    expect(code).toBe(0);
  });

  it("pre-push mode rejects convicted commits", () => {
    const { repoDir } = createTempRepo();
    tempRoot = path.dirname(repoDir);
    fs.mkdirSync(path.join(repoDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(repoDir, "src", "auth.ts"), "export const token = true;\n", "utf8");
    git(["add", "."], repoDir);
    git(["commit", "-m", "misc"], repoDir);
    const localSha = git(["rev-parse", "HEAD"], repoDir);
    const remoteSha = git(["rev-parse", "origin/master"], repoDir);

    const result = spawnSync(
      process.execPath,
      [path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), path.join(process.cwd(), "src", "cli.ts"), "pre-push", "--stdin"],
      {
        cwd: repoDir,
        encoding: "utf8",
        input: `refs/heads/master ${localSha} refs/heads/master ${remoteSha}\n`
      }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Push rejected by Commit Message Court");
  });

  it("install-hooks configures core.hooksPath", async () => {
    const { repoDir } = createTempRepo();
    tempRoot = path.dirname(repoDir);

    const code = await withCwdAsync(repoDir, () => runCli(["install-hooks"]));
    expect(code).toBe(0);
    expect(git(["config", "--get", "core.hooksPath"], repoDir)).toBe(".githooks");
  });
});
