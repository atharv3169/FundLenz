import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { number, compoundInterest, amortizationSchedule, investmentCagr,
  presentValue, format, FinancialInputError } from "../public/projects/fincalc/core.mjs";
const close = (actual, expected, epsilon = 1e-8) =>
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= epsilon,
    String(actual) + " differs from " + String(expected));
assert.equal(number("10,000", "Amount"), 10000);
assert.equal(number("250,000", "Amount"), 250000);
assert.equal(number("1,234,567.89", "Amount"), 1234567.89);
assert.equal(number("1,000.25", "Amount"), 1000.25);
assert.equal(number("-1,234.5", "Amount"), -1234.5);
for (const bad of ["1,00", "12,34", "1,23,456", "1,,000", "1,000,",
  "Infinity", "NaN", "1e3", "1 000", ""]) {
  assert.throws(() => number(bad, "Amount"), FinancialInputError, bad);
}
const c = {principal:"10,000",annualRate:"8",years:"5",compoundsPerYear:"12"};
const i = compoundInterest(c);
close(i.futureValue, compoundInterest({...c,principal:"10000"}).futureValue);
close(i.futureValue, 10000 * (1 + .08 / 12) ** 60);
assert.match(format(i.futureValue), /^14,898\./);
const l = {principal:"250,000",annualRate:"9",years:"5"};
const e = amortizationSchedule(l);
close(e.payment, amortizationSchedule({...l,principal:"250000"}).payment);
assert.equal(e.rows.length, 60);
close(e.rows.at(-1).balance, 0);
close(e.totalPaid, 250000 + e.totalInterest);
const g = investmentCagr({startValue:"10,000",endValue:"18,000",years:"5"});
close(g.cagr, ((1.8 ** .2) - 1) * 100);
assert.equal(format(number("18,000","End") / number("10,000","Start")) + "×", "1.80×");
const pv = presentValue({futureValue:"50,000",discountRate:"7",years:"5"});
close(pv.presentValue, 50000 / (1.07 ** 5));
assert.equal(format(number("50,000","FV")), "50,000.00");
const app = readFileSync("public/projects/fincalc/app.mjs","utf8");
assert.match(app, /showCalculation\(false\)/);
assert.match(app, /showCalculation\(true\)/);
assert.match(app, /if \(recordHistory\) saveHistory/);
assert.match(app, /recordHistory \? "CALCULATED" : "EXAMPLE"/);
assert.match(app, /fields.addEventListener\("input", \(\) => clearResults\(\)\)/);
assert.doesNotMatch(app, /format\(Number\(values\.(?:endValue|futureValue)/);
const back = readFileSync("components/catalogue-return-link.tsx","utf8");
assert.match(back, /href="\/"/);
assert.match(back, /Back to Portfolio Lab/);
assert.match(readFileSync("app/globals.css","utf8"), /\.catalog-return-link:focus-visible/);
for (const kind of ["fund-catalog","global-catalog","securities-catalog"]) {
  const src = readFileSync("components/" + kind + ".tsx","utf8");
  assert.match(src, /<CatalogueReturnLink \/>/);
  assert.match(src, /className="catalog-market-tabs"/);
}
console.log("PASS: all four FinCalc examples, grouped inputs and catalogue return links");
