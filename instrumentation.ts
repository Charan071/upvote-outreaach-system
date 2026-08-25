export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.DISABLE_QUEUE_WORKER === "1") return;
  const { startQueueWorker } = await import("./lib/worker");
  startQueueWorker();
}
