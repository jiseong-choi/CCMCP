import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { evaluateCourtCase } from "./court/analyze.js";
import { courtInputSchema, toolInputShape } from "./court/schemas.js";
import { CourtInput, CourtVerdict } from "./court/types.js";

function asToolResult(verdict: CourtVerdict, isError = false) {
  return {
    content: [
      {
        type: "text" as const,
        text: verdict.rendered_opinion
      }
    ],
    structuredContent: verdict as unknown as Record<string, unknown>,
    isError
  };
}

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

export function createCourtServer(): McpServer {
  const server = new McpServer({
    name: "commit-message-court",
    version: "0.1.0"
  });

  server.registerTool(
    "court.prosecute_commit",
    {
      title: "Prosecute Commit",
      description: "Put a commit subject and diff on trial and return a structured verdict.",
      inputSchema: toolInputShape,
      outputSchema: z.record(z.unknown())
    },
    async (args) => {
      const verdict = prosecuteCommit(courtInputSchema.parse(args));
      return asToolResult(verdict, verdict.verdict === "convicted");
    }
  );

  server.registerTool(
    "court.require_better_subject",
    {
      title: "Require Better Subject",
      description: "Force a better commit subject and provide rewrite suggestions.",
      inputSchema: toolInputShape,
      outputSchema: z.record(z.unknown())
    },
    async (args) => {
      const verdict = requireBetterSubject(courtInputSchema.parse(args));
      return asToolResult(verdict, verdict.verdict !== "approved");
    }
  );

  server.registerTool(
    "court.render_verdict",
    {
      title: "Render Verdict",
      description: "Render the courtroom opinion for a commit message case.",
      inputSchema: toolInputShape,
      outputSchema: z.record(z.unknown())
    },
    async (args) => {
      const verdict = renderVerdict(courtInputSchema.parse(args));
      return asToolResult(verdict, false);
    }
  );

  return server;
}
