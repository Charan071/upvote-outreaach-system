import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Icon, IconLabel } from "@/components/icons";
import { Empty, PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { contacts: true } } },
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
          body="Create an invite campaign from unused contacts, or a message campaign from the positive pool."
        />
      ) : (
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Kind</th>
              <th>Status</th>
              <th>People</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id}>
                <td><Link href={`/campaigns/${campaign.id}`}>{campaign.name}</Link></td>
                <td>{campaign.kind}</td>
                <td><StatusBadge status={campaign.status} /></td>
                <td>{campaign._count.contacts}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </>
  );
}
