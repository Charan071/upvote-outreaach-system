import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RetryEnrichButton } from "@/components/RetryEnrichButton";
import { Icon } from "@/components/icons";
import { PageHeader, StatusBadge } from "@/components/ui";
import { contactStatus } from "@/lib/status";
import { LocalTime } from "@/components/LocalTime";

export const dynamic = "force-dynamic";

function whenLabel(row: {
  sendStatus: string;
  sentAt: Date | null;
  runAfter: Date;
}) {
  if (row.sendStatus === "sent" && row.sentAt) {
    return <LocalTime at={row.sentAt} mode="datetime" />;
  }
  if (row.sendStatus === "queued" || row.sendStatus === "sending") {
    return <LocalTime at={row.runAfter} mode="datetime" />;
  }
  return null;
}

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      campaignContacts: {
        include: { campaign: true },
        orderBy: [{ runAfter: "desc" }, { sentAt: "desc" }],
      },
      messages: { include: { classification: true }, orderBy: { receivedAt: "desc" } },
    },
  });
  if (!contact) notFound();

  const displayName = contact.firstName
    ? `${contact.firstName} ${contact.lastName ?? ""}`.trim()
    : contact.linkedinSlug;
  const meta = [contact.productName, contact.company].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        kicker="Contact"
        title={displayName}
        actions={
          <div className="actions contact-header-actions">
            <StatusBadge status={contactStatus(contact)} />
            {contact.enrichStatus === "failed" ? <RetryEnrichButton id={contact.id} /> : null}
          </div>
        }
      />

      <div className="detail-grid contact-detail">
        <section className="panel stack contact-identity">
          <a className="contact-linkedin" href={contact.linkedinUrl} target="_blank" rel="noreferrer">
            <Icon name="user" size={14} />
            <span>linkedin.com/in/{contact.linkedinSlug}</span>
          </a>
          {contact.headline ? <p className="contact-headline">{contact.headline}</p> : (
            <p className="muted">No headline yet</p>
          )}
          {meta ? (
            <p className="contact-meta">
              <Icon name="building" size={14} />
              {meta}
              {contact.companyDomain ? ` · ${contact.companyDomain}` : ""}
            </p>
          ) : null}
          {contact.productUrl ? (
            <a className="contact-product-link" href={contact.productUrl} target="_blank" rel="noreferrer">
              Product Hunt · upvote when they reply
            </a>
          ) : null}
          {contact.contextSnippet ? <p className="muted contact-snippet">{contact.contextSnippet}</p> : null}
          {contact.enrichError ? <p className="warn-text">{contact.enrichError}</p> : null}
          {contact.lastOutboundAt ? (
            <p className="muted contact-last-send">
              Last send <LocalTime at={contact.lastOutboundAt} mode="datetime" />
            </p>
          ) : null}
        </section>

        <div className="contact-outreach stack">
          <section className="stack">
            <h2>Outreach</h2>
            {contact.campaignContacts.length === 0 ? (
              <p className="muted">Not in a campaign yet.</p>
            ) : (
              <div className="stack contact-outreach-list">
                {contact.campaignContacts.map((row) => {
                  const when = whenLabel(row);
                  return (
                    <article key={row.id} className="panel contact-outreach-card">
                      <div className="contact-outreach-top">
                        <div className="contact-outreach-title">
                          <Link href={`/campaigns/${row.campaignId}`}>{row.campaign.name}</Link>
                          <StatusBadge status={row.sendStatus} />
                        </div>
                        {when ? <p className="muted contact-outreach-when">{when}</p> : null}
                        {row.error ? <p className="warn-text">{row.error}</p> : null}
                      </div>
                      <pre className="contact-note">{row.renderedMessage}</pre>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="stack">
            <h2>Inbound</h2>
            {contact.messages.length === 0 ? (
              <p className="muted">No replies yet.</p>
            ) : (
              <div className="stack">
                {contact.messages.map((message) => (
                  <article key={message.id} className="review-card">
                    <p className="review-body">{message.body}</p>
                    <p className="muted">
                      {message.classification?.humanLabel ||
                        message.classification?.aiLabel ||
                        "Not reviewed"}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
