'use client';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  ChartNoAxesCombined,
  ChevronDown,
  Compass,
  Download,
  FileText,
  FlaskConical,
  FolderOpen,
  GitBranch,
  History,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  Redo2,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Undo2,
  X,
} from 'lucide-react';
import { demo, evaluate, fields, keys, type Model } from '@/lib/atlas/model';
import { parseModel } from '@/lib/atlas/files';
import { AtlasContext, views, type View, type Saved } from './context';
import { AtlasArt, Dialog, cash } from './ui';
import { Assumptions, Forecast } from './model-views';
import { Overview } from './overview';
import { Risk, Scenarios, Sensitivity } from './labs';
import { Research } from './research-view';
import { EquityView } from './equity-view';
import { Reports, AuditReport } from './reports';
const icons = [
  LayoutDashboard,
  Settings2,
  ChartNoAxesCombined,
  GitBranch,
  SlidersHorizontal,
  Activity,
  FlaskConical,
  BookOpen,
  FileText,
];
const descriptions = [
  'Value, price and the cash that connects them.',
  'Define the financials, discount rate and terminal economics.',
  'Edit annual operating drivers and trace each discounted cash flow.',
  'Compare alternative paths and preserve a case for later review.',
  'Stress two assumptions at once and inspect the largest drivers.',
  'Work back from price and test a distribution of outcomes.',
  'Value equity flows and cross-check operating value against peers.',
  'Search companies, filed histories and saved work.',
  'Import working models and export the full valuation record.',
];
const components: ComponentType[] = [
  Overview,
  Assumptions,
  Forecast,
  Scenarios,
  Sensitivity,
  Risk,
  EquityView,
  Research,
  Reports,
];
const vault = 'fundlenz.atlas.v1.vault',
  draft = 'fundlenz.atlas.v1.draft';
