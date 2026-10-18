"""Local review/commit gate, explicitly NOT a production-readiness gate."""
import json,pathlib,re,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'reports/zero-cost-phase-3'
def text(name):return (OUT/name).read_text()
def tap(name):
 data=text(name)
 return {key:int(re.findall(r'^# '+key+r' (\d+)$',data,re.M)[-1]) for key in ['tests','pass','fail','skipped']}
logs=['unit-tests.log','d1-all-tests.log','front-office-integration.log','auth-durability-integration.log','sportsbook-db-integration.log','trade-http-integration.log']
suites={name:tap(name) for name in logs}
assert all(result['fail']==0 for result in suites.values()),suites
assert suites['d1-all-tests.log']['pass']>=88,suites
assert suites['unit-tests.log']['skipped']==2,suites
assert all(suites[name]['skipped']==0 for name in logs[1:]),suites
for name in ['typecheck.log','mobile-typecheck.log','worker-typecheck.log','application-worker-typecheck.log','web-worker-typecheck.log']:assert not text(name).strip(),name
assert 'Ran 2 tests' in text('sqlite-page-tests.log') and 'OK' in text('sqlite-page-tests.log')
assert 'Failed to compile' not in text('production-build.log') and 'ƒ Middleware' in text('production-build.log')
assert '--dry-run: exiting now.' in text('cloudflare-build.log')
assert 'ios bundles' in text('native-export.log') and 'android bundles' in text('native-export.log') and 'Exported:' in text('native-export.log')
browser=json.loads(text('browser-results.json'));assert len(browser['routes'])==48
assert all(row.get('status')==200 and not row.get('error') and not row.get('horizontalOverflow') for row in browser['routes'])
probe=json.loads(text('local-worker-probe.json'));assert probe['capabilityAssertionsPassed']==2
for row in probe['results']:
 assert not row.get('error'),row
 if row['name'] not in ['Trending Props','Editorial ingestion admission']:assert row['status']==200,row
 else:assert row['status']==503,row
assert json.loads(text('postgres-d1-import.json'))['sourceModified'] is False
assert json.loads(text('cross-store-rehearsal.json'))['restore']['status']=='READY'
reports=['PHASE_3_TEST_BASELINE.md','POSTGRESQL_TO_D1_MIGRATION_RESULTS.md','CLOUDFLARE_HOSTING_IMPLEMENTATION.md','WORKER_PERFORMANCE_PHASE_3.md','ZERO_COST_AI_IMPLEMENTATION.md','EMAIL_DELIVERY_IMPLEMENTATION.md','PARLAY_LAB_SCHEDULING_RESULTS.md','CROSS_STORE_RECOVERY_RESULTS.md','ZERO_COST_PRODUCTION_READINESS_PHASE_3.md']
assert all((ROOT/name).exists() for name in reports)
final=(ROOT/reports[-1]).read_text();assert 'Production readiness: BLOCKED' in final
assert len(re.findall(r'^## \d+\.',final,re.M))==14
branch=subprocess.check_output(['git','branch','--show-current'],cwd=ROOT,text=True).strip();assert branch=='poc/zero-cost-production-readiness-phase-3',branch
subprocess.run(['git','diff','--check'],cwd=ROOT,check=True)
result={'gate':'LOCAL_REVIEW_COMMIT_ONLY','criticalTestsPassed':True,'suitePasses':sum(r['pass'] for r in suites.values())+2,'suiteFailures':0,'standaloneConditionalSkips':2,'unresolvedSkips':0,'browserCases':48,'localWorkerSamples':len(probe['results']),'productionReadiness':'BLOCKED','productionWorkerCpu':'UNVERIFIED','deploymentAuthorized':False,'branch':branch}
(OUT/'review-gate.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
