export const methods = [
  'Dividend discount',
  'Equity cash flow',
  'REIT distributions',
  'Residual income',
] as const;
export type Method = (typeof methods)[number];
export type EquityInputs = {
  base: number;
  years: number;
  growth: number;
  stable: number;
  rate: number;
  payout: number;
  exit: number;
  roe: number;
  stableRoe: number;
};
export function equityMethod(method: Method, a: EquityInputs) {
  const { base, years, growth, stable, rate, payout, exit, roe, stableRoe } = a;
  if (
    !Number.isFinite(base) ||
    base <= 0 ||
    !Number.isInteger(years) ||
    years < 1 ||
    years > 20 ||
    !Number.isFinite(rate) ||
    rate <= 0 ||
    rate > 100
  )
    throw Error(
      'Enter a positive base amount, 1–20 whole years and a cost of equity of up to 100%.',
    );
  if (
    method !== 'Residual income' &&
    (!Number.isFinite(growth) || growth <= -100 || growth > 250)
  )
    throw Error('Explicit growth must be above −100% and at most 250%.');
  if (
    method !== 'REIT distributions' &&
    (!Number.isFinite(stable) || stable <= -100 || rate <= stable)
  )
    throw Error('Stable growth must be above −100% and below cost of equity.');
  if (
    (method === 'Residual income' || method === 'REIT distributions') &&
    (!Number.isFinite(payout) || payout < 0 || payout > 100)
  )
    throw Error('Payout must be between 0% and 100%.');
  if (
    method === 'Residual income' &&
    (!Number.isFinite(roe) ||
      roe <= -100 ||
      !Number.isFinite(stableRoe) ||
      stableRoe <= 0 ||
      stable > stableRoe)
  )
    throw Error('Check forecast ROE and a sustainable, positive stable ROE.');
  if (method === 'REIT distributions' && (!Number.isFinite(exit) || exit <= 0))
    throw Error('Enter a positive exit price / AFFO multiple.');
  let running = base,
    explicit = 0;
  const flows: number[] = [],
    pvs: number[] = [];
  for (let i = 1; i <= years; i++) {
    let cf;
    if (method === 'Residual income') {
      cf = (running * (roe - rate)) / 100;
      running += ((running * roe) / 100) * (1 - payout / 100);
    } else {
      running *= 1 + growth / 100;
      cf = running * (method === 'REIT distributions' ? payout / 100 : 1);
    }
    const pv = cf / (1 + rate / 100) ** i;
    flows.push(cf);
    pvs.push(pv);
    explicit += pv;
  }
  const terminal =
      method === 'Residual income'
        ? (running * (stableRoe - rate)) / (rate - stable)
        : method === 'REIT distributions'
          ? running * exit
          : (running * (1 + stable / 100)) / ((rate - stable) / 100),
    terminalPV = terminal / (1 + rate / 100) ** years;
  const value =
    (method === 'Residual income' ? base : 0) + explicit + terminalPV;
  if (![value, ...pvs].every(Number.isFinite))
    throw Error('Calculation exceeds numeric range.');
  return { value, explicit, terminalPV, flows, pvs };
}

// A purchase outflow followed by equal annual distributions and a positive terminal sale has one IRR.
export function holdingReturn(
  entry: number,
  exit: number,
  annual: number,
  years: number,
) {
  if (
    ![entry, exit, annual, years].every(Number.isFinite) ||
    entry <= 0 ||
    exit <= 0 ||
    annual < 0 ||
    !Number.isInteger(years) ||
    years < 1 ||
    years > 30
  )
    throw Error(
      'Enter positive entry and exit prices, nonnegative distributions and 1–30 whole years.',
    );
  const pv = (rate: number) => {
    let value = exit;
    for (let i = 0; i < years; i++) value = (value + annual) / (1 + rate);
    return value;
  };
  let lo = -0.999999999,
    hi = 1;
  while (pv(hi) > entry && hi < 1e12) hi = hi * 2 + 1;
  if (pv(lo) < entry || pv(hi) > entry)
    throw Error('This return is outside the supported numerical bounds.');
  for (let i = 0; i < 130; i++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > entry) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 100;
}
