# whamlink-mcp

An [MCP](https://modelcontextprotocol.io) server for [whamlink](https://whamlink.com) — let any MCP client (Claude Desktop, IDEs, agents) publish a single file to a permanent, shareable link.

## Setup

1. Get an API key: register at <https://whamlink.com/app>, then create a key under **Keys**.
2. Add the server to your MCP client config, passing the key via `WHAMLINK_API_KEY`.

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "whamlink": {
      "command": "npx",
      "args": ["-y", "whamlink-mcp"],
      "env": { "WHAMLINK_API_KEY": "wl_your_key_here" }
    }
  }
}
```

Running from source instead of npm: `"command": "node", "args": ["/path/to/whamlink/mcp/dist/index.js"]` (after `npm install && npm run build` in `mcp/`).

### Environment

- `WHAMLINK_API_KEY` (optional) — your whamlink API key. If unset, the server still starts; the agent can `register` to create an account in-session (save the returned key here to persist).
- `WHAMLINK_BASE_URL` (optional) — defaults to `https://whamlink.com`.

## Tools

| Tool | What it does |
|------|--------------|
| `register` | Create an account on the user's behalf (consent + real email). Lets a new user go zero-to-published without setting a key first. |
| `publish_link` | Publish HTML / Markdown / PDF / image / text → a permanent URL. Public by default; set `visibility` to `private` / `password` / `email` to gate it. |
| `list_links` | List your published links (id, slug, mode, visibility, URL). |
| `set_link_access` | Change a link's visibility, password, shared-email list, `allowNetwork`, or title. |
| `replace_link_content` | Replace a link's content in place — the URL stays the same. |
| `delete_link` | Permanently delete a link. |

> PDF and image files aren't supported over MCP (tool args are JSON, which can't carry binary) — use the [whamlink dashboard](https://whamlink.com/app) or the multipart API for those.

**Never publish secrets, API keys, or private data.** Public links are unlisted but anyone with the URL can view them; use `private`/`password`/`email` visibility for anything sensitive.

## Develop

```bash
npm install
npm run build
npm test
```
