"""Feasibility gate: latest measured operations, measured canonical bodies,
approved retained-reference envelope. Never writes old milestone reports."""
from pathlib import Path
import json,math,sqlite3
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'reports/multi-d1-staging';OUT.mkdir(exist_ok=True)
load=lambda p:json.loads((ROOT/p).read_text())
s=ROOT/'scripts/project-approved-retention.py';text=s.read_text();ns={'__file__':str(s)}
exec(compile(text[:text.index('for dau in [0,10,25,50,100]:')],str(s),'exec'),ns)
size=load('reports/multi-d1-staging/canonical-sizes.json')['results'];measured=load('reports/batched-polling-capacity/capacity.json')
prior=load('reports/multi-d1-qualification/capacity.json');strategies=prior['strategies']
U=set('userAccountsAndOwnership authenticationHistory frontOfficeHistory savedBettingEvidence'.split())
S=set('operationalHistory aiResponseCache temporaryPayloadBacklog gcAuditAndPlanAllowance retentionAuditAndPlans'.split())
# The new polling tables are shared because source leases/checkpoints remain there.
# Retain the original conservative operational envelope; it has no trustworthy
# poll-job-only split, so subtracting the entire old envelope is not justified.
def components(dau,days,retained,body):
 c=ns['scenario'](dau,days,retained)[0]
 count=min(days,90)*96+(.05*dau*max(0,days-90) if not retained else 96*max(0,days-90))
 c['canonicalEditorialRecords']=math.ceil(count*body)
 c['fixedSchemaAndRegistry']+=12288 # measured migration-0045 physical page delta; replicated conservatively
 return c
fixed=None
def allocate(c,shares=None):
 shares=shares or [1/8]*8;f=c['fixedSchemaAndRegistry']
 team=sum(v for k,v in c.items() if k not in U|S|{'fixedSchemaAndRegistry'})
 return {**{f'TEAM_{i+1}':math.ceil((team*share+f)*1.2) for i,share in enumerate(shares)},'USER':math.ceil((sum(c[k] for k in U)+f)*1.2),'SHARED':math.ceil((sum(c[k] for k in S)+f)*1.2)}
rows=[]
for dau in (0,25,50,100):
 op=next(r for r in measured['rows'] if r['dau']==dau)
 for days in (30,90,180,365):
  base=components(dau,days,False,size[0]['canonicalEncodedBytesPerArticle'])
  worst=components(dau,days,True,size[1]['canonicalEncodedBytesPerArticle'])
  db=allocate(base);wdb=allocate(worst)
  sharedHistory=allocate(components(dau,days,True,size[0]['canonicalEncodedBytesPerArticle']))
  optimistic=dict(worst)
  for k in ('historicalOdds','labScoresAndTrending'):optimistic[k]=ns['scenario'](0,min(days,30),0)[0][k]
  strategiesAt={k:{'teams':v['teams'],'base':allocate(base,v['shares']),'retained':allocate(worst,v['shares'])} for k,v in strategies.items()}
  # Safe lower bound independent of any four-team allocation: eight bins must
  # each be no larger than 350 MB; at least one is >= their average.
  lowerBound=max(wdb[f'TEAM_{i+1}'] for i in range(8))
  correctionUnit=load('reports/batched-polling-capacity/qualified/day-after.json')['subsystems']['corrections']['rowsWritten']/96
  fourVersionWrites=math.ceil(op['rowsWritten']+192*correctionUnit)
  editorialKeys=set('editorialPublished canonicalEditorialRecords sourceIngestionEvidence searchIndexes structuredHistoryDirectoriesAndIndexes'.split())
  seasonal={k:math.ceil(v*1.25) if k in editorialKeys else v for k,v in worst.items()}
  seasonalMapping={name:allocate(seasonal,v['shares']) for name,v in strategies.items()}
  rows.append(dict(dau=dau,days=days,baseDatabasesBytes=db,baseAccountBytes=sum(db.values()),retainedDatabasesBytes=wdb,retainedSharedBodiesDatabasesBytes=sharedHistory,retainedAccountBytes=sum(wdb.values()),componentsBase=base,componentsRetained=worst,optimisticZeroOldSavedOddsDatabasesBytes=allocate(optimistic),strategies=strategiesAt,seasonal25PercentMoreEditorial=seasonalMapping,fourVersionSteadyStateWritesSensitivity=fourVersionWrites,measuredSingleD1DailyOperations=op,multiD1AdditionalDailyOperations=None,matureMaintenanceAdditionalDailyOperations=None,maximumSingleD1Queries=measured['maximumQueries'],maximumMultiD1Queries=None,teamAverageLowerBoundBytes=lowerBound,gatePass=lowerBound<350000000 and sum(wdb.values())<3500000000 and op['rowsWritten']<70000 and fourVersionWrites<70000,offlineDailyFullCopiesBytes=2*sum(sum(allocate(components(dau,d,True,size[1]['canonicalEncodedBytesPerArticle'])).values()) for d in range(1,days+1))))
