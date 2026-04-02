# Commit Message Court MCP

Conventional Commits를 사법제도로 강제하는 MCP 서버다.

## Tools
- `court.prosecute_commit`
- `court.require_better_subject`
- `court.render_verdict`

## Local usage
```bash
npm install
npm test
npm run build
node dist/index.js
```

## Manual evaluation
Codex에서 MCP 툴을 직접 호출하거나, 터미널에서 CLI를 직접 실행할 수 있다.

```bash
npm run court -- manual --subject "misc" --diff-file .\sample.diff
```

staged diff 기준으로 보고 싶으면 `--diff-file` 없이 현재 index를 읽게 둘 수 있다.

## Git hook setup
로컬 자동 평가를 켜려면 아래 한 번만 실행한다.

```bash
npm run build
npm run court:install-hooks
```

설치 후 동작은 다음과 같다.

- `git commit` 시 `commit-msg` 훅이 실행되어 경고와 재작성안을 출력한다.
- `git push` 시 `pre-push` 훅이 실행되어 `convicted` 커밋을 차단한다.

## Input shape
```json
{
  "subject": "fix(auth): normalize token handling",
  "body": "Optional commit body",
  "diff": "diff --git a/src/auth.ts b/src/auth.ts\n...",
  "pr_body": "Optional PR description",
  "style": "judge",
  "language": "en"
}
```
