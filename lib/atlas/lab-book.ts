import { methods, type Method, type EquityInputs } from './equity';
export type Peer = { name: string; ev: number | null; ebitda: number | null };
export type LabBook = {
  holding?: Partial<
    Record<'entry' | 'exit' | 'annual' | 'years', number | null>
  >;
  method?: Method;
  equity?: Partial<
    Record<Method, Partial<Record<keyof EquityInputs, number | null>>>
  >;
  peers?: Peer[];
  scenarios?: Partial<
    Record<'spread' | 'profit' | 'bear' | 'bull', number | null>
  >;
  risk?: Partial<
    Record<
      'seed' | 'draws' | 'growth' | 'margin' | 'rate' | 'rho',
      number | null
    >
  >;
  reverse?: { key: 'growth' | 'margin' | 'wacc'; target: number | null };
};
const names = [
  'base',
  'years',
  'growth',
  'stable',
  'rate',
  'payout',
  'exit',
  'roe',
  'stableRoe',
] as const;
export const sampleEquity: EquityInputs = {
  base: 2,
  years: 5,
  growth: 6,
  stable: 2,
  rate: 10,
  payout: 70,
  exit: 13,
  roe: 14,
  stableRoe: 11,
};
export function equityInputs(
  book: LabBook | undefined,
  method: Method,
  fictional: boolean,
): EquityInputs {
  return Object.fromEntries(
    names.map((k) => {
      const v = book?.equity?.[method]?.[k];
      return [
        k,
        v === undefined
          ? fictional
            ? sampleEquity[k]
            : k === 'years'
              ? 5
              : NaN
          : (v ?? NaN),
      ];
    }),
  ) as EquityInputs;
}
export function readBook(input: unknown): LabBook {
  const fail = (): never => {
    throw Error('Invalid research worksheet data.');
  };
  function rec(v: unknown, allowed: readonly string[]) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return fail();
    const r = v as Record<string, unknown>;
    if (Object.keys(r).some((k) => !allowed.includes(k))) return fail();
    return r;
  }
  const num = (v: unknown) =>
    v === null
      ? null
      : typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e12
        ? v
        : fail();
  function numbers(v: unknown, allowed: readonly string[]) {
    return Object.fromEntries(
      Object.entries(rec(v, allowed)).map(([k, x]) => [k, num(x)]),
    );
  }
  const obj = rec(input, [
      'method',
      'equity',
      'peers',
      'scenarios',
      'risk',
      'reverse',
      'holding',
    ]),
    book: LabBook = {};
  if (obj.method !== undefined) {
    if (!methods.includes(obj.method as Method)) fail();
    book.method = obj.method as Method;
  }
  if (obj.equity !== undefined)
    book.equity = Object.fromEntries(
      Object.entries(rec(obj.equity, methods)).map(([k, x]) => [
        k,
        numbers(x, names),
      ]),
    );
  if (obj.peers !== undefined) {
    if (!Array.isArray(obj.peers) || obj.peers.length > 12) return fail();
    book.peers = obj.peers.map((p) => {
      const x = rec(p, ['name', 'ev', 'ebitda']);
      if (typeof x.name !== 'string' || x.name.length > 60) return fail();
      return { name: x.name, ev: num(x.ev), ebitda: num(x.ebitda) };
    });
  }
  if (obj.scenarios !== undefined)
    book.scenarios = numbers(obj.scenarios, [
      'spread',
      'profit',
      'bear',
      'bull',
    ]);
  if (obj.holding !== undefined)
    book.holding = numbers(obj.holding, ['entry', 'exit', 'annual', 'years']);
  if (obj.risk !== undefined)
    book.risk = numbers(obj.risk, [
      'seed',
      'draws',
      'growth',
      'margin',
      'rate',
      'rho',
    ]);
  if (obj.reverse !== undefined) {
    const x = rec(obj.reverse, ['key', 'target']);
    if (x.key !== 'growth' && x.key !== 'margin' && x.key !== 'wacc')
      return fail();
    book.reverse = { key: x.key, target: num(x.target) };
  }
  return book;
}
