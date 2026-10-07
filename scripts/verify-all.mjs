import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
// Use the bundler already installed with Vite; no extra test dependency.
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve('vite'));
const { build } = await import(pathToFileURL(viteRequire.resolve('esbuild')).href);
fs.mkdirSync('.checks', { recursive: true });
const suites = ['finance','catalog','global','revision','reliability','global-portfolios'];
for (const suite of suites) {
 const output = `.checks/verify-${suite}.mjs`;
 await build({ entryPoints: [`scripts/verify-${suite}.mjs`], outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
 const result = spawnSync(process.execPath, [output], { stdio: 'inherit' });
 if (result.error) throw result.error;
 if (result.status !== 0) process.exit(result.status || 1);
}
