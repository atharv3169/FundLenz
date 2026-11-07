# Ternwell

A local, integrated three-statement modelling studio at `/ternwell`. Start with the fictional Alderwick Industrial case, create a zero-filled company, or download the populated input worksheet from **Import**. Amounts are in millions of the reporting currency. Changing currency relabels rather than converts amounts.

Each scenario has 17 operating, working-capital, investment, and financing drivers. Override individual years or use case defaults throughout a one- to ten-year forecast. Income feeds retained earnings and operating cash; opening debt and PP&E drive interest and depreciation. The revolver draws only to the available limit and sweeps excess cash. An accounting reconciliation and a liquidity shortfall are separate checks.

Use **Statements** to filter lines, view common-size data, or select a row to see its formula. **Schedules** covers working capital, fixed assets, debt, and equity. **Scenarios** compares three independent cases and stresses gross margin and sales growth. **Checks & files** exports an editable input CSV or lossless JSON, a statement CSV, a nine-sheet Excel results workbook with cached formulas and inter-statement links, and a printable report. Up to 12 versions can be saved on the current device. There is no upload service or catalogue dependency.

This annual management model assumes 365 days, operating interest and tax cash flows, and no deferred tax, loss carryforwards, FX translation, acquisitions or disposals. Other non-current balances are carried forward. See the [SEC guide to financial statements](https://www.sec.gov/investor/pubs/begfinstmtguide.htm) for background.

Tests cover profit, loss, liquidity shortfalls, borrowing limits, deliberately unbalanced inputs, CSV/JSON round trips, output safety and 2,160 modelled years. The native Worker browser suite exercises real chart controls, editing, all three statements, downloads, import review, print, saved cases, and phone widths.
