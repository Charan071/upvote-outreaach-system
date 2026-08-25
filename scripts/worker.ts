process.env.TZ = "UTC";

void import("../lib/worker").then(({ startQueueWorker }) => {
  startQueueWorker();
});
