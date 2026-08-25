import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { armCampaign, getSettings } from "@/lib/queue";
import {
  assertInviteCopy,
  contactTemplateVars,
  fillTemplate,
  templateOverflow,
} from "@/lib/template";

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { contacts: true } } },
  });
  return NextResponse.json({ campaigns });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const kind = body?.kind === "message" ? "message" : "invite";
  const settings = await getSettings();
  const template = String(body?.template || settings.defaultTemplate).trim();
  const copyError = kind === "invite" ? assertInviteCopy(template) : null;
  if (copyError) return NextResponse.json({ error: copyError }, { status: 400 });
  const name =
    String(body?.name || "").trim() ||
    `${kind === "message" ? "Messages" : "Invites"} · ${new Date().toISOString().slice(0, 10)}`;

  const ids: string[] = Array.isArray(body?.contactIds) ? body.contactIds.map(String) : [];

  const where =
    kind === "message"
      ? {
          poolStatus: "positive" as const,
          enrichStatus: "ready",
          ...(ids.length ? { id: { in: ids } } : {}),
        }
      : {
          enrichStatus: "ready",
          outreachStatus: "never",
          poolStatus: { not: "excluded" },
          ...(ids.length ? { id: { in: ids } } : {}),
        };

  const contacts = await prisma.contact.findMany({ where });
  if (!contacts.length) {
    return NextResponse.json(
      { error: kind === "message" ? "No confirmed positive contacts to message." : "No unused enriched contacts." },
      { status: 400 },
    );
  }

  const max = kind === "message" ? 2000 : 300;
  const overflow = contacts
    .map((contact) => templateOverflow(template, contactTemplateVars(contact), max))
    .find(Boolean);
  if (overflow) return NextResponse.json({ error: overflow }, { status: 400 });

  const created = await prisma.campaign.create({
    data: {
      name,
      kind,
      template,
      status: "draft",
      contacts: {
        create: contacts.map((contact) => ({
          contactId: contact.id,
          renderedMessage: fillTemplate(template, contactTemplateVars(contact)),
          sendStatus: "queued",
          runAfter: new Date(),
        })),
      },
    },
  });

  if (kind === "invite") {
    await prisma.contact.updateMany({
      where: { id: { in: contacts.map((c) => c.id) } },
      data: { outreachStatus: "queued", lastCampaignId: created.id },
    });
    await prisma.settings.update({
      where: { id: "default" },
      data: { defaultTemplate: template },
    });
  }

  const { campaign, scheduled } = await armCampaign(created.id);
  return NextResponse.json({ campaign, scheduled });
}
