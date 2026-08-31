# Launchlist Playbook — Getting Real Support for Your Product Hunt Launch

A practical guide to running founder-to-founder outreach on LinkedIn around a Product Hunt
launch: which tools you need, how far their free tiers actually get you, how to build the
contact list with an IDE or Claude, and the week-long workflow that ties it together.

Written for a solo founder with no ops team and no budget for a sales stack.

---

## 1. What this actually does

Other makers launching the same week as you are the single most receptive audience for a
"support my launch" ask. They understand the mechanic, they want reciprocity, and they are
active on the day. The problem is purely mechanical: finding them, getting their LinkedIn
profile, and sending a personal note to each one without spending your launch day copying
and pasting.

Launchlist automates that middle part. You give it LinkedIn profile URLs, it looks up each
person's name, then sends **one connection invite at a time**, spaced out, inside your local
working hours, staying under LinkedIn's limits. Replies come back into an inbox where you
label them.

What it is **not**: a mass-DM tool. The send rate is deliberately slow — roughly one invite
every 8–25 minutes. That pacing is the thing that keeps the account alive, so resist the
urge to tune it up.

> **A word on ethics and risk.** This automates a real LinkedIn account through an
> unofficial API. That is against LinkedIn's Terms of Service, and the account bears the
> risk — restriction or ban is a real, if uncommon, outcome at low volume. Sending a
> genuine, relevant note to a few dozen people a day is very different from blasting
> thousands. Stay on the first side of that line, for your own sake as much as anyone
> else's.

---

## 2. Prerequisites

| Requirement | Why | Hard blocker? |
|---|---|---|
| A LinkedIn account, ideally 6+ months old with a real history | New or empty accounts get restricted fastest | Yes |
| **LinkedIn Premium** (or a trial of it) | Free accounts allow only **5 invites with a note per month** | Yes, in practice |
| Node.js 20+ and Git | Running the app | Yes |
| A Unipile account | The LinkedIn API layer | Yes |
| Docker, *or* a Railway/Render account | Postgres database | Yes |
| Cursor, VS Code + Claude Code, or Claude with a browser tool | Building the contact list | No, but painful without |
| A Google AI Studio key | Auto-classifying replies | No, optional |

### The one that catches everyone

Read the Premium row again. On a **free** LinkedIn account you can send plenty of
connection requests, but only **five per month may carry a note**. A launch-support ask
without a note is nearly worthless — it's an anonymous connect request from a stranger.

Launchlist knows about this distinction and enforces it:

```18:23:lib/limits.ts
  free: {
    inviteDailyMax: 15,
    inviteWeeklyMax: 150,
    inviteMonthlyWithNote: 5,
    inviteNoteMax: 200,
  },
```

So before anything else: start a **LinkedIn Premium free trial** (one month, card required,
cancel any time). Time it to begin a few days before your launch. This single decision is
the difference between reaching 200 people and reaching 5.

---

## 3. The tools and what their free tiers really give you

### Unipile — the LinkedIn connection

Unipile hosts a real LinkedIn session and exposes it as an API. Launchlist never sees or
stores your LinkedIn password or cookies.

- **Free tier:** 7-day full-access trial, all features, **no credit card required**.
- **After that:** €49/month for up to 10 connected accounts. You need one.
- **The catch:** when the trial ends without a subscription, API access **locks**
  immediately. Calls return `403 api/inactive_subscription` and webhooks stop. Your queued
  invites simply stop going out.
- **The other catch:** trial eligibility is **per user, once**. Once you create or join an
  organization you can't get another trial by making a new org.

**What this means practically:** seven days is exactly one launch week, and not a day more.
Start the Unipile trial the day before you begin building your list, not two weeks earlier
while you're still planning. If the launch goes well and you want to keep the conversations
going, one month of €49 is a reasonable cost against the result.

### Railway — hosting (or just run it on your laptop)

- **Free trial:** $5 of credits, 30 days, no credit card.
- **Permanent free plan:** $1/month in non-rolling credits, capped at 1 vCPU / 0.5 GB RAM.
- **Hobby:** $5/month including $5 of usage.
- **The catch:** an always-on web service plus a Postgres database will not fit inside $1 a
  month. It fits comfortably inside the $5 trial credit for a launch week.

