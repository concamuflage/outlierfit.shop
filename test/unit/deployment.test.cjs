const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

/** Checks private env serialization, e.g. a dollar sign remains data rather than executable shell syntax. */
test('deployment environment files are private and reject multiline entries', async () => {
  const { writeEnv } = await import('../../scripts/deploy/secret-env.mjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'outlierfit-deploy-'));
  try {
    const filename = path.join(directory, 'runtime.env');
    writeEnv(filename, { PGPORT: 5432, EXAMPLE: 'literal $value' });
    assert.equal(fs.statSync(filename).mode & 0o777, 0o600);
    assert.deepEqual(require('dotenv').parse(fs.readFileSync(filename)), { PGPORT: '5432', EXAMPLE: 'literal $value' });
    assert.throws(() => writeEnv(filename, { BAD: 'first\nsecond' }), /Invalid environment/);
    assert.throws(() => writeEnv(filename, { 'BAD-NAME': 'value' }), /Invalid environment/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

/** Rejects arbitrary secret names before any metadata/network request, e.g. another project's secret. */
test('deployment secret reader only accepts OutlierFit environment secrets', async () => {
  const { readSecret } = await import('../../scripts/deploy/secret-env.mjs');
  await assert.rejects(readSecret('unrelated-secret'), /Unexpected deployment secret/);
});

/** Validates release arguments before root-owned state can be touched, e.g. ../etc cannot become a release ID. */
test('release helper rejects traversal and unknown environments/actions', () => {
  const script = path.resolve(__dirname, '../../scripts/deploy/remote-release.sh');
  for (const args of [['production', '../etc', 'deploy'], ['unknown', 'a'.repeat(40), 'deploy'], ['staging', 'a'.repeat(40), 'shell']]) {
    assert.equal(spawnSync('bash', [script, ...args]).status, 2);
  }
});

/** Enforces the artifact's confidentiality boundary, e.g. local credentials and the discovered passport never deploy. */
test('artifact packaging excludes secrets and the sensitive public scan', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../scripts/deploy/ci.sh'), 'utf8');
  assert.ok(source.includes("--exclude='.env*'"));
  assert.ok(source.includes('--exclude=.local'));
  assert.ok(source.includes('--exclude=public/products/levis/000VT-0000/passport.png'));
  assert.doesNotMatch(source, /source \.env/);
});
