// Thin, testable wrapper over the whamlink HTTP API. API-key auth — no CSRF header needed
// (the app only requires x-whamlink-app on cookie-authenticated requests).

export interface WhamlinkConfig {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export class WhamlinkError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "WhamlinkError";
  }
}

export type Visibility = "public" | "private" | "password" | "email";
export type Mode = "sandboxed_html" | "sanitized_html" | "markdown" | "pdf" | "image" | "text";

export interface PublishArgs {
  mode: Mode;
  content: string;
  title?: string;
  allowNetwork?: boolean;
  visibility?: Visibility;
  password?: string;
  shareEmails?: string[];
}

export interface AccessArgs {
  visibility?: Visibility;
  password?: string;
  shareEmails?: string[];
  allowNetwork?: boolean;
  title?: string;
}

async function call(cfg: WhamlinkConfig, method: string, path: string, body?: unknown): Promise<any> {
  const f = cfg.fetchImpl ?? fetch;
  const res = await f(`${cfg.baseUrl}${path}`, {
    method,
    headers: { "x-api-key": cfg.apiKey, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined;
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new WhamlinkError(json?.error?.code ?? "error", json?.error?.message ?? `Request failed (${res.status})`, res.status);
  }
  return json;
}

// Register a new account. No auth (there's no key yet) — returns { user, apiKey, _setup }.
export async function registerAccount(cfg: WhamlinkConfig, args: { email: string; name: string }): Promise<any> {
  const f = cfg.fetchImpl ?? fetch;
  const res = await f(`${cfg.baseUrl}/v1/auth/register`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(args),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new WhamlinkError(json?.error?.code ?? "error", json?.error?.message ?? `Register failed (${res.status})`, res.status);
  return json;
}

export const publishLink = (cfg: WhamlinkConfig, args: PublishArgs) => call(cfg, "POST", "/v1/publish", args);
export const listLinks = (cfg: WhamlinkConfig) => call(cfg, "GET", "/v1/docs");
export const deleteLink = (cfg: WhamlinkConfig, id: string) => call(cfg, "DELETE", `/v1/docs/${encodeURIComponent(id)}`);
export const setLinkAccess = (cfg: WhamlinkConfig, id: string, args: AccessArgs) => call(cfg, "PATCH", `/v1/docs/${encodeURIComponent(id)}`, args);
export const replaceLinkContent = (cfg: WhamlinkConfig, id: string, args: { mode: Mode; content: string }) =>
  call(cfg, "PUT", `/v1/docs/${encodeURIComponent(id)}/content`, args);
