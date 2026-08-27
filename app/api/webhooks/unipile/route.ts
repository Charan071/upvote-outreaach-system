import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyReply } from "@/lib/gemini";
import { applyUnipileStatus } from "@/lib/health";
import { isOurUnipileAccount } from "@/lib/unipile";
import { markConnectedAndSkipInvites } from "@/lib/connected";

export const runtime = "nodejs";

function headerOk(req: Request) {
  const secret = process.env.UNIPILE_WEBHOOK_SECRET;
  if (!secret) return true;
  return req.headers.get("unipile-auth") === secret || req.headers.get("x-unipile-auth") === secret;
}

function accountIdFrom(body: Record<string, unknown>) {
  const nested = body.AccountStatus as { account_id?: unknown } | undefined;
  return String(body.account_id || nested?.account_id || "");
}

function statusFrom(body: Record<string, unknown>) {
  const nested = body.AccountStatus as { message?: unknown; status?: unknown } | undefined;
  return String(nested?.message || nested?.status || body.message || body.status || "").trim();
}

/**
 * Unipile does not send an `event` field. Messaging payloads carry `event_type`;
 * relation payloads carry no event at all, so fall back to the payload shape.
 */
function resolveEvent(body: Record<string, unknown>) {
  const explicit = String(body.event || body.type || body.event_type || "").trim().toLowerCase();
  if (explicit) return explicit;
  if (body.AccountStatus) return "account_status";
  if (body.message_id || body.message) return "message_received";
  if (body.user_provider_id || body.user_public_identifier) return "new_relation";
  return "";
}

export async function POST(req: Request) {
  if (!headerOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: true });

  const event = resolveEvent(body);
  const accountId = accountIdFrom(body);

  if (body.AccountStatus || /account.?status/i.test(event)) {
    const status = statusFrom(body);
    if (!status) return NextResponse.json({ ok: true, event: event || "AccountStatus", ignored: true });
    const applied = await applyUnipileStatus(status, accountId || undefined);
    return NextResponse.json({ ok: true, event: event || "AccountStatus", applied });
  }

  if (accountId && !isOurUnipileAccount(accountId)) {
    return NextResponse.json({ ok: true, event, ignored: true, reason: "other_account" });
  }

  if (event === "new_relation") {
    const providerId = String(body.user_provider_id || "");
    const slug = String(body.user_public_identifier || "").toLowerCase();
    const contact = await prisma.contact.findFirst({
      where: {
        OR: [
          ...(providerId ? [{ unipileProviderId: providerId }] : []),
          ...(slug ? [{ linkedinSlug: slug }] : []),
        ],
      },
    });
    if (contact) {
      const stamp = new Date(String(body.timestamp || ""));
      await markConnectedAndSkipInvites(contact.id, Number.isNaN(stamp.getTime()) ? new Date() : stamp);
    }
    return NextResponse.json({ ok: true, event, matched: Boolean(contact) });
  }

  if (event === "message_received" || event === "new_message") {
    const providerId = String(
      (body.sender as { attendee_provider_id?: string } | undefined)?.attendee_provider_id ||
        body.attendee_provider_id ||
        body.sender_id ||
        "",
    );
    const text = String(body.message || body.text || body.body || "");
    const messageId = String(body.message_id || body.id || "");
    if (!text || !messageId) return NextResponse.json({ ok: true, event, ignored: true });

    const existing = await prisma.message.findUnique({ where: { unipileMessageId: messageId } });
    if (existing) return NextResponse.json({ ok: true, event, duplicate: true });

    const contact = providerId
      ? await prisma.contact.findFirst({ where: { unipileProviderId: providerId } })
      : null;
    if (!contact) return NextResponse.json({ ok: true, event, matched: false });

    const created = await prisma.message.create({
      data: {
        contactId: contact.id,
        direction: "in",
        body: text,
        unipileMessageId: messageId,
      },
    });
    try {
      const classified = await classifyReply(text);
      await prisma.classification.create({
        data: {
          messageId: created.id,
          aiLabel: classified?.label ?? "unclear",
          aiConfidence: classified?.confidence ?? null,
          aiReason: classified?.reason ?? (classified ? null : "Gemini key not set"),
          model: classified?.model ?? "none",
        },
      });
    } catch {
      // Review still lists the inbound message without a Gemini label.
    }
    await prisma.contact.update({
      where: { id: contact.id },
      data: { poolStatus: "pending_review" },
    });
    await markConnectedAndSkipInvites(contact.id);
    return NextResponse.json({ ok: true, event, matched: true });
  }

  return NextResponse.json({ ok: true, event: event || "ignored" });
}
