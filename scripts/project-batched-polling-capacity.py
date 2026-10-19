"""Measured full-day polling pipeline plus observed HTTP user unit costs."""
import json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'reports/batched-polling-capacity'
load=lambda p:json.loads(p.read_text())
before=load(ROOT/'reports/content-engine-capacity/day-after.json')
after=load(OUT/'qualified/day-after.json')
assert before.get('sourceChecks',before['subsystems']['source-poll-and-jobs']['requests'])==18504
assert after['sourceChecks']==18504 and after['maximumQueries']<=50 and after['over50']==0
assert len(after['final']['stories'])==96 and all(s['version']==2 for s in after['final']['stories'])
assert len({s['team_id'] for s in after['final']['stories']})==32
assert sum(s['request_count'] for s in after['final']['sourceCheckpoints'])==18504
assert len(after['final']['sourceCheckpoints'])==97 and not after['final']['pendingInbox']
assert all(s['failure_count']==0 for s in after['final']['sourceCheckpoints'])
assert after['maintenance']['restoreVerified'] and after['maintenance']['retired']==2
assert after['subsystems']['scheduler-idle']['requests']==1440
assert after['subsystems']['scheduler-idle']['rowsWritten']==0

def totals(day):
 core={k:sum(v[k] for name,v in day['subsystems'].items() if name not in ('fixture-setup','inspect')) for k in ('requests','statements','rowsRead','rowsWritten')}
 m=day['maintenance']
 return dict(core,sourceAccountRowsRead=core['rowsRead']+m['preparation']['rowsRead']+m['onlineCleanupRowsRead'],sourceAccountRowsWritten=core['rowsWritten']+m['preparation']['rowsWritten']+m['onlineCleanupRowsWritten'])
traces=[]
for path in (OUT/'browser/local-server.log',OUT/'auth/password-worker.log'):
 for line in path.read_text().splitlines():
  start=line.find('{"metric":"application_headers"')
  if start<0:continue
  try:item=json.loads(line[start:])
  except json.JSONDecodeError:continue
  if 'method' in item and 200<=item.get('status',0)<300:traces.append(item)
def unit(method,path):
 found=[x for x in traces if x['method']==method and path in x.get('routePattern','').replace('\\','')]
 if not found:raise ValueError('Missing observed HTTP unit '+method+' '+path)
 return {k:max(x[k] for x in found) for k in ('rowsRead','rowsWritten','statements')}
actions=[('GET','/api/auth/me',4),('POST','/api/auth/login',2),('POST','/api/auth/logout',2),('POST','/api/auth/signup',.1),('GET','/api/user/home',4),('GET','/api/user/saved-content',2),('POST','/api/user/saved-content',1),('PATCH','/api/user/preferences',.2),('POST','/api/saves/create',.5),('PUT','/api/user/content-state',2)]
units=[dict(method=m,path=p,perDauPerDayAssumed=f,observed=unit(m,p)) for m,p,f in actions]
bg=totals(after); rows=[]
for dau in (0,25,50,100):
 extra={k:math.ceil(sum(dau*u['perDauPerDayAssumed']*u['observed'][k] for u in units)) for k in ('rowsRead','rowsWritten','statements')}
 writes=bg['sourceAccountRowsWritten']+extra['rowsWritten']
 rows.append(dict(dau=dau,rowsRead=bg['sourceAccountRowsRead']+extra['rowsRead'],rowsWritten=writes,writeHeadroom=100000-writes,workerRequests=after['requestCount']+1440+math.ceil(sum(dau*u['perDauPerDayAssumed'] for u in units)),workerCpuMs=None,targetPass=writes<70000,freeWriteAllowancePass=writes<100000,scope='Measured synthetic background plus assumed frequencies at observed HTTP unit costs. Adds 1440 proposed scheduler trigger invocations; all idle API continuations measured. Not a hosted DAU replay.'))
result=dict(statusScope='Daily operation target only; hosted deployment and live workload unqualified',baseline='7aaec5b2',before=totals(before),after=bg,rows=rows,userUnits=units,sourceChecks=after['sourceChecks'],sourceCount=97,teams=32,pollingWritesBefore=before['subsystems']['source-poll-and-jobs']['rowsWritten'],pollingWritesAfter=after['subsystems']['source-poll-and-jobs']['rowsWritten'],maximumQueries=after['maximumQueries'],hostedWorkerCpuMs=None,physicalBytesBefore=before['final']['physicalBytes'],physicalBytesAfter=after['final']['physicalBytes'],emergencyRestoreAdditional=after['maintenance']['recovery'],offlineArchiveTwoCopiesBytes=after['maintenance']['archiveTwoCopiesBytes'],status='PASS' if next(r for r in rows if r['dau']==50)['targetPass'] else 'FAIL',qualifications=['Daily writes/reads/request envelope only; not overall production readiness','Cold registry + complete configured RSS schedules + 96 new articles/corrections + 32 briefings + actual odds/Lab Scores + owner recovery/retention included','No real upstream/provider networking or hosted CPU; observer mode suppresses notification fanout','Separate video registry, mature historical research, account headroom, seasonal bursts, ongoing user storage and multi-year retention remain unqualified','Emergency restore writes are additional and require ingestion pause, not assumed free headroom'])
(OUT/'capacity.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
