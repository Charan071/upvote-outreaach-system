import { runDailyProductHuntDiscovery } from "../lib/discover-ph";

runDailyProductHuntDiscovery()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
