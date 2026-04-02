# Commit Conventional Message Court MCP

Please write better commits with AI.

Give this repo to your AI and ask it to install the MCP for you.

Seriously. That is a valid setup flow.

I take your vague commit messages, drag them into court, point at the diff, and ask the question your teammates are too tired to ask:

"What exactly did you do?"

## Add to Codex

Add this to [`~/.codex/config.toml`](C:\Users\chrisdnm\.codex\config.toml):

```toml
[mcp_servers.commit-message-court]
command = "node"
args = ['C:\Users\chrisdnm\Desktop\commimWizard\dist\index.js']
```

Then restart Codex.

## Add to Claude Code

On Windows, add it as a local stdio server with:

```bash
claude mcp add --transport stdio commit-message-court -- node C:\Users\chrisdnm\Desktop\commimWizard\dist\index.js
```

If you want it available everywhere, add `--scope user`.

```bash
claude mcp add --transport stdio --scope user commit-message-court -- node C:\Users\chrisdnm\Desktop\commimWizard\dist\index.js
```

## Add to Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "commit-message-court": {
      "type": "stdio",
      "command": "node",
      "args": ["where code is"],
      "env": {}
    }
  }
}
```

Then restart Claude Desktop.

## What This Thing Does

- It sees `fix stuff` and objects.
- It sees `final_final_real` and requests counsel.
- It sees a risky diff and asks for evidence.
- It sees your commit history and tries, against all odds, to make it readable.
