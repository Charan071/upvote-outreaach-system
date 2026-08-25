import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/queue";
import { ImportForm } from "@/components/ImportForm";
import { DiscoverPhButton } from "@/components/DiscoverPhButton";
import { NextStep } from "@/components/NextStep";
import { Icon, IconLabel } from "@/components/icons";
import { Empty, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { contactStatus } from "@/lib/status";
import { LocalTime } from "@/components/LocalTime";

export const dynamic = "force-dynamic";

function FilterLink({
  href,
  active,
  icon,
  label,
  count,
}: {
  href: string;
  active: boolean;
  icon: "filter" | "sync" | "user" | "clock" | "send" | "inbox" | "star";
  label: string;
  count?: number;
}) {
  return (
    <Link className={active ? "on" : ""} href={href}>
      <Icon name={icon} size={14} />
      {label}
      {count != null ? <span className="filter-count">{count}</span> : null}
    </Link>
  );
}

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
  const [
    total,
    positive,
    pendingReview,
    readyToInvite,
    pendingEnrich,
    queuedPeople,
    invitedPeople,
    queuedCount,
    nextQueued,
  ] =
    await Promise.all([
      prisma.contact.count(),
      prisma.contact.count({ where: { poolStatus: "positive" } }),
      prisma.contact.count({ where: { poolStatus: "pending_review" } }),
      prisma.contact.count({ where: { enrichStatus: "ready", outreachStatus: "never" } }),
      prisma.contact.count({ where: { enrichStatus: "pending" } }),
      prisma.contact.count({ where: { outreachStatus: "queued" } }),
      prisma.contact.count({ where: { outreachStatus: { in: ["invited", "connected", "messaged"] } } }),
      prisma.campaignContact.count({
        where: { sendStatus: { in: ["queued", "sending"] }, campaign: { status: "running" } },
      }),
      prisma.campaignContact.findFirst({
        where: { sendStatus: { in: ["queued", "sending"] }, campaign: { status: "running" } },
        include: { contact: true },
        orderBy: { runAfter: "asc" },
      }),
    ]);
  const sendAtByContact = new Map(
    (
      await prisma.campaignContact.findMany({
        where: {
          sendStatus: { in: ["queued", "sending"] },
          campaign: { status: "running" },
          contactId: { in: contacts.map((contact) => contact.id) },
        },
        orderBy: { runAfter: "asc" },
        distinct: ["contactId"],
      })
    ).map((row) => [row.contactId, row.runAfter]),
  );

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
        timeZone={settings.timezone}
        minJitterSec={settings.minJitterSec}
        maxJitterSec={settings.maxJitterSec}
        nextSendAt={nextQueued?.runAfter ?? null}
        nextSendName={
          nextQueued
            ? nextQueued.contact.firstName
              ? `${nextQueued.contact.firstName} ${nextQueued.contact.lastName ?? ""}`.trim()
              : nextQueued.contact.linkedinSlug
            : null
        }
      />
      <details className="add-people" {...(total === 0 ? { open: true } : {})}>
        <summary>Add people</summary>
        <div className="add-people-grid">
          <DiscoverPhButton />
          <ImportForm pendingCount={pendingEnrich} readyCount={readyToInvite} />
        </div>
      </details>
      <section className="work-surface">
        <div className="work-toolbar">
          <div className="filters">
            <FilterLink href="/" active={!filter} icon="filter" label="All" count={total} />
            <FilterLink href="/?filter=needs_name" active={filter === "needs_name"} icon="sync" label="Needs name" count={pendingEnrich} />
            <FilterLink href="/?filter=never" active={filter === "never"} icon="user" label="Ready" count={readyToInvite} />
            <FilterLink href="/?filter=queued" active={filter === "queued"} icon="clock" label="Queued" count={queuedPeople} />
            <FilterLink href="/?filter=invited" active={filter === "invited"} icon="send" label="Invited" count={invitedPeople} />
            <FilterLink href="/?filter=pending" active={filter === "pending"} icon="inbox" label="Review" count={pendingReview} />
            <FilterLink href="/?filter=positive" active={filter === "positive"} icon="star" label="Interested" count={positive} />
          </div>
          <p className="work-count">{contacts.length} shown</p>
        </div>
        {contacts.length === 0 ? (
          <Empty
            icon="people"
            title="No contacts in this view"
            body="Collect today’s Product Hunt makers, or upload a CSV / paste LinkedIn URLs."
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
                  <th>Send at</th>
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
                    <td className="muted">
                      {sendAtByContact.get(contact.id) ? (
                        <LocalTime at={sendAtByContact.get(contact.id)!} />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
