"""Conservative inherited workload sensitivity, not a production forecast.
No measured synthetic page reduction is extrapolated into an annual saving.
"""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
base = json.loads((root / 'reports/sustainable-storage/capacity.json').read_text())
rows = []
for old in base['rows']:
    row = dict(old)
    payloads = 192 + 32 + 200 + 16 * 3 / 7 * 3 + .225 * row['dau']
    # Old model charged three fenced payload transactions. New atomic upload
    # uses one: four fewer guard writes/object. Index and other transaction
    # amplification remain in the inherited sensitivity, not measured savings.
    saving = round(4 * payloads)
    for field in ['d1WritesPerDayKnownLowerBound',
                  'd1WritesSensitivityIfOneFencedTransactionPerFourInheritedRowWrites']:
        row[field] -= saving
    row.update(measuredMaintenanceStepMaxStatements=12,
               measuredBrowserRequestMaxStatements=48,
               annualStorageSavingsCreditForInlineOrStaleScores=0,
               allWorkerPathsQualified=False)
    rows.append(row)
base.update(
    method='Conservative inherited workload envelope; atomic object writes remove two fenced transactions per object (four guard writes). No annual storage credit for inline page savings or stale score cleanup because the inherited combined editorial/identity/score bucket cannot be separated safely. Source-version caches can be reclaimed, but published history and odds remain rooted. Full mark remains owner-local. All operation figures are projections, not hosted measurements.',
    rows=rows,
    blockers=['365-day retained demand exceeds 500MB per database',
              '64MB payload admission intentionally unchanged',
              'Full marking is owner-local and pauses SDK writers',
              'Large legacy graphs, unbounded historical reads and cold/background paths not universally qualified below 50 statements',
              'Daily write/index amplification and hosted CPU lack production measurements'])
out = root / 'reports/d1-free-optimization/capacity.json'
out.write_text(json.dumps(base, indent=2) + '\n')
