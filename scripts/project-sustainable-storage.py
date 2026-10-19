"""Measured format/GC fixture + explicit inherited workload sensitivities.
Never treats synthetic category shares or logical deletion as measured annual savings."""
import json,math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
read=lambda p:json.loads((root/p).read_text())
before=read('reports/no-billing/capacity.json')
bench=read('reports/sustainable-storage/storage-benchmark.json')
rows=[]
for old in before['rows']:
 d,days=old['dau'],old['days']
 # Baseline AI component was two copies, 200*2048 bytes each/day. The no-R2
 # model retained one copy. Existing cache expiry is one day, not archival.
 expired_ai=max(0,days-1)*200*2048
 retained=max(0,old['payloadEncodedBytes']-expired_ai)
 # Preserve original 20% page/metadata planning reserve; drop base64's 4/3.
 # Unknown orphan rates and history retention savings receive ZERO credit.
 audited_deletions=200*days
 audit_bytes=audited_deletions*160 # assumed indexed audit footprint, not measured production
 capacity=math.ceil(old['d1StructuredBytes']+1.2*retained+audit_bytes)
 live_objects=math.ceil((192+32+16*3/7*3+.225*d)*days+200)
 cleanup_reads=math.ceil(old['d1StructuredBytes']/256+3*live_objects+1000)
 cleanup_writes=1005 # assumed 200 expired rows + 200 one-chunk objects + lock/audit updates
 payloads_per_day=192+32+200+16*3/7*3+.225*d
 min_fence_writes=math.ceil(payloads_per_day*6) # three guarded write batches/object
 known_writes=old['d1WritesPerDayLowerBound']+cleanup_writes+min_fence_writes
 rows.append(dict(dau=d,days=days,beforeD1Bytes=old['d1BytesWithoutAdmissionCap'],
  afterD1HighWaterDemandBytes=capacity,structuredBytes=old['d1StructuredBytes'],retainedEncodedPayloadBytes=math.ceil(retained),
  boundedAiEncodedBytes=409600,assumedAuditBytes=audit_bytes,
  payloadAdmissionExhaustionDaysApprox=round(64000000/(retained/days),2),
  workerRequestsPerDay=old['workerRequestsPerDay'],workerCpuMs=None,
  d1ReadsPerDayProjected=old['d1ReadsPerDayLowerBound']+cleanup_reads,
  d1WritesPerDayKnownLowerBound=known_writes,
  d1WritesSensitivityIfOneFencedTransactionPerFourInheritedRowWrites=known_writes+math.ceil(old['d1WritesPerDayLowerBound']/4)*2,
  cleanupRowsReadPerDayAssumed=cleanup_reads,cleanupRowsWrittenPerDayAssumed=cleanup_writes,
  cleanupQueriesPerDailyMarkAssumed=200+live_objects+800,
  wholeProductQualified=False,headroom30PercentMet=capacity<=350000000 and known_writes<=70000,
  physicalDeletionShrinkCreditBytes=0))
annual50=next(r for r in rows if r['dau']==50 and r['days']==365)
old50=next(r for r in before['rows'] if r['dau']==50 and r['days']==365)
# These are PROJECTED component shares, not observed annual data.
copies={
 'Front Office historical versions':.025*50*365*100000*.5,
 'Odds historical snapshots':16*3/7*365*100000,
 'Reconstructable AI responses':200*365*2048*2,
 'Private configuration and attachments':50*65536,
 'Saved evidence and identity/score/public payloads':(.2*50*365*2560)+365*(16*3/7)*2000*640+365*96*2048,
}
copies['Inherited editorial and other payloads (not separable from old model)']=old50['payloadEncodedBytes']*2-sum(copies.values())
components={k:dict(projectedD1BytesBefore=v/2*1.6,percentOfBeforeAnnualDemand=(v/2*1.6)/old50['d1BytesWithoutAdmissionCap']*100)for k,v in copies.items()}
components['Structured tables and indexes']=dict(projectedD1BytesBefore=old50['d1StructuredBytes'],percentOfBeforeAnnualDemand=old50['d1StructuredBytes']/old50['d1BytesWithoutAdmissionCap']*100)
result=dict(status='NO-GO: 50 DAU/365 days not achieved',limitsVerifiedOn='2026-10-19',
 method='Existing affine no-billing workload; remove base64 and expire only already-expired AI caches. No deletion credit for editorial/odds/user histories or unknown orphans. 1.2 page factor, audit bytes and GC scan density are assumptions; demand is counterfactual beyond the still-enforced 64MB admission cap.',
 measuredFixture=dict(beforeSqliteBytes=bench['legacyBase64']['before']['sqliteBytes'],binarySqliteBytes=bench['binary']['before']['sqliteBytes'],afterGcSqliteBytes=bench['binary']['after']['sqliteBytes'],reservedBefore=bench['binary']['capacityBefore']['reservedEncodedBytes'],reservedAfter=bench['binary']['capacityAfter']['reservedEncodedBytes'],reusedExistingPages=bench['binary']['reusedExistingPages']),
 permanentVersusReferencedAnnualPercent=None,reasonCategoryPrecision='Inherited model does not identify which historical odds/editorial payloads are unreferenced. Exact annual permanent/referenced/orphan shares cannot be measured from synthetic fixtures.',
 projectedComponentsAt50Dau365Days=components,rows=rows,
 hardLimits=dict(databaseBytes=500000000,accountBytes=5000000000,readsPerDay=5000000,writesPerDay=100000,workerRequestsPerDay=100000,workerCpuMsPerInvocation=10,queriesPerWorkerInvocation=50),
 blockers=['Annual retained storage remains above 500MB','64MB admission still exhausts; unchanged deliberately','GC scans are owner-local maintenance, not a <=50-query Worker invocation','Actual SQL transaction rate and hosted CPU unknown','Safe retention for historical odds/editorial not established'])
out=root/'reports/sustainable-storage';out.mkdir(exist_ok=True)
(out/'capacity.json').write_text(json.dumps(result,indent=2)+'\n')
for r in rows:
 if r['days']==365:print(r['dau'],r['afterD1HighWaterDemandBytes'],r['d1ReadsPerDayProjected'],r['d1WritesPerDayKnownLowerBound'],r['payloadAdmissionExhaustionDaysApprox'])
