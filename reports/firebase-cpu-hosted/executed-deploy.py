import pathlib,json,subprocess,os,tomllib
root=pathlib.Path('/private/tmp/down-distance-rc3');out=root/'reports/firebase-cpu-hosted'
private=pathlib.Path(pathlib.Path('/private/tmp/dd-rc3-private-location.txt').read_text().strip())
env={k:v for k,v in os.environ.items() if k in ['PATH','HOME','TMPDIR','SHELL','LANG','USER']};env.update(CI='true',WRANGLER_SEND_METRICS='false',WRANGLER_LOG_PATH=str(private/'firebase-cpu-deployment.log'))
for role in ['api','web']:
 c=tomllib.loads((root/f'config/rc3-hosted.{role}.toml').read_text());assert not c['workers_dev'] and not c['preview_urls'] and not c.get('triggers',{}).get('crons',[]);assert c['account_id']=='6e8c301360ab628706dcf3acf55f0dbb';assert c['vars']['APP_PASSWORD_ENABLED']=='false' and c['vars']['AUTH_PROVIDER']=='firebase';assert not c.get('routes') and not c.get('r2_buckets')
 assert json.loads((private/(role+'-secrets.json')).read_text())['FIREBASE_PROJECT_ID']=='down-and-distance-8526c'
command=['node','node_modules/wrangler/bin/wrangler.js']
results=[]
for role in ['api','web']:
 secrets=json.loads((private/(role+'-secrets.json')).read_text())
 r=subprocess.run(command+['deploy','--config',f'config/rc3-hosted.{role}.toml','--secrets-file',str(private/(role+'-secrets.json'))],cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 text=r.stdout
 for value in secrets.values():
  if len(value)>15:text=text.replace(value,'[REDACTED]')
 (out/f'deploy-{role}.log').write_text(text)
 results.append({'role':role,'exitCode':r.returncode,'private':True,'secretNames':sorted(secrets)})
 (out/'deployments.json').write_text(json.dumps(results,indent=2)+'\n')
 if r.returncode:raise SystemExit('Private '+role+' deployment failed; stop')
 print('Existing staging '+role+' deployed privately',flush=True)
