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

  const classification = await prisma.classification.findUnique({
    where: { id },
    include: { message: true },
  });
  if (!classification) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const poolStatus = label === "positive" ? "positive" : label === "unclear" ? "pending_review" : "excluded";

  await prisma.$transaction([
    prisma.classification.update({
      where: { id },
      data: { humanLabel: label, reviewedAt: new Date() },
    }),
    prisma.contact.update({
      where: { id: classification.message.contactId },
      data: { poolStatus },
    }),
  ]);

  return NextResponse.json({ ok: true, poolStatus });
}
