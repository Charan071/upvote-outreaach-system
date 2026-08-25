import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyReply } from "@/lib/gemini";
import { listChatMessages, listChats } from "@/lib/unipile";
import { markConnectedAndSkipInvites } from "@/lib/connected";

type Chat = {
  id?: string;
  attendee_provider_id?: string;
  attendees?: Array<{ provider_id?: string }>;
};

type ChatMessage = {
  id?: string;
  text?: string;
  body?: string;
  message?: string;
  is_sender?: boolean;
  sender_id?: string;
  timestamp?: string;
};

function attendeeIds(chat: Chat) {
  const ids = new Set<string>();
  if (chat.attendee_provider_id) ids.add(chat.attendee_provider_id);
  for (const attendee of chat.attendees ?? []) {
    if (attendee.provider_id) ids.add(attendee.provider_id);
  }
  return [...ids];
}

export async function POST() {
  try {
    const raw = (await listChats()) as { items?: Chat[] } | Chat[];
    const chats = Array.isArray(raw) ? raw : (raw.items ?? []);
    let imported = 0;

    for (const chat of chats.slice(0, 40)) {
      if (!chat.id) continue;
      const providers = attendeeIds(chat);
      const contact = await prisma.contact.findFirst({
        where: { unipileProviderId: { in: providers } },
      });
      if (!contact) continue;

      const messageRaw = (await listChatMessages(chat.id)) as { items?: ChatMessage[] } | ChatMessage[];
      const messages = Array.isArray(messageRaw) ? messageRaw : (messageRaw.items ?? []);

      for (const message of messages) {
        const body = message.text || message.body || message.message || "";
        if (!body || !message.id) continue;
        const isInbound = message.is_sender === false || (message.sender_id && message.sender_id === contact.unipileProviderId);
        if (!isInbound) continue;

        const existing = await prisma.message.findUnique({ where: { unipileMessageId: message.id } });
        if (existing) continue;

        const created = await prisma.message.create({
          data: {
            contactId: contact.id,
            direction: "in",
            body,
            unipileMessageId: message.id,
            receivedAt: message.timestamp ? new Date(message.timestamp) : new Date(),
          },
        });

        const classified = await classifyReply(body);
        await prisma.classification.create({
          data: {
            messageId: created.id,
            aiLabel: classified?.label ?? "unclear",
            aiConfidence: classified?.confidence ?? null,
            aiReason: classified?.reason ?? (classified ? null : "Gemini key not set"),
            model: classified?.model ?? "none",
          },
        });
        await prisma.contact.update({
          where: { id: contact.id },
          data: { poolStatus: "pending_review" },
        });
        await markConnectedAndSkipInvites(contact.id);
        imported += 1;
      }
    }

    return NextResponse.json({ imported });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Inbox sync failed" },
      { status: 500 },
    );
  }
}
