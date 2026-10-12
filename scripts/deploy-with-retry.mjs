// Repeat only the same built artifact after recognized transient transport errors.
// Never rebuild, change configuration, roll back data, or retry permanent errors.
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export function transientFailure(output) {
  return /(?:\b(?:500|502|503|504)\s+(?:Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout)\b|\b(?:ECONNRESET|ETIMEDOUT|EAI_AGAIN)\b)/i.test(output);
}

export async function deploy(run = spawnSync, wait = delay) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = run('wrangler', ['deploy', '--config', 'dist/server/wrangler.json'], {
      encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024,
      env: process.env, shell: false,
    });
    const output = (result.stdout || '') + (result.stderr || '');
    process.stdout.write(output);
    if (result.status === 0) return 0;
    if (result.error || result.signal || attempt === 3 || !transientFailure(output)) {
      console.error('Deployment failed; no further automatic attempts. Previous deployment is not intentionally changed.');
      return result.status || 1;
    }
    console.error(`Transient deployment failure; retry ${attempt}/2 with the same artifact.`);
    await wait(attempt * 15000);
  }
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await deploy();
}
