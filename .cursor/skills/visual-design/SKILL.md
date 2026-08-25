---
name: visual-design
description: Makes UI look and feel intentional — color, typography, theme, spacing, hierarchy, and operator UX. Use when restyling the app, changing palette/fonts/theme, polishing look and feel, improving user experience, or building/editing screens, pages, forms, tables, nav, empty states, or CSS.
---

# Visual Design

This is an operator tool people use every day, not a landing page. Design for clarity, calm, and speed. Distinctive is good; decorative is not.

Derived from Anthropic's `frontend-design` skill (Apache-2.0). Modified for this Launchlist app: product UI and UX, not marketing aesthetics. See [LICENSE.txt](LICENSE.txt).

Read [this-app.md](this-app.md) before changing styles or components.

Do not start a theme overhaul until you have shown a short design plan and the human has approved it. Small, local CSS fixes can proceed after a two-sentence plan.

## What this skill owns

Color, type, theme, spacing, elevation, density, hierarchy, motion, copy in the UI, empty/error/loading states, and whether a screen is easy to use.

Brainstorming owns product scope and architecture. If a UX change restructures flows or adds screens, classify it there first, then use this skill for look and feel.

## Ground it

Name the product, who uses it, and the screen's one job before choosing aesthetics.

This product: a solo operator's LinkedIn outreach desk — contacts, campaigns, reply review, settings. The job is "what should I do next?" not "be impressed."

Use real copy and real data shape (names, headlines, status badges, queues). Never design around lorem ipsum or marketing hero blocks.

## Design plan (show this first)

For any visual pass, write a compact plan, then stop for approval if you are changing theme-level tokens:

- **Color** — 4–6 named hex values (bg, surface, ink, muted, accent, danger/success). Accent is for action and status, not chrome.
- **Type** — one body face for UI; an optional display face only if it still reads as a tool. Set a scale (kicker / body / title / numeral). Do not pair three families.
- **Theme** — dark is the default. Light is a user toggle from the same tokens (`data-theme`). No extra palettes.
- **Layout** — one-sentence concept plus a tiny ASCII wire if structure changes. Prefer the existing shell (sidebar + main).
- **Signature** — one memorable thing (a numeral style, a review-card treatment, a next-step rail). Everything else stays quiet.
- **UX** — the primary action, the next-best action, and what empty/error/busy look like on this screen.

Then self-critique: would this plan fit any generic SaaS admin? If yes, revise the signature and type — not by adding decoration, but by making hierarchy and status more specific to outreach work.

AI-default looks to avoid unless the brief asks for them: cream + terracotta serif; near-black + acid green; hairline broadsheet; Inter/Roboto + purple gradient + glass cards; "AI SaaS" glow.

## Product UI principles

Spend boldness once. A 50px title can be the signature; then body, tables, and buttons stay disciplined.

- **Hierarchy** — one H1 per page. Kickers label context (Audience, Outreach, Inbox). Stats are scannable, not a dashboard trophy wall.
- **Primary action** — one obvious button per page (Write invite, New campaign, Sync inbox). Secondary actions are quieter.
- **Status is the product** — badges must be readable at a glance (ready / queued / interested / failed). Color never carries meaning alone; keep the label.
- **Density** — tables and review cards are the work surface. Comfortable density, not magazine whitespace and not a cramped spreadsheet.
- **Flow** — the Next step block should answer "what now?" Empty states invite the next action. Errors say what happened and how to fix it.
- **Consistency** — same button, badge, panel, and empty-state language on every route. If you invent a new pattern, you are probably missing an existing class.
- **Motion** — almost none. Hover/focus only. Honor `prefers-reduced-motion`.
- **Quality floor** — usable at 900px (existing breakpoint), visible `:focus-visible`, contrast that holds for muted text and accent-on-white.

## Copy

Words are UI. Sentence case. Active verbs. Same word for the same action everywhere ("Sync inbox" stays "Sync inbox").

- Buttons: "Save changes", "Write invite", "New campaign" — not Submit/OK.
- Empty: what is missing + the next action.
- Errors: what failed + what to do. No apology theater.

## Implement in this repo

Change look and feel through tokens and shared CSS, not one-off style attributes.

1. Tokens and theme: `app/globals.css` (`:root`)
2. Fonts: `@font-face` in `app/globals.css` (Roobert + Neue Montreal in `public/fonts/`)
3. Shared pieces: `components/ui.tsx`, `components/AppNav.tsx`, `components/icons.tsx`
4. Page structure stays in route files; they should keep using `PageHeader`, `Stat`, `Badge`, `Empty`, `btn` / `btn secondary`

Do not add Tailwind, a component library, or a parallel CSS module system for a restyle. Do not hardcode hex in JSX when a token exists.

After UI changes, verify in the browser the way a user would: click, filter, empty and populated states, desktop and the 900px layout. A screenshot of one screen is not verification.

## Restraint

Before you finish, remove one accessory. If the page still works without it, it should not have shipped.
