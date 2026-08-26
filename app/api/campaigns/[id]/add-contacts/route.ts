import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spreadQueuedJobs } from "@/lib/queue";
import {
  assertInviteCopy,
  contactTemplateVars,
  fillTemplate,
  templateOverflow,
} from "@/lib/template";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.status === "completed") {
    return NextResponse.json({ error: "This campaign is completed." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.contactIds) ? body.contactIds.map(String) : [];
  const kind = campaign.kind === "message" ? "message" : "invite";
  const template = campaign.template;
  const copyError = kind === "invite" ? assertInviteCopy(template) : null;
  if (copyError) return NextResponse.json({ error: copyError }, { status: 400 });

  const already = await prisma.campaignContact.findMany({
    where: { campaignId: id },
    select: { contactId: true },
  });
  const alreadyIds = new Set(already.map((row) => row.contactId));

  const eligible = await prisma.contact.findMany({
    where:
      kind === "message"
        ? {
            poolStatus: "positive",
            enrichStatus: "ready",
            ...(ids.length ? { id: { in: ids } } : {}),
          }
        : {
            enrichStatus: "ready",
            outreachStatus: "never",
            poolStatus: { not: "excluded" },
            ...(ids.length ? { id: { in: ids } } : {}),
          },
  });
  const toAdd = eligible.filter((c) => !alreadyIds.has(c.id));

  if (!toAdd.length) {
    return NextResponse.json(
      {
        error:
          kind === "message"
            ? "No new confirmed positive contacts to add."
            : "No new ready contacts to add.",
      },
      { status: 400 },
    );
  }

  const max = kind === "message" ? 2000 : 300;
  const overflow = toAdd
    .map((contact) => templateOverflow(template, contactTemplateVars(contact), max))
    .find(Boolean);
  if (overflow) return NextResponse.json({ error: overflow }, { status: 400 });

  await prisma.campaignContact.createMany({
    data: toAdd.map((contact) => ({
      campaignId: id,
      contactId: contact.id,
      renderedMessage: fillTemplate(template, contactTemplateVars(contact)),
      sendStatus: "queued",
      runAfter: new Date(),
    })),
  });

  if (kind === "invite") {
    await prisma.contact.updateMany({
      where: { id: { in: toAdd.map((c) => c.id) } },
      data: { outreachStatus: "queued", lastCampaignId: id },
    });
  }

  if (campaign.status === "draft") {
    await prisma.campaign.update({ where: { id }, data: { status: "running" } });
  }

  const scheduled = await spreadQueuedJobs(id);
  const updated = await prisma.campaign.findUnique({
    where: { id },
    include: { _count: { select: { contacts: true } } },
  });

  return NextResponse.json({
    campaign: updated,
    added: toAdd.length,
    scheduled,
    contactIds: toAdd.map((c) => c.id),
  });
}
