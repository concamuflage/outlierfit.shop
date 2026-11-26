const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

/** Ensures production uses safe tagged Gherkin features, not the removed standalone or Java smoke runners. */
test('production promotion runs only production-safe Playwright smoke features before finalization', () => {
  const root = path.resolve(__dirname, '../..');
  const pipeline = fs.readFileSync(path.join(root, 'Jenkinsfile'), 'utf8');
  assert.ok(pipeline.indexOf('production smoke') > pipeline.indexOf('production deploy'));
  assert.ok(pipeline.indexOf('production smoke') < pipeline.indexOf('production finalize'));
  assert.doesNotMatch(pipeline, /production auth|mvn\b/);
  assert.match(pipeline, /test-results-production\/junit\.xml/);
  const ci = fs.readFileSync(path.join(root, 'scripts/deploy/ci.sh'), 'utf8');
  assert.match(ci, /run test:smoke:production/);
  assert.doesNotMatch(ci, /auth-smoke\.mjs|smoke\.cjs/);
  for (const filename of ['scripts/deploy/smoke.cjs', 'scripts/deploy/auth-smoke.mjs']) {
    assert.equal(fs.existsSync(path.join(root, filename)), false);
  }
  const config = fs.readFileSync(path.join(root, 'playwright-tests/playwright.production.config.ts'), 'utf8');
  assert.match(config, /features\/production\/\*\.feature/);
  assert.match(config, /baseURL: "https:\/\/outlierfit\.shop"/);
  assert.doesNotMatch(config, /support\/fixtures|support\/bdd|TEST_DATABASE_URL/);
  const fixtures = fs.readFileSync(path.join(root, 'playwright-tests/production/fixtures.ts'), 'utf8');
  assert.match(fixtures, /\["GET", "HEAD", "OPTIONS"\]/);
  assert.match(fixtures, /route\.abort/);
  const scripts = JSON.parse(fs.readFileSync(path.join(root, 'playwright-tests/package.json'), 'utf8')).scripts;
  assert.match(scripts['test:smoke:production'], /--config playwright\.production\.config\.ts$/);
  // Let the dedicated config require BOTH tags; a CLI --grep would override its production-safe filter.
  assert.doesNotMatch(scripts['test:smoke:production'], /--grep/);
  assert.match(config, /grep:.*@smoke.*@production-safe/);
});

/** Checks the complete staging gate environment without Secret Manager access or any browser/payment actions. */
test('Playwright regression is pinned to staging test mode and its tunneled database', async () => {
  const { buildStagingRegressionEnv } = await import('../../scripts/deploy/playwright-regression.mjs');
  const runtime = {
    APP_URL: 'https://staging.outlierfit.shop', NEXTAUTH_URL: 'https://staging.outlierfit.shop',
    PGDATABASE: 'outlierfit_staging', PGUSER: 'unit-user', PGPASSWORD: 'unit:$password@',
    STRIPE_SECRET_KEY: 'sk_test_unit', RESEND_FROM_EMAIL: 'unit@example.invalid',
  };
  const ci = { GMAIL_ACCESS_TOKEN: 'unit-token', STRIPE_SECRET_KEY: 'sk_live_ignored', TEST_DATABASE_URL: 'postgresql://wrong/database' };
  const env = buildStagingRegressionEnv(runtime, ci, { HTTPS_PROXY: 'http://wrong-proxy.invalid', PLAYWRIGHT_BASE_URL: 'https://outlierfit.shop' });
  assert.equal(env.PLAYWRIGHT_BASE_URL, 'https://staging.outlierfit.shop');
  assert.equal(env.PLAYWRIGHT_STAGING_REGRESSION, '1');
  assert.equal(env.STRIPE_SECRET_KEY, 'sk_test_unit');
  const db = new URL(env.TEST_DATABASE_URL);
  assert.equal(db.hostname, '127.0.0.1');
  assert.equal(db.port, '15432');
  assert.equal(db.pathname, '/outlierfit_staging');
  assert.equal(decodeURIComponent(db.password), runtime.PGPASSWORD);
  assert.equal(env.RUN_MAIL_TESTS, '1');
  assert.equal(env.RUN_PAYMENT_TESTS, '1');
  assert.equal(env.RUN_MOCK_PAYMENT_TESTS, '0');
  assert.equal(env.NO_PROXY, '*');
  assert.equal(env.HTTPS_PROXY, '');
  for (const [changes, message] of [
    [{ PGDATABASE: 'outlierfit_production' }, /staging database/],
    [{ STRIPE_SECRET_KEY: 'sk_live_unit' }, /test-mode key/],
    [{ APP_URL: 'https://outlierfit.shop' }, /staging origin/],
    [{ EMAIL_VERIFICATION_APP_URL: 'http://localhost:3000' }, /staging origin/],
  ]) assert.throws(() => buildStagingRegressionEnv({ ...runtime, ...changes }, ci, {}), message);
  assert.throws(() => buildStagingRegressionEnv(runtime, {}, {}), /Gmail credentials/);
});

