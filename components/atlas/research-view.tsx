'use client';
import { useDeferredValue, useMemo, useState } from 'react';
import {
  Search,
  Library,
  ArrowUpRight,
  Plus,
  BookOpen,
  FolderOpen,
  Trash2,
} from 'lucide-react';
import {
  getSecurities,
  searchSecurities,
  type Securities,
  type Security,
} from '@/lib/securities';
import { blank, demo, evaluate, type Model } from '@/lib/atlas/model';
import { filings, filingModel } from '@/lib/atlas/research';
import { Screener } from './screener';
import { useAtlas } from './context';
import { Card, Dialog, Plot, Table, cash, n } from './ui';
const emptySecurities: Security[] = [];
export function Research() {
  const { m, edit, go, notify, library, remove } = useAtlas();
  const [area, select] = useState('Model library'),
    [q, setQ] = useState(''),
    [kind, setKind] = useState('All'),
    [ccy, setCcy] = useState('All'),
    [dateSort, setSort] = useState('Recent');
  const [directory, setDirectory] = useState<Securities | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [ex, setEx] = useState('All'),
    [typ, setType] = useState('All'),
    [page, setPage] = useState(0),
    [stock, setStock] = useState<Security | null>(null),
    [create, setCreate] = useState(false),
    [name, setName] = useState(''),
    [currency, setCurrency] = useState<Model['currency']>('USD'),
    [sector, setSector] = useState<Model['sector']>('Operating company'),
    [del, setDel] = useState<string | null>(null),
    [at, period] = useState(0);
  const query = useDeferredValue(q.trim().toLowerCase()),
    equities = directory?.records ?? emptySecurities,
    exchanges = useMemo(
      () =>
        Array.from(
          new Set(equities.flatMap((s) => (s.exchange ? [s.exchange] : []))),
        ).sort(),
      [equities],
    ),
    matches = useMemo(
      () =>
        searchSecurities(equities, query, typ === 'All' ? '' : typ).filter(
          (s) => ex === 'All' || s.exchange === ex,
        ),
      [equities, query, ex, typ],
    );
  const pageSize = 20,
    idx = Math.min(page, Math.max(0, Math.ceil(matches.length / pageSize) - 1)),
    slice = matches.slice(idx * pageSize, (idx + 1) * pageSize);
  async function fetchDir() {
    setLoading(true);
    setError('');
    try {
      const all = await getSecurities();
      setDirectory({
        ...all,
        records: all.records.filter(
          (s) => s.type === 'Stock' || s.type === 'ADR',
        ),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  const seeds = useMemo(
      () =>
        [0, 1, 2].map((i) => ({
          model: demo(i),
          id: 'demo' + i,
          at: '',
          label: demo(i).name,
        })),
      [],
    ),
    historySeeds = useMemo(
      () =>
        filings.map((f, i) => ({
          model: filingModel(i),
          id: 'filing' + i,
          at: '',
          label: f.name + ' · FY2025',
        })),
      [],
    );
  let collection = [...library, ...historySeeds, ...seeds].filter(
    (x) =>
      (
        x.label +
        ' ' +
        x.model.name +
        ' ' +
        x.model.ticker +
        ' ' +
        x.model.source
      )
        .toLowerCase()
        .includes(query) &&
      (kind === 'All' ||
        (kind === 'Saved'
          ? library.some((s) => s.id === x.id)
          : kind === x.model.basis)) &&
      (ccy === 'All' || ccy === x.model.currency),
  );
  if (dateSort === 'Name')
    collection = [...collection].sort((a, b) => a.label.localeCompare(b.label));
  else collection.sort((a, b) => b.at.localeCompare(a.at));
  function start(s: Model, why: string) {
    edit(s, why);
    go(evaluate(s).r ? 'Overview' : 'Assumptions');
    notify(why + ' · Undo returns to the previous model.');
  }
  return (
    <>
      <Card
        kicker="01 / Discovery"
        title="Research library"
        action={
          <button
            className="a-btn"
            onClick={() => {
              setStock(null);
              setCreate(true);
              setName('');
              setCurrency('USD');
              setSector('Operating company');
            }}
          >
            <Plus size={15} /> New model
          </button>
        }
      >
        <div className="a-chips">
          {[
            'Model library',
            'Securities catalogue',
            'Financial history',
            'Model screener',
          ].map((t) => (
            <button
              className="a-pill"
              aria-pressed={t === area}
              key={t}
              onClick={() => {
                select(t);
                setQ('');
                setPage(0);
                if (t === 'Securities catalogue' && !directory && !loading)
                  void fetchDir();
              }}
            >
              {t}
            </button>
          ))}
        </div>
        {area === 'Model screener' ? (
          <p>
            Compare completed valuations and export your filtered list below.
          </p>
        ) : area === 'Model library' ? (
          <>
            <div className="a-tools">
              <label className="a-search">
                <Search size={16} />
                <input
                  type="search"
                  placeholder="Company, ticker, source or saved case…"
                  aria-label="Search models"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
              <select
                aria-label="Filter model origin"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {['All', 'Saved', 'Filing', 'Fictional', 'Manual'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                aria-label="Filter model currency"
                value={ccy}
                onChange={(e) => setCcy(e.target.value)}
              >
                {['All', 'USD', 'INR', 'EUR', 'GBP'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                aria-label="Sort models"
                value={dateSort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option>Recent</option>
                <option>Name</option>
              </select>
            </div>
            <p className="a-muted">
              {collection.length} matching entries. Filed histories contain
              reported facts; they do not include a quote or a completed
              valuation.
            </p>
            <div className="a-list">
              {collection.map((s) => {
                const v = evaluate(s.model).r,
                  stored = library.some((x) => x.id === s.id);
                return (
                  <div className="a-listrow" key={s.id}>
                    <div className="a-emblem">
                      {s.model.basis === 'Filing' ? (
                        <BookOpen size={18} />
                      ) : stored ? (
                        <FolderOpen size={18} />
                      ) : (
                        <Library size={18} />
                      )}
                    </div>
                    <div>
                      <b>{s.label}</b>
                      <small>
                        {s.model.ticker || 'PRIVATE'} · {s.model.basis} ·{' '}
                        {s.model.currency}
                        {stored
                          ? ' · ' + new Date(s.at).toLocaleDateString()
                          : ''}
                      </small>
                    </div>
                    <span className="a-listnum">
                      {v ? cash(v.perShare, s.model.currency) : 'Inputs needed'}
                    </span>
                    <button
                      className="a-btn"
                      aria-label={'Open ' + s.label}
                      onClick={() => start(s.model, 'Opened ' + s.label)}
                    >
                      Open
                    </button>
                    {stored && (
                      <button
                        className="a-icon"
                        aria-label={'Delete ' + s.label}
                        onClick={() => setDel(s.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
              {!collection.length && <p>No entries match these filters.</p>}
            </div>
          </>
        ) : area === 'Securities catalogue' ? (
          <>
            <p>
              Find equity identities from the same FundLenz reference catalogue
              used elsewhere on the site. Directory dates belong to the source;
              a listing is not a price or a financial statement.
            </p>
            {loading ? (
              <p role="status">Loading the FundLenz securities catalogue…</p>
            ) : error ? (
              <div className="a-note">
                {error}{' '}
                <button className="a-btn" onClick={fetchDir}>
                  Retry directory
                </button>
              </div>
            ) : directory ? (
              <>
                <div className="a-tools">
                  <label className="a-search">
                    <Search size={16} />
                    <input
                      aria-label="Search equity directory"
                      placeholder="Search name, ticker, ISIN or exchange…"
                      type="search"
                      value={q}
                      onChange={(e) => {
                        setQ(e.target.value);
                        setPage(0);
                      }}
                    />
                  </label>
                  <select
                    aria-label="Filter exchange"
                    value={ex}
                    onChange={(e) => {
                      setEx(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="All">All exchanges</option>
                    {exchanges.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter security type"
                    value={typ}
                    onChange={(e) => {
                      setType(e.target.value);
                      setPage(0);
                    }}
                  >
                    {['All', 'Stock', 'ADR'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <p className="a-muted">
                  {matches.length.toLocaleString()} matches · catalogue as of{' '}
                  {directory.asOf || directory.checkedAt.slice(0, 10)}
                </p>
                <Table
                  heads={['Company', 'Symbol', 'Exchange', 'Class', '']}
                  rows={slice.map((s) => [
                    s.name,
                    s.symbol || '—',
                    s.exchange || '—',
                    s.type,
                    <button
                      key={s.id}
                      className="a-link"
                      onClick={() => {
                        setStock(s);
                        setName(s.name.slice(0, 100));
                        setCurrency('USD');
                        setSector('Operating company');
                        setCreate(true);
                      }}
                    >
                      Start model
                    </button>,
                  ])}
                />
                {!matches.length && <p>No matching equities.</p>}
                <div className="a-tools">
                  <button
                    className="a-btn"
                    disabled={idx === 0}
                    onClick={() => setPage(idx - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {idx + 1} of{' '}
                    {Math.max(1, Math.ceil(matches.length / pageSize))}
                  </span>
                  <button
                    className="a-btn"
                    disabled={(idx + 1) * pageSize >= matches.length}
                    onClick={() => setPage(idx + 1)}
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              <button className="a-btn" onClick={fetchDir}>
                Load directory
              </button>
            )}
          </>
        ) : (
          <>
            <p>
              {m.name} · {m.history.length} periods · {m.currency} millions ·{' '}
              {m.source || 'No source attached.'}
            </p>
            {m.history.length ? (
              <>
                <Plot
                  labels={m.history.map((x) => 'FY' + String(x.year).slice(-2))}
                  series={[
                    {
                      name: 'Reported / entered sales',
                      values: m.history.map((x) => x.sales),
                    },
                    { name: 'EBIT', values: m.history.map((x) => x.ebit) },
                  ]}
                  unit={m.currency + ' m'}
                  at={at}
                  onSelect={period}
                />
                <Table
                  heads={['FY', 'Sales', 'EBIT', 'EBIT margin', 'Cash capex']}
                  rows={m.history.map((h) => [
                    h.year,
                    n(h.sales),
                    n(h.ebit),
                    h.sales ? n((h.ebit / h.sales) * 100) + '%' : 'N/A',
                    n(h.capex),
                  ])}
                />
                <button
                  className="a-btn"
                  onClick={() => {
                    const h = m.history.at(-1)!,
                      f = m.history[0];
                    if (h.sales <= 0) return;
                    const margin = (h.ebit / h.sales) * 100,
                      growth =
                        f !== h && f.sales > 0
                          ? ((h.sales / f.sales) ** (1 / (h.year - f.year)) -
                              1) *
                            100
                          : null;
                    const next = {
                      ...m,
                      inputs: {
                        ...m.inputs,
                        revenue: h.sales,
                        margin,
                        marginEnd: margin,
                        capex:
                          h.capex !== null
                            ? (h.capex / h.sales) * 100
                            : m.inputs.capex,
                        growth: growth ?? m.inputs.growth,
                        growthEnd: growth ?? m.inputs.growthEnd,
                      },
                    };
                    edit(
                      next,
                      'Calibrated revenue, margins and available drivers to entered history',
                    );
                    notify(
                      'Applied historical ratios as forecast assumptions. Annual overrides remain in effect.',
                    );
                  }}
                >
                  Use historical ratios as forecast drivers
                </button>
              </>
            ) : (
              <p className="a-note">
                Load a filed history or import annual figures in Reports &
                files.
              </p>
            )}
            <h4>Filed examples</h4>
            {filings.map((f, i) => (
              <div className="a-keyline" key={f.ticker}>
                <span>{f.name} · FY2023–25</span>
                <a href={f.url} target="_blank" rel="noreferrer">
                  SEC filing ↗
                </a>
                <button
                  className="a-link"
                  onClick={() => start(filingModel(i), 'Loaded filed history')}
                >
                  Load history
                </button>
              </div>
            ))}
          </>
        )}
      </Card>
      {area === 'Model screener' && (
        <Screener
          entries={[...library, ...historySeeds, ...seeds]}
          open={(s) => start(s, 'Opened screener result')}
        />
      )}
      {create && (
        <Dialog
          title={
            stock ? 'Start from this listing' : 'Start a blank company model'
          }
          onClose={() => setCreate(false)}
        >
          <p>
            {stock
              ? stock.symbol +
                ' · ' +
                stock.exchange +
                ' · identity dated ' +
                stock.asOf
              : 'Enter the company identity and the currency used in its accounts.'}{' '}
            Financial assumptions start empty.
          </p>
          <label className="a-full">
            Company name
            <input
              autoFocus
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="a-gridform">
            <label>
              Currency
              <select
                value={currency}
                onChange={(e) =>
                  setCurrency(e.target.value as Model['currency'])
                }
              >
                {['USD', 'EUR', 'INR', 'GBP'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Business type
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value as Model['sector'])}
              >
                {['Operating company', 'Bank / insurer', 'REIT'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="a-primary"
            disabled={!name.trim()}
            onClick={() => {
              const v = blank(name.trim(), stock?.symbol || '');
              v.currency = currency;
              v.sector = sector;
              if (stock)
                v.source =
                  'Identity only: ' +
                  stock.id +
                  ' · ' +
                  stock.sourceIds.join(', ') +
                  ' · ' +
                  stock.asOf;
              setCreate(false);
              start(v, 'Started manual model');
            }}
          >
            Create model <ArrowUpRight size={14} />
          </button>
        </Dialog>
      )}
      {del && (
        <Dialog title="Delete saved snapshot?" onClose={() => setDel(null)}>
          <p>
            The active worksheet will remain open. This removes only the
            selected browser snapshot.
          </p>
          <button
            className="a-btn"
            onClick={() => {
              remove(del);
              setDel(null);
            }}
          >
            Delete snapshot
          </button>
        </Dialog>
      )}
    </>
  );
}
