# 2027 draft data refresh

The canonical board is `src/server/data/draft-prospects.json`. The UI reads it through
`getDraftProspectsForYear(2027)` and does not contain a separate hand-maintained prospect list.

Refresh the source caches and generated prospect file from the repository root with:

```bash
npm run sync:nfl-data
```

The sync pipeline merges the consensus, ESPN profile, and available ranking caches, preserves
source-rank/provenance fields, and writes the generated JSON atomically. Review the diff before
committing, especially player identity matches, measurements, and position changes.

Headshots use the linked ESPN college-player profile image where an identity match exists. The UI
uses an initials avatar when no permitted profile image is available; do not substitute Getty, AP,
or other editorial photography.
