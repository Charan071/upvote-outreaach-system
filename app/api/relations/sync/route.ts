import { NextResponse } from "next/server";
import { syncAcceptedRelations } from "@/lib/connected";

export const runtime = "nodejs";
export const maxDuration = 120;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Auth: Authorization: Bearer $CRON_SECRET — reconciles accepted invites. */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    // First page only by default — Unipile flags deep, frequent relation polling.
    const url = new URL(req.url);
    const pages = Number(url.searchParams.get("pages"));
    const result = await syncAcceptedRelations({
      maxPages: Number.isFinite(pages) && pages > 0 ? pages : 1,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Relations sync failed" },
      { status: 500 },
    );
  }
}
