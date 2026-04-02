import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createCourtServer } from "../src/server.js";

const diff = `diff --git a/src/config.ts b/src/config.ts
index 1111111..2222222 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,3 +1,4 @@
+export const timeout = 5000;
`;

describe("MCP server", () => {
  it("lists all three court tools", async () => {
    const server = createCourtServer();
    const client = new Client({ name: "test-client", version: "0.1.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = await client.listTools();

    expect(result.tools.map((tool) => tool.name)).toEqual([
      "court.prosecute_commit",
      "court.require_better_subject",
      "court.render_verdict"
    ]);
  });

  it("returns structured verdict data from prosecute_commit", async () => {
    const server = createCourtServer();
    const client = new Client({ name: "test-client", version: "0.1.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = await client.callTool({
      name: "court.prosecute_commit",
      arguments: {
        subject: "misc",
        diff
      }
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent?.verdict).toBe("convicted");
    expect(result.structuredContent?.rewritten_subject).toMatch(/^chore\(config\): /);
    const text = result.content[0];
    expect(text && "text" in text ? text.text : "").toContain("Prosecution Brief");
  });

  it("returns a rewrite even when only the subject must improve", async () => {
    const server = createCourtServer();
    const client = new Client({ name: "test-client", version: "0.1.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = await client.callTool({
      name: "court.require_better_subject",
      arguments: {
        subject: "update",
        body: "Tighten wording.",
        diff
      }
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent?.required_actions).toContain(
      "Replace the subject with a concrete action and scope."
    );
    expect(result.structuredContent?.rewritten_subject).toBeTruthy();
  });
});
