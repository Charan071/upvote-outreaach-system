/**
 * LinkedIn actions go through Unipile (hosted session), not Composio and not
 * the official LinkedIn Marketing API. Composio's LinkedIn toolkit is posting
 * (posts/comments/org) with no invite/inbox triggers.
 *
 * Credentials stay on Unipile. This app stores UNIPILE_DSN, UNIPILE_TOKEN, and
 * one UNIPILE_ACCOUNT_ID. Do not store LinkedIn passwords, cookies, user-agents,
 * or proxies. Hosted Auth connect/disconnect for multiple accounts is parked.
 */
type UnipileProfile = {
  provider_id?: string;
  public_identifier?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
};

export class UnipileError extends Error {
  status: number;
  type: string;

  constructor(status: number, message: string, type = "") {
    super(`Unipile ${status}: ${message}`);
    this.name = "UnipileError";
    this.status = status;
    this.type = type;
  }
}

function errorType(json: unknown) {
  if (!json || typeof json !== "object") return "";
  const row = json as { type?: unknown; error?: unknown };
  return String(row.type || row.error || "");
}

function errorMessage(json: unknown, fallback: string) {
  if (json && typeof json === "object") {
    const row = json as { message?: unknown; detail?: unknown; title?: unknown };
    if (row.detail) return String(row.detail);
    if (row.message) return String(row.message);
    if (row.title) return String(row.title);
  }
  return fallback;
}

export function linkedInAccountConfigured() {
  return Boolean(process.env.UNIPILE_DSN && process.env.UNIPILE_TOKEN && process.env.UNIPILE_ACCOUNT_ID);
}

export function linkedInAccountId() {
  return process.env.UNIPILE_ACCOUNT_ID || "";
}

export function isOurUnipileAccount(accountId?: string | null) {
  const ours = linkedInAccountId();
  if (!accountId) return true;
  if (!ours) return true;
  return accountId === ours;
}

function config() {
  const dsn = process.env.UNIPILE_DSN?.replace(/\/$/, "");
  const token = process.env.UNIPILE_TOKEN;
  const accountId = process.env.UNIPILE_ACCOUNT_ID;
  if (!dsn || !token || !accountId) {
    throw new Error("Unipile is not configured. Set UNIPILE_DSN, UNIPILE_TOKEN, and UNIPILE_ACCOUNT_ID.");
  }
  return { dsn, token, accountId };
}

async function unipileFetch(path: string, init: RequestInit = {}) {
  const { dsn, token } = config();
  const res = await fetch(`${dsn}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "X-API-KEY": token,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new UnipileError(res.status, errorMessage(json, text.slice(0, 400) || res.statusText), errorType(json));
  }
  return json;
}

export async function getLinkedInAccount(): Promise<{ id: string; status: string }> {
  const { accountId } = config();
  const data = (await unipileFetch(`/api/v1/accounts/${encodeURIComponent(accountId)}`)) as {
    id?: string;
    status?: string;
    sources?: Array<{ status?: string }>;
  };
  const status = String(data.sources?.[0]?.status || data.status || "OK").toUpperCase();
  return { id: data.id || accountId, status };
}

export function isLinkedInLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const type = error instanceof UnipileError ? error.type : "";
  const status = error instanceof UnipileError ? error.status : 0;
  return (
    status === 422 ||
    status === 429 ||
    status === 500 ||
    /cannot_resend|restriction|limit|too many/i.test(`${type} ${message}`)
  );
}

export async function getLinkedInProfile(slug: string): Promise<{
  providerId: string;
  publicIdentifier: string;
  firstName: string;
  lastName: string;
  headline: string;
}> {
  const { accountId } = config();
  const data = (await unipileFetch(
    `/api/v1/users/${encodeURIComponent(slug)}?account_id=${encodeURIComponent(accountId)}`,
  )) as UnipileProfile;

  const providerId = data.provider_id;
  const firstName = (data.first_name ?? "").trim();
  if (!providerId || !firstName) {
    throw new Error("Unipile returned a profile without first_name or provider_id.");
  }

  return {
    providerId,
    publicIdentifier: data.public_identifier ?? slug,
    firstName,
    lastName: (data.last_name ?? "").trim(),
    headline: (data.headline ?? "").trim(),
  };
}

export async function sendInvitation(providerId: string, message: string) {
  const { accountId } = config();
  return unipileFetch("/api/v1/users/invite", {
    method: "POST",
    body: JSON.stringify({
      provider_id: providerId,
      account_id: accountId,
      message,
    }),
  });
}

export async function startChat(providerId: string, text: string) {
  const { accountId } = config();
  const body = new FormData();
  body.append("account_id", accountId);
  body.append("text", text);
  body.append("attendees_ids", providerId);

  const { dsn, token } = config();
  const res = await fetch(`${dsn}/api/v1/chats`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "X-API-KEY": token,
    },
    body,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new UnipileError(
      res.status,
      errorMessage(json, JSON.stringify(json) || res.statusText),
      errorType(json),
    );
  }
  return json;
}

export async function listChats() {
  const { accountId } = config();
  return unipileFetch(`/api/v1/chats?account_id=${encodeURIComponent(accountId)}&limit=50`);
}

export async function listChatMessages(chatId: string) {
  return unipileFetch(`/api/v1/chats/${encodeURIComponent(chatId)}/messages?limit=30`);
}
