'use client';
import { useEffect, useRef, useState } from 'react';
import { FileUp, Upload } from 'lucide-react';
import { demo, evaluate, keys, type Model } from '@/lib/atlas/model';
import {
  csv,
  download,
  downloadInputTemplate,
  historyUnits,
  importJson,
  modelCsv,
  modelFromHistory,
  parseModel,
  readUploadCsv,
  type CsvUpload,
  type HistoryUnit,
} from '@/lib/atlas/files';
import { secFacts } from '@/lib/atlas/research';
import { useAtlas } from './context';
import { Dialog, Table, n } from './ui';

type Props =
  | { csvOnly: true; onClose: () => void }
  | { csvOnly?: false; onClose?: never };

export function ModelImporter({ csvOnly = false, onClose }: Props) {
  const { m, edit, setPeriod, go, notify } = useAtlas();
  const file = useRef<HTMLInputElement>(null),
    seq = useRef(0);
  const [pending, setPending] = useState<CsvUpload | null>(null);
  const [fileName, setFileName] = useState(''),
    [name, setName] = useState('');
  const [currency, setCurrency] = useState<Model['currency'] | ''>(''),
    [unit, setUnit] = useState<HistoryUnit | ''>('');
  const [err, setErr] = useState(''),
    [busy, setBusy] = useState(false),
    [drag, setDrag] = useState(false);
  const [cut, setCut] = useState(() => new Date().toISOString().slice(0, 10));
  useEffect(
    () => () => {
      ++seq.current;
    },
    [],
  );
  async function read(f: File) {
    const token = ++seq.current;
    setErr('');
    setPending(null);
    setBusy(true);
    try {
      const limit = csvOnly || /\.csv$/i.test(f.name) ? 2 : 20;
      if (f.size > limit * 1_000_000)
        throw Error('File exceeds ' + limit + ' MB.');
      const text = (await f.text()).replace(/^\uFEFF/, '');
      let candidate: CsvUpload;
      if (!csvOnly && text.trimStart().startsWith('{')) {
        const raw = JSON.parse(text);
        candidate = {
          kind: 'model',
          model:
            raw.format === 'fundlenz.atlas'
              ? importJson(text)
              : parseModel(secFacts(raw, cut)),
        };
      } else candidate = readUploadCsv(text);
      if (seq.current !== token) return;
      setFileName(f.name);
      setName(
        (
          (candidate.kind === 'history' && candidate.company) ||
          f.name.replace(/\.csv$/i, '').replace(/[_-]+/g, ' ')
        )
          .trim()
          .slice(0, 100),
      );
      setCurrency(
        candidate.kind === 'history' ? (candidate.currency ?? '') : '',
      );
      setUnit(candidate.kind === 'history' ? (candidate.unit ?? '') : '');
      setPending(candidate);
    } catch (e) {
      if (seq.current === token) setErr((e as Error).message);
    } finally {
      if (seq.current === token) setBusy(false);
    }
  }
  function cancel() {
    ++seq.current;
    setPending(null);
    setBusy(false);
    setErr('');
    onClose?.();
  }
  const chooser = (
    <div className="a-importer">
      <p>
        {csvOnly
          ? 'Open an Atlas worksheet, or bring your own annual financials. You can review the figures before changing your model.'
          : 'Open an Atlas worksheet, annual financial history or an Atlas JSON snapshot. SEC Company Facts JSON uses annual 10-K filings available by your cutoff.'}
      </p>
      <div
        className={'a-drop ' + (drag ? 'over' : '')}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files[0]) void read(e.dataTransfer.files[0]);
        }}
      >
        <FileUp size={25} aria-hidden="true" />
        <b aria-live="polite">
          {busy
            ? 'Reading file…'
            : csvOnly
              ? 'Drop your CSV here'
              : 'Drop a CSV or JSON file here'}
        </b>
        <button
          className="a-btn"
          autoFocus={csvOnly}
          onClick={() => file.current?.click()}
        >
          <Upload size={15} aria-hidden="true" />{' '}
          {csvOnly ? 'Choose CSV file' : 'Choose file'}
        </button>
        <input
          ref={file}
          className="a-sr"
          tabIndex={-1}
          aria-label={csvOnly ? 'Upload model CSV' : 'Import model file'}
          type="file"
          accept={
            csvOnly ? '.csv,text/csv' : '.json,.csv,application/json,text/csv'
          }
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (f) void read(f);
          }}
        />
      </div>
      {err && (
        <p className="a-note" role="alert">
          {err}
        </p>
      )}
      <p className="a-import-help">
        <b>Annual financials:</b> one row per fiscal year, with revenue, EBIT
        and optional capex. Enter capex as a positive outflow. For a full
        valuation, use the input template or edit the worked example.
      </p>
      <div className="a-tools a-import-templates" aria-label="CSV downloads">
        <button
          className="a-link"
          onClick={downloadInputTemplate}
        >
          Blank input template ↓
        </button>
        <button
          className="a-link"
          onClick={() =>
            download('atlas-worked-example.csv', modelCsv(demo()), 'text/csv')
          }
        >
          Worked CSV example ↓
        </button>
        <button
          className="a-link"
          onClick={() =>
            download(
              'atlas-history-example.csv',
              csv([
                ['Fiscal year', 'Revenue', 'EBIT', 'Capex'],
                [2024, 100, 12, 4],
                [2025, 115, 15, 5],
              ]),
              'text/csv',
            )
          }
        >
          History example ↓
        </button>
      </div>
      {!csvOnly && (
        <label className="a-import-cut">
          SEC filing cutoff{' '}
          <input
            type="date"
            value={cut}
            onChange={(e) => setCut(e.target.value)}
          />
        </label>
      )}
      <p className="a-import-local">
        Files stay on this device. CSV limit: 2 MB.
      </p>
    </div>
  );
  if (!pending)
    return csvOnly ? (
      <Dialog key="pick" title="Upload CSV" onClose={cancel}>
        {chooser}
      </Dialog>
    ) : (
      chooser
    );

  let candidate: Model | null = pending.kind === 'model' ? pending.model : null;
  let problem = '';
  if (pending.kind === 'history' && name.trim() && currency && unit) {
    try {
      candidate = modelFromHistory(
        pending.rows,
        name,
        currency,
        unit,
        fileName,
      );
    } catch {
      problem =
        'These figures exceed the supported range. Check the amounts and the units selected below.';
    }
  }
  const check = candidate ? evaluate(candidate) : null;
  return (
    <Dialog key="review" title="Review import before applying" onClose={cancel}>
      <div className="a-importer">
        {pending.kind === 'history' ? (
          <>
            <p>
              <b>{fileName}</b> · {pending.rows.length} annual{' '}
              {pending.rows.length === 1 ? 'period' : 'periods'} · FY
              {pending.rows[0].year}
              {pending.rows.length > 1 ? '–' + pending.rows.at(-1)!.year : ''}
            </p>
            <label className="a-full">
              Company name
              <input
                autoFocus
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="a-gridform">
              <label>
                Reporting currency
                <select
                  disabled={!!pending.currency}
                  value={currency}
                  onChange={(e) =>
                    setCurrency(e.target.value as Model['currency'] | '')
                  }
                >
                  <option value="">Choose currency…</option>
                  {['USD', 'EUR', 'INR', 'GBP'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Amounts in your CSV
                <select
                  disabled={!!pending.unit}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as HistoryUnit | '')}
                >
                  <option value="">Choose units…</option>
                  {Object.entries(historyUnits).map(([v, [caption]]) => (
                    <option key={v} value={v}>
                      {caption}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Table
              caption="Recent annual figures as entered in the file"
              heads={['Fiscal year', 'Revenue', 'EBIT', 'Capex']}
              rows={pending.rows
                .slice(-3)
                .map((h) => [
                  h.year,
                  n(h.sales, 6),
                  n(h.ebit, 6),
                  n(h.capex, 6),
                ])}
            />
            <p className="a-import-help">
              {candidate
                ? candidate.inputs.revenue !== null
                  ? 'Starting revenue: ' +
                    candidate.currency +
                    ' ' +
                    n(candidate.inputs.revenue, 8) +
                    ' million. '
                  : 'Enter positive starting revenue in Assumptions. '
                : 'Choose the currency and units used in your file. '}
              Forecast assumptions stay blank for you to fill in.
            </p>
          </>
        ) : (
          <>
            <p>
              <b>{pending.model.name}</b> · {pending.model.currency} · FY
              {pending.model.year} · {pending.model.basis}
            </p>
            <p>
              {pending.model.history.length} historical periods ·{' '}
              {keys.filter((k) => pending.model.inputs[k] !== null).length}{' '}
              supplied inputs ·{' '}
              {
                keys.filter((k) => pending.model.inputs[k] !== m.inputs[k])
                  .length
              }{' '}
              input differences from the active sheet.
            </p>
            <p>
              {check?.r
                ? 'The imported FCFF model calculates successfully.'
                : 'Incomplete model: ' + check?.error}
            </p>
            {pending.model.source && (
              <p className="a-muted">{pending.model.source}</p>
            )}
          </>
        )}
        {problem && (
          <p role="alert" className="a-note">
            {problem}
          </p>
        )}
        <div className="a-tools a-import-confirm">
          <button
            className="a-primary"
            disabled={!candidate}
            onClick={() => {
              if (!candidate) return;
              edit(candidate, 'Imported model file');
              setPeriod(0);
              cancel();
              go(check?.r ? 'Overview' : 'Assumptions');
              notify(
                check?.r
                  ? 'Model imported. Undo returns to the previous worksheet.'
                  : 'Data imported. Complete the missing assumptions to see your valuation.',
              );
            }}
          >
            Apply import
          </button>
          <button className="a-btn" onClick={cancel}>
            Cancel
          </button>
        </div>
      </div>
    </Dialog>
  );
}
