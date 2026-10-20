import {readFile,writeFile,stat} from 'node:fs/promises';import os from 'node:os';
const root='/private/tmp/down-distance-rc3/',account='6e8c301360ab628706dcf3acf55f0dbb',mode=process.argv[2];
if(!['enable','disable'].includes(mode))throw Error('Explicit exposure mode required');
if(mode==='enable'){
 const path=root+'reports/firebase-hosted/workers-after-deploy.json',rows=JSON.parse(await readFile(path,'utf8'));
 if(Date.now()-(await stat(path)).mtimeMs>300000||rows.length!==5||rows.some(x=>x.exposure.enabled||x.exposure.previews_enabled||x.schedules.schedules.length))throw Error('Fresh private preconditions failed');
 const web=rows.find(x=>x.role==='web'),api=rows.find(x=>x.role==='api');
 for(const item of [web,api])for(const [key,value]of [['AUTH_PROVIDER','firebase'],['APP_PASSWORD_ENABLED','false'],['FIREBASE_AUTH_ENABLED','true']])if(!item.bindings.some(b=>b.name===key&&b.value===value))throw Error('Unsafe auth setting');
 for(const key of ['ASSETS','API_SERVICE','STAGING_ACCESS_SECRET','AUTH_JWT_SECRET','D1_USERS'])if(!web.bindings.some(b=>b.name===key))throw Error('Missing gate binding');
 const expiry=web.bindings.find(b=>b.name==='STAGING_ACCESS_EXPIRES_AT')?.value;if(Date.parse(expiry)<Date.now()+900000)throw Error('Gate window expired or too short');
}
const token=(await readFile(os.homedir()+'/Library/Preferences/.wrangler/config/default.toml','utf8')).match(/^oauth_token\s*=\s*"([^"]+)"/m)[1];
const url=`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/down-distance-rc3-staging-web/subdomain`;
const r=await fetch(url,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({enabled:mode==='enable',previews_enabled:false})});const body=await r.json();if(!r.ok||!body.success)throw Error('Exposure change failed '+r.status);
const verify=await fetch(url,{headers:{authorization:'Bearer '+token}}),actual=await verify.json();if(!actual.success||actual.result.enabled!==(mode==='enable')||actual.result.previews_enabled)throw Error('Exposure readback failed');
await writeFile(root+'reports/firebase-hosted/exposure-'+mode+'.json',JSON.stringify({checkedAtUtc:new Date().toISOString(),...actual.result},null,2)+'\n');console.log('Protected staging exposure '+mode+' verified; internal Workers unchanged');
