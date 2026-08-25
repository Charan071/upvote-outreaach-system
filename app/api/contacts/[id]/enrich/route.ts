import { NextResponse } from "next/server";
import { enrichContact } from "@/lib/enrich";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const contact = await enrichContact(id);
    return NextResponse.json({ contact });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enrich failed" },
      { status: 400 },
    );
  }
}