type Moment = { model: Model; why: string };
function readVault(): Saved[] {
  const raw = JSON.parse(localStorage.getItem(vault) || '[]');
  if (!Array.isArray(raw) || raw.length > 40)
    throw Error('Invalid model vault');
  return raw.map((x) => {
    if (
      typeof x?.id !== 'string' ||
      typeof x.label !== 'string' ||
      typeof x.at !== 'string' ||
      !Number.isFinite(Date.parse(x.at))
    )
      throw Error('Invalid snapshot metadata');
    return {
      id: x.id,
      label: x.label.slice(0, 80),
      at: x.at,
      model: parseModel(x.model),
    };
  });
}
export function AtlasWorkspace() {
  const [state, setState] = useState<{
      now: Moment;
      past: Moment[];
      future: Moment[];
    }>({
      now: { model: demo(), why: 'Opened fictional model' },
      past: [],
      future: [],
    }),
    [view, setView] = useState<View>('Overview'),
    [period, setPeriod] = useState(0),
    [library, setLibrary] = useState<Saved[]>([]),
    [ready, setReady] = useState(false),
    [message, setMsg] = useState(''),
    [menu, setMenu] = useState(false),
    [collapsed, collapse] = useState(false),
    [dialog, open] = useState<'search' | 'save' | 'history' | null>(null),
    [q, search] = useState(''),
    [label, setLabel] = useState(''),
    [draftOk, setDraftOk] = useState(true);
  const m = state.now.model,
    { r, error } = useMemo(() => evaluate(m), [m]),
    idx = views.indexOf(view),
    Screen = components[idx],
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    title = useRef<HTMLHeadingElement>(null);
  const notify = useCallback((s: string) => {
    setMsg(s);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 5500);
  }, []);
  const edit = useCallback(
    (model: Model, why: string) =>
      setState((s) => ({
        past: [...s.past, s.now].slice(-60),
        now: { model, why },
        future: [],
      })),
    [],
  );
  const undo = () =>
    setState((s) =>
      s.past.length
        ? {
            past: s.past.slice(0, -1),
            now: s.past.at(-1)!,
            future: [s.now, ...s.future],
          }
        : s,
    );
  const redo = () =>
    setState((s) =>
      s.future.length
        ? {
            past: [...s.past, s.now],
            now: s.future[0],
            future: s.future.slice(1),
          }
        : s,
    );
  const go = useCallback((v: View) => {
    setView(v);
    setMenu(false);
    open(null);
    requestAnimationFrame(() => title.current?.focus({ preventScroll: true }));
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const d = localStorage.getItem(draft);
        if (d) {
          const model = parseModel(JSON.parse(d));
          setState({
            now: { model, why: 'Restored local worksheet' },
            past: [],
            future: [],
          });
        }
      } catch {
        notify('A local draft could not be restored. The example is open.');
      }
      try {
        setLibrary(readVault());
      } catch {
        notify('Model vault unavailable. Export JSON to keep a backup.');
      }
      setReady(true);
    });
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [notify]);
  useEffect(() => {
    if (!ready) return;
    const flush = () => {
      try {
        localStorage.setItem(draft, JSON.stringify(parseModel(m)));
        setDraftOk(true);
      } catch {
        setDraftOk(false);
      }
    };
    const t = setTimeout(flush, 200);
    window.addEventListener('pagehide', flush);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pagehide', flush);
    };
  }, [m, ready]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        search('');
        open((d) => (d === 'search' ? null : 'search'));
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const save = (name: string) => {
    try {
      const list = readVault();
      if (list.length >= 40) {
        notify(
          'Vault holds 40 snapshots. Export or remove an older snapshot first.',
        );
        return;
      }
      const entry = {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        label: name.trim().slice(0, 80) || m.name,
        model: parseModel(m),
      };
      const next = [entry, ...list];
      localStorage.setItem(vault, JSON.stringify(next));
      setLibrary(next);
      open(null);
      notify('Saved ' + entry.label + ' to this browser.');
    } catch (e) {
      notify('Snapshot was not saved: ' + (e as Error).message);
    }
  };
  const remove = (id: string) => {
    try {
      const next = readVault().filter((x) => x.id !== id);
      localStorage.setItem(vault, JSON.stringify(next));
      setLibrary(next);
      notify('Snapshot removed.');
    } catch {
      notify('Could not update this browser’s vault.');
    }
  };
  const options = [
    ...views.map((v, i) => ({
      name: v,
      sub: descriptions[i],
      act: () => go(v),
    })),
    ...library.map((s) => ({
      name: s.label,
      sub: 'Saved model · ' + s.model.ticker + ' · ' + s.model.currency,
      act: () => {
        edit(s.model, 'Restored ' + s.label);
        go('Overview');
      },
    })),
    ...keys.map((k) => ({
      name: fields[k][0],
      sub: 'Assumption · ' + fields[k][1],
      act: () => {
        go('Assumptions');
        requestAnimationFrame(() => {
          const el = document.querySelector<HTMLInputElement>(
            '.atlas-app input[aria-label="' + fields[k][0] + '"]',
          );
          if (el) {
            el.focus();
            el.scrollIntoView({ block: 'center' });
          } else
            notify(
              'This input is inactive. Enable Show inactive inputs in Assumptions.',
            );
        });
      },
    })),
  ]
    .filter((x) =>
      (x.name + ' ' + x.sub).toLowerCase().includes(q.toLowerCase()),
    )
    .slice(0, 28);
  return (
    <AtlasContext.Provider
      value={{
        m,
        r,
        error,
        edit,
        go,
        notify,
        library,
        save,
        remove,
        period: Math.min(period, m.horizon - 1),
        setPeriod,
      }}
    >
      <main className={'atlas-app' + (collapsed ? ' a-compact' : '')}>
        <div className="atlas-screen">
          <div className="a-banner">
            <div className="a-banner-ink">
              <div className="a-brandline">
                <Compass size={14} /> FundLenz <span>/</span> Research tools
              </div>
              <h1>
                DCF <em>Atlas</em>
              </h1>
              <p>Company valuation &amp; scenario research</p>
            </div>
            <AtlasArt />
            <div className="a-banner-actions">
              <button onClick={() => go('Research library')}>
                <FolderOpen size={15} /> Model library
              </button>
              <button onClick={() => go('Reports & files')}>
                <Download size={15} /> Reports &amp; files
              </button>
            </div>
          </div>
          <div className="a-commandbar">
            <div className="a-identity">
              <span className="a-monogram">
                {(m.ticker || m.name || 'A').slice(0, 2)}
              </span>
              <div>
                <b>{m.name || 'Untitled company'}</b>
                <small>
                  {m.ticker || 'PRIVATE'} · {m.currency} · FY{m.year}
                </small>
              </div>
              <span className="a-badge">
                {m.basis === 'Fictional'
                  ? 'Demo case'
                  : m.basis === 'Filing'
                    ? 'Filed history'
                    : 'Manual inputs'}
              </span>
            </div>
            <div className="a-tools">
              <button
                className="a-command"
                onClick={() => {
                  search('');
                  open('search');
                }}
              >
                <Search size={15} /> Find a tool <kbd>⌘ / Ctrl K</kbd>
              </button>
              <button
                className="a-primary"
                onClick={() => {
                  setLabel(m.name + ' · case');
                  open('save');
                }}
              >
                <Save size={15} /> Save case
              </button>
            </div>
          </div>
          <div className="a-layout">
            <aside className={'a-rail ' + (menu ? 'opened' : '')}>
              <div className="a-railcap">
                <span>WORKSPACE</span>
                <button
                  className="a-icon"
                  aria-label={
                    collapsed
                      ? 'Expand workspace navigation'
                      : 'Collapse workspace navigation'
                  }
                  onClick={() => collapse(!collapsed)}
                >
                  <PanelLeftClose size={15} />
                </button>
              </div>
              <button
                className="a-mobilemenu"
                onClick={() => setMenu(!menu)}
                aria-expanded={menu}
              >
                <Menu size={17} /> {view} <ChevronDown size={15} />
              </button>
              <nav aria-label="Atlas tools">
                {views.map((v, i) => {
                  const I = icons[i];
                  return (
                    <button
                      key={v}
                      title={v}
                      aria-current={view === v ? 'page' : undefined}
                      onClick={() => go(v)}
                    >
                      <I size={17} />
                      <span>{v}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="a-railfoot">
                <span className={'a-dot ' + (!r ? 'warn' : '')} />
                <span>{r ? 'Model calculates' : 'Inputs required'}</span>
                <small>
                  {m.horizon} years ·{' '}
                  {m.timing === 'midyear' ? 'midyear' : 'year-end'}
                </small>
              </div>
            </aside>
            <div className="a-surface">
              <div className="a-workhead">
                <div>
                  <div className="a-over">
                    Workbench &nbsp; / &nbsp; {String(idx + 1).padStart(2, '0')}
                  </div>
                  <h2 ref={title} tabIndex={-1}>
                    {view}
                  </h2>
                  <p>{descriptions[idx]}</p>
                </div>
                <div className="a-tools a-history">
                  <button
                    className="a-icon"
                    disabled={!state.past.length}
                    onClick={undo}
                    aria-label="Undo change"
                    title="Undo"
                  >
                    <Undo2 size={16} />
                  </button>
                  <button
                    className="a-icon"
                    disabled={!state.future.length}
                    onClick={redo}
                    aria-label="Redo change"
                    title="Redo"
                  >
                    <Redo2 size={16} />
                  </button>
                  <button
                    className="a-icon"
                    onClick={() => open('history')}
                    aria-label="Show edit history"
                    title="History"
                  >
                    <History size={16} />
                  </button>
                </div>
              </div>
              <div className="a-view" key={view}>
                <Screen />
              </div>
              <div className="a-foot">
                <span>DCF Atlas / FundLenz</span>
                <span>
                  {draftOk
                    ? 'Working draft stored locally'
                    : 'Draft not saved · export a snapshot'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div id="atlas-print-report" className="a-print">
          <AuditReport m={m} />
        </div>
        {message && (
          <div role="status" className="a-toast">
            {message}
            <button aria-label="Dismiss notice" onClick={() => setMsg('')}>
              <X size={14} />
            </button>
          </div>
        )}
        {dialog === 'search' && (
          <Dialog title="Search the workspace" onClose={() => open(null)}>
            <input
              className="a-wide"
              autoFocus
              type="search"
              placeholder="Find a tool, saved case or assumption…"
              aria-label="Search workspace"
              value={q}
              onChange={(e) => search(e.target.value)}
            />
            <div className="a-commandlist">
              {options.map((x, i) => (
                <button key={i} onClick={x.act}>
                  <span>
                    <b>{x.name}</b>
                    <small>{x.sub}</small>
                  </span>
                  <ArrowRight size={15} />
                </button>
              ))}
              {!options.length && <p>No matching tools or saved cases.</p>}
            </div>
          </Dialog>
        )}
        {dialog === 'save' && (
          <Dialog title="Save a named snapshot" onClose={() => open(null)}>
            <p>
              {m.name} · {cash(r?.perShare, m.currency)} per share. Snapshots
              remain on this browser; export JSON for a portable copy.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save(label);
              }}
            >
              <label className="a-full">
                Snapshot name
                <input
                  autoFocus
                  maxLength={80}
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </label>
              <button className="a-primary">Save snapshot</button>
            </form>
          </Dialog>
        )}
        {dialog === 'history' && (
          <Dialog title="Worksheet history" onClose={() => open(null)}>
            <p>
              Up to 60 changes in this session. Restore an earlier state or use
              Undo and Redo.
            </p>
            <div className="a-commandlist">
              <p>
                <b>Current:</b> {state.now.why}
              </p>
              {state.past
                .map((entry, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setState((s) => ({
                        now: entry,
                        past: s.past.slice(0, i),
                        future: [...s.past.slice(i + 1), s.now, ...s.future],
                      }));
                      open(null);
                    }}
                  >
                    <span>
                      {entry.why}
                      <small>{entry.model.name}</small>
                    </span>
                    Restore
                  </button>
                ))
                .reverse()}
            </div>
          </Dialog>
        )}
      </main>
    </AtlasContext.Provider>
  );
}
