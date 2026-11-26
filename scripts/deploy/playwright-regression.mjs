import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSecret } from './secret-env.mjs';

const stagingOrigin = 'https://staging.outlierfit.shop';

/** Builds a staging-only test environment; e.g. DB fixtures always use the private SSH tunnel on localhost:15432. */
export function buildStagingRegressionEnv(runtime, ci, inherited = process.env) {
  if (runtime.PGDATABASE !== 'outlierfit_staging') throw new Error('Regression requires the staging database');
  if (!runtime.PGUSER || !runtime.PGPASSWORD) throw new Error('Missing staging database credentials');
  if (!/^[sr]k_test_.+/.test(runtime.STRIPE_SECRET_KEY || '')) throw new Error('Staging regression requires a Stripe test-mode key');
  if (!runtime.RESEND_FROM_EMAIL) throw new Error('Missing staging email sender');
  if (!ci.GMAIL_REFRESH_TOKEN && !ci.GMAIL_ACCESS_TOKEN) throw new Error('Missing CI Gmail credentials');
  if (ci.GMAIL_REFRESH_TOKEN && (!ci.GOOGLE_CLIENT_ID || !ci.GOOGLE_CLIENT_SECRET)) throw new Error('Missing CI Gmail OAuth client');
  for (const key of ['APP_URL', 'NEXTAUTH_URL', 'CLIENT_ORIGIN', 'EMAIL_VERIFICATION_APP_URL', 'PASSWORD_RESET_APP_URL']) {
    if (key === 'APP_URL' && !runtime[key]) throw new Error('Missing staging APP_URL');
    if (runtime[key]) {
      const url = new URL(runtime[key]);
      if (url.origin !== stagingOrigin || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
        throw new Error(`Unexpected staging origin in ${key}`);
      }
    }
  }
  const database = new URL('postgresql://127.0.0.1:15432/outlierfit_staging');
  database.username = runtime.PGUSER;
  database.password = runtime.PGPASSWORD;
  // CI secrets contribute only mail settings, never an arbitrary DB, target, or Stripe live key.
  const mail = Object.fromEntries(['GMAIL_REFRESH_TOKEN', 'GMAIL_ACCESS_TOKEN', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
    .map(key => [key, ci[key] || '']));
  return {
    ...inherited, ...runtime, ...mail,
    CI: '1', PLAYWRIGHT_BASE_URL: stagingOrigin, PLAYWRIGHT_STAGING_REGRESSION: '1',
    TEST_DATABASE_URL: database.href,
    PGHOST: '127.0.0.1', PGPORT: '15432',
    RUN_MAIL_TESTS: '1', RUN_PAYMENT_TESTS: '1', RUN_MOCK_PAYMENT_TESTS: '0',
    TEST_EMAIL_BASE: ci.TEST_EMAIL_BASE || ci.TEST_SIGNUP_EMAIL || 'concamuflage@gmail.com',
    HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '', NO_PROXY: '*',
    http_proxy: '', https_proxy: '', all_proxy: '', no_proxy: '*',
  };
}

/** Runs Playwright regression using Secret Manager credentials in memory; no runtime env file is written. */
async function main() {
  const runtime = await readSecret('outlierfit-staging-env');
  const ci = await readSecret('outlierfit-ci-env');
  const child = spawn('npm', ['run', 'test:regression:staging'], {
    cwd: fileURLToPath(new URL('../../playwright-tests/', import.meta.url)),
    env: buildStagingRegressionEnv(runtime, ci), stdio: 'inherit',
  });
  /** Forwards Jenkins cancellation instead of leaving the runner active after tunnel cleanup. */
  const interrupt = () => child.kill('SIGINT');
  /** Stops the owned runner when Jenkins terminates the stage. */
  const terminate = () => child.kill('SIGTERM');
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', terminate);
  try {
    process.exitCode = await new Promise((resolveExit, reject) => {
      child.once('error', reject);
      child.once('exit', code => resolveExit(code ?? 1));
    });
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', terminate);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