**Honest recommendation:** for a single launch, **skip hosting entirely and run it locally**
with Docker. It costs nothing, there's no trial clock, and the only real downside is that
invites pause when your laptop sleeps — which matters less than you'd think, since sends
are confined to your working hours anyway.

Host it only if you want the queue running while your machine is off.

### Context.dev — optional, skip it

Used for one narrow job: a single search per day to find LinkedIn URLs, at one credit per
run. The IDE-based approach in Section 5 does the same job for free with better coverage.
Leave `CONTEXT_DEV_API_KEY` empty.

### Google AI Studio (Gemini) — optional

Classifies inbound replies as positive/negative/neutral so you can triage faster. The free
tier is generous and far beyond what this needs. Leave `GEMINI_API_KEY` empty and you just
label replies yourself, which for 30 replies takes about five minutes.

### Total cost for one launch week

| Path | Cost |
|---|---|
| LinkedIn Premium trial + Unipile trial + local Docker | **$0** |
| Same, but hosted on Railway trial credit | **$0** |
| If you keep it running past the trials | ~€49 + $5/month + Premium |

---

## 4. Setup

### 4.1 Connect LinkedIn to Unipile

1. Sign up at [unipile.com](https://www.unipile.com/) and start the 7-day trial.
2. In the dashboard, connect your LinkedIn account. You'll log in through their hosted flow
   and complete any 2FA challenge.
3. Collect three values:
   - `UNIPILE_DSN` — looks like `https://api12.unipile.com:14200`
   - `UNIPILE_TOKEN` — your API key
   - `UNIPILE_ACCOUNT_ID` — the ID of the connected LinkedIn account
4. Leave the account connected. If LinkedIn logs the session out, Unipile marks it
   disconnected and Launchlist pauses on its own.

### 4.2 Run the app

```bash
git clone <your-fork-url> launchlist
cd launchlist

cp .env.example .env     # fill in the three Unipile values
docker compose up -d     # Postgres on localhost:5432
npm install
npm run db:push
npm run db:seed
npm run dev              # http://localhost:3000
```

The queue worker starts alongside Next.js. It looks up names, sends invites, and sleeps
between actions — you don't start it separately.

Minimum `.env`:

```bash
DATABASE_URL="postgresql://outreach:outreach@localhost:5432/outreach"
UNIPILE_DSN=https://apiXX.unipile.com:PORT
UNIPILE_TOKEN=your-token
UNIPILE_ACCOUNT_ID=your-account-id
```

### 4.3 Configure Settings before importing anyone

Open **Settings** and set these deliberately:

| Setting | Suggested | Reasoning |
|---|---|---|
| Account tier | `paid` if on Premium | Unlocks the 300-character note and higher caps |
| Daily invite cap | 40–50 to start | Unipile's own recommendation is 50/day; the ceiling is 80 |
| Weekly invite cap | 180 | LinkedIn's hard weekly ceiling is ~200. Leave headroom |
| Work hours | Your real ones, e.g. 09:00–18:00 | Invites at 4 a.m. local time look exactly like a bot |
| Work days | Mon–Fri, or include weekends | Weekend launches are quieter but people do reply |
| Gap between sends | Leave the default (8–25 min) | This is the main safety mechanism |
| Timezone | Yours | Everything else keys off it |

If your account is newer than about six months, halve the daily cap for the first week.

### 4.4 Webhooks (only if hosted)

Point Unipile's Users webhook at `https://your-app/api/webhooks/unipile`, subscribing to
`new_relation`, `message_received`, and Account Status. This is what flips someone from
"invited" to "connected" the moment they accept.

Running locally, skip it — the app reconciles accepted invites by polling instead.

---

## 5. Building the contact list

This is the part with no off-the-shelf tool, and where an AI-assisted IDE genuinely earns
its place. The goal is a list of LinkedIn profile URLs for makers who launched on Product
Hunt in the last day or two.

### Why you can't just fetch the pages

Product Hunt sits behind Cloudflare, so `curl` and plain HTTP fetches return 403. Worse,
maker profiles render their social links **client-side** — even if you get the HTML, the
LinkedIn anchor isn't in it. You need a real browser that executes JavaScript.

That rules out most scraping shortcuts and leaves you with browser automation.

### Option A — Cursor or VS Code with the Playwright MCP (recommended)

1. Install the Playwright MCP server in your IDE. In Cursor this is a few lines in
   `mcp.json`; the Playwright docs cover the VS Code equivalent.
2. Ask your agent to open the Product Hunt leaderboard for the day you want:
   `https://www.producthunt.com/leaderboard/daily/2026/9/1/all` — note the **`/all`**
   suffix, which gives every launch rather than just the featured ones. It's the difference
   between roughly 30 products and roughly 120.
3. Have it scroll the page repeatedly before extracting. The list is virtualized, so a
   single read captures only the first 15–20 products.
4. For each product slug, visit `/products/{slug}/makers`, collect the `@username` of each
   maker, then visit each maker's profile and pull the `linkedin.com/in/` link.

This repo has that crawl ready to run at `scripts/ph-makers-crawl.js`. Edit the `SLUGS`
array to a batch of about ten products and run it through the Playwright tool — small
batches keep each run inside the tool's timeout. It returns the maker name, headline, and
LinkedIn URL per product.

A realistic yield: **10 products produces 10–25 LinkedIn URLs.** Many makers don't link
LinkedIn at all, and solo makers are common, so budget for roughly one usable URL per
product.

### Option B — Claude with browser access

If you'd rather not set up an IDE, Claude with a browser tool can do the same job
conversationally. Something like:

> Open `https://www.producthunt.com/leaderboard/daily/2026/9/1/all`. Scroll to the bottom
> repeatedly until no new products load, then give me every product slug. Then for each of
> the first 20, open `/products/{slug}/makers`, and for each maker open their profile and
> extract their `linkedin.com/in/` URL. Return JSON with product name, product URL, and
> LinkedIn URL.

Slower and more hands-on than the script, but zero setup.

### Option C — manual

Open the leaderboard, click through products, click makers, copy LinkedIn URLs into a text
file. About 45 minutes for 50 contacts. Genuinely fine for a first launch, and you'll
understand the data better for having done it once.

### Importing

Paste URLs straight into the app's import box (one per line), or `POST /api/contacts/import`
with structure — worth doing, because storing each person's product URL lets you
**reciprocate** when they reply:

```json
{
  "contacts": [
    {
      "linkedinUrl": "https://www.linkedin.com/in/example/",
      "productName": "StayThere.ai",
      "productUrl": "https://www.producthunt.com/products/staythere",
      "source": "product_hunt"
    }
  ]
}
```

Duplicates are rejected on LinkedIn slug, so re-importing an overlapping batch is safe.

After import each contact sits at `pending` while the worker looks up their name — about
100 profile visits a day, spaced out. Names must resolve before a campaign can render
`{first_name}`.

---

## 6. Writing the note

One note covers the whole campaign, with `{first_name}` and `{company}` filled per person.
The cap is **300 characters after filling** on Premium, 200 on free.

A version that has worked:

```
Hey {first_name},

We launched Meridian on Product Hunt! 🚀 It creates worklogs and daily summaries, so you
can stop letting your work go unnoticed. It's open source and free for individual
developers.

I'd love your support and honest feedback: https://www.producthunt.com/products/meridian-16
```

What makes it work: it's specific about what the product does, it says "honest feedback"
rather than only asking for an upvote, and it's short enough to read in the notification
preview without expanding.

**Watch the character budget.** That template is 283 characters before the name goes in,
leaving 17 characters of headroom. Some people have genuinely long first names — a
"Veera Venkata Satyanarayana" blows the cap and the app will refuse to create the campaign
rather than send something truncated mid-sentence. Either trim the template or shorten that
contact's stored first name to the part you'd actually greet them by.

---

## 7. Running the campaign

1. **Contacts** → select the enriched, unused people → *Add to campaign* → new campaign.
2. Open the campaign, check the rendered preview on a couple of real contacts.
3. Unpause. The worker takes over: one invite, wait 8–25 minutes, next invite, stopping at
   your daily cap and outside your work hours.
4. Watch the campaign KPI strip: targeted, sent, accepted, replied.

### What to expect

Rough numbers from a real launch week, useful as a sanity check rather than a promise:

| Stage | Typical |
|---|---|
| Invites sent | 100% |
| Accepted | 40–60% — makers accept other makers readily |
| Replied | 10–20% of accepted |
| Actually upvoted | Some fraction of replies; you'll never measure it exactly |

### The reciprocity loop — the part that actually matters

The upvote is not the point. The conversation is. When someone replies, **ask for their
Product Hunt link and support their launch too.** That exchange is why storing `productUrl`
at import time is worth the extra effort — you already have their launch on file.

This turns a cold ask into a mutual one, and it's the difference between a one-off favour
and a peer who remembers you next launch.

### If the queue stalls

| Symptom | Cause | Fix |
|---|---|---|
| Everything "queued", nothing sending | Outside work hours, or a cap is hit | Check Settings; it resumes on its own |
| Sends stopped mid-campaign | Weekly cap reached | Rolling 7-day window; wait for the reset |
| `403 api/inactive_subscription` | Unipile trial ended | Subscribe, or the account is locked |
| One contact fails, rest continue | Already invited or already connected | Correct behaviour — it skips, doesn't pause |
| Everything paused after one failure | A real 429 from LinkedIn | Leave it alone for 24h, then halve your cap |

The pause-on-rate-limit behaviour is intentional. If LinkedIn throttles you, the worst
possible response is to retry.

---

## 8. Limits, in one place

Launchlist enforces these; LinkedIn is the one actually counting.

| Limit | Premium | Free |
|---|---|---|
| Invites/day (ceiling) | 80 | 15 |
| Invites/day (recommended) | 50 | 10 |
| Invites/week | 200 | 150 |
| **Invites with a note/month** | unlimited | **5** |
| Note length | 300 chars | 200 chars |
| Profile visits/day | 100 | 100 |
| Messages/day | 100 | 100 |

New accounts should sit at 15 invites and 40 profile visits a day for the first week or two.

The weekly counter is a **rolling seven-day window**, not a calendar week. It resets seven
days after the window opened, not on Monday morning. Plan your launch week around that.

---

## 9. Recommended end-to-end workflow

**T-7 days — set up, no clocks running yet**

Clone and run locally, get Docker and Postgres up. Do a dry run: import three profiles of
people you actually know, confirm names resolve and one invite sends correctly. Don't start
the Unipile trial yet — the seven days are precious.

**T-2 days — start the clocks**

Start the LinkedIn Premium trial and the Unipile trial. Connect the account. Configure
Settings. Do a first list-building run against yesterday's leaderboard, import 25–50
contacts, and let name lookup run overnight.

**T-1 day — first campaign**

Write the note, create a campaign from the enriched contacts, send at 40–50/day. These are
warm-ups: real conversations before you have an ask.

**Launch day**

Morning: scrape today's `/all` leaderboard — these are the people launching alongside you
and the most receptive audience you'll get. Import, enrich, create a campaign. Send at your
full daily cap.

Throughout: reply to everything within an hour or two. Support their launches. This is where
your day should go — not into the tooling.

**T+1 to T+4 — the long tail**

Keep scraping each day's launches. Watch the weekly cap: 200 across the week means roughly
40/day if you spread it evenly, and it's better to spread than to burn 80 on day one and go
dark. Keep working the replies; most upvotes arrive from conversations started a day or two
earlier.

**T+7 — decide**

Trials are ending. If it produced real conversations, subscribe. If not, export your
contacts, cancel both, and you've spent nothing.

---

## 10. Common mistakes

**Skipping LinkedIn Premium.** Five noted invites a month is not a campaign.

**Using the featured leaderboard instead of `/all`.** You'll see 30 products instead of 120
and conclude there aren't enough makers to reach.

**Not scrolling before extracting.** The leaderboard is virtualized. A single read gives you
the first 19 products and you won't notice the other 100 are missing.

**Raising the send gap "just for launch day."** The pacing is the safety mechanism. An
account restriction on launch day costs far more than the extra invites gain.

**Treating it as a numbers game.** Two hundred invites with a generic note will underperform
fifty with a specific one, and will damage your reputation with exactly the people you most
want to know.

**Asking for an upvote and disappearing.** The reciprocity loop is the whole value. Support
their launch, and they'll remember you next time.

---

## 11. If you get stuck

- Unipile API reference and provider limits: <https://developer.unipile.com/>
- Product Hunt daily leaderboard: `producthunt.com/leaderboard/daily/YYYY/M/D/all`
- App health, caps, and account status: the **Settings** page
- Queue behaviour: `lib/queue.ts` and `lib/limits.ts` — both are short and commented

The database is plain Postgres, so anything the UI won't show you is one SQL query away.
