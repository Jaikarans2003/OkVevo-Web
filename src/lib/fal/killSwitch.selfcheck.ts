/**
 * Kill switch script + removed admin routes.
 * Absent App Router files are Next.js 404s. Run: npx tsx src/lib/fal/killSwitch.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..', '..', '..');
const script = path.join(root, 'scripts', 'drama-kill-switch.ts');
const infra = readFileSync(path.join(root, 'scripts', 'drama-infra.sh'), 'utf8');
const billing = readFileSync(path.join(root, 'scripts', 'ops-billing-finish.sh'), 'utf8');
const cron = readFileSync(path.join(root, 'src', 'app', 'api', 'cron', 'fal-drift', 'route.ts'), 'utf8');
const scriptSrc = readFileSync(script, 'utf8');

const gone = [
  ['src', 'app', 'admin', 'drama'],
  ['src', 'app', 'admin', 'login'],
  ['src', 'app', 'api', 'admin', 'session'],
  ['src', 'app', 'api', 'admin', 'drama'],
  ['src', 'lib', 'admin', 'sessionCookie.ts'],
  ['scripts', 'admin-claim.ts'],
  ['src', 'lib', 'fal', 'adminGuard.selfcheck.ts'],
].map((parts) => path.join(root, ...parts));
for (const file of gone) {
  assert.equal(existsSync(file), false, `removed route still present: ${file}`);
}

const banned = [
  ['', 'admin', 'drama'].join('/'),
  ['', 'api', 'admin', 'session'].join('/'),
  ['', 'api', 'admin', 'drama'].join('/'),
  'SignIn' + 'Island',
  'createAdminSessionCookie',
  'readAdminSessionCookie',
];

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
    const full = path.join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|mjs|sh|md)$/.test(name)) out.push(full);
  }
}

const files: string[] = [];
walk(path.join(root, 'src'), files);
walk(path.join(root, 'scripts'), files);
const hits: string[] = [];
for (const file of files) {
  if (file.endsWith('killSwitch.selfcheck.ts')) continue;
  const text = readFileSync(file, 'utf8');
  for (const needle of banned) {
    if (text.includes(needle)) hits.push(`${path.relative(root, file)} contains ${needle}`);
  }
}
assert.deepEqual(hits, [], hits.join('\n'));

assert.ok(scriptSrc.includes('runTransaction'), 'kill switch must re-read inside a transaction');
assert.ok(scriptSrc.includes('opsAdminAudit'), 'kill switch must write an audit row');
assert.ok(scriptSrc.includes('planKillSwitch'), 'kill switch must record old -> new');
assert.ok(scriptSrc.includes('actor'), 'audit must record who');
assert.match(scriptSrc, /--on\|--off/);

function run(args: string[]) {
  return spawnSync('npx', ['tsx', script, ...args], { encoding: 'utf8', cwd: root });
}
const usage = run([]);
assert.notEqual(usage.status, 0, usage.stdout || usage.stderr);
assert.match(usage.stderr, /Usage:/);
const badProject = run(['--project', 'other', '--off']);
assert.notEqual(badProject.status, 0, 'unknown project must refuse');
const both = run(['--project', 'okvevo-testing', '--on', '--off']);
assert.notEqual(both.status, 0, 'on and off together must refuse');

assert.ok(infra.includes('jaikaran.pesce@gmail.com'), 'HIGH and heartbeat mail goes to the operator');
assert.ok(infra.includes('conditionAbsent'), 'missing heartbeat uses a metric-absence condition');
assert.ok(infra.includes('nia_ops_high'), 'HIGH log metric is created by drama-infra');
assert.ok(infra.includes('nia_fal_heartbeat'), 'heartbeat metric is created by drama-infra');
assert.ok(infra.includes('82800s'), 'heartbeat absence window is 23h');
assert.equal(infra.includes('93600s'), false, '26h is over the Cloud Monitoring cap');
assert.ok(infra.includes('23h30m'), 'script records why 26h is not used');
assert.ok(billing.includes('20 */12 * * *'), 'fal-drift runs every 12h so 23h absence does not false-alarm');
assert.equal(infra.includes('Skip if unused'), false);
assert.equal(infra.includes('printed, not created'), false);
assert.ok(cron.includes("condition: 'heartbeat'"), 'fal-drift must log a heartbeat line');
assert.ok(cron.includes('alertLogLine'), 'heartbeat log uses the structured alert line');

console.log('killSwitch.selfcheck: ok');
