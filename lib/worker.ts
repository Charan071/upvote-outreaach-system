import { armCampaign, spreadQueuedJobs, tickQueue } from "./queue";
import { prisma } from "./prisma";

process.env.TZ = "UTC";

const globalForWorker = globalThis as unknown as { queueWorkerStarted?: boolean };

async function recoverInterruptedSends() {
  await prisma.campaignContact.updateMany({
    where: { sendStatus: "sending" },
    data: { sendStatus: "queued", error: "Retrying after interrupted send" },
  });
}

async function armReadyDraftCampaigns() {
  const drafts = await prisma.campaign.findMany({
    where: {
      status: "draft",
      contacts: { some: { sendStatus: "queued", contact: { enrichStatus: "ready" } } },
    },
    select: { id: true },
  });
  for (const draft of drafts) {
    await armCampaign(draft.id);
  }
  if (drafts.length) await spreadQueuedJobs();
  return drafts.length;
}

export function startQueueWorker() {
  if (globalForWorker.queueWorkerStarted) return;
  if (process.env.DISABLE_QUEUE_WORKER === "1") return;
  globalForWorker.queueWorkerStarted = true;

  const intervalMs = Math.max(5_000, Number(process.env.QUEUE_WORKER_INTERVAL_MS || 20_000));

  const run = async () => {
    try {
      const result = await tickQueue();
      if (result.reason !== "empty" && result.reason !== "jitter" && result.reason !== "outside_hours") {
        console.info("[queue-worker]", result);
      }
    } catch (error) {
      console.error("[queue-worker]", error);
    }
  };

  void (async () => {
    try {
      await recoverInterruptedSends();
      const armed = await armReadyDraftCampaigns();
      if (armed) console.info(`[queue-worker] started ${armed} draft campaign(s) that already had queued people`);
    } catch (error) {
      console.error("[queue-worker] startup", error);
    }
    await run();
    setInterval(run, intervalMs);
  })();
}
