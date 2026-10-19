"""Offline, conservative envelopes. No provider calls or quota certification."""
import json, math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
read=lambda p:json.loads((root/p).read_text())
current=read('reports/production-completion/capacity-model.json')
old=read('reports/zero-cost-phase-4/capacity-model.json')
backup=read('reports/staging-readiness/backup-capacity-model.json')
lookup={(r['dau'],r['days']):r for r in old['scenarios']}
rows=[]
for r in current['scenarios']:
 if r['dau'] not in [100,500,1000,1500,2000] or r['days']!=365:continue
 payload=lookup[r['dau'],365]['r2PayloadBytes']+r['r2AdditionalPayloadBytes']
 keep=set(range(330,366))
 for day in list(keep):keep.update(range(((day-1)//7)*7+1,day+1))
 full=sum((day-1)%7==0 for day in keep); delta=len(keep)-full
 directory=r['d1Bytes']*.25
 rows.append({**r,'retainedWeeklyFullPoints':full,'retainedDailyDeltaPoints':delta,
  'r2RequiredPayloadFloorBytes':payload,
  'r2WeeklyDailyLowChurnBytes':math.ceil(payload+directory*(full+delta*backup['measuredLowChurnRatio'])),
  'r2WeeklyDailyFullChurnBytes':math.ceil(payload+directory*(full+delta)),
  'storageMethod':'Assumed 25% directory/D1 physical ratio and inherited low-churn measurement; all history retained',
  'firstKnownHardLimitsViolated':[name for name,exceeded in [('D1 per-database storage',r['d1Bytes']>500000000),('D1 daily reads',r['d1ReadsPerDayLowerBound']>5000000),('D1 daily writes',r['d1WritesPerDayLowerBound']>100000),('Worker daily requests',r['workerRequestsPerDayLowerBound']>100000),('R2 Class A monthly',r['r2ClassAPer30DaysLowerBound']>1000000),('R2 Class B monthly',r['r2ClassBPer30DaysLowerBound']>10000000)] if exceeded],
  'privateStagingColdAssetGateExtraPerDauAssumed':110,'privateStagingColdRequestSensitivity':r['workerRequestsPerDayLowerBound']+110*r['dau'],'emailProviderAllowance':None,'sportsProviderAllowance':None,'hostedCpuMs':None,'wholeProductQualified':False})
result={'scope':'PROJECTED lower bounds from inherited workload, not observed traffic. New migration domains, real AI/mail/provider quotas and archival growth remain unmodeled. No deletion assumed.',
 'accountPreflight':'Workers Free; R2 and Access not enabled as of preflight. No renewed account access in sprint.',
 'measuredDeltaRatioFromSyntheticFixture':backup['measuredLowChurnRatio'],
 'annualPayloadBreakdown1000Dau':backup['annualPayloadBreakdown'],
 'rows':rows,'maximumSustainableDauAtZeroCost':None,'reason':'No whole-product DAU qualified; unavailable R2/Access first, then D1 and operations bounds plus hosted CPU unknown.'}
out=root/'reports/final-staging';out.mkdir(exist_ok=True,parents=True)
(out/'capacity.json').write_text(json.dumps(result,indent=2)+'\n')
for r in rows:print(r['dau'],r['d1Bytes'],r['r2WeeklyDailyLowChurnBytes'],','.join(r['firstKnownHardLimitsViolated']))
