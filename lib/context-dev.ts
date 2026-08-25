import ContextDev, { APIError, RateLimitError } from "context.dev";
import type { WebSearchResponse } from "context.dev/resources";
import { prisma } from "./prisma";

const SOCIAL_HOSTS = new Set([
  "linkedin.com",
  "www.linkedin.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "pinterest.com",
  "reddit.com",
]);

let client: ContextDev | null = null;

function getClient() {
  if (!process.env.CONTEXT_DEV_API_KEY) {
    throw new Error("Context.dev is not configured. Set CONTEXT_DEV_API_KEY.");
  }
  if (!client) client = new ContextDev();
  return client;
}

export function isContextDevConfigured() {
  return Boolean(process.env.CONTEXT_DEV_API_KEY);
}

export function dailyCreditBudget() {
  const parsed = Number(process.env.CONTEXT_DEV_DAILY_CREDIT_BUDGET ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export async function getCreditStatus() {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  const today = await prisma.discoveryRun.findUnique({
    where: { dayKey: new Date().toISOString().slice(0, 10) },
  });
  const usedFromRun = today?.creditsUsed ?? 0;
  const usedToday = Math.max(settings?.contextCreditsUsedToday ?? 0, usedFromRun);
  return {
    remaining: settings?.contextCreditsRemaining ?? null,
    usedToday,
    dailyBudget: dailyCreditBudget(),
  };
}

async function assertCreditBudget(cost: number) {
  const { usedToday, dailyBudget, remaining } = await getCreditStatus();
  if (remaining != null && remaining < cost) {
    throw new Error(`Context.dev is out of credits (${remaining} left).`);
  }
  if (usedToday + cost > dailyBudget) {
    throw new Error(
      `Context.dev daily budget is ${dailyBudget} credit${dailyBudget === 1 ? "" : "s"}. Already used ${usedToday} today.`,
    );
  }
}

async function recordCredits(meta?: { credits_consumed?: number; credits_remaining?: number } | null) {
  if (!meta) return;
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  if (!settings) return;
  await prisma.settings.update({
    where: { id: "default" },
    data: {
      ...(typeof meta.credits_remaining === "number" ? { contextCreditsRemaining: meta.credits_remaining } : {}),
      ...(typeof meta.credits_consumed === "number" && meta.credits_consumed > 0
        ? { contextCreditsUsedToday: { increment: meta.credits_consumed } }
        : {}),
    },
  });
}

function retryAfterMs(err: APIError, attempt: number) {
  const header = err.headers?.get("Retry-After");
  const seconds = header ? Number(header) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  return 2 ** attempt * 1000;
}

function isRetryable(err: unknown): err is APIError {
  return err instanceof RateLimitError;
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryable(err) || attempt === maxAttempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs(err, attempt)));
    }
  }
  throw new Error("unreachable");
}

export type WebSearchHit = WebSearchResponse["results"][number];

export type SearchWebOptions = {
  numResults?: number;
  freshness?: "last_24_hours" | "last_week" | "last_month" | "last_year";
  includeDomains?: string[];
  excludeDomains?: string[];
};

export async function searchWeb(
  query: string,
  options: number | SearchWebOptions = 10,
): Promise<WebSearchResponse> {
  const opts = typeof options === "number" ? { numResults: options } : options;
  await assertCreditBudget(1);
  const response = await withRetry(() =>
    getClient().web.search({
      query,
      numResults: opts.numResults ?? 10,
      freshness: opts.freshness,
      includeDomains: opts.includeDomains,
      excludeDomains: opts.excludeDomains ?? ["pinterest.com"],
    }),
  );
  await recordCredits(response.key_metadata);
  return response;
}

export async function retrieveBrandByDomain(_domain: string): Promise<never> {
  throw new Error("Brand retrieve costs 10 credits and is disabled. Use searchWeb only.");
}

export async function retrieveBrandByName(_name: string): Promise<never> {
  throw new Error("Brand retrieve costs 10 credits and is disabled. Use searchWeb only.");
}

export async function extractFromUrl(
  _url: string,
  _schema: Record<string, unknown>,
  _instructions?: string,
): Promise<never> {
  throw new Error("Extract costs 10 credits and is disabled. Use searchWeb only.");
}

export type PublicProfileContext = {
  company: string | null;
  companyDomain: string | null;
  snippet: string | null;
  sourceUrl: string | null;
};

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function companyFromHeadline(headline: string | null | undefined) {
  if (!headline) return null;
  const match = headline.match(/\b(?:at|@)\s+([^|•,/\-]+)/i);
  const name = match?.[1]?.replace(/\s+/g, " ").trim();
  return name && name.length >= 2 ? name : null;
}

export function pickPublicContext(
  hits: WebSearchHit[],
  fallbackCompany: string | null,
): PublicProfileContext {
  const publicHit =
    hits.find((hit) => {
      const host = hostOf(hit.url);
      return host && !SOCIAL_HOSTS.has(host);
    }) ?? hits[0];

  if (!publicHit) {
    return { company: fallbackCompany, companyDomain: null, snippet: null, sourceUrl: null };
  }

  const host = hostOf(publicHit.url);
  const companyDomain = host && !SOCIAL_HOSTS.has(host) ? host : null;

  return {
    company: fallbackCompany,
    companyDomain,
    snippet: publicHit.description.slice(0, 400) || null,
    sourceUrl: publicHit.url,
  };
}
