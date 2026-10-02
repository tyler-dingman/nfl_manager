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
  await page.getByLabel('Search teams').waitFor(); await shot('team');
  await page.getByText('View All Teams',{exact:true}).click();
  if(await page.getByRole('button',{name:/^(Arizona Cardinals|Chicago Bears|Kansas City Chiefs)$/}).count()!==3)throw Error('All teams missing');
  await page.getByLabel('Search teams').fill('Bears');
  await page.getByRole('button',{name:'Chicago Bears',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByText('ALL THINGS BEARS.',{exact:false}).waitFor(); await shot('value');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByText('STAY IN THE KNOW',{exact:true}).waitFor(); await shot('delivery');
  if(name==='large') {
    await page.getByRole('button',{name:'Maybe later',exact:true}).click();
    await page.getByText('PREVIEW · SAMPLE CONTENT',{exact:true}).waitFor();
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-testid=onboarding-home-transition]')).opacity) === 1);
    await shot('home-skipped');
    await context.close();
    continue;
  }
  await page.getByRole('checkbox').filter({hasText:'Push Notifications'}).click();
  await page.getByRole('alert').waitFor();
  await page.getByRole('checkbox').filter({hasText:'Email Updates'}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByText('Pick a time for your daily Three & Out.',{exact:true}).waitFor();
  await page.getByRole('radio').filter({hasText:'Custom'}).click();
  await page.getByLabel('Custom time HH:MM').fill('09:15'); await shot('time');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByText('YOU’RE ALL SET!',{exact:true}).waitFor(); await shot('confirmation');
  await page.getByRole('button',{name:'Previous onboarding step'}).click();
  if(await page.getByLabel('Custom time HH:MM').inputValue()!=='09:15')throw Error('Lost time');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Go to My Team',exact:true}).click();
  await page.getByText('PREVIEW · SAMPLE CONTENT',{exact:true}).waitFor();
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-testid=onboarding-home-transition]')).opacity) === 1);
  await shot('home');
  await context.close();
 }
 await browser.close(); console.log('PASS: test login, team search/selection, value, push unavailable recovery, email preference, custom time, back, completion and Home at 360/430 widths.');
})().catch(e=>{console.error(e);process.exit(1)});
