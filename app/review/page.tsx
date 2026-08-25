import { prisma } from "@/lib/prisma";
import { ReviewActions } from "@/components/ReviewActions";
import { SyncInboxButton } from "@/components/SyncInboxButton";
import { Empty, PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const items = await prisma.classification.findMany({
    where: { reviewedAt: null },
    include: { message: { include: { contact: true } } },
    orderBy: { message: { receivedAt: "desc" } },
  });

  return (
    <>
      <PageHeader kicker="Inbox" title="Review classifications" actions={<SyncInboxButton />} />
      {items.length === 0 ? (
        <Empty
          icon="inbox"
          title="Nothing to review"
          body="Sync the LinkedIn inbox, then confirm Gemini labels before anyone enters the positive pool."
        />
      ) : (
        items.map((item) => (
          <article key={item.id} className="review-card">
            <p className="kicker">
              {item.message.contact.firstName || item.message.contact.linkedinSlug}
            </p>
            <p>{item.message.body}</p>
            <p className="muted">
              Gemini: <StatusBadge status={item.aiLabel} /> {item.aiReason}
            </p>
            <ReviewActions id={item.id} aiLabel={item.aiLabel} />
          </article>
        ))
      )}
    </>
  );
}
