import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.ATLAS_PLAYWRIGHT_MODULE||'playwright');
const url=process.env.TERNWELL_URL||new URL('/ternwell',process.env.ATLAS_URL||'http://127.0.0.1:8787').href;
const browser=await chromium.launch({executablePath:process.env.ATLAS_CHROMIUM||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];let steps=0;
async function check(name,fn){await fn();console.log('  ✓ '+name);steps++;}
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:940},acceptDownloads:true});
 const page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 const b=name=>page.getByRole('button',{name,exact:true}),nav=t=>page.getByRole('navigation',{name:'Ternwell tools'}).getByRole('button',{name:t,exact:true}).click();
 const dlg=()=>page.getByRole('dialog');let formData,jsonFile;
 await page.goto(url);
 await check('Overview, chart keyboard inspection, fourth project and preserved Atlas/FinCalc order',async()=>{
   await page.getByRole('heading',{name:'Operating outlook'}).waitFor();
   const plot=page.getByRole('slider',{name:'Inspect fiscal year for Earnings into cash'});await plot.focus();await plot.press('End');assert.equal(await page.getByLabel('Inspect fiscal year',{exact:true}).inputValue(),'4');await plot.press('Home');
   await b('More projects').click();const links=await page.getByRole('navigation',{name:'FundLenz projects',exact:true}).getByRole('link').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));assert.deepEqual(links,['/','/dcf-atlas','/fincalc','/ternwell']);await page.keyboard.press('Escape');await page.getByRole('navigation',{name:'FundLenz projects',exact:true}).waitFor({state:'hidden'});
 });
 await check('Changing a driver, annual override, case isolation, and undo/redo',async()=>{
   await nav('Drivers');const val=page.getByRole('spinbutton',{name:/^Revenue growth/});await val.fill('13');await val.press('Enter');await b('Upside').click();assert.equal(await val.inputValue(),'12');await b('Downside').click();assert.equal(await val.inputValue(),'-3');await b('Base').click();assert.equal(await val.inputValue(),'13');
   await b('Annual overrides').click();await val.fill('-10');await val.press('Enter');await b('Undo change').click();assert.equal(await val.inputValue(),'');await b('Redo change').click();assert.equal(await val.inputValue(),'-10');
   await nav('Statements');await page.getByLabel('Find a line item').fill('Revenue');const row=page.getByRole('table',{name:'Income statement',exact:true}).getByRole('row').nth(1);assert.equal(await row.getByRole('cell').first().innerText(),'328.5');await row.getByRole('button',{name:'Revenue',exact:true}).click();await dlg().getByText(/Prior-year revenue/).waitFor();await page.keyboard.press('Escape');
   await page.getByLabel('Find a line item').fill('');
   const amount=label=>page.locator('.tw-view').getByRole('table').getByRole('row').filter({has:page.getByRole('button',{name:label,exact:true})}).getByRole('cell').first().innerText();
   const ni=await amount('Net income');await page.getByRole('checkbox',{name:'Common size'}).check();assert.equal(await amount('Revenue'),'100%');await page.getByRole('checkbox',{name:'Common size'}).uncheck();
   await b('Balance sheet').click();const cash=await amount('Cash and equivalents');assert.equal(await amount('Balance difference'),'0');
   await b('Cash flow').click();assert.equal(await amount('Net income'),ni);assert.equal(await amount('Closing cash'),cash);
 });
 await check('Financing schedules, scenario sensitivity and report downloads',async()=>{
   await nav('Schedules');await b('Debt & liquidity').click();await page.getByRole('table',{name:'Debt & liquidity roll-forward',exact:true}).waitFor();
   await nav('Scenarios');await page.getByRole('button',{name:/^Growth -6, margin -6,/}).click();assert.match(await page.locator('.tw-insight').innerText(),/growth -6 pp/);
   await nav('Checks & files');await page.getByText('All clear',{exact:true}).waitFor();
   const download=async(label)=>{const d=page.waitForEvent('download');await b(label).click();return await d;};
   const x=await download('Download Excel');assert((await fs.readFile(await x.path())).subarray(0,2).equals(Buffer.from('PK')));
   const c=await download('Download inputs');formData=await fs.readFile(await c.path(),'utf8');assert.match(formData,/override,Base,2026,growth,-10/);
   const j=await download('Download JSON');jsonFile=JSON.parse(await fs.readFile(await j.path(),'utf8'));assert.equal(jsonFile.cases.Base.drivers.growth,13);
   await page.emulateMedia({media:'print'});for(const name of ['Income statement','Balance sheet','Cash-flow statement'])assert(await page.getByRole('heading',{name,exact:true}).isVisible(),name+' missing from print report');await page.emulateMedia({media:'screen'});
 });
 await check('Import rejects invalid inputs; preview, cancel, apply, device save and restore',async()=>{
   await b('Import').click();const upload=()=>page.getByLabel('Upload Ternwell file');await upload().setInputFiles({name:'wrong.csv',mimeType:'text/csv',buffer:Buffer.from('revenue,year\n3,2025')});await dlg().getByRole('alert').waitFor();assert(await b('Apply import').isDisabled());
   const fixture={name:'own.csv',mimeType:'text/csv',buffer:Buffer.from(formData.replace('Alderwick Industrial','Northmill Fixture'))};
   await upload().setInputFiles(fixture);await dlg().getByRole('heading',{name:'Northmill Fixture'}).waitFor();await b('Cancel').click();assert.match(await page.locator('.tw-identity').innerText(),/Alderwick/);
   await b('Import').click();await upload().setInputFiles(fixture);await b('Apply import').click();await page.getByRole('heading',{name:'Operating outlook'}).waitFor();assert.match(await page.locator('.tw-identity').innerText(),/Northmill/);
   await b('Saved versions').click();await b('Save current version').click();await b('Close dialog').click();await page.reload();await page.locator('.tw-identity').getByText('Northmill Fixture',{exact:true}).waitFor();await b('New model').click();await dlg().getByLabel('Company name').fill('Empty local model');await b('Create model').click();await b('Saved versions').click();await dlg().getByRole('button',{name:'Restore'}).click();assert.match(await page.locator('.tw-identity').innerText(),/Northmill/);
 });
 await check('Unbalanced opening is reported and never silently repaired',async()=>{
   await b('Model setup').click();await dlg().getByLabel('Cash and equivalents').fill('35');await b('Apply changes').click();await b('See checks →').click();await page.getByText('Review needed',{exact:true}).waitFor();
   const row=page.getByRole('table',{name:'Model reconciliation checks'}).getByRole('row').filter({has:page.getByRole('button',{name:'Balance sheet difference',exact:true})});assert.equal(await row.getByRole('cell').first().innerText(),'3');
 });
 await check('320px and 390px layout, reduced motion, mobile tabs, tables and dialogs',async()=>{
   const mob=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const pg=await mob.newPage();pg.on('pageerror',e=>errors.push(e.message));await pg.goto(url);
   for(const width of [390,320]){
     await pg.setViewportSize({width,height:844});
     for(const tab of ['Overview','Statements','Drivers','Schedules','Scenarios','Checks & files']){await pg.getByRole('navigation',{name:'Ternwell tools'}).getByRole('button',{name:tab,exact:true}).click();assert(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflows at '+width+' in '+tab);}
     await pg.getByRole('button',{name:'Model setup',exact:true}).click();await pg.getByRole('dialog').getByLabel('Company name').waitFor();await pg.getByRole('button',{name:'Cancel',exact:true}).click();
   }await mob.close();
 });assert.deepEqual(errors,[]);console.log('Ternwell: '+steps+' end-to-end browser journeys passed.');
}finally{await browser.close();}
