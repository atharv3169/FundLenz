import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Reuse the project's locked ESLint JSON Schema validator; no added dependency.
const require = createRequire(import.meta.url);
const eslintRequire = createRequire(require.resolve('eslint'));
const Ajv = eslintRequire('ajv');
const ajv = new Ajv({ allErrors: true, format: 'full', jsonPointers: true, unknownFormats: 'fail' });
const json = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const compile = path => ajv.compile(json(`automation/schemas/${path}.schema.json`));
const candidate = compile('candidate');
const issues = compile('open-issues');
const bootstrapAudit = compile('bootstrap-audit');
const dailyAudit = compile('daily-audit');
let checks = 0;
function accepts(validate, value) { checks++; assert(validate(value), JSON.stringify(validate.errors)); }
function rejects(validate, value) { checks++; assert(!validate(value), 'Invalid contract unexpectedly accepted'); }

const empty = json('automation/fixtures/empty-candidate.json');
accepts(candidate, empty);
rejects(candidate, { ...empty, approved: true });
rejects(candidate, { ...empty, base_dataset_sha256: 'unverified' });
rejects(candidate, { ...empty, completed_at: 'yesterday' });
// Fictional contract-only proposal; never written to production/audit state.
const p = {
  proposal_id: 'fixture-1', catalogue: 'india', record_id: 'fixture-fund',
  fund_id: 'fixture-fund', security_id: null, atomic_group: 'fixture-fund:nav',
  field: 'nav', task_type: 'reinvestigation', issue_id: 'fixture-issue',
  previous_candidate: 672, previous_verified: 6.72, previous_verified_snapshot: '2026-09-30',
  new_candidate: 6.82, snapshot_date: '2026-10-01',
  source_url: 'https://example.invalid/fixture', source_type: 'official_nav_feed',
  finding: 'extraction_error', confidence: 'high', reason: 'Fictional schema fixture only.',
  evidence: [{ source_url: 'https://example.invalid/fixture', source_sha256: '0'.repeat(64),
    retrieved_at: empty.completed_at, locator: 'fixture row 1', source_period: '2026-10-01',
    excerpt: 'Fictional test evidence, not an actual source.' }],
  publish_recommendation: 'candidate_for_validation',
};
const packet = proposal => ({ ...empty, proposals: [proposal] });
accepts(candidate, packet(p));
rejects(candidate, packet({ ...p, publish_recommendation: 'approved' }));
rejects(candidate, packet({ ...p, evidence: [] }));
rejects(candidate, packet({ ...p, issue_id: null }));
rejects(candidate, packet({ ...p, finding: 'unresolved' }));
rejects(candidate, packet({ ...p, source_url: 'javascript:alert(1)' }));
rejects(candidate, packet({ ...p, snapshot_date: '2026-02-30' }));
accepts(candidate, packet({ ...p, finding: 'unresolved', new_candidate: null, evidence: [] }));
accepts(issues, json('audit/open-issues.json'));
const currentAudit = json('audit/latest.json');
// The committed audit evolves from bootstrap to daily reports. Preserve the
// distinct strict schemas; do not treat one phase as the other or allow extras.
checks++; assert(['bootstrap', 'daily'].includes(currentAudit.report_kind),
  'Unknown audit report kind');
const audit = currentAudit.report_kind === 'bootstrap' ? bootstrapAudit : dailyAudit;
accepts(audit, currentAudit);
rejects(audit, { ...currentAudit, report_kind: currentAudit.report_kind === 'daily' ? 'bootstrap' : 'daily' });
rejects(audit, { ...currentAudit, unknown_field: 'reject-this-unreviewed-extra' });
rejects(issues, { ...json('audit/open-issues.json'), api_key: 'not-a-secret-fixture' });

const meta = json('public/data/site-metadata.json');
const label = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${meta.catalogueSourceCheckDate}T00:00:00Z`));
checks++; assert.equal(label, '5 October 2026', 'The existing visible label must be preserved.');
console.log(JSON.stringify({ status: 'passed', checks,
  scope: 'JSON contracts and unchanged date label; not a working source validator' }, null, 2));
