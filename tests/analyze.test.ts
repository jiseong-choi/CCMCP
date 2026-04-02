import { describe, expect, it } from "vitest";
import { evaluateCourtCase } from "../src/court/analyze.js";

const riskyDiff = `diff --git a/src/auth.ts b/src/auth.ts
index 1111111..2222222 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -80,6 +80,16 @@ export async function signIn() {
-  return token;
+  if (!token) {
+    throw new Error("missing token");
+  }
+  return token;
 }
`;

const testedDiff = `diff --git a/src/auth.ts b/src/auth.ts
index 1111111..2222222 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -80,6 +80,8 @@ export async function signIn() {
+  return normalizeToken(token);
 }
diff --git a/tests/auth.spec.ts b/tests/auth.spec.ts
new file mode 100644
--- /dev/null
+++ b/tests/auth.spec.ts
@@ -0,0 +1,8 @@
+describe("auth", () => {
+  test("normalizes token", () => {
+    expect(normalizeToken("abc")).toBe("abc");
+  });
+});
`;

describe("evaluateCourtCase", () => {
  it("convicts vague risky commits and suggests rewrites", () => {
    const verdict = evaluateCourtCase({
      subject: "fix stuff",
      diff: riskyDiff
    });

    expect(verdict.verdict).toBe("convicted");
    expect(verdict.score).toBeLessThan(60);
    expect(verdict.charges).toContain("vague subject line");
    expect(verdict.evidence[0]?.label).toBe("Exhibit A");
    expect(verdict.rewritten_subject).toMatch(/^fix\(auth\): /);
  });

  it("rewards test evidence for a precise conventional subject", () => {
    const verdict = evaluateCourtCase({
      subject: "fix(auth): normalize token handling",
      body: "Explain why the token is normalized before returning it.",
      diff: testedDiff
    });

    expect(verdict.verdict).toBe("approved");
    expect(verdict.score).toBeGreaterThanOrEqual(80);
    expect(verdict.evidence[0]?.excerpt).toContain("Test-related changes");
    expect(verdict.rewritten_subject).toBeUndefined();
  });

  it("renders distinct courtroom opinions", () => {
    const judgeOpinion = evaluateCourtCase({
      subject: "fix stuff",
      diff: riskyDiff,
      style: "judge"
    }).rendered_opinion;

    const prosecutorOpinion = evaluateCourtCase({
      subject: "fix stuff",
      diff: riskyDiff,
      style: "prosecutor"
    }).rendered_opinion;

    expect(judgeOpinion).toContain("Court Opinion");
    expect(prosecutorOpinion).toContain("Prosecution Brief");
    expect(prosecutorOpinion).not.toEqual(judgeOpinion);
    expect(judgeOpinion).toMatchInlineSnapshot(`
      "# Court Opinion

      This court finds the defendant commit convicted.

      Score: 0/100

      Charges: vague subject line, non-conventional title, underspecified narrative, high-risk area touched, missing test evidence

      Exhibits

      - Exhibit A: No updated test file found in the submitted diff. (material change without supporting validation)
      - Exhibit B: src/auth.ts line 1 (auth pathway touched)
      - Exhibit C: src/auth.ts (1 file(s) changed)

      Sentence: Convicted. Rewrite the subject, explain the change, and produce testable evidence.

      Required actions

      - Replace the subject with a concrete action and scope.
      - Use <type>(<scope>): <summary> format.
      - Add or cite tests that prove the change."
    `);
  });
});
