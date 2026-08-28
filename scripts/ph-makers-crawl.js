// Product Hunt makers -> LinkedIn crawl, run via playwright browser_run_code_unsafe.
// PH renders profile social links client-side, so each maker profile needs a real
// page load; fetching the HTML directly returns markup without the LinkedIn anchor.
// Edit SLUGS per batch to keep a single run well under the tool timeout.

async (page) => {
  const SLUGS = ["aramb", "revalvo", "snakerank", "notchdrop", "fide-island"];
  const results = [];

  for (const slug of SLUGS) {
    const entry = { slug, product: null, makers: [], linkedinFound: 0 };
    try {
      await page.goto(`https://www.producthunt.com/products/${slug}/makers`, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      await page.waitForTimeout(1200);

      const info = await page.evaluate(() => {
        const users = new Set();
        document.querySelectorAll('a[href^="/@"], a[href*="producthunt.com/@"]').forEach((a) => {
          const m = a.getAttribute("href").match(/@([A-Za-z0-9_\-.]+)/);
          if (m) users.add(m[1]);
        });
        const h = document.querySelector("main h1, h1");
        return { users: [...users], product: h ? h.innerText.trim() : null };
      });
      entry.product = info.product;

      for (const user of info.users.slice(0, 6)) {
        try {
          await page.goto(`https://www.producthunt.com/@${user}`, {
            waitUntil: "domcontentloaded",
            timeout: 45000,
          });
          await page.waitForTimeout(900);
          const prof = await page.evaluate(() => {
            const a = [...document.querySelectorAll('a[href*="linkedin.com/in/"]')][0];
            const h = document.querySelector("main h1, h1");
            const text = (document.querySelector("main") || document.body).innerText;
            const headline = text.split("\n").map((s) => s.trim()).filter(Boolean)[1] || null;
            return {
              linkedin: a ? a.getAttribute("href") : null,
              name: h ? h.innerText.trim() : null,
              headline,
            };
          });
          if (prof.linkedin) entry.linkedinFound += 1;
          entry.makers.push({ user, ...prof });
        } catch (e) {
          entry.makers.push({ user, error: String(e).slice(0, 120) });
        }
      }
    } catch (e) {
      entry.error = String(e).slice(0, 200);
    }
    results.push(entry);
  }

  return JSON.stringify(results);
}
