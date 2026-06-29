import { describe, it, expect, vi } from "vitest";
import { registerAccount, publishLink, listLinks, deleteLink, setLinkAccess, replaceLinkContent, WhamlinkError, type WhamlinkConfig } from "../src/client.js";

function mockFetch(status: number, json: unknown, capture?: (url: string, init: any) => void) {
  return vi.fn(async (url: string, init: any) => {
    capture?.(url, init);
    return { status, ok: status >= 200 && status < 300, text: async () => (json === undefined ? "" : JSON.stringify(json)) } as any;
  });
}
const cfg = (fetchImpl: any): WhamlinkConfig => ({ baseUrl: "https://x.test", apiKey: "wl_test", fetchImpl });

describe("whamlink mcp client", () => {
  it("publish posts to /v1/publish with the api key and returns the body", async () => {
    let seen: any;
    const f = mockFetch(201, { id: "doc_1", slug: "abc", url: "https://x.test/abc" }, (u, i) => (seen = { u, i }));
    const r = await publishLink(cfg(f), { mode: "text", content: "hi", visibility: "private" });
    expect(seen.u).toBe("https://x.test/v1/publish");
    expect(seen.i.method).toBe("POST");
    expect(seen.i.headers["x-api-key"]).toBe("wl_test");
    expect(JSON.parse(seen.i.body)).toEqual({ mode: "text", content: "hi", visibility: "private" });
    expect(r.url).toBe("https://x.test/abc");
  });

  it("list GETs /v1/docs", async () => {
    let seen: any;
    const f = mockFetch(200, { docs: [] }, (u, i) => (seen = { u, i }));
    await listLinks(cfg(f));
    expect(seen.u).toBe("https://x.test/v1/docs");
    expect(seen.i.method).toBe("GET");
  });

  it("delete returns undefined on 204 and encodes the id", async () => {
    let seen: any;
    const f = mockFetch(204, undefined, (u, i) => (seen = { u, i }));
    const r = await deleteLink(cfg(f), "doc/../x");
    expect(seen.u).toBe("https://x.test/v1/docs/doc%2F..%2Fx");
    expect(seen.i.method).toBe("DELETE");
    expect(r).toBeUndefined();
  });

  it("set_link_access PATCHes the doc", async () => {
    let seen: any;
    const f = mockFetch(200, { id: "doc_1" }, (u, i) => (seen = { u, i }));
    await setLinkAccess(cfg(f), "doc_1", { visibility: "password", password: "hunter2" });
    expect(seen.u).toBe("https://x.test/v1/docs/doc_1");
    expect(seen.i.method).toBe("PATCH");
    expect(JSON.parse(seen.i.body).visibility).toBe("password");
  });

  it("replace_link_content PUTs to /content", async () => {
    let seen: any;
    const f = mockFetch(200, { url: "https://x.test/abc" }, (u, i) => (seen = { u, i }));
    await replaceLinkContent(cfg(f), "doc_1", { mode: "markdown", content: "# new" });
    expect(seen.u).toBe("https://x.test/v1/docs/doc_1/content");
    expect(seen.i.method).toBe("PUT");
  });

  it("register POSTs to /v1/auth/register WITHOUT an api key", async () => {
    let seen: any;
    const f = mockFetch(201, { user: { email: "a@b.com" }, apiKey: "wl_new" }, (u, i) => (seen = { u, i }));
    const r = await registerAccount({ baseUrl: "https://x.test", apiKey: "", fetchImpl: f }, { email: "a@b.com", name: "A" });
    expect(seen.u).toBe("https://x.test/v1/auth/register");
    expect(seen.i.method).toBe("POST");
    expect(seen.i.headers["x-api-key"]).toBeUndefined(); // no auth on register
    expect(r.apiKey).toBe("wl_new");
  });

  it("throws WhamlinkError with the API code/message on failure", async () => {
    const f = mockFetch(403, { error: { code: "verification_required", message: "verify first" } });
    await expect(publishLink(cfg(f), { mode: "text", content: "x" })).rejects.toMatchObject({ code: "verification_required", status: 403 });
    await expect(publishLink(cfg(f), { mode: "text", content: "x" })).rejects.toBeInstanceOf(WhamlinkError);
  });
});
