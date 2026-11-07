# Ternwell

A local, integrated three-statement modelling studio at `/ternwell`. Start with the fictional Alderwick Industrial case, create a zero-filled company, or download the populated input worksheet from **Import**. Amounts are in millions of the reporting currency. Changing currency relabels rather than converts amounts.

Each scenario has 17 operating, working-capital, investment, and financing drivers. Override individual years or use case defaults throughout a one- to ten-year forecast. Income feeds retained earnings and operating cash; opening debt and PP&E drive interest and depreciation. The revolver draws only to the available limit and sweeps excess cash. An accounting reconciliation and a liquidity shortfall are separate checks.

In **Statements**, choose a case, a statement and a fiscal-year cell. Enter a signed amount in millions to replace its calculated value for that case and year. Linked lines and later periods recalculate. Revert to the formula to remove an override. Checks flag accounting differences independently of editable presentation figures.

| What you want to do | Download | Bring it back |
| --- | --- | --- |
| Edit opening balances and assumptions for the whole company | Editable input CSV | Upload edited inputs; review before replacing all three cases |
| Enter your own statement figures for one case | Statement CSV for that case | Upload statement CSV for the same case, units and fiscal years; unchanged figures keep calculating |
| Move the complete model to another device | JSON backup | Restore JSON backup |
| Continue analysis in Excel | All-case modelling workbook | Edit its opening balances or case inputs directly in Excel; use CSV to bring changes back to Ternwell |
| Share a reference copy | Active case results workbook or all-case print report | These are reports, not import formats |

The Excel modelling workbook includes formula-linked calculations, native comparison charts and annual case figures. The print report includes the income statement, balance sheet and cash flow for all three cases. Files are processed in the browser; up to 12 versions can be saved on the current device.

This annual management model assumes 365 days, operating interest and tax cash flows, and no deferred tax, loss carryforwards, FX translation, acquisitions or disposals. Other non-current balances are carried forward. See the [SEC guide to financial statements](https://www.sec.gov/investor/pubs/begfinstmtguide.htm) for background.

Tests cover profit, loss, liquidity shortfalls, borrowing limits, deliberately unbalanced inputs, CSV/JSON round trips, output safety and 2,160 modelled years. The native Worker browser suite exercises real chart controls, editing, all three statements, downloads, import review, print, saved cases, and phone widths.
