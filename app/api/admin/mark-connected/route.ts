import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markConnectedAndSkipInvites } from "@/lib/connected";
import { normalizeLinkedInUrl } from "@/lib/linkedin";

export const runtime = "nodejs";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Auth: Authorization: Bearer $CRON_SECRET — body: { contactIds?: string[], linkedinUrls?: string[] } */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const ids = new Set<string>(Array.isArray(body?.contactIds) ? body.contactIds.map(String) : []);
  for (const raw of Array.isArray(body?.linkedinUrls) ? body.linkedinUrls : []) {
    const normalized = normalizeLinkedInUrl(String(raw));
    if (!normalized) continue;
    const row = await prisma.contact.findFirst({
      where: { OR: [{ linkedinUrl: normalized.url }, { linkedinSlug: normalized.slug }] },
      select: { id: true },
    });
    if (row) ids.add(row.id);
  }

  if (!ids.size) {
    return NextResponse.json({ error: "contactIds or linkedinUrls required" }, { status: 400 });
  }

  const updated: string[] = [];
  for (const id of ids) {
    const skipped = await markConnectedAndSkipInvites(id);
    updated.push(id);
    void skipped;
  }

  return NextResponse.json({ updated: updated.length, contactIds: updated });
}
