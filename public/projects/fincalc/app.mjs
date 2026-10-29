import {
  compoundInterest, amortizationSchedule, investmentCagr,
  presentValue, number, format, csv, scheduleCsv, FinancialInputError,
} from "./core.mjs";

const configurations = {
  compound: {
    title: "Compound interest", result: "Future value",
    description: "See how an amount grows when interest is added at regular intervals.",
    method: "FV = P × (1 + r/n)^(n×t). The annual rate is entered as a percentage; only whole compounding periods are supported.",
    fields: [
      ["principal", "Starting principal", "10,000", "amount"],
      ["annualRate", "Annual interest rate", "8", "% per year"],
      ["years", "Investment duration", "5", "years"],
      ["compoundsPerYear", "Compounding frequency", "12", "times/year"],
    ],
  },
  emi: {
    title: "Loan EMI & schedule", result: "Monthly EMI",
    description: "Estimate fixed monthly repayments and inspect the associated loan amortization schedule.",
    method: "EMI = P × r / [1 − (1+r)^(-n)], where r is the monthly rate. Monthly payments and the rate are assumed fixed; the last installment clears the balance.",
    fields: [
      ["principal", "Loan principal", "250,000", "amount"],
      ["annualRate", "Annual interest rate", "9", "% per year"],
      ["years", "Loan duration", "5", "years"],
    ],
  },
  cagr: {
    title: "Investment CAGR", result: "Annualized growth",
    description: "Compare a starting and ending value using an annualized compound growth rate.",
    method: "CAGR = ((Ending value / Starting value)^(1 / years) − 1) × 100. It assumes a single beginning and ending value, without interim cash flows.",
    fields: [
      ["startValue", "Beginning value", "10,000", "amount"],
      ["endValue", "Ending value", "18,000", "amount"],
      ["years", "Holding period", "5", "years"],
    ],
  },
  pv: {
    title: "Present value", result: "Value today",
    description: "Discount a future amount to its present value using an annual discount rate.",
    method: "PV = FV / (1 + r)^t. This uses annual compounding and a single future payment; a discount rate above −100% is required.",
    fields: [
      ["futureValue", "Future amount", "50,000", "amount"],
      ["discountRate", "Annual discount rate", "7", "% per year"],
      ["years", "Time until payment", "5", "years"],
    ],
  },
};
const buttons = [...document.querySelectorAll("[data-mode]")];
const fields = document.querySelector("#fields");
const form = document.querySelector("#calc-form");
const error = document.querySelector("#error");
const scheduleButton = document.querySelector("#download-schedule");
const historyButton = document.querySelector("#download-history");
const historyDisplay = document.querySelector("#history");
const resultExtra = document.querySelector("#result-extra");
let active = "compound";
let currentSchedule = null;
const history = [];

