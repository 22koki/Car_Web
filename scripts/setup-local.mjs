import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

if (!existsSync('.dev.vars')) {
  writeFileSync('.dev.vars', [
    '# Local development only. This file must never be committed.',
    'STAFF_EMAILS=seedy@sites.test',
    `PRIVATE_API_KEY=${randomBytes(32).toString('hex')}`,
    'SITE_URL=http://localhost:5173',
    '',
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  console.log('Created local development configuration with a fresh private secret.');
} else {
  console.log('Keeping your existing .dev.vars configuration.');
}

for (const script of [['scripts/run-framework.mjs', 'build'], ['scripts/migrate-local.mjs']]) {
  const result = spawnSync(process.execPath, script, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Ready. Run npm run dev, then open /admin to sign in and add your inventory.');
console.log('Portable local sign-in is a development simulation; hosted staff access is enforced by the server.');
