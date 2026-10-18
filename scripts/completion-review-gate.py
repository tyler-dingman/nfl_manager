"""Local review-commit gate. This explicitly does not authorize deployment."""
import pathlib,json,re,subprocess
root=pathlib.Path(__file__).resolve().parents[1];out=root/'reports/production-completion'
load=lambda n:json.loads((out/n).read_text())
logs=['unit-tests.log','d1-all-tests.log','front-office-integration.log','auth-durability-integration.log','sportsbook-db-integration.log','trade-http-integration.log']
suites={}
for name in logs:
 text=(out/name).read_text();suites[name]={k:int(re.findall(r'^# '+k+r' (\d+)$',text,re.M)[-1])for k in ['pass','fail','skipped']}
assert all(s['fail']==0 for s in suites.values()),suites
assert suites['unit-tests.log']['pass']>=1059 and suites['d1-all-tests.log']['pass']>=104
assert '# fail 0' in (out/'data-services-tests.log').read_text()
assert 'Ran 2 tests' in (out/'sqlite-page-tests.log').read_text() and 'OK' in (out/'sqlite-page-tests.log').read_text()
for n in ['typecheck.log','completion-typecheck.log']:assert not (out/n).read_text().strip(),n
scale=load('scale-recovery.json');assert scale['users']==5000 and scale['checkpoint']['objects']>=2800 and scale['restore']['status']=='READY'
assert scale['allOriginalUserIdsPreserved'] and scale['repeatedCheckpoint']['reusedCheckpoint']
assert load('postgres-d1-import.json')['sourceModified'] is False
assert load('split-build.json')['dryRunStatus']==0 and load('split-build.json')['productionDeployment'] is False
web_bytes=float(re.findall(r'gzip: ([\d.]+) KiB',(out/'split-build.log').read_text())[-1])*1024
assert web_bytes<3*1024*1024 and load('api-bundle.json')['gzipBytes']<3*1024*1024
probe=load('web-worker-probe.json');assert probe['capabilityAssertionsPassed']==8
assert sum(r['attempt']=='team'for r in probe['results'])==32
assert all(r.get('status')==(503 if r['path']=='/api/automation/content' else 200)for r in probe['results'])
assert 'Uncaught' not in (out/'web-worker.log').read_text() and 'api_failure' not in (out/'web-worker.log').read_text()
assert len(load('browser-results.json')['routes'])==48
assert all(r['status']==200 and not r['horizontalOverflow']for r in load('browser-results.json')['routes'])
branch=subprocess.check_output(['git','branch','--show-current'],cwd=root,text=True).strip();assert branch=='poc/zero-cost-production-completion'
report=(root/'ZERO_COST_PRODUCTION_COMPLETION_REPORT.md').read_text();assert 'Production readiness: **BLOCKED**' in report
assert load('capacity-model.json')['maximumVerifiedWholeProductDau'] is None
subprocess.run(['git','diff','--check'],cwd=root,check=True)
result={'gate':'LOCAL_REVIEW_COMMIT_ONLY','criticalTestsPassed':True,'suitePasses':sum(s['pass']for s in suites.values())+2,'suiteFailures':0,'standaloneConditionalSkips':2,'browserCases':48,'workerHttpSamples':len(probe['results']),'workerCapabilityAssertions':8,'teamVariants':32,'recoveryUsers':scale['users'],'recoveryObjects':scale['checkpoint']['objects'],'webGzipBytes':web_bytes,'apiGzipBytes':load('api-bundle.json')['gzipBytes'],'productionReadiness':'BLOCKED','productionCpu':'UNVERIFIED','wholeProductMigration':'PARTIAL','deploymentAuthorized':False,'branch':branch}
(out/'review-gate.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
