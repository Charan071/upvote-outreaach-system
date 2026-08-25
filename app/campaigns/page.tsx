import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { IconLabel } from "@/components/icons";
import { Empty, PageHeader, StatusBadge } from "@/components/ui";
import { campaignKindLabel } from "@/lib/status";
import { LocalTime } from "@/components/LocalTime";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { contacts: true } },
      contacts: { select: { sendStatus: true, runAfter: true } },
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
      <section className="work-surface">
        <div className="work-toolbar">
          <p className="work-count">{campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}</p>
        </div>
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
                <th>Next send</th>
                <th>People</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => {
                const sent = campaign.contacts.filter((row) => row.sendStatus === "sent").length;
                const queuedRows = campaign.contacts.filter(
                  (row) => row.sendStatus === "queued" || row.sendStatus === "sending",
                );
                const queued = queuedRows.length;
                const nextSend = queuedRows.reduce<Date | null>((soonest, row) => {
                  if (!soonest || row.runAfter < soonest) return row.runAfter;
                  return soonest;
                }, null);
                return (
                  <tr key={campaign.id}>
                    <td><Link href={`/campaigns/${campaign.id}`}>{campaign.name}</Link></td>
                    <td>{campaignKindLabel(campaign.kind)}</td>
                    <td><StatusBadge status={campaign.status} /></td>
                    <td>{sent}</td>
                    <td>{queued}</td>
                    <td className="muted">{nextSend && campaign.status === "running" ? <LocalTime at={nextSend} /> : "—"}</td>
                    <td>{campaign._count.contacts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </section>
    </>
  );
}
