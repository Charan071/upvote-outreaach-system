import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CampaignActions } from "@/components/CampaignActions";
import { CampaignMessageEditor } from "@/components/CampaignMessageEditor";
import { PageHeader, StatusBadge } from "@/components/ui";
import { campaignKindLabel } from "@/lib/status";
import { LocalHourRange, LocalTime } from "@/components/LocalTime";
import { getSettings } from "@/lib/queue";
import { formatJitterPhrase } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const settings = await getSettings();
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      contacts: { include: { contact: true }, orderBy: { runAfter: "asc" } },
    },
  });
  if (!campaign) notFound();

  const sent = campaign.contacts.filter((c) => c.sendStatus === "sent").length;
  const failed = campaign.contacts.filter((c) => c.sendStatus === "failed").length;
  const queuedRows = campaign.contacts.filter((c) => c.sendStatus === "queued" || c.sendStatus === "sending");
  const queued = queuedRows.length;
  const kind = campaign.kind === "message" ? "message" : "invite";
  const unit = kind === "message" ? "message" : "invite";
  const nextQueued = queuedRows[0];

  return (
    <>
      <PageHeader
        kicker={campaignKindLabel(campaign.kind)}
        title={campaign.name}
        actions={<CampaignActions id={campaign.id} status={campaign.status} />}
      />
      <p className="campaign-meta">
        <StatusBadge status={campaign.status} />
        <span>
          {sent} sent · {queued} queued · {failed} failed · {campaign.contacts.length} total
        </span>
      </p>
      {campaign.status === "running" && queued > 0 ? (
        <section className="next-step" style={{ marginBottom: 22 }}>
          <div className="next-step-body">
            <div>
              <p className="kicker">Worker</p>
              <h2>Sending {queued} {unit}{queued === 1 ? "" : "s"}</h2>
              <p className="muted">
                Next send <LocalTime at={nextQueued.runAfter} />
                {nextQueued.contact.firstName ? ` · ${nextQueued.contact.firstName}` : ""}. Each remaining {unit} is
                scheduled below, one at a time during{" "}
                <LocalHourRange
                  startHour={settings.workStartHour}
                  endHour={settings.workEndHour}
                  timeZone={settings.timezone}
                />
                , with {formatJitterPhrase(settings.minJitterSec, settings.maxJitterSec)}.
              </p>
            </div>
          </div>
        </section>
      ) : campaign.status !== "running" && queued > 0 ? (
        <section className="next-step" style={{ marginBottom: 22 }}>
          <div className="next-step-body">
            <div>
              <p className="kicker">Paused</p>
              <h2>{queued} {unit}{queued === 1 ? "" : "s"} waiting</h2>
              <p className="muted">Press Resume to let the worker continue sending.</p>
            </div>
          </div>
        </section>
      ) : null}
      <CampaignMessageEditor
        campaignId={campaign.id}
        kind={kind}
        template={campaign.template}
        previewName={campaign.contacts[0]?.contact.firstName || "Alex"}
        previewCompany={
          campaign.contacts[0]?.contact.productName ||
          campaign.contacts[0]?.contact.company ||
          "Acme"
        }
      />
      <div className="table-wrap">
        <table>
          <thead>
              <tr>
              <th>Person</th>
              <th>Preview</th>
              <th>Status</th>
              <th>Send at</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {campaign.contacts.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link href={`/contacts/${row.contactId}`}>
                    {row.contact.firstName || row.contact.linkedinSlug}
                  </Link>
                </td>
                <td className="queued-note-locked">{row.renderedMessage}</td>
                <td><StatusBadge status={row.sendStatus} /></td>
                <td className="muted">
                  {row.sendStatus === "sent" && row.sentAt ? (
                    <LocalTime at={row.sentAt} mode="datetime" />
                  ) : row.sendStatus === "queued" || row.sendStatus === "sending" ? (
                    <LocalTime at={row.runAfter} />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="muted">{row.error || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
