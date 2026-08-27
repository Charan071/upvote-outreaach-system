import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CampaignActions } from "@/components/CampaignActions";
import { CampaignMessageEditor } from "@/components/CampaignMessageEditor";
import { PageHeader, Stat, StatusBadge } from "@/components/ui";
import { campaignKindLabel } from "@/lib/status";
import { LocalHourRange, LocalTime } from "@/components/LocalTime";
import { getSettings, completeCampaignIfDone } from "@/lib/queue";
import { formatJitterPhrase } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const settings = await getSettings();
  await completeCampaignIfDone(id);
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      contacts: {
        include: { contact: { include: { messages: { where: { direction: "in" }, take: 1 } } } },
        orderBy: { runAfter: "asc" },
      },
    },
  });
  if (!campaign) notFound();

  const sent = campaign.contacts.filter((c) => c.sendStatus === "sent").length;
  const failed = campaign.contacts.filter((c) => c.sendStatus === "failed").length;
  const skipped = campaign.contacts.filter((c) => c.sendStatus === "skipped").length;
  const queuedRows = campaign.contacts.filter((c) => c.sendStatus === "queued" || c.sendStatus === "sending");
  const queued = queuedRows.length;
  const kind = campaign.kind === "message" ? "message" : "invite";
  const unit = kind === "message" ? "message" : "invite";
  const nextQueued = queuedRows[0];

  const accepted = campaign.contacts.filter((c) => c.acceptedAt).length;
  const replied = campaign.contacts.filter(
    (c) => c.sendStatus === "sent" && c.contact.messages.length > 0,
  ).length;
  const rate = (part: number) => (sent ? `${Math.round((part / sent) * 100)}%` : "—");

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
          {sent} sent · {queued} queued · {skipped} skipped · {failed} failed · {campaign.contacts.length} total
        </span>
      </p>
      {kind === "invite" ? (
        <div className="stats campaign-kpis">
          <Stat value={campaign.contacts.length} label="Targeted" icon="pool" />
          <Stat value={`${sent}/${campaign.contacts.length}`} label="Invites sent" icon="send" />
          <Stat value={`${accepted} · ${rate(accepted)}`} label="Accepted" icon="user" />
          <Stat value={`${replied} · ${rate(replied)}`} label="Replied" icon="inbox" />
        </div>
      ) : null}
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
      ) : campaign.status === "completed" ? (
        <section className="next-step" style={{ marginBottom: 22 }}>
          <div className="next-step-body">
            <div>
              <p className="kicker">Done</p>
              <h2>All {unit}s finished</h2>
              <p className="muted">Add more people to reopen this campaign and keep sending.</p>
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
        <table className="campaign-people-table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Status</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {campaign.contacts.map((row) => {
              const when =
                row.sendStatus === "sent" && row.sentAt ? (
                  <LocalTime at={row.sentAt} mode="datetime" />
                ) : row.sendStatus === "queued" || row.sendStatus === "sending" ? (
                  <LocalTime at={row.runAfter} mode="datetime" />
                ) : null;
              const shortError =
                row.error && (row.sendStatus === "failed" || row.sendStatus === "skipped")
                  ? row.error.replace(/^Unipile \d+:\s*/i, "").trim()
                  : null;
              return (
                <tr key={row.id}>
                  <td>
                    <Link href={`/contacts/${row.contactId}`}>
                      {row.contact.firstName || row.contact.linkedinSlug}
                    </Link>
                  </td>
                  <td className="campaign-status-cell">
                    <StatusBadge status={row.sendStatus} />
                    {shortError ? (
                      <p className="campaign-row-error" title={row.error || shortError}>
                        {shortError}
                      </p>
                    ) : null}
                  </td>
                  <td className="muted when-cell">{when ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
