const { chromium } = require('../../../node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, '../../../reports/mobile-screen-previews/onboarding');
fs.mkdirSync(output, {recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 for(const [name,width,height] of [['small',360,800],['large',430,932]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:name==='small'?'no-preference':'reduce'});
  await context.route('**/api/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{}'}));
  const page=await context.newPage();
  await page.goto('http://localhost:8090/sign-in');
  await page.getByRole('button',{name:'Skip introduction'}).click();
  await page.getByRole('button',{name:'Log In',exact:true}).click();
  await page.getByLabel('Email',{exact:true}).fill('test@gmail.com');
  await page.getByLabel('Password',{exact:true}).fill('test');
  await page.getByRole('button',{name:'Log In',exact:true}).click();
  const shot=async(label)=>{await page.screenshot({path:path.join(output,`${name}-${label}.png`),fullPage:true});};
  await page.getByRole('button',{name:'Philadelphia Eagles',exact:true}).waitFor();
  await page.getByRole('button',{name:name==='small'?'Philadelphia Eagles':'Chicago Bears',exact:true}).click();
  await page.getByText(name==='small'?'ALL THINGS EAGLES.':'ALL THINGS BEARS.',{exact:true}).waitFor();
  await page.waitForTimeout(500); await shot('value-redesign');
  await context.close();
 }
 await browser.close(); console.log('PASS: Eagles/Bears value screens at 360/430 widths.');
})().catch(e=>{console.error(e);process.exit(1)});
