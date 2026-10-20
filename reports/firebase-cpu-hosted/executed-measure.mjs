import {readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import WebSocket from '/private/tmp/down-distance-rc3/node_modules/ws/wrapper.mjs';
import {createRequire} from 'node:module';
const require=createRequire('/private/tmp/down-distance-rc3/package.json');
const {initializeApp,deleteApp}=require('firebase/app');
const {getAuth,createUserWithEmailAndPassword,getIdToken}=require('firebase/auth');
const root='/private/tmp/down-distance-rc3/',out=root+'reports/firebase-cpu-hosted/',account='6e8c301360ab628706dcf3acf55f0dbb',base='https://down-distance-rc3-staging-web.tdingman5.workers.dev';
const dir=(await readFile('/private/tmp/dd-rc3-private-location.txt','utf8')).trim();
const oauth=(await readFile(os.homedir()+'/Library/Preferences/.wrangler/config/default.toml','utf8')).match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
const traces=[],operations=[],tails=[];let session,app,stopReason,disablePromise,activeLabel,profilePromise;
function disable(){return disablePromise??=(async()=>{execFileSync(process.execPath,['/private/tmp/dd-cpu-hosted-exposure.mjs','disable'],{stdio:'inherit'});})();}
async function save(){await writeFile(out+'measured-authentication.json',JSON.stringify({source:'Actual Cloudflare live tail trace-v1 cpuTime milliseconds; numeric stages are elapsed only',operations,traces,stopReason:stopReason??null,legacyPasswordInvocations:traces.filter(t=>t.role==='password').length,thresholdMs:10},null,2)+'\n');}
async function captureProfile(){
 const startedAtUtc=new Date().toISOString();
 try{
  const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/workers/down-distance-rc3-staging-api/versions/latest/profile',{method:'POST',headers:{authorization:'Bearer '+oauth,'content-type':'application/json'},body:JSON.stringify({duration_ms:3000,profile_type:'cpu'}),signal:AbortSignal.timeout(15000)});
  const bytes=Buffer.from(await r.arrayBuffer());const result={startedAtUtc,finishedAtUtc:new Date().toISOString(),worker:'down-distance-rc3-staging-api',httpStatus:r.status,bytes:bytes.length,durationMs:3000,additionalTrafficGenerated:false};
  if(r.ok){await writeFile(out+'api-cpu.pprof.gz',bytes);result.profileSaved=true;}else{try{const j=JSON.parse(bytes.toString());result.errors=j.errors;}catch{result.error='Non-profile response';}}
  await writeFile(out+'profile-attempt.json',JSON.stringify(result,null,2)+'\n');
 }catch(e){await writeFile(out+'profile-attempt.json',JSON.stringify({startedAtUtc,errorType:e.name,profileSaved:false},null,2)+'\n');}
}
async function api(path,method,body){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method,headers:{authorization:'Bearer '+oauth,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const x=await r.json();if(!r.ok||!x.success)throw Error('Telemetry API '+r.status);return x.result;}
try{
 const security=JSON.parse(await readFile(out+'security.json','utf8'));if(!security.passed||Date.now()-Date.parse(security.checkedAtUtc)>600000)throw Error('Fresh staging security PASS required');
 for(const role of ['api','web','password']){
  const path='/workers/scripts/down-distance-rc3-staging-'+role+'/tails';const tail=await api(path,'POST',{}),ws=new WebSocket(tail.url,'trace-v1');tails.push({path,id:tail.id,ws});
  ws.on('message',data=>{try{
   const x=JSON.parse(data.toString());if(!x.event?.request)return;let path;try{path=new URL(x.event?.request?.url).pathname;}catch{}
   const metrics=[];for(const log of x.logs??[])for(const raw of log.message??[])try{const m=typeof raw==='string'?JSON.parse(raw):raw;if(m?.metric==='application_headers'){
    const safe={};for(const k of ['metric','method','route','routePattern','status','wallMs','d1Calls','statements','rowsRead','rowsWritten','r2Reads','r2Writes','cpuMs','cpuSource'])if(k in m)safe[k]=m[k];
    safe.authTimings=(m.authTimings??[]).map(t=>({stage:t.stage,elapsedMs:t.elapsedMs,ok:t.ok}));metrics.push(safe);
   }}catch{}
   const trace={role,path,operation:activeLabel??null,receivedAtUtc:new Date().toISOString(),eventTimestamp:x.eventTimestamp,outcome:x.outcome,status:x.event?.response?.status,cpuTimeMs:x.cpuTime,wallTimeMs:x.wallTime,metrics,exceptionNames:(x.exceptions??[]).map(e=>e.name)};traces.push(trace);
   if(typeof x.cpuTime==='number'&&x.cpuTime>10){stopReason??=`Workers Free CPU exceeded: ${role} ${path} ${x.cpuTime} ms > 10 ms`;void disable().catch(()=>{});}
   if(role==='password'){stopReason??='Unexpected legacy password Worker invocation';void disable().catch(()=>{});}
  }catch{}});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Tail connection timeout')),15000);ws.once('open',()=>{clearTimeout(timer);ws.send(JSON.stringify({debug:false}));resolve();});ws.once('error',reject);});
 }
 const config=JSON.parse(await readFile(dir+'/firebase-client.json','utf8'));app=initializeApp(config,'dd-cpu-hosted-'+Date.now());const auth=getAuth(app),email='firebase-cpu-'+Date.now()+'@example.invalid',password=randomBytes(24).toString('base64url');
 const started=Date.now();const registered=await createUserWithEmailAndPassword(auth,email,password);let idToken=await getIdToken(registered.user);
 await writeFile(dir+'/firebase-cpu-synthetic-a.json',JSON.stringify({email,password,idToken,refreshToken:registered.user.refreshToken}),{mode:0o600});
 operations.push({label:'Firebase SDK registration',provider:'Firebase Spark',status:'PASS',latencyMs:Date.now()-started,cloudflareCpuMs:null,cloudflareInvoked:false});await save();
 const stage=(await readFile(dir+'/staging-cookie.txt','utf8')).trim();
 async function call(label,path,expected,body){
  if(stopReason)throw Error(stopReason);activeLabel=label;const started=Date.now(),firstTrace=traces.length;
  if(label==='First registration-related web identity exchange')profilePromise=captureProfile();
  const response=await fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{cookie:stage+(session?'; '+session:''),origin:base,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  const text=await response.text();let json;try{json=JSON.parse(text);}catch{}
  const cookie=response.headers.get('set-cookie')?.split(';')[0];if(cookie?.startsWith('dd_session='))session=cookie;
  const operation={label,path,status:response.status,expected,pass:response.status===expected,startedAtUtc:new Date(started).toISOString(),latencyMs:Date.now()-started};operations.push(operation);
  // Wait for both service-binding hops. Never qualify a Web event without the API event.
  for(let i=0;i<150;i++){
   const rows=traces.slice(firstTrace).filter(t=>typeof t.cpuTimeMs==='number');
   if(stopReason||(['web','api'].every(role=>rows.some(t=>t.role===role))))break;
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  await new Promise(resolve=>setTimeout(resolve,750));
  operation.cpuSamples=traces.slice(firstTrace).map(t=>({role:t.role,path:t.path,cpuTimeMs:t.cpuTimeMs,outcome:t.outcome}));
  await save();console.log(label+': HTTP '+response.status+' actual CPU '+JSON.stringify(operation.cpuSamples));
  if(stopReason)throw Error(stopReason);
  if(!operation.pass||text.includes('1102'))throw Error('Hosted operation failed '+label+' '+response.status);
  if(!['web','api'].every(role=>operation.cpuSamples.some(s=>s.role===role&&typeof s.cpuTimeMs==='number')))throw Error('Missing actual CPU for a Worker hop');
  return {json,text,response};
 }
 const exchange=await call('First registration-related web identity exchange','/api/auth/firebase/session',200,{idToken});
 if(!exchange.json?.user?.id||exchange.json?.accessToken)throw Error('Incorrect web identity exchange contract');
 await writeFile(dir+'/firebase-cpu-app-session.json',JSON.stringify({session,userId:exchange.json.user.id}),{mode:0o600});
 for(let i=0;i<3;i++){const r=await call('Session lookup sample '+(i+1),'/api/auth/me',200);if(r.json?.user?.id!==exchange.json.user.id)throw Error('Session identity mismatch');}
 for(let i=0;i<3;i++){
  idToken=await getIdToken(registered.user,true);
  const result=await call('Refreshed web identity exchange sample '+(i+1),'/api/auth/firebase/session',200,{idToken});
  if(result.json?.user?.id!==exchange.json.user.id||result.json.accessToken)throw Error('Refresh identity mismatch');
 }
 for(const path of ['/','/front-office','/parlay-lab','/account']){
  const result=await call('Authenticated SSR '+path,path,200);if(!result.response.headers.get('content-type')?.includes('text/html'))throw Error('SSR not HTML');
 }
 await call('Invalid Firebase token rejection','/api/auth/firebase/session',401,{idToken:'invalid.synthetic.token'});
 await call('Global NFL feed smoke','/api/content/huddle?team=NFL',200);
 const oldSession=session;await call('Logout','/api/auth/logout',200,{});session=oldSession;
 await call('Revoked logged-out session denial','/api/auth/me',401);session=undefined;
}catch(error){stopReason??=error.message;console.log('Hosted validation stopped: '+stopReason);await disable();}
finally{
 await disable();
 await new Promise(resolve=>setTimeout(resolve,1000));
 for(const tail of tails){tail.ws.close();await api(tail.path+'/'+tail.id,'DELETE').catch(()=>{});}
 if(profilePromise)await profilePromise;
 if(app)await deleteApp(app);await save();
}
