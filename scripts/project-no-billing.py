"""Inherited workload sensitivity, NOT measured capacity or billing certification."""
import json,math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
read=lambda p:json.loads((root/p).read_text())
old=read('reports/zero-cost-phase-4/capacity-model.json')['scenarios']
current=read('reports/production-completion/capacity-model.json')['scenarios']
def at(rows,d,days,key):return next(r[key] for r in rows if r['dau']==d and r['days']==days)
def linear(rows,d,days,key):
 a,b=at(rows,100,days,key),at(rows,500,days,key)
 return a+(d-100)*(b-a)/400
rows=[]
for d in [0,10,25,50,100]:
 for days in [30,90,180,365]:
  # Affine extrapolation retains the fixed background workload. Rounded source
  # rows introduce <=a few bytes error; these remain explicitly assumptions.
  structured=linear(current,d,days,'d1Bytes')
  payload=(linear(old,d,days,'r2PayloadBytes')+linear(current,d,days,'r2AdditionalPayloadBytes'))/2
  # Source models include two copies; one lives inside D1. No backup directories
  # retained in the cloud. TEXT base64 + 20% page/metadata reserve are assumptions.
  storage=math.ceil(structured+payload*4/3*1.2)
  reads=math.ceil(1950162+668.32*d+96*8+.4*d)
  writes=67711+26*d+600+96*8+32*3+math.ceil(16*3/7*10)+math.ceil(.05*d)
  # New payload rows: four metadata writes plus one chunk write minimum/object.
  # Content objects/day envelope, excludes unknown media and source domains.
  objects=96*2+32+200+16*3/7*3+.2*d+.025*d
  extra_writes=math.ceil(objects*5)
  extra_reads=math.ceil(objects*8)
  rows.append(dict(dau=d,days=days,workerRequestsPerDay=math.ceil(8034+57.6*d+.1*d/3),
   d1ReadsPerDayLowerBound=reads+extra_reads,d1WritesPerDayLowerBound=writes+extra_writes,
   d1StructuredBytes=math.ceil(structured),payloadEncodedBytes=math.ceil(payload),d1BytesWithoutAdmissionCap=storage,
   payloadBudgetDaysApprox=round(64000000/(payload/days),2),r2Bytes=0,
   workerCpuMs=None,aiGenerationsPerDay=200,aiNeuronsPerDayAssumed=200*math.ceil(2756*4625/1e6+700*30475/1e6),
   emailPerDayAssumed=10+math.ceil(.1*d),sportsObjectsPer31DaysReserved=780,
   sportsHttpCallsPerWeekMinimum=3,sourceFetchesPerDay=None,qualified=False))
out=root/'reports/no-billing';out.mkdir(exist_ok=True)
(out/'capacity.json').write_text(json.dumps(dict(status='NO-GO',method='Affine inherited workloads at 100/500 DAU, preserving fixed intercept; no whole-product certification. Compression/page reserve assumed, not production measurements. Bound is an unbounded demand counterfactual; adapter refuses new payloads at 64MB encoded reservation, never deletes history.',firstKnownLimit='64MB payload admission within days; long-term D1 storage. Hosted CPU and provider access remain unverified.',accountHeadroom='Historical preflight only; no account or production access in this mission.',limits=dict(workerRequests=100000,d1Reads=5000000,d1Writes=100000,d1DbBytes=500000000,d1AccountBytes=5000000000,workerCpuMs=10,timeTravelDays=7),rows=rows),indent=2)+'\n')
for r in rows:
 if r['days']==365:print(r['dau'],r['workerRequestsPerDay'],r['d1ReadsPerDayLowerBound'],r['d1WritesPerDayLowerBound'],r['d1BytesWithoutAdmissionCap'],r['payloadBudgetDaysApprox'])
