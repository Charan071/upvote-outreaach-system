# This app's UI surface

Launchlist — Next.js App Router, React 19, **no Tailwind**. Global CSS + a few shared components.

## Tokens (`app/globals.css`)

Dark is the default (`data-theme="dark"`). Light uses the same token names. Users toggle in the sidebar; choice is stored as `launchlist.theme`. Accent stays purple; primary buttons invert with the theme (white on dark, black on light).

| Token | Dark | Light | Role |
|---|---|---|---|
| `--bg` / `--bg-2` | `#0d0d0d` / `#141414` | `#ffffff` | Canvas and cards |
| `--aside` | `#0d0d0d` | `#ffffff` | Sidebar |
| `--ink` / `--text` | `#f5f5f5` | `#141414` | Body and titles |
| `--muted` | `#9a9a9a` | `#6b6b6b` | Secondary text |
| `--line` | `#2a2a2a` | `#e5e7eb` | Hairlines |
| `--accent` | `#8a05ff` | `#8a05ff` | Links, kickers, selected nav/filters, logo |
| `--accent-soft` | `#2a1140` | `#f6ebff` | Selected washes |
| `--btn-fill` / `--btn-color` | white / `#0d0d0d` | `#0d0d0d` / white | Primary button |

Type: **Roobert** for h1, brand, and stat numbers. **Neue Montreal** for body and buttons. **ui-sans-serif** for h2–h4. Font files live in `public/fonts/`.

Brand: outlined upvote triangle (accent stroke, canvas fill) + **Launchlist** in the sidebar header, with a chevron collapse control beside the name. Same mark is the browser tab favicon (`app/icon.svg`).

Layout: `main` is full remaining column. Contacts: Add people sits above the `.work-surface` list. Settings keeps Live account + KPIs + form as they are.

## Shared components

- `components/ui.tsx` — `PageHeader`, `Badge`, `StatusBadge`, `Empty`, `Stat`
- `components/AppNav.tsx` — sticky collapsible sidebar, theme switch
- `components/icons.tsx` — inline icons + `BrandMark`
- Classes: `.shell`, `.work-surface`, `.add-people`, `.settings-grid`, `.detail-grid`, `.btn`, `.panel`, `.table-wrap`, `.filters`, `.next-step`, `.review-card`, `.empty`
