const {chromium}=require('../../../node_modules/playwright');
const fs=require('node:fs'),path=require('node:path');
const width=Number(process.env.LAUNCH_PREVIEW_WIDTH ?? 393);
const output=path.resolve(__dirname,'../../../reports/mobile-screen-previews/field-launch',width===393?'.':`width-${width}`);fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width,height:852},recordVideo:{dir:output,size:{width,height:852}}});
 await ctx.route('**/api/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 const page=await ctx.newPage();page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
 await page.goto('http://localhost:8090/sign-in');
 await page.getByTestId('field-launch-full').waitFor();
 await page.evaluate(()=>{window.launchHashNodes=Array.from(document.querySelectorAll('[data-testid^="field-badge-hash-"] path'));window.launchHashY=window.launchHashNodes.map(node=>{const r=node.closest('[data-testid]').getBoundingClientRect();return r.y+r.height/2;});});
 const start=Date.now();
 for(const [t,name] of [[10,'own-10'],[183,'own-20'],[364,'own-30'],[542,'own-40'],[718,'midfield-50'],[891,'opponent-40'],[1063,'opponent-30'],[1232,'opponent-20'],[1400,'10-center'],[1470,'line-retract'],[1540,'compress'],[1605,'border-start'],[1640,'down'],[1670,'ampersand'],[1720,'distance'],[1840,'badge']]){
  await page.waitForTimeout(Math.max(0,(t <= 1400 ? t * 2800 / 1400 : 2800 + (t - 1400) * 2)-(Date.now()-start)));
  await page.screenshot({path:path.join(output,name+'.png')});
  if(name==='badge') {
   const result=await page.evaluate(()=>{const nodes=Array.from(document.querySelectorAll('[data-testid^="field-badge-hash-"] path'));return {same:nodes.length===20&&nodes.every((node,i)=>node===window.launchHashNodes[i]),baseline:nodes.every((node,i)=>Math.abs((()=>{const r=node.closest('[data-testid]').getBoundingClientRect();return r.y+r.height/2;})()-window.launchHashY[i])<0.1),colors:nodes.map(node=>getComputedStyle(node).fill)};});
   if(!result.same||!result.baseline||result.colors.some(color=>color!=='rgb(255, 61, 56)'))throw Error('Field hash identity/color mismatch: '+JSON.stringify(result));
  }
 }
 await page.getByRole('button',{name:'Log In',exact:true}).waitFor();
 await page.reload();await page.getByTestId('field-launch-full').waitFor(); await page.getByTestId('field-yard-0').waitFor();await page.getByRole('button',{name:'Log In',exact:true}).waitFor();
 const recording=await page.video().path();
 await ctx.close();
 fs.renameSync(recording,path.join(output,'field-launch.webm'));
 const reduced=await browser.newContext({viewport:{width:360,height:800},reducedMotion:'reduce'});await reduced.route('**/api/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));const p=await reduced.newPage();await p.goto('http://localhost:8090/sign-in');await p.getByRole('button',{name:'Log In',exact:true}).waitFor();await reduced.close();
 await browser.close();console.log('PASS full, browser replay numbered sequence and reduced motion startup; keyframes and recording captured.');
})().catch(e=>{console.error(e);process.exit(1)});
