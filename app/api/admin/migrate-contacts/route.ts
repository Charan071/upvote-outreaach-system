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
  productName?: string | null;
  source?: string;
};

/**
 * One-shot Render → Railway contact import.
 * Auth: Authorization: Bearer $CRON_SECRET
 * Body: { contacts: IncomingContact[] }
 *
 * Skips already-invited people. Queued-but-unsent become never (no campaign on Railway yet).
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
  let skippedInvited = 0;
  let skippedInvalid = 0;

  for (const row of rows) {
    const outreach = String(row.outreachStatus || "never");
    if (["invited", "connected", "messaged"].includes(outreach)) {
      skippedInvited += 1;
      continue;
    }

    const normalized = normalizeLinkedInUrl(row.linkedinUrl || row.linkedinSlug || "");
    if (!normalized) {
      skippedInvalid += 1;
      continue;
    }

    // Unsent queue on Render had no Railway campaign — reset to never so they can be queued again.
    const outreachStatus = outreach === "queued" ? "never" : outreach === "never" ? "never" : "never";
    const enrichStatus = row.enrichStatus === "ready" ? "ready" : row.enrichStatus === "failed" ? "failed" : "pending";

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
      lastCampaignId: null,
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
    } else {
      try {
        await prisma.contact.create({ data });
        created += 1;
      } catch {
        // Unique race on unipileProviderId — retry without it
        await prisma.contact.create({
          data: { ...data, unipileProviderId: null },
        });
        created += 1;
      }
    }
  }

  return NextResponse.json({
    created,
    updated,
    skippedInvited,
    skippedInvalid,
    note: "Queued Render contacts were reset to outreachStatus=never (no campaign migrated).",
  });
}
