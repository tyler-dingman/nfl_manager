import{readFile,writeFile}from'node:fs/promises';import os from'node:os';import WebSocket from'/private/tmp/down-distance-rc3/node_modules/ws/wrapper.mjs';
import{execFileSync}from'node:child_process';
const root='/private/tmp/down-distance-rc3/',out=root+'reports/firebase-hosted/',dir=(await readFile('/private/tmp/dd-rc3-private-location.txt','utf8')).trim(),base='https://down-distance-rc3-staging-web.tdingman5.workers.dev',account='6e8c301360ab628706dcf3acf55f0dbb';
const oauth=(await readFile(os.homedir()+'/Library/Preferences/.wrangler/config/default.toml','utf8')).match(/^oauth_token\s*=\s*"([^"]+)"/m)[1];
const traces=[],operations=[],tails=[];let session,stopReason;
async function save(){await writeFile(out+'measured-authentication.json',JSON.stringify({source:'Actual Cloudflare live tail trace-v1 cpuTime milliseconds; not local timing',operations,traces,stopReason:stopReason??null,legacyPasswordInvocations:traces.filter(t=>t.role==='password').length},null,2)+'\n');}
async function api(path,method,body){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method,headers:{authorization:'Bearer '+oauth,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const x=await r.json();if(!x.success)throw Error('Telemetry API '+r.status);return x.result;}
try{
 for(const role of['api','web','password']){
  const path='/workers/scripts/down-distance-rc3-staging-'+role+'/tails',tail=await api(path,'POST',{}),ws=new WebSocket(tail.url,'trace-v1');tails.push({path,id:tail.id,ws});
  ws.on('message',data=>{try{const x=JSON.parse(data.toString());let path;try{path=new URL(x.event?.request?.url).pathname}catch{}const metrics=[];for(const l of x.logs??[])for(const raw of l.message??[])try{const m=typeof raw==='string'?JSON.parse(raw):raw;if(m?.metric==='application_headers')metrics.push(m);}catch{}
   traces.push({role,path,receivedAt:Date.now(),eventTimestamp:x.eventTimestamp,outcome:x.outcome,status:x.event?.response?.status,cpuTimeMs:x.cpuTime,wallTimeMs:x.wallTime,metrics,exceptionNames:(x.exceptions??[]).map(e=>e.name)});
  }catch{}});
  await new Promise((resolve,reject)=>{ws.once('open',()=>{ws.send(JSON.stringify({debug:false}));resolve()});ws.once('error',reject)});
 }
 const stage=await readFile(dir+'/staging-cookie.txt','utf8'),firebase=JSON.parse(await readFile(dir+'/firebase-synthetic-a.json','utf8'));
 async function call(label,path,expected,body){
  const start=Date.now();const r=await fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{cookie:stage+(session?'; '+session:''),origin:base,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();let json;try{json=JSON.parse(text)}catch{}
  const operation={label,path,status:r.status,expected,startedAtUtc:new Date(start).toISOString(),pass:r.status===expected};operations.push(operation);
  const cookie=r.headers.get('set-cookie')?.split(';')[0];if(cookie?.startsWith('dd_session='))session=cookie;
  if(json?.user?.id)await writeFile(dir+'/firebase-app-session.json',JSON.stringify({session,userId:json.user.id}),{mode:0o600});
  for(let i=0;i<60;i++){if(traces.some(t=>t.receivedAt>=start&&t.path===path&&typeof t.cpuTimeMs==='number'))break;await new Promise(resolve=>setTimeout(resolve,100));}
  const samples=traces.filter(t=>t.receivedAt>=start&&t.path===path&&typeof t.cpuTimeMs==='number');operation.cpuSamples=samples.map(t=>({role:t.role,cpuTimeMs:t.cpuTimeMs}));
  await save();console.log(label+': HTTP '+r.status+' CPU '+JSON.stringify(operation.cpuSamples));
  const over=samples.find(t=>t.cpuTimeMs>10);if(over){stopReason=`Workers Free CPU exceeded during ${label}: ${over.role} ${over.cpuTimeMs} ms > 10 ms`;throw Error(stopReason);}
  if(text.includes('1102'))throw Error('Cloudflare resource limit response');
  if(!operation.pass)throw Error('Hosted operation failed '+label+' '+r.status);
  return json;
 }
 await call('Firebase registration-related identity exchange','/api/auth/firebase/session',200,{idToken:firebase.idToken});
 await call('Verified session lookup','/api/auth/me',200);
 for(const path of['/','/front-office','/parlay-lab','/account'])await call('Authenticated SSR '+path,path,200);
 await call('Logout','/api/auth/logout',200,{});
 session=undefined;
 await call('Logged-out session denied','/api/auth/me',401);
}catch(error){stopReason??=error.message;console.log('Hosted validation stopped: '+stopReason);execFileSync(process.execPath,['/private/tmp/dd-firebase-exposure.mjs','disable'],{stdio:'inherit'});}
finally{
 await new Promise(resolve=>setTimeout(resolve,2000));
 for(const tail of tails){tail.ws.close();await api(tail.path+'/'+tail.id,'DELETE').catch(()=>{});}
 await save();
}
