# NFL Manager

Next.js 14 App Router starter with Tailwind CSS, shadcn/ui, TanStack Table, and Zustand.

## Data ingestion pipeline

This project now includes a production-oriented NFL ingestion pipeline that combines:

- **ESPN API** for teams, rosters, and player metadata.
- **OverTheCap scraping** for team salary cap data and player-level contract details.

Pipeline code lives in:

- `src/server/data-sources/espn.ts`
- `src/server/data-sources/overthecap.ts`
- `src/server/data-sources/overthecap-contracts.ts`
- `src/server/ingest/teams.ts`
- `src/server/ingest/players.ts`
- `src/server/ingest/cap.ts`
- `src/server/ingest/contracts.ts`
- `src/server/ingest/normalize.ts`
- `src/scripts/sync-nfl-data.ts`
- `src/scripts/sync-contracts.ts`

The canonical 32-team seed is in `src/server/ingest/teams.ts` and is used as a stable fallback for IDs/conference/division mapping.

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create `.env.local` with Supabase placeholders:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

3. Run the development server:

```bash
pnpm dev
```

4. Open `http://localhost:3000`.

## Sync NFL data

Run a full refresh:

```bash
npm run sync:nfl-data
```

Script behavior:

1. Seeds canonical 32 teams.
2. Pulls ESPN teams + rosters.
3. Scrapes OverTheCap cap table.
4. Scrapes OverTheCap team contract pages.
5. Reconciles team and player mapping via normalization and safe matching.
6. Writes `src/server/data/nfl-data.json`.
7. Prints a summary (`teams`, `players`, `cap records`, `contracts`, `mismatches`).

The script is idempotent and safe to run multiple times.

Run contract-only reconciliation + debug output:

```bash
npm run sync:contracts
```

## Daily scheduling

### Option A: VPS cron

```cron
0 3 * * * cd /path/to/nfl_manager && npm run sync:nfl-data >> /var/log/nfl-sync.log 2>&1
```

### Option B: GitHub Actions

```yaml
on:
  schedule:
    - cron: '0 3 * * *'
```

A ready workflow file is included at `.github/workflows/nfl-data-sync.yml`.

## Troubleshooting

- If ESPN endpoints fail temporarily, player sync logs a warning and preserves existing local data.
- If OverTheCap page structure changes, cap sync logs parser errors and preserves existing local data.
- If an OverTheCap team contract page fails, contract sync logs the missing team and continues.
- Team mapping issues are reported as unmatched rows in sync output.
- Player matching is `normalized name + team` first, then a safe unique name fallback across the league.

## Scripts

- `pnpm dev` - Start the dev server.
- `pnpm build` - Build for production.
- `pnpm start` - Start production server.
- `pnpm lint` - Run ESLint.
- `pnpm format` - Run Prettier.
- `npm run sync:nfl-data` - Sync NFL teams, rosters, cap data, and OverTheCap player contracts.
- `npm run sync:contracts` - Sync/reconcile player contracts from OverTheCap and print a validation sample.
