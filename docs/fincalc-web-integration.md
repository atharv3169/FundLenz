# FinCalc browser edition hosted by FundLenz

The original FinCalc project stays in a separate repository:
https://github.com/atharv3169/FinCalc

The browser implementation lives in FinCalc `web/` on the independent
feature branch `feat/browser-fincalc-fundlenz-20261029`.
Initial reviewed source revision: `fa45400ca0c133db0ff1e2d350de230d2eaca46f`.

FundLenz hosts a **reviewed copy** of four web files under
`public/projects/fincalc/`. The same-origin application is displayed at
`/fincalc` by the Next.js route `app/fincalc/page.tsx`. The navigation
sidebar links Portfolio Lab to `/` and FinCalc to `/fincalc`.
The original Python `project.py` and its tests are *not* altered or hosted.

To update FinCalc: review and test the FinCalc source independently, copy
its four browser files here byte-for-byte, update the immutable release
manifest for these files, and then build/test FundLenz. The FundLenz snapshot
is not a live dependency on another GitHub branch or a remote CDN.

The calculations run on the visitor's device. The browser port uses
JavaScript floating-point arithmetic, with two-decimal output; Python CLI
continues using Decimal. CSV history remains in memory until page reload.
The financial assumptions and disclosures are stated in the app.

This arrangement does not create another Cloudflare Worker or expose the
existing FinCalc repository to the FundLenz automatic catalogue publisher.
