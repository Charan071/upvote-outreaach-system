import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertInviteCopy } from "@/lib/template";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; rowId: string }> },
) {
  const { id, rowId } = await params;
  const body = await req.json().catch(() => null);
  const renderedMessage = String(body?.renderedMessage || "").trim();
  if (!renderedMessage) return NextResponse.json({ error: "Message is required." }, { status: 400 });

  const row = await prisma.campaignContact.findFirst({
    where: { id: rowId, campaignId: id },
    include: { campaign: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const copyError = row.campaign.kind === "invite" ? assertInviteCopy(renderedMessage) : null;
  if (copyError) return NextResponse.json({ error: copyError }, { status: 400 });
  if (row.sendStatus !== "queued") {
    return NextResponse.json({ error: "Only queued messages can be edited." }, { status: 400 });
  }
  const max = row.campaign.kind === "message" ? 2000 : 300;
  if (renderedMessage.length > max) {
    return NextResponse.json(
      { error: `This is ${renderedMessage.length} characters. The ${max} character cap would cut it mid-sentence.` },
      { status: 400 },
    );
  }

  const updated = await prisma.campaignContact.update({
    where: { id: rowId },
    data: { renderedMessage },
  });
  return NextResponse.json({ row: updated });
}
