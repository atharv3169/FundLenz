/** Dependency-free OOXML export. User text is always an inline string, never a spreadsheet formula. */
import {
  fields,
  keys,
  driver,
  type Model,
  type Result,
  type Key,
} from './model';
type Cell = string | number | null | { f: string; v: number };
const enc = new TextEncoder(),
  esc = (s: string) =>
    s
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
function col(i: number): string {
  return i < 26
    ? String.fromCharCode(65 + i)
    : col(Math.floor(i / 26) - 1) + col(i % 26);
}
function sheet(rows: Cell[][]) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="40" width="18" customWidth="1"/></cols><sheetData>' +
    rows
      .map(
        (r, i) =>
          '<row r="' +
          (i + 1) +
          '">' +
          r
            .map((v, j) => {
              const p = '<c r="' + col(j) + (i + 1) + '"';
              return v === null
                ? ''
                : typeof v === 'string'
                  ? p +
                    ' s="' +
                    (i === 0 ? 1 : 0) +
                    '" t="inlineStr"><is><t xml:space="preserve">' +
                    esc(v) +
                    '</t></is></c>'
                  : typeof v === 'number'
                    ? p + ' s="2"><v>' + v + '</v></c>'
                    : p +
                      ' s="2"><f>' +
                      esc(v.f) +
                      '</f><v>' +
                      v.v +
                      '</v></c>';
            })
            .join('') +
          '</row>',
      )
      .join('') +
    '</sheetData></worksheet>'
  );
}
function zip(files: Record<string, string>) {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (v: number[], n: number) => v.push(n & 255, (n >>> 8) & 255),
    u32 = (v: number[], n: number) => {
      u16(v, n);
      u16(v, n >>> 16);
    };
  for (const [name, text] of Object.entries(files)) {
    const data = enc.encode(text),
      fn = enc.encode(name);
    let crc = -1;
    for (const b of data) {
      crc ^= b;
      for (let j = 0; j < 8; j++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ -1) >>> 0;
    const shared: number[] = [];
    for (const x of [20, 0, 0, 0, 33]) u16(shared, x);
    for (const x of [crc, data.length, data.length]) u32(shared, x);
    u16(shared, fn.length);
    u16(shared, 0);
    const local: number[] = [];
    u32(local, 0x04034b50);
    local.push(...shared, ...fn);
    chunks.push(Uint8Array.from(local), data);
    const cent: number[] = [];
    u32(cent, 0x02014b50);
    u16(cent, 20);
    cent.push(...shared);
    for (let i = 0; i < 3; i++) u16(cent, 0);
    u32(cent, 0);
    u32(cent, offset);
    cent.push(...fn);
    central.push(Uint8Array.from(cent));
    offset += local.length + data.length;
  }
  const end: number[] = [];
  u32(end, 0x06054b50);
  for (const x of [0, 0, central.length, central.length]) u16(end, x);
  u32(
    end,
    central.reduce((n, x) => n + x.length, 0),
  );
  u32(end, offset);
  u16(end, 0);
  const parts = [...chunks, ...central, Uint8Array.from(end)],
    all = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
  let pos = 0;
  for (const p of parts) {
    all.set(p, pos);
    pos += p.length;
  }
  return all.buffer;
}
export function workbook(m: Model, r: Result) {
  const ref = (k: Key) => 'Inputs!$B$' + (2 + keys.indexOf(k)),
    fr = (f: string, v: number) => ({ f, v });
  const inputs: Cell[][] = [
    ['Assumption', 'Value', 'Unit'],
    ...keys.map((k) => [fields[k][0], m.inputs[k], fields[k][2]]),
  ];
  const forecast: Cell[][] = [
    [
      'FY',
      'Sales growth (%)',
      'EBIT margin (%)',
      'D&A / sales (%)',
      'Capex / sales (%)',
      'NWC / sales (%)',
      'Revenue',
      'EBIT',
      'Tax paid',
      'NOPAT',
      'D&A',
      'Capex',
      'Operating NWC',
      'Change NWC',
      'Closing losses',
      'FCFF',
      'PV factor',
      'PV FCFF',
    ],
  ];
  r.rows.forEach((x, i) => {
    const n = i + 2,
      p = n - 1,
      prev = i ? 'G' + p : ref('revenue'),
      prevWC = i ? 'M' + p : ref('revenue') + '*' + ref('nwc') + '/100',
      loss = i ? 'O' + p : ref('nol');
    const rates = (['growth', 'margin', 'da', 'capex', 'nwc'] as const).map(
      (k) => {
        const a = m.overrides[i]?.[k];
        if (a !== undefined) return a;
        const end =
          k === 'growth' ? 'growthEnd' : k === 'margin' ? 'marginEnd' : k;
        return fr(
          ref(k) +
            '+(' +
            ref(end) +
            '-' +
            ref(k) +
            ')*' +
            i +
            '/' +
            (m.horizon - 1),
          driver(m, k, i)!,
        );
      },
    );
    forecast.push([
      x.year,
      ...rates,
      fr(prev + '*(1+B' + n + '/100)', x.sales),
      fr('G' + n + '*C' + n + '/100', x.ebit),
      fr('MAX(0,H' + n + '-' + loss + ')*' + ref('tax') + '/100', x.taxes),
      fr('H' + n + '-I' + n, x.nopat),
      fr('G' + n + '*D' + n + '/100', x.da),
      fr('G' + n + '*E' + n + '/100', x.capex),
      fr('G' + n + '*F' + n + '/100', x.nwc),
      fr('M' + n + '-(' + prevWC + ')', x.delta),
      fr('MAX(0,' + loss + '-H' + n + ')', x.losses),
      fr('J' + n + '+K' + n + '-L' + n + '-N' + n, x.fcff),
      fr(
        '1/(1+Summary!$B$2/100)^' + (i + (m.timing === 'midyear' ? 0.5 : 1)),
        x.factor,
      ),
      fr('P' + n + '*Q' + n, x.pv),
    ]);
  });
  const n = m.horizon + 1,
    w =
      m.discount === 'direct'
        ? ref('wacc')
        : '(' +
          ref('rf') +
          '+' +
          ref('beta') +
          '*' +
          ref('erp') +
          ')*(1-' +
          ref('debtWeight') +
          '/100)+' +
          ref('debtCost') +
          '*(1-' +
          ref('tax') +
          '/100)*' +
          ref('debtWeight') +
          '/100';
  const tv =
    m.terminal === 'growth'
      ? 'IF(OR(B2<=' +
        ref('terminalG') +
        ',' +
        ref('roic') +
        '<=' +
        ref('terminalG') +
        ',Forecast!H' +
        n +
        '<=0),NA(),Forecast!H' +
        n +
        '*(1-' +
        ref('tax') +
        '/100)*(1+' +
        ref('terminalG') +
        '/100)*(1-' +
        ref('terminalG') +
        '/' +
        ref('roic') +
        ')/((B2-' +
        ref('terminalG') +
        ')/100))'
      : 'IF(Forecast!H' +
        n +
        '+Forecast!K' +
        n +
        '<=0,NA(),(Forecast!H' +
        n +
        '+Forecast!K' +
        n +
        ')*' +
        ref('multiple') +
        ')';
  const summary: Cell[][] = [
    ['DCF Atlas / ' + m.name, m.currency + ' millions'],
    ['Discount rate (%)', fr(w, r.w)],
    ['PV of forecast FCFF', fr('SUM(Forecast!R2:R' + n + ')', r.explicit)],
    ['Terminal value at horizon', fr(tv, r.tv)],
    ['PV of terminal value', fr('B4/(1+B2/100)^' + m.horizon, r.terminalPV)],
    ['Operating enterprise value', fr('B3+B5', r.ev)],
    [
      'Equity bridge adjustment',
      fr(
        ref('cash') +
          '+' +
          ref('assets') +
          '-' +
          ref('debt') +
          '-' +
          ref('claims'),
        r.netAdj,
      ),
    ],
    ['Equity value', fr('B6+B7', r.equity)],
    ['Value per diluted share', fr('B8/' + ref('shares'), r.perShare)],
    ['Period end', m.asOf],
    ['Price as of', m.priceDate],
    ['Input origin', m.basis],
    ['Discount convention', m.timing],
    ['Terminal method', m.terminal],
    ['Source / notes', m.source],
    ['Analyst notes', m.notes],
    [
      'Editing',
      'Edit linked inputs or annual forecast rates. Horizon and method are fixed in this export.',
    ],
  ];
  const hist: Cell[][] = [
    ['Fiscal year', 'Sales', 'EBIT', 'Cash capex'],
    ...m.history.map((h) => [h.year, h.sales, h.ebit, h.capex]),
  ];
  const names = ['Summary', 'Inputs', 'Forecast', 'History'];
  const ns = 'http://schemas.openxmlformats.org/',
    rel = ns + 'officeDocument/2006/relationships/',
    relDoc = (children: string) =>
      '<Relationships xmlns="' +
      ns +
      'package/2006/relationships">' +
      children +
      '</Relationships>',
    relationship = (i: number, type: string, target: string) =>
      '<Relationship Id="rId' +
      i +
      '" Type="' +
      rel +
      type +
      '" Target="' +
      target +
      '"/>';
  const files: Record<string, string> = {
    '[Content_Types].xml':
      '<Types xmlns="' +
      ns +
      'package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      names
        .map(
          (_, i) =>
            '<Override PartName="/xl/worksheets/sheet' +
            (i + 1) +
            '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
        )
        .join('') +
      '</Types>',
    '_rels/.rels': relDoc(relationship(1, 'officeDocument', 'xl/workbook.xml')),
    'xl/workbook.xml':
      '<workbook xmlns="' +
      ns +
      'spreadsheetml/2006/main" xmlns:r="' +
      rel.slice(0, -1) +
      '"><sheets>' +
      names
        .map(
          (s, i) =>
            '<sheet name="' +
            s +
            '" sheetId="' +
            (i + 1) +
            '" r:id="rId' +
            (i + 1) +
            '"/>',
        )
        .join('') +
      '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>',
    'xl/_rels/workbook.xml.rels': relDoc(
      names
        .map((_, i) =>
          relationship(
            i + 1,
            'worksheet',
            'worksheets/sheet' + (i + 1) + '.xml',
          ),
        )
        .join('') + relationship(5, 'styles', 'styles.xml'),
    ),
    'xl/styles.xml':
      '<styleSheet xmlns="' +
      ns +
      'spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173F43"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="4" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
  };
  [summary, inputs, forecast, hist].forEach(
    (rows, i) =>
      (files['xl/worksheets/sheet' + (i + 1) + '.xml'] = sheet(rows)),
  );
  return new Blob([zip(files)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
