import { NextResponse } from "next/server";
import { getTodaysDiscovery, runDailyProductHuntDiscovery } from "@/lib/discover-ph";
import { getCreditStatus } from "@/lib/context-dev";
import { getSettings } from "@/lib/queue";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  await getSettings();
  const [run, credits] = await Promise.all([getTodaysDiscovery(), getCreditStatus()]);
  return NextResponse.json({ run, credits });
}

export async function POST(req: Request) {
  try {
    await getSettings();
    const body = await req.json().catch(() => null);
    const productNames = typeof body?.productNames === "string" ? body.productNames : undefined;
    const result = await runDailyProductHuntDiscovery({ productNames });
    const credits = await getCreditStatus();
    return NextResponse.json({ ...result, credits });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Discovery failed" },
      { status: 400 },
    );
  }
}