/** Ensures regression, rather than Java/smoke, gates staging publication; production's pipeline is a separate file. */
test('staging deployment publishes artifacts only after the Playwright regression gate', () => {
  const root = path.resolve(__dirname, '../..');
  const pipeline = fs.readFileSync(path.join(root, 'Jenkinsfile.staging'), 'utf8');
  assert.match(pipeline, /ci\.sh staging regression/);
  assert.doesNotMatch(pipeline, /ci\.sh staging (smoke|auth|full)\b|mvn\b/);
  assert.ok(pipeline.indexOf('staging regression') > pipeline.indexOf('staging deploy'));
  assert.ok(pipeline.indexOf('staging regression') < pipeline.indexOf('staging publish'));
  assert.match(pipeline, /playwright-tests\/test-results\/junit\.xml/);
  assert.match(pipeline, /archiveArtifacts/);
  const scripts = JSON.parse(fs.readFileSync(path.join(root, 'playwright-tests/package.json'), 'utf8')).scripts;
  assert.match(scripts['test:regression:staging'], /PLAYWRIGHT_STAGING_REGRESSION=1/);
  assert.match(scripts['test:regression:staging'], /--workers=3/);
  assert.equal(scripts['pretest:regression:staging'], 'PLAYWRIGHT_STAGING_REGRESSION=1 bddgen');
  // Per-project filters must not be overridden by a command-wide grep-invert, which could duplicate mail scenarios.
  assert.doesNotMatch(scripts['test:regression:staging'], /--grep/);
  const config = fs.readFileSync(path.join(root, 'playwright-tests/playwright.config.ts'), 'utf8');
  assert.match(config, /name: "chromium-ui"[\s\S]*?fullyParallel: true,[\s\S]*?workers: 3/);
  for (const project of ['chromium-external', 'api', 'support']) {
    assert.match(config, new RegExp(`name: "${project}"[\\s\\S]*?workers: 1`));
  }
});

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

/** Tests actual tar exclusion behavior using fake files, e.g. a passport-named fixture is absent from the archive. */
test('tar artifact excludes private fixtures while retaining normal product assets', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'outlierfit-package-'));
  const fixture = path.join(directory, 'source');
  try {
    for (const file of ['.env.local', '.local/credential.json', '.git/config', 'public/products/levis/000VT-0000/passport.png', 'public/products/9653/1.jpg']) {
      const filename = path.join(fixture, file);
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename, 'synthetic test fixture, not real data');
    }
    const archive = path.join(directory, 'artifact.tar');
    const result = spawnSync('tar', ['--exclude=.git', '--exclude=.env*', '--exclude=.local',
      '--exclude=public/products/levis/000VT-0000/passport.png', '-cf', archive, '.'], {
      cwd: fixture, env: { ...process.env, COPYFILE_DISABLE: '1' }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const listing = spawnSync('tar', ['-tf', archive], { encoding: 'utf8' });
    assert.equal(listing.status, 0);
    assert.match(listing.stdout, /public\/products\/9653\/1\.jpg/);
    assert.doesNotMatch(listing.stdout, /passport\.png|\.env\.local|\.local\/|\.git\//);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
