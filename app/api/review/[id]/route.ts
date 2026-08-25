import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LABELS, type ReplyLabel } from "@/lib/gemini";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const label = String(body?.label || "");
  if (!LABELS.includes(label as ReplyLabel)) {
    return NextResponse.json({ error: "Invalid label." }, { status: 400 });
  }

  const message = await prisma.message.findUnique({
    where: { id },
    include: { classification: true },
  });
  if (!message || message.direction !== "in") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const poolStatus = label === "positive" ? "positive" : label === "unclear" ? "pending_review" : "excluded";
  const reviewedAt = new Date();

  if (message.classification) {
    await prisma.$transaction([
      prisma.classification.update({
        where: { id: message.classification.id },
        data: { humanLabel: label, reviewedAt },
      }),
      prisma.contact.update({
        where: { id: message.contactId },
        data: { poolStatus },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.classification.create({
        data: {
          messageId: message.id,
          aiLabel: label,
          aiReason: "Labeled in Review",
          model: "human",
          humanLabel: label,
          reviewedAt,
        },
      }),
      prisma.contact.update({
        where: { id: message.contactId },
        data: { poolStatus },
      }),
    ]);
  }

  return NextResponse.json({ ok: true, poolStatus });
}
