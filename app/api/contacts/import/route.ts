import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeLinkedInUrl, parseLinkedInInput } from "@/lib/linkedin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  const lines = parseLinkedInInput(text);
  if (!lines.length) {
    return NextResponse.json(
      { error: "Upload a CSV or paste at least one LinkedIn URL." },
      { status: 400 },
    );
  }

  let created = 0;
  let skippedDuplicates = 0;
  let invalid = 0;

  for (const line of lines) {
    const normalized = normalizeLinkedInUrl(line);
    if (!normalized) {
      invalid += 1;
      continue;
    }

    const existing = await prisma.contact.findFirst({
      where: { OR: [{ linkedinUrl: normalized.url }, { linkedinSlug: normalized.slug }] },
    });
    if (existing) {
      skippedDuplicates += 1;
      continue;
    }

    await prisma.contact.create({
      data: {
        linkedinUrl: normalized.url,
        linkedinSlug: normalized.slug,
        enrichStatus: "pending",
      },
    });
    created += 1;
  }

  return NextResponse.json({
    created,
    skippedDuplicates,
    invalid,
    enriched: 0,
    pendingEnrich: created,
    note: "Profiles are visited one at a time during Run next (~100/day, random gaps in working hours).",
  });
}