annual=next(r for r in rows if r['dau']==50 and r['days']==365)
result=dict(gate='FAIL' if not annual['gatePass'] else 'UNQUALIFIED',routingImplemented=False,baseline='c8d80820',rows=rows,canonicalMeasurements=size,limits=dict(targetDatabaseBytes=350000000,targetAccountBytes=3500000000,hardDatabaseBytes=500000000,hardAccountBytes=5000000000,targetWrites=70000),assumptions=['Encoded canonical sizes measured through current D1 commit; 4 independent 12KB bodies is retained-history sensitivity, not observed traffic','Other domain bytes/retention/reference fractions are approved synthetic model proxies, not newly measured production volumes','Migration 0045 adds measured 12288-byte initial physical overhead per full schema copy; conservatively charged to all ten', '20% reserve and ten conservative full schema/registry copies; no cross-database dedup credit','No inferred operations multiplier for ten databases; measured single-D1 daily totals are a lower bound before unimplemented cross-shard handoffs','No saved evidence release savings; optimistic extraction counterfactual is not implementation credit','All daily full offline backups x2 retained; no invented rotation/incremental policy','Seasonal weights are synthetic, not actual named-team volume; no workload-specific optimal real-team mapping claimed','Four-version steady-state write sensitivity adds 192 daily corrections at observed full-day correction unit cost; not a second measured day', 'Seasonal stress adds 25% editorial volume only and distributes it using synthetic weights; no real team popularity asserted', 'First-day owner scan costs do not qualify mature annual retention/backup reads; additional mature maintenance remains unknown', 'Unchanged 64MB encoded payload admission guard can bind before modeled physical size'])
connection=sqlite3.connect(':memory:')
for migration in sorted((ROOT/'workers/content-engine/migrations').glob('*.sql')):connection.executescript(migration.read_text())
previousRoles={r['table']:r['allocation'] for r in load('reports/multi-d1/capacity.json')['tableInventory']}
previousRoles.update(app_storage_poll_batch='SHARED',app_storage_poll_retry='SHARED')
inventory=[]
for (table,) in connection.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"):
 role=previousRoles[table]
 fks=[dict(target=r[2],column=r[3],targetColumn=r[4]) for r in connection.execute('PRAGMA foreign_key_list("'+table+'")')]
 inventory.append(dict(table=table,role=role,foreignKeys=fks))
result['currentTableInventory']=inventory
result['crossRoleForeignKeys']=[dict(table=r['table'],**fk) for r in inventory for fk in r['foreignKeys'] if previousRoles[fk['target']]!=r['role'] and 'LOCAL_INTERNAL' not in (r['role'],previousRoles[fk['target']])]
(OUT/'table-allocation.md').write_text('# Proposed allocation (not enabled)\n\nEach TEAM_OWNER table belongs to exactly one deterministic owner shard. LOCAL_INTERNAL is local to each populated database; polling lease/inbox tables are explicitly SHARED. Existing SQL cross-role foreign keys require verified reference contracts before routing.\n\n| Table | Role | FK targets |\n|---|---|---|\n'+''.join('| '+r['table']+' | '+r['role']+' | '+(', '.join(f['target'] for f in r['foreignKeys']) or '—')+' |\n' for r in inventory))
(OUT/'capacity.json').write_text(json.dumps(result,indent=2)+'\n')
(OUT/'projections.md').write_text('# Storage projections\n\nDecimal MB/GB, including 20% physical reserve and ten schema copies. These are synthetic retention projections, not measured ten-database files. TEAM is each uniform team shard; all ten individual sizes and four mapping strategies are in capacity.json.\n\n| DAU | Days | TEAM base MB | TEAM retained/changed MB | USER MB | SHARED MB | Account base GB | Account retained GB |\n|---:|---:|---:|---:|---:|---:|---:|---:|\n'+''.join(f"| {r['dau']} | {r['days']} | {r['baseDatabasesBytes']['TEAM_1']/1e6:.1f} | {r['retainedDatabasesBytes']['TEAM_1']/1e6:.1f} | {r['baseDatabasesBytes']['USER']/1e6:.1f} | {r['baseDatabasesBytes']['SHARED']/1e6:.1f} | {r['baseAccountBytes']/1e9:.3f} | {r['retainedAccountBytes']/1e9:.3f} |\n" for r in rows))
assert len(rows)==16
assert annual['teamAverageLowerBoundBytes']>350000000
assert annual['gatePass'] is False
print(json.dumps({k:annual[k] for k in ('baseDatabasesBytes','baseAccountBytes','retainedDatabasesBytes','retainedAccountBytes','optimisticZeroOldSavedOddsDatabasesBytes','teamAverageLowerBoundBytes','measuredSingleD1DailyOperations')},indent=2))
