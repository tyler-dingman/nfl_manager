"""Static dependency inventory and conservative projections; does not inspect .env or accounts."""
import collections
import json
import pathlib
import re
import subprocess
from urllib.parse import urlsplit

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/zero-cost-phase-2'
OUT.mkdir(parents=True, exist_ok=True)
tracked = subprocess.check_output(['git', 'ls-files'], cwd=ROOT, text=True).splitlines()
env_refs, hosts, tables, postgres = collections.defaultdict(set), collections.defaultdict(set), {}, collections.defaultdict(set)
for name in tracked:
    if not name.startswith(('src/', 'scripts/', 'services/', 'workers/', '.github/workflows/', 'db/migrations/')):
        continue
    if not name.endswith(('.ts', '.tsx', '.mjs', '.py', '.yml', '.toml', '.sql')) or '.test.' in name:
        continue
    path = ROOT / name
    if not path.is_file(): continue
    text = path.read_text(errors='replace')
    for key in re.findall(r'process\.env\.([A-Z][A-Z0-9_]+)', text): env_refs[key].add(name)
    for host in re.findall(r'https?://([a-zA-Z0-9.-]+)(?=[/:\s\'"`])', text): hosts[host.lower()].add(name)
    if name.startswith(('db/migrations/', 'src/server/')) and 'CREATE TABLE' in text:
        for table in re.findall(r'CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([a-zA-Z_][a-zA-Z_0-9]*)', text, re.I): tables[table] = name
    for feature, pattern in {'jsonb': r'jsonb', 'row-lock': r'FOR UPDATE', 'advisory-lock': r'pg_(?:try_)?advisory',
                             'vector': r'\bvector\b|<=>', 'transaction': r'\.begin\(', 'array': r'ANY\(|unnest\('}.items():
        if re.search(pattern, text, re.I): postgres[feature].add(name)
inventory = {'scope': 'Static references, not proof of configured or active services. No environment values/accounts read.',
             'accountUsage': 'UNVERIFIED: production/account access prohibited',
             'environmentNames': {k: sorted(v) for k,v in sorted(env_refs.items())},
             'declaredHosts': {k: sorted(v) for k,v in sorted(hosts.items())},
             'postgresTables': dict(sorted(tables.items())),
             'postgresCompatibilityDependencies': {k: sorted(v) for k,v in postgres.items()},
             'schedules': {n: (ROOT/n).read_text() for n in tracked if n.startswith('.github/workflows/') and n.endswith('.yml') and 'cron:' in (ROOT/n).read_text()}}
(OUT/'infrastructure-inventory.json').write_text(json.dumps(inventory, indent=2)+'\n')

prior=json.loads((ROOT/'workers/content-engine/measurements/zero-cost-projection.json').read_text())
a=prior['alternatives']['A-entropy']
limits=prior['quotas']
# Add the new isolated schedule directory to the inherited measured editorial floor.
schedule=json.loads((OUT/'schedule-storage.json').read_text()) if (OUT/'schedule-storage.json').exists() else None
schedule_sensitivity=[]
if schedule:
    import math
    for result in schedule['results']:
        extra=math.ceil(result['table']['bytes']*1.2)
        schedule_sensitivity.append({'summaryBytes':result['summaryBytes'],'d1Bytes365':a['horizons']['365']['d1Bytes']+extra,
                                     'r2Bytes365':a['horizons']['365']['r2Bytes']+math.ceil(extra*9.6)})
    measured=schedule['results'][0]['table']['bytes']
    for day,horizon in a['horizons'].items():
        extra=math.ceil(measured*int(day)/365*1.2)
        horizon['d1Bytes']+=extra
        backup_extra=math.ceil(extra*9.6)
        horizon['r2Bytes']+=backup_extra
        horizon['inventoryBackupR2Bytes']+=backup_extra
        horizon['dailyFullInventoryExportRows']+=math.ceil(156*int(day)/365)
        horizon['dailyBackupObjectWrites']=math.ceil(horizon['d1Bytes']/512000)+1
        horizon['dailyBackupCheckpointWrites']=math.ceil(horizon['dailyBackupObjectWrites']/8)*4
    # Conservative rounded allowance: claim/completion writes, full inventory rows,
    # and an extra backup chunk/day. Three provider runs/week were already modeled.
    a['dailyD1Writes']+=2
    a['dailyD1Reads']+=math.ceil(156*1.2)
    a['backgroundRequests']+=2
    a['r2ClassAPer30Days']+=36
    a['dailyR2ReadsBenchmarkConservative']+=1
