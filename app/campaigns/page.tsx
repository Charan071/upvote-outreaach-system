import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { IconLabel } from "@/components/icons";
import { Empty, PageHeader, StatusBadge } from "@/components/ui";
import { campaignKindLabel } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { contacts: true } },
      contacts: { select: { sendStatus: true } },
    },
  });

  return (
    <>
      <PageHeader
        kicker="Outreach"
        title="Campaigns"
        actions={
          <Link className="btn" href="/campaigns/new">
            <IconLabel name="plus">New campaign</IconLabel>
          </Link>
        }
      />
      {campaigns.length === 0 ? (
        <Empty
          icon="campaign"
          title="No campaigns"
          body="Create a campaign from contacts who already have names. The worker sends one invite at a time."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Queued</th>
                <th>People</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => {
                const sent = campaign.contacts.filter((row) => row.sendStatus === "sent").length;
                const queued = campaign.contacts.filter(
                  (row) => row.sendStatus === "queued" || row.sendStatus === "sending",
                ).length;
                return (
                  <tr key={campaign.id}>
                    <td><Link href={`/campaigns/${campaign.id}`}>{campaign.name}</Link></td>
                    <td>{campaignKindLabel(campaign.kind)}</td>
                    <td><StatusBadge status={campaign.status} /></td>
                    <td>{sent}</td>
                    <td>{queued}</td>
                    <td>{campaign._count.contacts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
