import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/queue";
import { ImportForm } from "@/components/ImportForm";
import { DiscoverPhButton } from "@/components/DiscoverPhButton";
import { NextStep } from "@/components/NextStep";
import { Icon, IconLabel } from "@/components/icons";
import { Empty, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { contactStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const settings = await getSettings();
  const where =
    filter === "positive"
      ? { poolStatus: "positive" }
      : filter === "pending"
        ? { poolStatus: "pending_review" }
        : filter === "never"
          ? { outreachStatus: "never", enrichStatus: "ready" }
          : filter === "queued"
            ? { outreachStatus: "queued" }
          : filter === "invited"
            ? { outreachStatus: { in: ["invited", "connected", "messaged"] } }
            : filter === "needs_name"
              ? { enrichStatus: "pending" }
            : {};

  const contacts = await prisma.contact.findMany({ where, orderBy: { createdAt: "desc" } });
  const [total, positive, pendingReview, readyToInvite, pendingEnrich, queuedCount] = await Promise.all([
    prisma.contact.count(),
    prisma.contact.count({ where: { poolStatus: "positive" } }),
    prisma.contact.count({ where: { poolStatus: "pending_review" } }),
    prisma.contact.count({ where: { enrichStatus: "ready", outreachStatus: "never" } }),
    prisma.contact.count({ where: { enrichStatus: "pending" } }),
    prisma.campaignContact.count({
      where: { sendStatus: { in: ["queued", "sending"] }, campaign: { status: "running" } },
    }),
  ]);

  return (
    <>
      <PageHeader
        kicker="Audience"
        title="Contacts"
        actions={
          readyToInvite > 0 ? (
            <Link className="btn" href="/campaigns/new">
              <IconLabel name="send">Write invite</IconLabel>
            </Link>
          ) : null
        }
      />
      <div className="stats">
        <Stat value={total} label="People" icon="pool" />
        <Stat value={readyToInvite} label="Ready to invite" icon="user" />
        <Stat value={pendingReview} label="Needs reply review" icon="inbox" />
        <Stat value={positive} label="Interested" icon="star" />
      </div>
      <NextStep
        pendingCount={pendingEnrich}
        readyCount={readyToInvite}
        queuedCount={queuedCount}
        workStartHour={settings.workStartHour}
        workEndHour={settings.workEndHour}
      />
      <DiscoverPhButton />
      <ImportForm pendingCount={pendingEnrich} readyCount={readyToInvite} />
      <div className="filters">
        <Link className={!filter ? "on" : ""} href="/">
          <Icon name="filter" size={14} />All
        </Link>
        <Link className={filter === "needs_name" ? "on" : ""} href="/?filter=needs_name">
          <Icon name="sync" size={14} />Needs name
        </Link>
        <Link className={filter === "never" ? "on" : ""} href="/?filter=never">
          <Icon name="user" size={14} />Ready to invite
        </Link>
        <Link className={filter === "queued" ? "on" : ""} href="/?filter=queued">
          <Icon name="clock" size={14} />Queued
        </Link>
        <Link className={filter === "invited" ? "on" : ""} href="/?filter=invited">
          <Icon name="send" size={14} />Invited
        </Link>
        <Link className={filter === "pending" ? "on" : ""} href="/?filter=pending">
          <Icon name="inbox" size={14} />Needs reply review
        </Link>
        <Link className={filter === "positive" ? "on" : ""} href="/?filter=positive">
          <Icon name="star" size={14} />Interested
        </Link>
      </div>
      {contacts.length === 0 ? (
        <Empty
          icon="people"
          title="No contacts yet"
          body="Collect today’s Product Hunt makers, or upload a CSV / paste LinkedIn URLs. Names come from Unipile; company context comes from Context.dev."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Launch</th>
                <th>Company</th>
                <th>Headline</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id}>
                  <td>
                    <Link href={`/contacts/${contact.id}`}>
                      {contact.firstName ? `${contact.firstName} ${contact.lastName ?? ""}` : contact.linkedinSlug}
                    </Link>
                  </td>
                  <td className="muted">{contact.productName || "—"}</td>
                  <td className="muted">{contact.company || "—"}</td>
                  <td className="muted">{contact.headline || "—"}</td>
                  <td><StatusBadge status={contactStatus(contact)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
