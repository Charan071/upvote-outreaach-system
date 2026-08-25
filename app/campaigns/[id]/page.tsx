import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CampaignActions } from "@/components/CampaignActions";
import { CampaignMessageEditor } from "@/components/CampaignMessageEditor";
import { QueuedMessageEditor } from "@/components/QueuedMessageEditor";
import { PageHeader, StatusBadge } from "@/components/ui";

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

  return (
    <>
      <PageHeader
        kicker={campaign.kind}
        title={campaign.name}
        actions={<CampaignActions id={campaign.id} status={campaign.status} />}
      />
      <p className="muted" style={{ marginBottom: 22 }}>
        <StatusBadge status={campaign.status} /> {sent} sent · {failed} failed · {campaign.contacts.length} total
      </p>
      {campaign.status !== "running" ? (
        <section className="next-step" style={{ marginBottom: 22 }}>
          <div className="next-step-body">
            <div>
              <p className="kicker">Next</p>
              <h2>Start sending connection requests</h2>
              <p className="muted">
                Invites go out one at a time during working hours, with a random gap between each. Press Start sending, then Send next invite.
              </p>
            </div>
          </div>
        </section>
      ) : null}
      <CampaignMessageEditor
        campaignId={campaign.id}
        kind={campaign.kind === "message" ? "message" : "invite"}
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
            <th>Message</th>
            <th>Status</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {campaign.contacts.map((row) => (
            <tr key={row.id}>
              <td>{row.contact.firstName || row.contact.linkedinSlug}</td>
              <td>
                <QueuedMessageEditor
                  campaignId={campaign.id}
                  rowId={row.id}
                  initial={row.renderedMessage}
                  locked={row.sendStatus !== "queued"}
                  kind={campaign.kind === "message" ? "message" : "invite"}
                />
              </td>
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
