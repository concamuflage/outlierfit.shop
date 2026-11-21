import { spawn } from 'node:child_process';
import { readSecret } from './secret-env.mjs';

/** Runs signup/login with CI mail credentials and a DB tunnel, without sourcing secrets as shell code. */
async function main() {
  const [environment, domain, profile = 'auth'] = process.argv.slice(2);
  if (!['staging', 'production'].includes(environment)) throw new Error('Unexpected smoke environment');
  const runtime = await readSecret(`outlierfit-${environment}-env`);
  const ci = await readSecret('outlierfit-ci-env');
  const env = { ...process.env, ...runtime, ...ci, PGHOST: '127.0.0.1', PGPORT: '15432' };
  if (profile === 'full' && environment !== 'staging') throw new Error('Full regression is staging-only');
  const runner = profile === 'full' ? 'DeploymentRegressionRunner' : 'DeploymentAuthRunner';
  const child = spawn('mvn', ['-B', '-ntp', `-Dtest=${runner}`, '-Dheadless=true', `-DbaseUrl=https://${domain}`, 'test'], {
    cwd: 'test/ui', env, stdio: 'inherit',
  });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
