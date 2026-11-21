import fs from 'node:fs';

/** Reads one environment's Secret Manager JSON using the VM identity, never printing values. */
export async function readSecret(name) {
  if (!/^outlierfit-(staging|production|ci)-env$/.test(name)) throw new Error('Unexpected deployment secret');
  const tokenResponse = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
    headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(15000),
  });
  if (!tokenResponse.ok) throw new Error('VM service-account token unavailable');
  const token = await tokenResponse.json();
  const response = await fetch(`https://secretmanager.googleapis.com/v1/projects/outlierfit/secrets/${name}/versions/latest:access`, {
    headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Secret Manager access failed (${response.status}) for ${name}`);
  const secret = await response.json();
  return JSON.parse(Buffer.from(secret.payload.data, 'base64').toString('utf8'));
}

/** Writes a private dotenv/systemd environment file, e.g. PGPORT="5432", without shell evaluation. */
export function writeEnv(filename, values) {
  const lines = Object.entries(values).map(([key, value]) => {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || /[\r\n]/.test(String(value))) throw new Error('Invalid environment entry');
    return `${key}=${JSON.stringify(String(value))}`;
  });
  fs.writeFileSync(filename, lines.join('\n') + '\n', { mode: 0o600 });
  fs.chmodSync(filename, 0o600);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url))) {
  const [name, filename] = process.argv.slice(2);
  if (!filename) throw new Error('Usage: secret-env.mjs outlierfit-staging-env /private/file');
  writeEnv(filename, await readSecret(name));
}