function addStat(label, value) {
  const row = document.createElement("div");
  row.className = "stat";
  const caption = document.createElement("span");
  caption.textContent = label;
  const figure = document.createElement("strong");
  figure.textContent = value;
  row.append(caption, figure);
  resultExtra.append(row);
}
function clearResults() {
  document.querySelector("#result-title").textContent = configurations[active].result;
  document.querySelector("#result-value").textContent = "—";
  document.querySelector("#result-support").textContent = "Enter your values and calculate to see the result.";
  document.querySelector("#result-state").textContent = "READY";
  resultExtra.replaceChildren();
  currentSchedule = null;
  scheduleButton.hidden = true;
  error.hidden = true;
  error.textContent = "";
}
function renderTool(mode) {
  if (!Object.hasOwn(configurations, mode)) return;
  active = mode;
  const config = configurations[mode];
  buttons.forEach(button => {
    if (button.dataset.mode === mode) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const ordinal = Object.keys(configurations).indexOf(mode) + 1;
  document.querySelector(".input-panel .section-tag").textContent =
    String(ordinal).padStart(2, "0") + " / FINANCIAL CALCULATOR";
  document.querySelector("#tool-title").textContent = config.title;
  document.querySelector("#tool-description").textContent = config.description;
  document.querySelector("#method").textContent = config.method;
  fields.replaceChildren();
  for (const [id, label, initial, unit] of config.fields) {
    const wrapper = document.createElement("div");
    wrapper.className = "field";
    const inputId = "field-" + id;
    const heading = document.createElement("label");
    heading.htmlFor = inputId;
    heading.textContent = label;
    const holder = document.createElement("div");
    holder.className = "input-wrap";
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.name = id;
    input.id = inputId;
    input.autocomplete = "off";
    input.required = true;
    input.value = initial;
    input.setAttribute("aria-label", label);
    const badge = document.createElement("span");
    badge.className = "unit";
    badge.textContent = unit;
    holder.append(input, badge);
    wrapper.append(heading, holder);
    fields.append(wrapper);
  }
  clearResults();
  showCalculation(false);
}
function calculate(mode, values) {
  if (mode === "compound") {
    const r = compoundInterest(values);
    return { value: r.futureValue, display: format(r.futureValue),
      detail: "Estimated value at the end of the selected term.",
      stats: [["Interest earned", format(r.interestEarned)],
        ["Compounding periods", String(r.periods)]] };
  }
  if (mode === "emi") {
    const r = amortizationSchedule(values);
    currentSchedule = r.rows;
    return { value: r.payment, display: format(r.payment),
      detail: "Estimated monthly loan installment.",
      stats: [["Total interest", format(r.totalInterest)],
        ["Total repayable", format(r.totalPaid)],
        ["Monthly installments", String(r.months)]] };
  }
  if (mode === "cagr") {
    const r = investmentCagr(values);
    return { value: r.cagr, display: format(r.cagr, true),
      detail: "Annualized compound percentage change.",
      stats: [["Growth factor", format(number(values.endValue, "Ending value") / number(values.startValue, "Starting value")) + "×"]] };
  }
  const r = presentValue(values);
  return { value: r.presentValue, display: format(r.presentValue),
    detail: "Equivalent value today under the chosen discount rate.",
    stats: [["Future amount", format(number(values.futureValue, "Future value"))]] };
}
function saveHistory(mode, values, result) {
  history.unshift({ timestamp_utc: new Date().toISOString(), calculator: configurations[mode].title,
    inputs: JSON.stringify(values), result: result.display });
  if (history.length > 50) history.pop();
  historyButton.disabled = false;
  historyDisplay.replaceChildren();
  for (const item of history.slice(0, 4)) {
    const row = document.createElement("div");
    row.className = "history-item";
    const label = document.createElement("span");
    label.textContent = item.calculator;
    const resultText = document.createElement("b");
    resultText.textContent = item.result;
    row.append(label, resultText);
    historyDisplay.append(row);
  }
}
function download(name, content) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
buttons.forEach(button => button.addEventListener("click", () => renderTool(button.dataset.mode)));
document.querySelector("#reset").addEventListener("click", () => renderTool(active));
function showCalculation(recordHistory) {
  error.hidden = true;
  error.textContent = "";
  resultExtra.replaceChildren();
  currentSchedule = null;
  scheduleButton.hidden = true;
  try {
    const values = Object.fromEntries(new FormData(form).entries());
    const result = calculate(active, values);
    document.querySelector("#result-title").textContent = configurations[active].result;
    document.querySelector("#result-value").textContent = result.display;
    document.querySelector("#result-support").textContent = recordHistory
      ? result.detail : "Example using the prefilled values. " + result.detail;
    document.querySelector("#result-state").textContent = recordHistory ? "CALCULATED" : "EXAMPLE";
    result.stats.forEach(([label, value]) => addStat(label, value));
    scheduleButton.hidden = active !== "emi";
    if (recordHistory) saveHistory(active, values, result);
  } catch (problem) {
    document.querySelector("#result-state").textContent = "INPUT ERROR";
    document.querySelector("#result-value").textContent = "—";
    document.querySelector("#result-support").textContent = "Correct the input values and try again.";
    error.textContent = problem instanceof FinancialInputError ? problem.message : "Could not calculate. Check your inputs.";
    error.hidden = false;
  }
}
form.addEventListener("submit", event => {
  event.preventDefault();
  showCalculation(true);
});
fields.addEventListener("input", () => clearResults());
scheduleButton.addEventListener("click", () => {
  if (currentSchedule) download("fincalc-amortization.csv", scheduleCsv(currentSchedule));
});
historyButton.addEventListener("click", () => {
  if (!history.length) return;
  download("fincalc-history.csv", csv([...history].reverse(),
    ["timestamp_utc", "calculator", "inputs", "result"]));
});
renderTool("compound");
