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
