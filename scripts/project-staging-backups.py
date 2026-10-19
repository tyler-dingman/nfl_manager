"""Reproduce backup sensitivity envelopes; never a whole-product Free-tier certification."""
import json, math
from pathlib import Path
root = Path(__file__).resolve().parents[1]
def read(path): return json.loads((root / path).read_text())
old = read('reports/zero-cost-phase-4/capacity-model.json')
completion = read('reports/production-completion/capacity-model.json')
scale = read('reports/staging-readiness/scale-recovery.json')
result = read('reports/staging-readiness/backup-capacity-model.json')
lookup = {(r['dau'], r['days']): r for r in old['scenarios']}
ratio = scale['incremental']['dailyDirectoryBytes'] / scale['incremental']['weeklyDirectoryBytes']
rows = []
for current in completion['scenarios']:
    if current['dau'] != 1000: continue
    days = current['days']
    payload = lookup[1000, days]['r2PayloadBytes'] + current['r2AdditionalPayloadBytes']
    keep = set(range(max(1, days - 35), days + 1))
    for day in list(keep): keep.update(range(((day - 1) // 7) * 7 + 1, day + 1))
    full = sum((day - 1) % 7 == 0 for day in keep)
    deltas = len(keep) - full
    checkpoint = current['d1Bytes'] * .25
    rows.append(dict(days=days, d1Bytes=current['d1Bytes'], beforeR2Bytes=current['r2Bytes'],
        payloadFloorBytes=payload, retainedWeeklyFullPoints=full, retainedDailyDeltaPoints=deltas,
        directoryFullBytesAssumed=math.ceil(checkpoint),
        r2BytesAtMeasuredLowChurnRatio=math.ceil(payload + checkpoint * (full + deltas * ratio)),
        r2BytesAtTenPercentDeltaRatio=math.ceil(payload + checkpoint * (full + deltas * .1)),
        r2BytesAtFullChurnRatio=math.ceil(payload + checkpoint * (full + deltas)),
        worstHighEntropyPayloadFloorBytes=payload + current['worstGameR2Bytes'] - current['r2Bytes'],
        unmodeledBytes=None))
result['measuredLowChurnRatio'] = ratio
result['scenarios'] = rows
annual = next(r for r in rows if r['days'] == 365)
assert abs(sum(result['annualPayloadBreakdown'].values()) - annual['payloadFloorBytes']) < 2
assert annual['payloadFloorBytes'] > result['headroomTargetBytes']
(root / 'reports/staging-readiness/backup-capacity-model.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(annual))
