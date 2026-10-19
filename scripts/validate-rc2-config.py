"""Read-only local release template checks. Never contacts Cloudflare."""
import json,pathlib,tomllib
root=pathlib.Path(__file__).resolve().parents[1]
names=['api','web','password','application','odds-processor']
configs={name:tomllib.loads((root/'config'/f'rc2.{name}.toml').read_text()) for name in names}
physical={}
for role,c in configs.items():
 assert c['workers_dev'] is False and c['preview_urls'] is False
 assert not c.get('routes') and not c.get('r2_buckets')
 assert not c.get('triggers',{}).get('crons')
 assert c['name'].startswith('down-distance-rc2-staging-')
 for key in c.get('vars',{}):assert 'DATABASE_URL' not in key and 'R2' not in key
 for binding in c.get('d1_databases',[]):
  assert binding['remote'] is False
  previous=physical.setdefault(binding['binding'],binding['database_id'])
  assert previous==binding['database_id']
 for service in c.get('services',[]):assert service['service'].startswith('down-distance-rc2-staging-')
assert len(physical)==10 and len(set(physical.values()))==10
for role in ['api','web']:assert {b['binding'] for b in configs[role]['d1_databases']}==set(physical)
assert configs['web']['main']=='../workers/staging/mtls-index.ts'
assert configs['web']['assets']['run_worker_first'] is True
assert 'REPLACE_' in configs['web']['vars']['STAGING_MTLS_SHA256']
for key,value in configs['application']['vars'].items():
 if key.endswith('_ENABLED'):assert value=='false'
result={'status':'PASS','scope':'local review templates only','workers':len(configs),'distinctD1Databases':len(physical),'r2Bindings':0,'cronTriggers':0,'publicWorkersDev':False,'resourcesCreated':False,'deployableWithoutOwnerConfiguration':False}
out=root/'reports/rc2';out.mkdir(parents=True,exist_ok=True)
(out/'configuration.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
