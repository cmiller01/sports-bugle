# Sports Bugle

[![CI](https://github.com/cmiller01/sports-bugle/actions/workflows/ci.yml/badge.svg)](https://github.com/cmiller01/sports-bugle/actions/workflows/ci.yml)

A daily sports page — a single-page dashboard that pulls live scores, standings,
and playoff brackets from the public ESPN API and lays them out in a
print-friendly newspaper style.

## Features

- Multi-league scoreboard: NBA, NFL, MLB, NHL, NCAA Men's Basketball, and EPL
- Playoff series views for the NBA and NHL
- NCAA Men's Basketball tournament bracket
- Favorite-team filtering with `localStorage` persistence
- Auto-refresh every five minutes
- Print-optimized layout
- Headless mode via URL params (`?headless&leagues=nba,nhl&favs=...`) for
  automated snapshots

## Tech stack

- [React 18](https://react.dev/) with [Vite](https://vitejs.dev/)
- ESPN's public `site.api.espn.com` endpoints (no key required)
- [pnpm](https://pnpm.io/) for package management

## Local development

Requires Node.js 18+ and pnpm.

```sh
pnpm install
pnpm dev
```

The dev server runs at http://localhost:5173 by default.

Other scripts:

```sh
pnpm build     # production build to ./dist
pnpm preview   # serve the production build locally
```

## Project layout

```
.
├── index.html          # Vite entry HTML
├── src/
│   ├── main.jsx        # React root
│   └── App.jsx         # Entire app: config, data fetching, and UI
├── public/             # Static assets (favicon, _redirects)
├── vite.config.js      # Build config + version injection
└── package.json
```

Adding a new league is a matter of extending the `LEAGUES` map at the top of
`src/App.jsx` with a path, sport, and a few per-league knobs (days of lookback,
whether it has playoffs, etc.).

## License

MIT — see [LICENSE](./LICENSE).
