import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assertInviteCopy,
  contactTemplateVars,
  fillTemplate,
  templateOverflow,
} from "@/lib/template";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const template = String(body?.template || "").trim();
  if (!template) return NextResponse.json({ error: "Message is required." }, { status: 400 });

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { contacts: { include: { contact: true } } },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const copyError = campaign.kind === "invite" ? assertInviteCopy(template) : null;
  if (copyError) return NextResponse.json({ error: copyError }, { status: 400 });
  const max = campaign.kind === "message" ? 2000 : 300;
  const people = campaign.contacts.length
    ? campaign.contacts.map((row) => row.contact)
    : [{ firstName: "Alex", company: "Acme" }];
  const overflow = people
    .map((contact) => templateOverflow(template, contactTemplateVars(contact), max))
    .find(Boolean);
  if (overflow) return NextResponse.json({ error: overflow }, { status: 400 });

  await prisma.campaign.update({ where: { id }, data: { template } });
  if (campaign.kind === "invite") {
    await prisma.settings.update({
      where: { id: "default" },
      data: { defaultTemplate: template },
    });
  }

  const queued = campaign.contacts.filter((row) => row.sendStatus === "queued");
  for (const row of queued) {
    await prisma.campaignContact.update({
      where: { id: row.id },
      data: {
        renderedMessage: fillTemplate(template, contactTemplateVars(row.contact)),
      },
    });
  }

  return NextResponse.json({ ok: true, updated: queued.length });
}
