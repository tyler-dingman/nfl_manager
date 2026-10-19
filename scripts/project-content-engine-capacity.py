"""Measured content-day + explicit observed HTTP unit costs; no inherited intercept."""
import json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'reports/content-engine-capacity'
load=lambda f:json.loads((OUT/f).read_text())
before,after=load('day-before.json'),load('day-after.json')
for day in [before,after]:
 assert day['maintenance']['restoreVerified'] and day['maintenance']['retired']==2
 assert day['subsystems']['source-poll-and-jobs']['requests']==18504
 assert len({x['team_id'] for x in day['final']['stories']})==32
 assert len(day['final']['stories'])==96 and all(x['version']==2 for x in day['final']['stories'])
 assert day['assumptions']['odds'].find('real computeTrendingProps')>=0
assert after['maximumQueries']<=50
assert after['subsystems']['corrections']['maxQueries']<30
assert after['maintenance']['preparation']['rowsRead']<100000

def totals(day):
 core={k:sum(v[k] for s,v in day['subsystems'].items() if s not in ['fixture-setup','inspect']) for k in ['rowsRead','rowsWritten','requests','statements']}
 m=day['maintenance']
 return dict(core,sourceAccountRowsRead=core['rowsRead']+m['preparation']['rowsRead']+m['onlineCleanupRowsRead'],sourceAccountRowsWritten=core['rowsWritten']+m['preparation']['rowsWritten']+m['onlineCleanupRowsWritten'])
# Final complete API HTTP measurements, including successful login unit costs.
traces=[]
for path in [OUT/'browser-final/local-server.log',OUT/'auth/password-worker.log']:
 for line in path.read_text().splitlines():
  i=line.find('{"metric":"application_headers"')
  if i<0:continue
  try:x=json.loads(line[i:])
  except json.JSONDecodeError:continue
  if 'method' in x and 200<=x.get('status',0)<300:traces.append(x)
def unit(method,path):
 found=[x for x in traces if x['method']==method and path in x.get('routePattern','').replace('\\','')]
 if not found:raise ValueError('Missing observed HTTP unit '+method+' '+path)
 return {k:max(x[k] for x in found) for k in ['rowsRead','rowsWritten','statements']}
# Frequency assumptions, not measured production DAU behavior.
actions=[('GET','/api/auth/me',4),('POST','/api/auth/login',2),('POST','/api/auth/logout',2),('POST','/api/auth/signup',.1),('GET','/api/user/home',4),('GET','/api/user/saved-content',2),('POST','/api/user/saved-content',1),('PATCH','/api/user/preferences',.2),('POST','/api/saves/create',.5),('PUT','/api/user/content-state',2)]
units=[{'method':method,'path':path,'perDauPerDayAssumed':frequency,'observed':unit(method,path)} for method,path,frequency in actions]
background=totals(after);rows=[]
for dau in [0,25,50,100]:
 extra={k:math.ceil(sum(dau*x['perDauPerDayAssumed']*x['observed'][k] for x in units)) for k in ['rowsRead','rowsWritten','statements']}
 requests=math.ceil(sum(dau*x['perDauPerDayAssumed'] for x in units))
 rows.append(dict(dau=dau,d1Reads=background['sourceAccountRowsRead']+extra['rowsRead'],d1Writes=background['sourceAccountRowsWritten']+extra['rowsWritten'],workerRequests=after['requestCount']+requests,maximumMeasuredContentQueries=after['maximumQueries'],maximumMeasuredUserQueries=max(x['observed']['statements'] for x in units),workerCpuMs=None,measuredOneDayD1PhysicalBytes=after['final']['physicalBytes'],measuredEncodedPayloadBytes=after['final']['encoded'],userStorageGrowthBytes=None,storageScope='background day measurement only; not a full-product storage forecast at this DAU',offlineFullBackupTwoCopiesBytes=after['maintenance']['archiveTwoCopiesBytes'],emergencyRemoteRestoreAdditionalReads=after['maintenance']['recovery']['rowsRead'],emergencyRemoteRestoreAdditionalWrites=after['maintenance']['recovery']['rowsWritten'],feasibility='FAIL',reasons=['measured background alone exceeds 100000 writes and 70000 target','user frequencies are assumptions and omit notification fanout/video/history-heavy research; these add demand','full global automation HTTP continuation and hosted CPU remain unqualified']))
result=dict(status='FAIL',baseline='eb8af327',measurement='Actual local workerd HTTP per-job/service pipeline, 24h virtual clock, all current monitoring RSS cadences; no production observations or deployed Free-plan success claim',before=totals(before),after=background,rows=rows,userUnitCosts=units,sourcePollLedger=dict(polls=18504,businessMutationsPerUnchangedPoll=4,fenceMutationsPerUnchangedPoll=8,indexedExtraRowsPerUnchangedPollReconciled=6,accountedRowsPerUnchangedPoll=18,steadyPollRowsWritten=18504*18,newCandidates=96,newCandidateAndJobRowsWritten=96*17,total=18504*18+96*17,scope='Reconciles complete day metadata using current SQL/index/fence layout; not physical disk I/O or a hosted billing certificate'),limits=dict(accountReads=5000000,accountWrites=100000,writeTarget=70000,workerQueryLimit=50,workerQueryTarget=30),unqualified=['mature history and seasonal/upstream bursts','notifications suppressed by observer mode; user activity is an explicit measured-unit model, not 50 users replayed through the full ingestion day','separate video-provider registry and full historical-reference datasets','all-source global API orchestration is not one of these bounded fixture requests','future remote owner-maintenance wiring and production CPU','multi-year database/backup retention capacity'])
(OUT/'capacity.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'before':result['before'],'after':result['after'],'rows':rows},indent=2))
