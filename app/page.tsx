import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ImportForm } from "@/components/ImportForm";
import { DiscoverPhButton } from "@/components/DiscoverPhButton";
import { NextStep } from "@/components/NextStep";
import { Icon, IconLabel } from "@/components/icons";
import { Badge, Empty, PageHeader, Stat, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const where =
    filter === "positive"
      ? { poolStatus: "positive" }
      : filter === "pending"
        ? { poolStatus: "pending_review" }
        : filter === "never"
          ? { outreachStatus: "never" }
          : filter === "invited"
            ? { outreachStatus: { in: ["queued", "invited", "connected", "messaged"] } }
            : {};

  const contacts = await prisma.contact.findMany({ where, orderBy: { createdAt: "desc" } });
  const [total, positive, pending, never, pendingEnrich, readyToInvite] = await Promise.all([
    prisma.contact.count(),
    prisma.contact.count({ where: { poolStatus: "positive" } }),
    prisma.contact.count({ where: { poolStatus: "pending_review" } }),
    prisma.contact.count({ where: { outreachStatus: "never" } }),
    prisma.contact.count({ where: { enrichStatus: "pending" } }),
    prisma.contact.count({ where: { enrichStatus: "ready", outreachStatus: "never" } }),
  ]);

  return (
    <>
      <PageHeader
        kicker="Audience"
        title="Contacts"
        actions={
          readyToInvite > 0 ? (
            <Link className="btn" href="/campaigns/new">
              <IconLabel name="send">Write invite and send</IconLabel>
            </Link>
          ) : null
        }
      />
      <div className="stats">
        <Stat value={total} label="In pool" icon="pool" />
        <Stat value={never} label="Never contacted" icon="user" />
        <Stat value={pending} label="Pending review" icon="inbox" />
        <Stat value={positive} label="Positive pool" icon="star" />
      </div>
      <NextStep pendingCount={pendingEnrich} readyCount={readyToInvite} />
      <DiscoverPhButton />
      <ImportForm pendingCount={pendingEnrich} readyCount={readyToInvite} />
      <div className="filters">
        <Link className={!filter ? "on" : ""} href="/">
          <Icon name="filter" size={14} />All
        </Link>
        <Link className={filter === "never" ? "on" : ""} href="/?filter=never">
          <Icon name="user" size={14} />Never contacted
        </Link>
        <Link className={filter === "invited" ? "on" : ""} href="/?filter=invited">
          <Icon name="send" size={14} />Contacted
        </Link>
        <Link className={filter === "pending" ? "on" : ""} href="/?filter=pending">
          <Icon name="inbox" size={14} />Pending review
        </Link>
        <Link className={filter === "positive" ? "on" : ""} href="/?filter=positive">
          <Icon name="star" size={14} />Positive
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
                <th>Enrich</th>
                <th>Outreach</th>
                <th>Pool</th>
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
                  <td><StatusBadge status={contact.enrichStatus} /></td>
                  <td><StatusBadge status={contact.outreachStatus} /></td>
                  <td>
                    {contact.poolStatus === "none" ? <Badge>none</Badge> : <StatusBadge status={contact.poolStatus} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
