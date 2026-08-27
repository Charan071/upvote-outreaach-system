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
  network_distance?: string;
  is_relationship?: boolean;
  specifics?: {
    network_distance?: string;
    is_relationship?: boolean;
  };
};

function stringField(value: unknown) {
  return typeof value === "string" ? value : "";
}

function profileRelation(data: UnipileProfile) {
  return {
    networkDistance: stringField(data.network_distance) || stringField(data.specifics?.network_distance),
    isRelationship: data.is_relationship === true || data.specifics?.is_relationship === true,
  };
}

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

/** True only for hard LinkedIn/Unipile rate limits that should pause sending. */
export function isLinkedInLimitError(error: unknown) {
  if (isAlreadyInvitedError(error) || isAlreadyConnectedError(error)) return false;
  const message = error instanceof Error ? error.message : String(error);
  const type = error instanceof UnipileError ? error.type : "";
  const status = error instanceof UnipileError ? error.status : 0;
  const blob = `${type} ${message}`;
  if (status === 429 || status === 500) return true;
  return /cannot_resend_yet|rate.?limit|too many|restriction|temporarily.?throttl/i.test(blob);
}

export function isAlreadyConnectedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const type = error instanceof UnipileError ? error.type : "";
  return /already.?connect|already.?relation|first_degree/i.test(`${type} ${message}`);
}

/** Pending invite already exists for this recipient — skip, do not pause. */
export function isAlreadyInvitedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const type = error instanceof UnipileError ? error.type : "";
  const blob = `${type} ${message}`;
  return (
    /already been sent|invitation has already been sent|already.?invited|pending.?invitation/i.test(blob) ||
    (/cannot_resend/i.test(blob) && /recipient|already/i.test(blob))
  );
}

type SentInvitation = {
  id?: string;
  invited_user_id?: string | null;
  invited_user_public_id?: string | null;
};

type SentInvitationCache = {
  expiresAt: number;
  byProviderId: Set<string>;
  byPublicId: Set<string>;
};

let sentInvitationCache: SentInvitationCache | null = null;
const SENT_INVITE_CACHE_MS = 5 * 60 * 1000;

function normalizePublicId(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "")
    .replace(/\/+$/, "");
}

export async function listSentInvitations(opts?: { force?: boolean }): Promise<SentInvitationCache> {
  const now = Date.now();
  if (!opts?.force && sentInvitationCache && sentInvitationCache.expiresAt > now) {
    return sentInvitationCache;
  }

  const { accountId } = config();
  const byProviderId = new Set<string>();
  const byPublicId = new Set<string>();
  let cursor: string | undefined;

  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({
      account_id: accountId,
      limit: "100",
    });
    if (cursor) params.set("cursor", cursor);
    const data = (await unipileFetch(`/api/v1/users/invite/sent?${params}`)) as {
      items?: SentInvitation[];
      cursor?: string | null;
    };
    for (const item of data.items || []) {
      if (item.invited_user_id) byProviderId.add(String(item.invited_user_id));
      const publicId = normalizePublicId(item.invited_user_public_id);
      if (publicId) byPublicId.add(publicId);
    }
    cursor = data.cursor || undefined;
    if (!cursor) break;
  }

  sentInvitationCache = {
    expiresAt: now + SENT_INVITE_CACHE_MS,
    byProviderId,
    byPublicId,
  };
  return sentInvitationCache;
}

export async function hasPendingSentInvitation(input: {
  providerId?: string | null;
  linkedinSlug?: string | null;
}) {
  const cache = await listSentInvitations();
  if (input.providerId && cache.byProviderId.has(input.providerId)) return true;
  const slug = normalizePublicId(input.linkedinSlug);
  if (slug && cache.byPublicId.has(slug)) return true;
  return false;
}

export function clearSentInvitationCache() {
  sentInvitationCache = null;
}

export type LinkedInRelation = {
  providerId: string;
  publicIdentifier: string;
};

/**
 * First-degree connections, newest first. Reconciles accepted invites the
 * new_relation webhook misses.
 *
 * Unipile flags frequent or deep polling of this endpoint as automation, so
 * routine runs should take page 1 only. Deeper sweeps are for initial sync.
 * https://developer.unipile.com/docs/provider-limits-and-restrictions
 */
export async function listRelations(opts?: { maxPages?: number }): Promise<LinkedInRelation[]> {
  const { accountId } = config();
  const out: LinkedInRelation[] = [];
  let cursor: string | undefined;
  const maxPages = Math.max(1, opts?.maxPages ?? 10);

  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({ account_id: accountId, limit: "100" });
    if (cursor) params.set("cursor", cursor);
    const data = (await unipileFetch(`/api/v1/users/relations?${params}`)) as {
      items?: Array<{ provider_id?: string; public_identifier?: string }>;
      cursor?: string | null;
    };
    for (const item of data.items || []) {
      out.push({
        providerId: String(item.provider_id || ""),
        publicIdentifier: normalizePublicId(item.public_identifier),
      });
    }
    cursor = data.cursor || undefined;
    if (!cursor) break;
  }

  return out;
}

export async function getLinkedInProfile(slug: string): Promise<{
  providerId: string;
  publicIdentifier: string;
  firstName: string;
  lastName: string;
  headline: string;
  networkDistance: string;
  isRelationship: boolean;
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

  const relation = profileRelation(data);
  return {
    providerId,
    publicIdentifier: data.public_identifier ?? slug,
    firstName,
    lastName: (data.last_name ?? "").trim(),
    headline: (data.headline ?? "").trim(),
    networkDistance: relation.networkDistance,
    isRelationship: relation.isRelationship,
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
