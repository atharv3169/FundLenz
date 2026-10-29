/**
 * FinCalc browser edition — a JavaScript port of project.py's financial formulas.
 * The original Python calculator uses Decimal(36) precision. The browser port
 * uses JavaScript numbers and rounds at display/export boundaries; it is an
 * educational calculator, not an accounting ledger.
 */
const AMOUNT_LIMIT = 1_000_000_000_000;
const RESULT_LIMIT = 1_000_000_000_000_000;
export class FinancialInputError extends Error {
  constructor(message) { super(message); this.name = "FinancialInputError"; }
}
export function number(value, label, { min = -AMOUNT_LIMIT, max = AMOUNT_LIMIT } = {}) {
  const text = String(value ?? "").trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
    throw new FinancialInputError(label + " must be a finite number.");
  }
  const n = Number(text);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new FinancialInputError(label + " must be between " + min + " and " + max + ".");
  }
  return n;
}
function checked(value, label) {
  if (!Number.isFinite(value) || Math.abs(value) > RESULT_LIMIT) {
    throw new FinancialInputError(label + " is outside the supported calculator range.");
  }
  return value;
}
function periods(years, frequency, label) {
  const n = years * frequency;
  if (!Number.isInteger(n) || n > 1200) {
    throw new FinancialInputError(label + " must result in a whole number of periods (maximum 1,200).");
  }
  return n;
}
export function compoundInterest({ principal, annualRate, years, compoundsPerYear = 12 }) {
  const p = number(principal, "Principal", { min: 0 });
  const rate = number(annualRate, "Annual rate", { min: -100000, max: 100000 }) / 100;
  const t = number(years, "Years", { min: 0, max: 100 });
  const frequency = number(compoundsPerYear, "Compounds per year", { min: 1, max: 365 });
  if (!Number.isInteger(frequency)) throw new FinancialInputError("Compounds per year must be an integer.");
  const n = periods(t, frequency, "Years");
  const base = 1 + rate / frequency;
  if (base <= 0) throw new FinancialInputError("Rate is too negative for the selected compounding frequency.");
  const futureValue = checked(p * Math.pow(base, n), "Future value");
  return { futureValue, interestEarned: checked(futureValue - p, "Interest earned"), periods: n };
}
export function loanEmi({ principal, annualRate, years }) {
  const p = number(principal, "Loan amount", { min: 0.00000001 });
  const annual = number(annualRate, "Annual rate", { min: 0, max: 100000 });
  const t = number(years, "Years", { min: 0.00000001, max: 100 });
  const n = periods(t, 12, "Loan duration");
  const r = annual / 1200;
  // The expm1 formulation is more stable than r(1+r)^n/((1+r)^n-1).
  const emi = r === 0 ? p / n : p * r / -Math.expm1(-n * Math.log1p(r));
  return { payment: checked(emi, "Monthly payment"), months: n, monthlyRate: r, principal: p };
}
export function amortizationSchedule(values) {
  const { payment, months, monthlyRate, principal } = loanEmi(values);
  let balance = principal;
  const rows = [];
  let totalInterest = 0;
  for (let month = 1; month <= months; month++) {
    const interest = balance * monthlyRate;
    const paidPrincipal = month === months ? balance : Math.min(balance, Math.max(0, payment - interest));
    const thisPayment = paidPrincipal + interest;
    balance = Math.max(0, balance - paidPrincipal);
    totalInterest += interest;
    rows.push({ month, payment: checked(thisPayment, "Payment"), principal: paidPrincipal,
      interest, balance });
  }
  return { payment, months, rows, totalInterest: checked(totalInterest, "Total interest"),
    totalPaid: checked(principal + totalInterest, "Total paid") };
}
export function investmentCagr({ startValue, endValue, years }) {
  const start = number(startValue, "Starting value", { min: 0.00000001 });
  const end = number(endValue, "Ending value", { min: 0.00000001 });
  const t = number(years, "Years", { min: 0.00000001, max: 100 });
  return { cagr: checked((Math.pow(end / start, 1 / t) - 1) * 100, "CAGR") };
}
export function presentValue({ futureValue, discountRate, years }) {
  const f = number(futureValue, "Future value", { min: 0 });
  const r = number(discountRate, "Discount rate", { min: -99.999999, max: 100000 }) / 100;
  const t = number(years, "Years", { min: 0, max: 100 });
  return { presentValue: checked(f / Math.pow(1 + r, t), "Present value") };
}
const fixed = value => (Math.round((value + Math.sign(value) * Number.EPSILON) * 100) / 100).toFixed(2);
export function format(value, percent = false) {
  if (!Number.isFinite(value)) throw new FinancialInputError("Cannot format a non-finite value.");
  const [whole, fractional] = fixed(value).split(".");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + fractional + (percent ? "%" : "");
}
export function csv(rows, columns) {
  const escapeCell = cell => '"' + String(cell).replace(/"/g, '""') + '"';
  return [columns.map(escapeCell).join(","), ...rows.map(row => columns.map(k => {
    // Numeric result cells are formatted, while dates/labels are fixed application values.
    const value = row[k] ?? "";
    return escapeCell(value);
  }).join(","))].join("\r\n") + "\r\n";
}
export function scheduleCsv(rows) {
  return csv(rows.map(row => ({ month: row.month, payment: fixed(row.payment),
    principal: fixed(row.principal), interest: fixed(row.interest),
    balance: fixed(row.balance) })), ["month", "payment", "principal", "interest", "balance"]);
}
