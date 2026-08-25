import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RetryEnrichButton } from "@/components/RetryEnrichButton";
import { Icon } from "@/components/icons";
import { PageHeader, Stat, StatusBadge } from "@/components/ui";
import { contactStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      campaignContacts: { include: { campaign: true }, orderBy: { sentAt: "desc" } },
      messages: { include: { classification: true }, orderBy: { receivedAt: "desc" } },
    },
  });
  if (!contact) notFound();

  return (
    <>
      <PageHeader
        kicker="Contact"
        title={contact.firstName ? `${contact.firstName} ${contact.lastName ?? ""}` : contact.linkedinSlug}
        actions={contact.enrichStatus === "failed" ? <RetryEnrichButton id={contact.id} /> : null}
      />
      <div className="stats stats-3">
        <Stat value={<StatusBadge status={contactStatus(contact)} />} label="Status" icon="user" />
      </div>
      <section className="panel stack">
        <p>
          <a href={contact.linkedinUrl} target="_blank" rel="noreferrer">
            <Icon name="user" size={14} /> {contact.linkedinUrl}
          </a>
        </p>
        <p className="muted">{contact.headline || "No headline yet"}</p>
        {contact.productName ? <p>Launch: {contact.productName}</p> : null}
        {contact.company ? (
          <p>
            <Icon name="building" size={14} /> {contact.company}
            {contact.companyDomain ? ` · ${contact.companyDomain}` : ""}
          </p>
        ) : null}
        {contact.contextSnippet ? <p className="muted">{contact.contextSnippet}</p> : null}
        {contact.enrichError ? <p className="warn-text">{contact.enrichError}</p> : null}
      </section>

      <h2>Campaign history</h2>
      {contact.campaignContacts.length === 0 ? (
        <p className="muted">No campaigns yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Campaign</th><th>Message</th><th>Status</th></tr>
            </thead>
            <tbody>
              {contact.campaignContacts.map((row) => (
                <tr key={row.id}>
                  <td><Link href={`/campaigns/${row.campaignId}`}>{row.campaign.name}</Link></td>
                  <td className="queued-note-locked">{row.renderedMessage}</td>
                  <td><StatusBadge status={row.sendStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="section-title">Inbound</h2>
      {contact.messages.length === 0 ? (
        <p className="muted">No replies yet.</p>
      ) : (
        <div className="stack">
          {contact.messages.map((message) => (
            <article key={message.id} className="review-card">
              <p className="review-body">{message.body}</p>
              <p className="muted">
                {message.classification?.humanLabel || message.classification?.aiLabel || "Not reviewed"}
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