def model(dau, objects=11):
    # Fixed 24% effective public hit rate, rather than increasing hit rate to make scale pass.
    public_misses=12*dau*.76
    import math
    # Six protected page navigations each perform an extra /api/auth/me HTTP request.
    requests=a['backgroundRequests']+math.ceil(1.2*40*dau)
    reads=a['dailyD1Reads']+math.ceil(1.2*public_misses*30)
    r2b=math.ceil(1.2*(a['dailyR2ReadsBenchmarkConservative']+public_misses*objects))*30
    metrics={'workerRequestsPerDay': requests, 'd1ReadsPerDay': reads, 'd1WritesPerDay': a['dailyD1Writes'],
             'r2ClassAPer30Days': a['r2ClassAPer30Days'], 'r2ClassBPer30Days': r2b,
             'd1Bytes365': a['horizons']['365']['d1Bytes'], 'r2Bytes365': a['horizons']['365']['r2Bytes']}
    bounds={'workerRequestsPerDay':100000,'d1ReadsPerDay':5000000,'d1WritesPerDay':100000,
            'r2ClassAPer30Days':1000000,'r2ClassBPer30Days':10000000,'d1Bytes365':500000000,'r2Bytes365':10000000000}
    metrics['exceeds30PercentHeadroom']=[k for k,v in bounds.items() if metrics[k]>v*.7]
    metrics['exceedsHardLimit']=[k for k,v in bounds.items() if metrics[k]>v]
    metrics['additionalPrivateDbRowReadsEstimatePerDay']=60*dau
    metrics['additionalPrivateDbRowWritesEstimatePerDay']=4*dau
    metrics['searchPgRowsEstimatePerDay']=300*dau
    metrics['neonPollingCuHoursPer30Days']=180
    metrics['wholeProductCost']='UNVERIFIED'
    return metrics
output={'scope':'PROJECTED editorial-only Cloudflare floor; private data, vectors, FO, odds state, email and AI excluded. Not a whole-product certification.',
        'provenance':'ae40533f local measurements; copied inputs retained in workers/content-engine/measurements/',
        'measurement':'No production provider usage or billed Worker CPU measured.',
        'assumptions': {'operationalHeadroom':.3,'operationMultiplier':1.2,'publicCacheHit':.24,'r2ObjectsPerMiss':11,
                        'privateDbWritesPerDau':4,'refreshesPerWeek':3,'baselineNewCandidatesPerDay':200,
                        'sessionValidationHttpRequestsPerDau':6,'totalWorkerRequestsPerDauBeforeReserve':40},
        'traffic':{str(d):model(d) for d in [100,500,1000,1500,2000,3000,5000]},
        'storage':a['horizons'],
        'scheduleSummaryStorageSensitivity':schedule_sensitivity,
        'maximumCloudflareComponentDau30PercentHeadroom':max(d for d in range(5001) if not model(d)['exceeds30PercentHeadroom']),
        'maximumCloudflareComponentDauAt20ObjectsPerMiss':max(d for d in range(5001) if not model(d,20)['exceeds30PercentHeadroom']),
        'maximumVerifiedWholeProductDau':None,
        'email':{str(n):{'dailySubscriptionEmails':n,'accountRecoveryReservePerDay':max(10,n*.02),
                          'resendFreeDailyLimit':100,'resendFreeMonthlyLimit':3000,'brevoFreeDailyLimit':300}
                 for n in [100,500,1000,2000,5000]},
        'odds':{'daysPerWeek':3,'maximumRefreshesIn31Days':15,'assumedNflEventsPerRefresh':16,
                'assumedEventObjectsPer31Days':240,'localSgoObjectCeiling':1000,'publishedSgoAmateurObjectsPerMonth':2500,
                'additionalManualImportsOrOtherConsumers':'UNVERIFIED', 'unabatedPartnerQualification':'UNVERIFIED'}}
(OUT/'capacity-model.json').write_text(json.dumps(output,indent=2)+'\n')
print(json.dumps({'tables':len(tables),'environmentNames':len(env_refs),'hosts':len(hosts),
                  'cloudflareOnlyHeadroomDau':output['maximumCloudflareComponentDau30PercentHeadroom'],
                  'wholeProductDau':None}))
