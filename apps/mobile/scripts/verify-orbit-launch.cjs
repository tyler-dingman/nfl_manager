const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../../../node_modules/playwright');
const config=path.resolve(__dirname,'../lib/launch/config.ts');
const original=fs.readFileSync(config,'utf8');
(async()=>{
 let browser;
 try {
  fs.writeFileSync(config,original.replace("= 'field'","= 'orbit'"));
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:393,height:852}});
  await page.route('**/api/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
  await page.goto('http://localhost:8090/sign-in');
  await page.getByTestId('brand-intro-0').waitFor();
  await page.getByTestId('brand-intro-1').waitFor();
  await page.getByTestId('brand-intro-2').waitFor();
  await page.getByRole('button',{name:'Log In',exact:true}).waitFor();
  console.log('PASS: Orbit retains logo, circles, message and completion. Restoring FIELD.');
 } finally {fs.writeFileSync(config,original);if(browser)await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
