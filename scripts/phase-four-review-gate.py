"""Commit-review gate, deliberately not a production readiness gate."""
import json,pathlib,re,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'reports/zero-cost-phase-4'
def data(n):return (OUT/n).read_text()
def load(n):return json.loads(data(n))
def tap(n):return {k:int(re.findall(r'^# '+k+r' (\d+)$',data(n),re.M)[-1])for k in ['pass','fail','skipped']}
logs=['unit-tests.log','d1-all-tests.log','front-office-integration.log','auth-durability-integration.log','sportsbook-db-integration.log','trade-http-integration.log']
suites={n:tap(n)for n in logs}
assert all(v['fail']==0 for v in suites.values()),suites
assert suites['unit-tests.log']['pass']>=1059 and suites['unit-tests.log']['skipped']==2
assert suites['d1-all-tests.log']['pass']>=96
assert all(suites[n]['skipped']==0 for n in logs[1:])
for n in ['typecheck.log','worker-typecheck.log','application-worker-typecheck.log','web-worker-typecheck.log']:assert not data(n).strip(),n
assert 'Ran 2 tests' in data('sqlite-page-tests.log') and 'OK' in data('sqlite-page-tests.log')
assert 'Failed to compile' not in data('node-build.log') and 'ƒ Middleware' in data('node-build.log')
for n in ['cloudflare-build.log','scheduler-dry-run.log']:assert '--dry-run: exiting now.' in data(n)
assert all(not r.get('error') and r['status']==200 and not r.get('horizontalOverflow') for r in load('browser-results.json')['routes'])
assert len(load('browser-results.json')['routes'])==48
probe=load('local-worker-probe.json');assert probe['capabilityAssertionsPassed']==4
for r in probe['results']:assert not r.get('error') and r['status']==(503 if r['name'] in ['Trending Props','Editorial ingestion admission'] else 200),r
scale=load('scale-recovery.json');assert scale['users']>=3000 and scale['savedBets']>=3000 and scale['restore']['status']=='READY' and scale['idempotentRestore']['status']=='READY'
assert scale['repeatedCheckpoint']['id']==scale['checkpoint']['id'] and scale['repeatedCheckpoint']['reusedCheckpoint']
assert scale['backupD1Metrics']['statements']>0 and scale['restoreD1Metrics']['rowsWritten']>0
assert sum(scale['worstObjectOperations'].values())<500
assert load('postgres-d1-import.json')['sourceModified'] is False
assert load('capacity-model.json')['maximumVerifiedWholeProductDau'] is None
names=['PHASE_4_STORAGE_OPTIMIZATION.md','PHASE_4_D1_INTEGRATION.md','PHASE_4_CLOUDFLARE_COMPATIBILITY.md','PHASE_4_PERFORMANCE.md','PHASE_4_PARLAY_LAB_OPTIMIZATION.md','PHASE_4_RECOVERY_SCALE_TEST.md','PHASE_4_PROVIDER_VALIDATION.md','ZERO_COST_PRODUCTION_READINESS_PHASE_4.md']
assert all((ROOT/n).exists()for n in names)
final=(ROOT/names[-1]).read_text();assert 'Production readiness: BLOCKED' in final and len(re.findall(r'^## \d+\.',final,re.M))==15
branch=subprocess.check_output(['git','branch','--show-current'],cwd=ROOT,text=True).strip();assert branch=='poc/zero-cost-production-readiness-phase-4'
subprocess.run(['git','diff','--check'],cwd=ROOT,check=True)
result={'gate':'LOCAL_REVIEW_COMMIT_ONLY','criticalTestsPassed':True,'suitePasses':sum(v['pass']for v in suites.values())+2,'suiteFailures':0,'standaloneConditionalSkips':2,'unresolvedConditionalSkips':0,'browserCases':48,'workerRouteSamples':len(probe['results']),'workerCapabilityAssertions':4,'recoveryUsers':scale['users'],'productionReadiness':'BLOCKED','productionCpu':'UNVERIFIED','wholeProductMigration':'PARTIAL','deploymentAuthorized':False,'branch':branch}
(OUT/'review-gate.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
