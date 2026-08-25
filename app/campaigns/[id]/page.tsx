import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CampaignActions } from "@/components/CampaignActions";
import { CampaignMessageEditor } from "@/components/CampaignMessageEditor";
import { PageHeader, StatusBadge } from "@/components/ui";
import { campaignKindLabel } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      contacts: { include: { contact: true }, orderBy: { runAfter: "asc" } },
    },
  });
  if (!campaign) notFound();

  const sent = campaign.contacts.filter((c) => c.sendStatus === "sent").length;
  const failed = campaign.contacts.filter((c) => c.sendStatus === "failed").length;
  const queued = campaign.contacts.filter((c) => c.sendStatus === "queued" || c.sendStatus === "sending").length;
  const kind = campaign.kind === "message" ? "message" : "invite";
  const unit = kind === "message" ? "message" : "invite";

  return (
    <>
      <PageHeader
        kicker={campaignKindLabel(campaign.kind)}
        title={campaign.name}
        actions={<CampaignActions id={campaign.id} status={campaign.status} />}
      />
      <p className="muted" style={{ marginBottom: 22 }}>
        <StatusBadge status={campaign.status} /> {sent} sent · {queued} queued · {failed} failed ·{" "}
        {campaign.contacts.length} total
      </p>
      {campaign.status === "running" && queued > 0 ? (
        <section className="next-step" style={{ marginBottom: 22 }}>
          <div className="next-step-body">
            <div>
              <p className="kicker">Worker</p>
              <h2>Sending {queued} {unit}{queued === 1 ? "" : "s"}</h2>
              <p className="muted">
                The background worker sends one {unit} at a time during working hours, with a random gap. You do not
                need to click send for each person.
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
                <td className="muted">{row.error || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
