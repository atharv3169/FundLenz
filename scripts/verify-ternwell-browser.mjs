import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.ATLAS_PLAYWRIGHT_MODULE||'playwright');
const url=process.env.TERNWELL_URL||new URL('/ternwell',process.env.ATLAS_URL||'http://127.0.0.1:8787').href;
const browser=await chromium.launch({executablePath:process.env.ATLAS_CHROMIUM||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];let steps=0;
async function check(name,fn){await fn();console.log('  ✓ '+name);steps++;}
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:940},acceptDownloads:true});
 const page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 const b=name=>page.getByRole('button',{name,exact:true}),nav=t=>page.getByRole('navigation',{name:'Ternwell tools'}).getByRole('button',{name:t,exact:true}).click();
 const download=async(label)=>{const [d]=await Promise.all([page.waitForEvent('download'),b(label).click()]);return await d.path();};
 const dlg=()=>page.getByRole('dialog');let formData,jsonFile;
 await page.goto(url);
 await check('Overview, chart keyboard inspection, third-place Ternwell and fourth-place FinCalc',async()=>{
   await page.getByRole('heading',{name:'Operating outlook'}).waitFor();
   const plot=page.getByRole('slider',{name:'Inspect fiscal year for Earnings into cash'});await plot.focus();await plot.press('End');assert.equal(await page.getByLabel('Inspect fiscal year',{exact:true}).inputValue(),'4');await plot.press('Home');
   await b('More projects').click();const links=await page.getByRole('navigation',{name:'FundLenz projects',exact:true}).getByRole('link').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));assert.deepEqual(links,['/','/dcf-atlas','/ternwell','/fincalc']);await page.keyboard.press('Escape');await page.getByRole('navigation',{name:'FundLenz projects',exact:true}).waitFor({state:'hidden'});
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
 await check('Edit and restore formulas on every statement; cross-statement edits stay in one case',async()=>{
   await nav('Statements');
   for(const [sheet,line] of [['Income statement','Net income'],['Balance sheet','Cash and equivalents'],['Cash flow','Cash from operations']]){
     await b(sheet).click();
     const cell=b('Edit '+line+', FY2026');
     const original=await cell.innerText();await cell.click();
     await dlg().getByRole('spinbutton',{name:/Statement value/}).fill('222.25');await b('Save value').click();
     assert.match(await cell.innerText(),/222[.]25/);
     if(sheet==='Income statement'){
       await b('Cash flow').click();assert.match(await b('Edit Net income, FY2026').innerText(),/222[.]25/);
       await page.getByRole('group',{name:'Active scenario'}).getByRole('button',{name:'Upside'}).click();
       assert.doesNotMatch(await b('Edit Net income, FY2026').innerText(),/222[.]25/);
       await page.getByRole('group',{name:'Active scenario'}).getByRole('button',{name:'Base'}).click();await b(sheet).click();
     }
     await cell.click();await b('Revert to formula').click();assert.equal(await cell.innerText(),original);
   }
 });
 await check('Financing schedules, scenario sensitivity and report downloads',async()=>{
   await nav('Schedules');await b('Debt & liquidity').click();await page.getByRole('table',{name:'Debt & liquidity roll-forward',exact:true}).waitFor();
   await nav('Scenarios');await page.getByRole('button',{name:/^Growth -6, margin -6,/}).click();assert.match(await page.locator('.tw-insight').innerText(),/growth -6 pp/);
   await nav('Checks & files');await page.getByText('All clear',{exact:true}).waitFor();

   const x=await download('Download Excel');assert((await fs.readFile(x)).subarray(0,2).equals(Buffer.from('PK')));
   const c=await download('Download inputs');formData=await fs.readFile(c,'utf8');assert.match(formData,/override,Base,2026,growth,-10/);
   const j=await download('Download JSON');jsonFile=JSON.parse(await fs.readFile(j,'utf8'));assert.equal(jsonFile.cases.Base.drivers.growth,13);
   const premium=await download('Download editable Excel');
   const evidence=JSON.parse(execFileSync('python3',['-c',`
import json, sys, zipfile, xml.etree.ElementTree as ET
with zipfile.ZipFile(sys.argv[1]) as z:
 sheets=[n for n in z.namelist() if __import__('re').fullmatch(r'xl/worksheets/sheet[0-9]+[.]xml',n)]
 charts=[n for n in z.namelist() if __import__('re').fullmatch(r'xl/charts/chart[0-9]+[.]xml',n)]
 docs=[ET.fromstring(z.read(n)) for n in sheets]
 print(json.dumps({'charts':len(charts),'formulas':sum(len(d.findall('.//{*}f')) for d in docs),'brand':any('fundlenz' in ''.join(d.itertext()).lower() for d in docs)}))
`,premium],{encoding:'utf8'}));
   assert(evidence.charts>=1&&evidence.formulas>20&&evidence.brand,'Missing native chart, editable formulas or workbook branding: '+JSON.stringify(evidence));
   await page.emulateMedia({media:'print'});
   const report=page.locator('.tw-case-report');assert(await report.locator('[data-report="comparison"]').first().isVisible());
   for(const scenario of ['Base','Upside','Downside'])for(const statement of ['income','balance','cash']){
     const section=report.locator('[data-case="'+scenario+'"][data-statement="'+statement+'"]').first();
     assert(await section.isVisible(),scenario+' '+statement+' missing from print report');
     assert.match(await section.innerText(),/FY\s*2026/i);
   }
   const out=path.join(process.env.RUNNER_TEMP||os.tmpdir(),'ternwell-print-review');
   await fs.mkdir(out,{recursive:true});
   const folios=await report.locator('.tr-paper').evaluateAll(sections=>sections.map(el=>({
     heading:el.querySelector('h2')?.textContent.trim(), statement:el.getAttribute('data-statement'),
     captions:[...el.querySelectorAll('figure')].filter(f=>f.querySelector('svg :is(path,rect,circle,polyline,line)')).map(f=>f.querySelector('figcaption')?.textContent.trim()).filter(Boolean)
   })));
   assert(folios[0]?.captions.length>=1,'Opening dashboard has no labelled data visualization');
   for(const f of folios.filter(x=>x.statement))assert(f.captions.length>=1,'Missing chart: '+f.heading);
   await fs.writeFile(path.join(out,'folios.json'),JSON.stringify(folios));await page.evaluate(()=>document.fonts.ready.then(()=>true));
   await page.pdf({path:path.join(out,'ternwell-report.pdf'),format:'A4',preferCSSPageSize:true,printBackground:true});
   execFileSync('python3',['scripts/verify-ternwell-pdf.py',out],{stdio:'inherit'});
   await page.emulateMedia({media:'screen'});
 });
 await check('Download current statement CSV, edit one line, preview, apply and undo',async()=>{
   const path=await download('Export statements'),source=await fs.readFile(path,'utf8');
   const edited=source.replace(/^(Income statement,Revenue,)[^,\r\n]+/m,(_,prefix)=>prefix+'512.75');
   assert.notEqual(edited,source,'Current statement export must include an editable Revenue row');
   await b('Upload statement CSV').click();await page.getByLabel('Upload Ternwell file').setInputFiles({name:'edited-statements.csv',mimeType:'text/csv',buffer:Buffer.from(edited)});
   await b('Apply import').click();await nav('Statements');await b('Income statement').click();
   assert.match(await b('Edit Revenue, FY2026').innerText(),/512[.]75/);
   await page.emulateMedia({media:'print'});
   const income=page.locator('.tw-case-report [data-case="Base"][data-statement="income"]').first();
   assert.match(await income.innerText(),/512[.]75/,'Changed revenue missing from printed Base statement');
   await page.emulateMedia({media:'screen'});await nav('Checks & files');
   const workbookPath=await download('Download editable Excel');
   const baseRevenue=execFileSync('python3',['-c',`
import sys, posixpath, zipfile, xml.etree.ElementTree as ET
with zipfile.ZipFile(sys.argv[1]) as z:
 wb=ET.fromstring(z.read('xl/workbook.xml')); rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
 sheet=next(el for el in wb.findall('.//{*}sheet') if el.get('name')=='Base Statements')
 rid=next(v for k,v in sheet.attrib.items() if k.endswith('}id'))
 target=next(el.get('Target') for el in rels if el.get('Id')==rid)
 xml=ET.fromstring(z.read(posixpath.normpath(posixpath.join('xl',target)).lstrip('/')))
 for row in xml.findall('.//{*}row'):
  cells=row.findall('{*}c')
  if cells and ''.join(cells[0].itertext())=='Revenue':
   print(cells[1].find('{*}v').text);break
`,workbookPath],{encoding:'utf8'});assert.equal(Number(baseRevenue),512.75,'Workbook must export the edited Base revenue');
   await nav('Statements');await b('Undo change').click();assert.match(await b('Edit Revenue, FY2026').innerText(),/328[.]5/);
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
