#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  type WhamlinkConfig, WhamlinkError,
  registerAccount, publishLink, listLinks, deleteLink, setLinkAccess, replaceLinkContent,
} from "./client.js";

// The key is mutable: it can come from the env, or be set in-session by the `register` tool, so a
// brand-new user can go from zero to published in one conversation. cfg.apiKey is read at call time.
const cfg: WhamlinkConfig = { baseUrl: process.env.WHAMLINK_BASE_URL ?? "https://whamlink.com", apiKey: process.env.WHAMLINK_API_KEY ?? "" };

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const errText = (text: string) => ({ content: [{ type: "text" as const, text }], isError: true });
async function guard<T>(fn: () => Promise<T>, render: (r: T) => string) {
  try { return ok(render(await fn())); }
  catch (e) {
    const msg = e instanceof WhamlinkError ? `whamlink error (${e.status} ${e.code}): ${e.message}` : `whamlink request failed: ${(e as Error).message}`;
    return errText(msg);
  }
}
// Tools that act on an account need a key. Fail with a clear instruction rather than a raw 401.
const needKey = () => cfg.apiKey ? null : errText("No whamlink API key. Ask the user for consent and their real email, call `register` to create an account (or have them set WHAMLINK_API_KEY in the MCP config), then retry.");

const visibility = z.enum(["public", "private", "password", "email"]);
// Text-based modes only: MCP tool args are JSON, which can't carry binary. PDF/image files must
// go through the dashboard or the multipart API, so they're intentionally not offered here.
const mode = z.enum(["sandboxed_html", "sanitized_html", "markdown", "text"]);

const server = new McpServer({ name: "whamlink", version: "0.1.2" });

server.tool(
  "register",
  "Create a whamlink account on the USER'S behalf. Only call this with the user's explicit consent and their REAL email — a verification link is sent there. Returns an API key used for the rest of this session; tell the user to set it as WHAMLINK_API_KEY in their MCP config to keep it across restarts.",
  { email: z.string().email().describe("the user's real email"), name: z.string() },
  (a) => guard(async () => {
    const r = await registerAccount(cfg, a);
    if (r?.apiKey) cfg.apiKey = r.apiKey; // use it for the rest of this session
    return r;
  }, (r) => `Account created for ${r.user?.email ?? "the user"} — you can publish now.\nAPI key (save as WHAMLINK_API_KEY to persist): ${r.apiKey}\nA verification link was emailed; clicking it unlocks full quota (3 links allowed before verifying).`),
);

server.tool(
  "publish_link",
  "Publish text-based content (HTML, Markdown, or plain text) to a permanent whamlink URL. Links are public (unlisted) by default; set visibility to private/password/email to gate them. (PDF/image files aren't supported over MCP — use the whamlink dashboard or multipart API for those.) Never publish secrets or private data.",
  {
    mode: mode.describe("sandboxed_html (runs JS, isolated origin), sanitized_html (scripts stripped), markdown, or text"),
    content: z.string().describe("The text content to publish (UTF-8)."),
    title: z.string().optional(),
    allowNetwork: z.boolean().optional().describe("Let sandboxed/sanitized HTML load https CDN scripts/styles"),
    visibility: visibility.optional().describe("Default public. private = owner only; password = also pass `password`; email = also pass `shareEmails`"),
    password: z.string().min(6).optional(),
    shareEmails: z.array(z.string().email()).optional(),
  },
  (a) => needKey() ?? guard(() => publishLink(cfg, a), (r) => `Published: ${r.url}\n(id: ${r.id}, slug: ${r.slug})`),
);

server.tool(
  "list_links",
  "List the links you've published (id, slug, title, mode, visibility, size, URL).",
  {},
  () => needKey() ?? guard(() => listLinks(cfg), (r) =>
    !r.docs?.length ? "No links yet." :
    r.docs.map((d: any) => `• ${d.title || d.slug} — ${cfg.baseUrl}/${d.slug} [${d.mode}, ${d.visibility ?? "public"}] (id: ${d.id})`).join("\n")),
);

server.tool(
  "delete_link",
  "Permanently delete a published link by its id.",
  { id: z.string().describe("The doc id, e.g. doc_xxx (from list_links or publish_link)") },
  (a) => needKey() ?? guard(() => deleteLink(cfg, a.id), () => `Deleted ${a.id}.`),
);

server.tool(
  "set_link_access",
  "Change a link's access: visibility (public/private/password/email), password, shared email list, allowNetwork, or title.",
  {
    id: z.string(),
    visibility: visibility.optional(),
    password: z.string().min(6).optional(),
    shareEmails: z.array(z.string().email()).optional(),
    allowNetwork: z.boolean().optional(),
    title: z.string().optional(),
  },
  ({ id, ...rest }) => needKey() ?? guard(() => setLinkAccess(cfg, id, rest), () => `Updated access for ${id}.`),
);

server.tool(
  "replace_link_content",
  "Replace a link's content in place — the URL stays the same.",
  { id: z.string(), mode, content: z.string() },
  ({ id, mode, content }) => needKey() ?? guard(() => replaceLinkContent(cfg, id, { mode, content }), (r) => `Replaced content for ${id} (${r.url}).`),
);

await server.connect(new StdioServerTransport());
process.stderr.write(`whamlink-mcp connected (base: ${cfg.baseUrl})\n`);
