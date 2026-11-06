// Optional integration suite: run with the FundLenz production Worker served locally.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
const { chromium } = await import(
  process.env.ATLAS_PLAYWRIGHT_MODULE || 'playwright'
);
const url = process.env.ATLAS_URL || 'http://127.0.0.1:8787/dcf-atlas';
const out =
  process.env.ATLAS_QA_DIR ||
  (await fs.mkdtemp(path.join(tmpdir(), 'dcf-atlas-qa-')));
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.ATLAS_CHROMIUM || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const errors = [];
let passed = 0;
async function step(name, fn) {
  await fn();
  console.log('  ✓ ' + name);
  passed++;
}
try {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 980 },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => errors.push(e.message));
  const nav = async (name) => {
    await page
      .getByRole('navigation', { name: 'Atlas tools' })
      .getByRole('button', { name, exact: true })
      .click();
    await page.locator('.a-workhead h2').filter({ hasText: name }).waitFor();
  };
  const btn = (label) => page.getByRole('button', { name: label, exact: true });
  async function download(re, pathTo) {
    const promise = page.waitForEvent('download');
    await page.getByRole('button', { name: re }).click();
    const d = await promise;
    assert.equal(await d.failure(), null);
    const file = path.join(out, pathTo || d.suggestedFilename());
    await d.saveAs(file);
    return file;
  }
  await step(
    'Four-row overview, linked chart and table insights, hover, keyboard and live drivers',
    async () => {
      const res = await page.goto(url);
      assert.equal(res.status(), 200);
      await page.getByRole('heading', { name: 'Cash-flow outlook' }).waitFor();
      await page
        .locator('.a-kpi strong')
        .filter({ hasText: '$38.30' })
        .waitFor();
      await page.screenshot({
        path: path.join(out, 'desktop.png'),
        animations: 'disabled',
      });
      const grid = page.locator('.ao-grid'),
        ledger = grid.getByRole('region', { name: 'Overview annual forecast' });
      const chart = (id) => grid.locator('[data-chart-inspector="' + id + '"]');
      const tip = grid.getByRole('tooltip');
      assert.equal(await page.getByLabel('Chart measure').count(), 0);
      assert.equal(await grid.locator('.ao-trace,.ao-bridge').count(), 4);
      const geometry = await grid.evaluate((el) => ({
        cols: getComputedStyle(el).gridTemplateColumns.split(' ').length,
        rows: new Set(
          Array.from(el.children, (e) =>
            Math.round(e.getBoundingClientRect().top),
          ),
        ).size,
      }));
      assert.deepEqual(geometry, { cols: 4, rows: 4 });
      await chart('cash').locator('[data-point="0:2"]').hover();
      await tip.filter({ hasText: 'Free cash flow · FY2028' }).waitFor();
      const selected = ledger
        .getByRole('row')
        .filter({ has: page.getByRole('button', { name: 'Inspect FY2028' }) });
      assert.equal(
        await selected.getByRole('button').getAttribute('aria-pressed'),
        'true',
      );
      assert(
        (await tip.innerText()).includes(
          'USD ' + (await selected.locator('td').nth(4).innerText()) + 'm',
        ),
      );
      assert.match(await tip.innerText(), /converts to free cash flow/);
      await page
        .getByRole('region', { name: 'Cash-flow bridge figures for FY2028' })
        .waitFor();
      const ops = chart('operations');
      await ops.locator('[data-point="1:4"]').hover();
      await tip.filter({ hasText: 'Operating profit · FY2030' }).waitFor();
      assert.equal(await tip.count(), 1);
      const bounds = await ops.boundingBox(),
        pop = await tip.boundingBox();
      assert(
        pop.x >= bounds.x - 1 &&
          pop.x + pop.width <= bounds.x + bounds.width + 1,
        'edge insight stays inside the chart width',
      );
      await page.locator('.a-workhead h2').hover();
      await tip.waitFor({ state: 'hidden' });
      const rates = chart('rates');
      await rates.focus();
      await rates.press('End');
      await rates.press('ArrowDown');
      await tip
        .filter({ hasText: 'EBIT margin · FY2030' })
        .filter({ hasText: '22%' })
        .waitFor();
      await rates.press('ArrowLeft');
      await tip.filter({ hasText: 'FY2029' }).waitFor();
      await rates.press('Escape');
      await tip.waitFor({ state: 'hidden' });
      await chart('bridge').locator('[data-bar="2"]').hover();
      await tip
        .filter({ hasText: 'Capital expenditure · FY2029' })
        .filter({ hasText: 'deducted' })
        .waitFor();
      await chart('dependence').focus();
      await chart('dependence').press('End');
      await tip.filter({ hasText: 'Explicit forecast' }).waitFor();
      await ledger.getByRole('button', { name: 'Inspect FY2026' }).click();
      await tip.waitFor({ state: 'hidden' });
      await btn('Next overview year').click();
      await page
        .getByRole('heading', { name: 'Cash bridge · FY2027' })
        .waitFor();
      const cashCard = grid.locator('.ao-trace').filter({
        has: page.getByRole('heading', { name: 'Cash-flow outlook' }),
      });
      await cashCard
        .getByRole('button', { name: 'Free cash flow', exact: true })
        .click();
      assert.equal(
        await chart('cash').locator('[data-point^="0:"]').count(),
        0,
      );
      await chart('cash').locator('[data-point="1:0"]').hover();
      await tip.filter({ hasText: 'Present value · FY2026' }).waitFor();
      await cashCard
        .getByRole('button', { name: 'Free cash flow', exact: true })
        .click();
      const input = page.getByRole('slider', {
        name: 'First-year growth',
        exact: true,
      });
      assert.equal(
        await page
          .getByRole('slider', {
            name: 'Capital expenditure / revenue',
            exact: true,
          })
          .inputValue(),
        '5.4',
      );
      await input.focus();
      await input.press('End');
      assert.notEqual(
        await page.locator('.a-kpi strong').first().innerText(),
        '$38.30',
      );
      await btn('Undo change').click();
      await page
        .locator('.a-kpi strong')
        .filter({ hasText: '$38.30' })
        .waitFor();
    },
  );
  await step(
    'Overview starts a model, reviews complete worksheets and normalizes personal historical CSVs',
    async () => {
      const fresh = await browser.newContext({
        viewport: { width: 1440, height: 980 },
        acceptDownloads: true,
      });
      fresh.setDefaultTimeout(10000);
      fresh.setDefaultNavigationTimeout(30000);
      try {
        const p = await fresh.newPage();
        p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(url);
        const action = (name) => p.getByRole('button', { name, exact: true });
        const identity = p.locator('.a-identity');
        const dialog = p.getByRole('dialog');
        const file = (name, text) => ({
          name,
          mimeType: 'text/csv',
          buffer: Buffer.from(text),
        });
        const openUpload = async () => {
          await action('Upload CSV').click();
          await p.getByRole('dialog', { name: 'Upload CSV' }).waitFor();
        };
        await action('Add model').click();
        await dialog.getByLabel('Company name').fill('Manual case');
        await dialog.getByLabel('Currency').selectOption('GBP');
        await action('Create model').click();
        await p
          .getByRole('heading', { name: 'Assumptions', exact: true })
          .waitFor();
        assert.match(await identity.innerText(), /Manual case/);
        assert.match(await identity.innerText(), /GBP/);
        await p
          .getByRole('navigation', { name: 'Atlas tools' })
          .getByRole('button', { name: 'Overview', exact: true })
          .click();
        await p.getByText('Model needs inputs', { exact: true }).waitFor();
        await openUpload();
        const input = p.getByLabel('Upload model CSV');
        await input.setInputFiles(file('bad.csv', 'x,y\n1,2'));
        await dialog.getByRole('alert').waitFor();
        assert.match(await identity.innerText(), /Manual case/);
        const download = p.waitForEvent('download');
        await dialog
          .getByRole('button', { name: /Worked CSV example/ })
          .click();
        const example = await download;
        const exported = await fs.readFile(await example.path(), 'utf8');
        const actual = file(
          'case.csv',
          exported
            .replace(
              'model,name,,Meridian Instruments',
              'model,name,,User worksheet',
            )
            .replace('input,revenue,,1240', 'input,revenue,,2480'),
        );
        await input.setInputFiles(actual);
        await dialog
          .getByText('The imported FCFF model calculates successfully.')
          .waitFor();
        await action('Cancel').click();
        assert.match(await identity.innerText(), /Manual case/);
        await openUpload();
        await input.setInputFiles(actual);
        await action('Apply import').click();
        await p
          .getByRole('heading', { name: 'Overview', exact: true })
          .waitFor();
        assert.match(await identity.innerText(), /User worksheet/);
        const firstYear = p
          .getByRole('region', { name: 'Overview annual forecast' })
          .getByRole('row')
          .nth(1);
        assert.equal(
          await firstYear.locator('td').first().innerText(),
          '2,777.6',
        );
        await openUpload();
        await input.setInputFiles(
          file(
            'my-company.csv',
            'FY,Sales,Operating income,Capex\n2024,12,-1,\n2025,16,3,2',
          ),
        );
        await dialog.getByLabel('Company name').fill('My INR company');
        assert(await action('Apply import').isDisabled());
        await dialog.getByLabel('Reporting currency').selectOption('INR');
        await dialog.getByLabel('Amounts in your CSV').selectOption('crores');
        await dialog.getByText(/Starting revenue: INR 160 million/).waitFor();
        await action('Apply import').click();
        await p
          .getByRole('heading', { name: 'Assumptions', exact: true })
          .waitFor();
        assert.match(await identity.innerText(), /My INR company/);
        assert.equal(
          await p.getByLabel('Starting revenue', { exact: true }).inputValue(),
          '160',
        );
        assert.equal(
          await p.getByLabel('First-year growth', { exact: true }).inputValue(),
          '',
        );
        await action('Undo change').click();
        assert.match(await identity.innerText(), /User worksheet/);
      } finally {
        await fresh.close();
      }
    },
  );
  await step(
    'keyboard command search, annual override, history, undo and redo',
    async () => {
      await page.keyboard.press('Control+k');
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('searchbox').fill('forecast studio');
      await dlg.getByRole('button', { name: /Forecast studio/i }).click();
      const first = page.getByLabel('Year 1 growth override');
      await first.fill('18');
      await btn('Undo change').click();
      assert.equal(await first.inputValue(), '');
      await btn('Redo change').click();
      assert.equal(await first.inputValue(), '18');
      await btn('Show edit history').click();
      await page.getByRole('dialog', { name: 'Worksheet history' }).waitFor();
      await page.keyboard.press('Escape');
      await btn('Undo change').click();
    },
  );
  await step(
    'all three valuation surfaces, adopt and roll back a cell, CSV download',
    async () => {
      await nav('Sensitivity');
      await page.getByLabel(/^Grid/).selectOption('7');
      assert.equal(await page.locator('.a-heat tbody button').count(), 49);
      for (const axis of [
        'Growth × margin',
        'Capex × discount',
        'Capital × perpetuity',
      ]) {
        await page.getByLabel(/^Axes/).selectOption(axis);
        const cell = page
          .locator('.a-heat tbody button:not([disabled])')
          .nth(2);
        await cell.click();
        assert.equal(await btn('Adopt inputs').isEnabled(), true);
      }
      await btn('Adopt inputs').click();
      await btn('Undo change').click();
      await download(/Grid CSV/, 'surface.csv');
      await page.screenshot({
        path: path.join(out, 'sensitivity.png'),
        animations: 'disabled',
      });
    },
  );
  await step(
    'scenario weights, invalid-weight guard and named case persistence',
    async () => {
      await nav('Scenarios');
      await page.getByLabel('Downside weight (%)', { exact: true }).fill('80');
      await page.getByText('Weights exceed 100%').waitFor();
      await page.getByLabel('Downside weight (%)', { exact: true }).fill('25');
      await page.getByLabel('Snapshot label').fill('Browser baseline');
      await page
        .locator('.a-view')
        .getByRole('button', { name: 'Save case', exact: true })
        .click();
      await nav('Research library');
      await page.getByLabel('Search models').fill('Browser baseline');
      await btn('Open Browser baseline').waitFor();
    },
  );
  await step(
    'reverse DCF, off-thread seeded simulation, investor IRR and sample export',
    async () => {
      await nav('Risk & reverse DCF');
      await page.getByLabel('Solve for').selectOption('wacc');
      await page.getByLabel('Target price', { exact: true }).fill('38.30');
      assert.match(
        await page.locator('.a-keyline').first().innerText(),
        /8\.82%/,
      );
      await page.getByLabel('Number of draws', { exact: true }).fill('5000');
      await btn('Run simulation').click();
      await page.getByText(/valid draws ·/).waitFor({ timeout: 20000 });
      await download(/Export samples/, 'simulation.csv');
      const lines = (
        await fs.readFile(path.join(out, 'simulation.csv'), 'utf8')
      )
        .trim()
        .split('\n');
      assert(lines.length > 4900);
      await page.getByLabel('Expected exit price', { exact: true }).fill('45');
      await page
        .locator('.a-keyline')
        .filter({ hasText: 'Annualized investor IRR' })
        .filter({ hasText: '8.45%' })
        .waitFor();
    },
  );
  await step(
    'peer cross-check and independently saved equity-method assumptions',
    async () => {
      await nav('Equity methods');
      await btn('Residual income').click();
      await page
        .getByLabel('Opening book value / share', { exact: true })
        .fill('12');
      await page.getByLabel('Peer 1 ev', { exact: true }).fill('240');
      await page.getByLabel('Peer 1 ebitda', { exact: true }).fill('20');
      await page.getByText(/1 eligible · median 12×/).waitFor();
      await download(/Export peers/, 'peers.csv');
      await nav('Overview');
      await nav('Equity methods');
      assert.equal(
        await page
          .getByLabel('Opening book value / share', { exact: true })
          .inputValue(),
        '12',
      );
      assert.equal(
        await page.getByLabel('Peer 1 ev', { exact: true }).inputValue(),
        '240',
      );
    },
  );
  let imported;
  await step(
    'working templates, auditable workbook, printable/offline reports, schema validation and import review',
    async () => {
      await nav('Reports & files');
      await page
        .getByLabel('Research notes')
        .fill('Browser-tested memorandum: source and thesis.');
      await download(/Worked CSV example/, 'template.csv');
      await download(/Blank input template/, 'blank.csv');
      await download(/Editable Excel workbook/, 'worksheet.xlsx');
      await download(/Offline HTML report/, 'memorandum.html');
      await download(/Model snapshot/, 'model.json');
      await download(/Input worksheet/, 'inputs.csv');
      await download(/Forecast CSV/, 'forecast.csv');
      const html = await fs.readFile(path.join(out, 'memorandum.html'), 'utf8');
      assert(
        html.includes('Browser-tested memorandum') &&
          html.includes('Independent equity worksheets'),
      );
      await page.pdf({
        path: path.join(out, 'memorandum.pdf'),
        format: 'A4',
        printBackground: true,
      });
      const inp = page.getByLabel('Import model file', { exact: true });
      await inp.setInputFiles({
        name: 'bad.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('foo,bar\n1,2'),
      });
      await page.getByRole('alert').waitFor();
      assert.equal(await page.getByRole('dialog').count(), 0);
      imported = JSON.parse(
        await fs.readFile(path.join(out, 'model.json'), 'utf8'),
      );
      imported.model.name = 'Imported operations case';
      await inp.setInputFiles({
        name: 'review.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(imported)),
      });
      await page
        .getByRole('dialog', { name: 'Review import before applying' })
        .waitFor();
      assert.doesNotMatch(
        await page.locator('.a-identity').innerText(),
        /Imported operations/,
      );
      await btn('Apply import').click();
      await page
        .locator('.a-identity')
        .filter({ hasText: 'Imported operations case' })
        .waitFor();
      await page.reload();
      await page
        .locator('.a-identity')
        .filter({ hasText: 'Imported operations case' })
        .waitFor();
      await nav('Equity methods');
      assert.equal(
        await page.getByLabel('Peer 1 ev', { exact: true }).inputValue(),
        '240',
      );
    },
  );
  await step(
    'model screening, SEC financial statements and live FundLenz reference identity with empty financials',
    async () => {
      await nav('Research library');
      await btn('Model screener').click();
      await page
        .getByLabel('Minimum model gap (%)', { exact: true })
        .fill('99990');
      await page.getByText(/No completed valuations match/).waitFor();
      await page.getByLabel('Minimum model gap (%)', { exact: true }).fill('');
      await download(/Export \d+ results/, 'screen.csv');
      await btn('Model library').last().click();
      await page.getByLabel('Filter model origin').selectOption('Filing');
      await page.getByLabel('Search models').fill('Microsoft');
      await page
        .getByRole('button', { name: /Open Microsoft Corporation/ })
        .click();
      await page.getByLabel('Starting revenue', { exact: true }).waitFor();
      assert.equal(
        await page.getByLabel('Starting revenue', { exact: true }).inputValue(),
        '281724',
      );
      await nav('Equity methods');
      assert.equal(
        await page
          .getByLabel('Starting dividend / share', { exact: true })
          .inputValue(),
        '',
      );
      await nav('Research library');
      await btn('Securities catalogue').click();
      await page.getByLabel('Search equity directory').fill('AAPL');
      await page
        .getByRole('row')
        .filter({ hasText: /AAPL/i })
        .first()
        .getByRole('button', { name: 'Start model' })
        .click();
      await btn('Create model').click();
      assert.equal(
        await page.getByLabel('Starting revenue', { exact: true }).inputValue(),
        '',
      );
      await nav('Overview');
      await page.getByText('Model needs inputs').waitFor();
    },
  );
  await step('desktop More projects opens the native Atlas route', async () => {
    await page
      .getByRole('button', { name: 'More projects', exact: true })
      .click();
    const link = page
      .getByRole('link', { name: /DCF Atlas/ })
      .filter({ visible: true })
      .first();
    assert.equal(await link.getAttribute('href'), '/dcf-atlas');
    await link.click();
    assert.equal(new URL(page.url()).pathname, '/dcf-atlas');
  });
  await step(
    'mobile at 390 and 320 px, reduced motion, tool drawer and horizontally contained tables',
    async () => {
      const mobile = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: 'reduce',
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
      });
      mobile.setDefaultTimeout(10000);
      mobile.setDefaultNavigationTimeout(30000);
      const p = await mobile.newPage();
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(url);
      await p.locator('.a-kpi strong').first().waitFor();
      await p.screenshot({
        path: path.join(out, 'mobile.png'),
        animations: 'disabled',
      });
      for (const width of [390, 320]) {
        await p.setViewportSize({ width, height: 844 });
        const menu = p.locator('.a-mobilemenu');
        if (
          (await menu.getAttribute('aria-expanded')) === 'false' &&
          !(await p.locator('.ao-grid').isVisible())
        ) {
          await menu.tap();
          await p
            .getByRole('navigation', { name: 'Atlas tools' })
            .getByRole('button', { name: 'Overview', exact: true })
            .tap();
        }
        const starts = p.getByRole('group', { name: 'Start with your data' });
        const addBox = await starts
          .getByRole('button', { name: 'Add model' })
          .boundingBox();
        const upload = starts.getByRole('button', { name: 'Upload CSV' });
        const uploadBox = await upload.boundingBox();
        assert(
          addBox &&
            uploadBox &&
            addBox.y === uploadBox.y &&
            uploadBox.x + uploadBox.width <= width + 1,
        );
        await upload.tap();
        await p
          .getByRole('dialog', { name: 'Upload CSV' })
          .getByRole('button', { name: 'Choose CSV file' })
          .waitFor();
        await p.getByRole('button', { name: 'Close dialog' }).tap();
        const surface = p.locator('[data-chart-inspector="operations"]');
        await surface.locator('[data-point="0:4"]').tap();
        const note = p
          .getByRole('tooltip')
          .filter({ hasText: 'Revenue · FY2030' });
        await note.waitFor();
        const box = await note.boundingBox();
        assert(
          box.x >= -1 && box.x + box.width <= width + 1,
          'touch insight stays on screen',
        );
        await p.getByRole('heading', { name: 'Operating performance' }).tap();
        await note.waitFor({ state: 'hidden' });
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
          'overview overflows at ' + width,
        );
        await p
          .getByRole('region', { name: 'Overview annual forecast' })
          .waitFor();

        await menu.click();
        await p
          .getByRole('navigation', { name: 'Atlas tools' })
          .getByRole('button', { name: 'Sensitivity', exact: true })
          .click();
        await p.getByRole('heading', { name: 'Valuation surface' }).waitFor();
        assert.equal(await menu.getAttribute('aria-expanded'), 'false');
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
          'page overflows at ' + width,
        );
        await p.getByLabel(/^Grid/).selectOption('7');
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
          'grid overflows at ' + width,
        );
      }
      await mobile.close();
    },
  );
  assert.deepEqual(errors, []);
  console.log(
    'DCF Atlas: ' + passed + ' browser journeys passed. Files: ' + out,
  );
} finally {
  await browser.close();
}
