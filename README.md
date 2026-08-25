# upvote-outreaach-system

Contact pool: Product Hunt makers → LinkedIn outreach (Next.js, Prisma/Postgres, Unipile, Gemini, Context.dev).

Working hours, invite spacing, and daily caps use **UTC**.

## Local setup

1. Copy `.env.example` to `.env` and fill in Unipile/Gemini/Context.dev keys.
2. Start Postgres: `docker compose up -d`
3. Push schema: `npm run db:push`
4. (Optional) Copy existing SQLite data: `npm run db:migrate-sqlite`
5. Seed defaults: `npm run db:seed`
6. Run the app: `npm run dev`

The background worker starts with the Next.js server and processes queued invites, profile lookups, and spacing automatically. For production, run `npm run worker` as a separate process and set `DISABLE_QUEUE_WORKER=1` on the web service.

Secrets stay in `.env` locally and in Render env vars. Never commit `.env`.
