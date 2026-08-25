import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await prisma.campaign.update({
    where: { id },
    data: { status: "paused" },
  });
  return NextResponse.json({ campaign });
}
