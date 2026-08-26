import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeLinkedInUrl, parseLinkedInInput } from "@/lib/linkedin";

export const runtime = "nodejs";
export const maxDuration = 60;

type IncomingRow = {
  linkedinUrl?: string;
  productName?: string | null;
  productUrl?: string | null;
  source?: string | null;
};

function normalizeProductUrl(raw: string | null | undefined) {
  const value = String(raw || "").trim();
  if (!value) return null;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (!/producthunt\.com$/i.test(url.hostname) && !/\.producthunt\.com$/i.test(url.hostname)) {
      return null;
    }
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const structured: IncomingRow[] = Array.isArray(body?.contacts) ? body.contacts : [];
  const text = typeof body?.text === "string" ? body.text : "";
  const defaultProductName =
    typeof body?.productName === "string" ? body.productName.trim() || null : null;
  const defaultProductUrl = normalizeProductUrl(body?.productUrl);
  const defaultSource =
    typeof body?.source === "string" && body.source.trim() ? body.source.trim() : "manual";

  const rows: IncomingRow[] = structured.length
    ? structured
    : parseLinkedInInput(text).map((linkedinUrl) => ({
        linkedinUrl,
        productName: defaultProductName,
        productUrl: defaultProductUrl,
        source: defaultSource,
      }));

  if (!rows.length) {
    return NextResponse.json(
      { error: "Upload a CSV, paste LinkedIn URLs, or send contacts[]." },
      { status: 400 },
    );
  }

  let created = 0;
  let skippedDuplicates = 0;
  let invalid = 0;

  for (const row of rows) {
    const normalized = normalizeLinkedInUrl(String(row.linkedinUrl || ""));
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
        productName: (row.productName || defaultProductName || "").trim() || null,
        productUrl: normalizeProductUrl(row.productUrl) || defaultProductUrl,
        source: (row.source || defaultSource || "manual").trim() || "manual",
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
