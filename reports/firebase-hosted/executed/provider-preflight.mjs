import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import * as verification from '/private/tmp/down-distance-rc3/src/server/auth/firebase-token.ts';
const dir=(await readFile('/private/tmp/dd-rc3-private-location.txt','utf8')).trim();
const config=JSON.parse(await readFile(dir+'/firebase-client.json','utf8'));
const email='firebase-rc3-'+Date.now()+'@example.invalid',password=randomBytes(24).toString('base64url');
async function post(operation,body){
 const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:'+operation+'?key='+encodeURIComponent(config.apiKey),{method:'POST',redirect:'manual',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const data=await response.json();if(!response.ok)throw Error(operation+': '+response.status+' '+(data.error?.message??'provider error'));return data;
}
const result={checkedAtUtc:new Date().toISOString(),projectId:config.projectId,realProvider:true,stagingWorkerInvoked:false};
try{
 const signup=await post('signUp',{email,password,returnSecureToken:true});
 await writeFile(dir+'/firebase-synthetic-a.json',JSON.stringify({email,password,...signup}),{mode:0o600});
 const lookup=await post('lookup',{idToken:signup.idToken});
 const api=verification.default??verification;
 const identity=await api.verifyFirebaseSignature(signup.idToken,config.projectId);
 api.assertFirebaseAccount(identity,lookup.users?.[0]);
 Object.assign(result,{registration:'PASS',signature:'PASS',issuerAudienceExpirationUid:'PASS',revocationMetadata:'PASS',lookupFieldNames:Object.keys(lookup.users?.[0]??{}),userId:identity.uid});
}catch(error){Object.assign(result,{passed:false,blocker:error.message});}
await writeFile('/private/tmp/down-distance-rc3/reports/firebase-hosted/provider-preflight.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
