import { searchWeb } from "../lib/context-dev";

async function main() {
  const query = "Product Hunt maker founder LinkedIn";
  const response = await searchWeb(query, 10);
  const top = response.results.slice(0, 3).map((hit) => ({
    title: hit.title,
    url: hit.url,
    relevance: hit.relevance,
    description: hit.description.slice(0, 180),
  }));

  console.log(
    JSON.stringify(
      {
        query: response.query,
        credits: response.key_metadata,
        resultCount: response.results.length,
        top,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
