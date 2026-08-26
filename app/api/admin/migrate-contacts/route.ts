import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeLinkedInUrl } from "@/lib/linkedin";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

type IncomingContact = {
  linkedinUrl?: string;
  linkedinSlug?: string;
  firstName?: string | null;
  lastName?: string | null;
  headline?: string | null;
  company?: string | null;
  companyDomain?: string | null;
  contextSnippet?: string | null;
  unipileProviderId?: string | null;
  enrichStatus?: string;
  enrichError?: string | null;
  outreachStatus?: string;
  poolStatus?: string;
  lastOutboundAt?: string | null;
  productName?: string | null;
  source?: string;
};

/**
 * One-shot Render → Railway contact import.
 * Auth: Authorization: Bearer $CRON_SECRET
 * Body: { contacts: IncomingContact[] }
 *
 * Preserves invite-sent statuses. Queued-but-unsent become never
 * (no campaign rows migrated).
 */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const rows: IncomingContact[] = Array.isArray(body?.contacts) ? body.contacts : [];
  if (!rows.length) {
    return NextResponse.json({ error: "contacts array required" }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  let skippedInvalid = 0;
  const byOutreach: Record<string, number> = {};

  for (const row of rows) {
    const normalized = normalizeLinkedInUrl(row.linkedinUrl || row.linkedinSlug || "");
    if (!normalized) {
      skippedInvalid += 1;
      continue;
    }

    const rawOutreach = String(row.outreachStatus || "never");
    // Unsent queue had no Railway campaign — reset so they can be re-queued.
    // Already sent (invited/connected/messaged) keep their status.
    const outreachStatus =
      rawOutreach === "queued"
        ? "never"
        : ["invited", "connected", "messaged", "never"].includes(rawOutreach)
          ? rawOutreach
          : "never";

    const enrichStatus =
      row.enrichStatus === "ready" ? "ready" : row.enrichStatus === "failed" ? "failed" : "pending";

    byOutreach[outreachStatus] = (byOutreach[outreachStatus] || 0) + 1;

    const data = {
      linkedinUrl: normalized.url,
      linkedinSlug: normalized.slug,
      firstName: row.firstName ?? null,
      lastName: row.lastName ?? null,
      headline: row.headline ?? null,
      company: row.company ?? null,
      companyDomain: row.companyDomain ?? null,
      contextSnippet: row.contextSnippet ?? null,
      unipileProviderId: row.unipileProviderId || null,
      enrichStatus,
      enrichError: row.enrichError ?? null,
      outreachStatus,
      poolStatus: row.poolStatus || "none",
      lastCampaignId: null as string | null,
      lastOutboundAt: row.lastOutboundAt ? new Date(row.lastOutboundAt) : null,
      productName: row.productName ?? null,
      source: row.source || "manual",
    };

    const existing = await prisma.contact.findFirst({
      where: { OR: [{ linkedinUrl: normalized.url }, { linkedinSlug: normalized.slug }] },
    });

    if (existing) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: {
          ...data,
          unipileProviderId: data.unipileProviderId || existing.unipileProviderId,
        },
      });
      updated += 1;
      continue;
    }

    try {
      await prisma.contact.create({ data });
      created += 1;
    } catch {
      await prisma.contact.create({
        data: { ...data, unipileProviderId: null },
      });
      created += 1;
    }
  }

  return NextResponse.json({
    created,
    updated,
    skippedInvalid,
    byOutreach,
    note: "queued→never (no campaign migrated). invited/connected/messaged kept.",
  });
}
