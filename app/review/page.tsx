import { prisma } from "@/lib/prisma";
import { ReviewActions } from "@/components/ReviewActions";
import { SyncInboxButton } from "@/components/SyncInboxButton";
import { Empty, PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const items = await prisma.message.findMany({
    where: {
      direction: "in",
      OR: [{ classification: null }, { classification: { reviewedAt: null } }],
    },
    include: { contact: true, classification: true },
    orderBy: { receivedAt: "desc" },
  });

  return (
    <>
      <PageHeader kicker="Inbox" title="Review replies" actions={<SyncInboxButton />} />
      {items.length === 0 ? (
        <Empty
          icon="inbox"
          title="No replies yet"
          body="Inbound LinkedIn messages show up here automatically. Use Sync inbox if a reply is missing."
        />
      ) : (
        items.map((item) => (
          <article key={item.id} className="review-card">
            <p className="kicker">
              {item.contact.firstName || item.contact.linkedinSlug}
            </p>
            <p className="review-body">{item.body}</p>
            {item.classification ? (
              <p className="muted">
                Suggested: <StatusBadge status={item.classification.aiLabel} /> {item.classification.aiReason}
              </p>
            ) : (
              <p className="muted">No automatic label yet — pick one below.</p>
            )}
            <ReviewActions messageId={item.id} aiLabel={item.classification?.aiLabel} />
          </article>
        ))
      )}
    </>
  );
}
