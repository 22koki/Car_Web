import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

if (!existsSync('dist/server/wrangler.json')) throw new Error('Build the app first with npm run build.');
const base = ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB', '--local', '--config', 'dist/server/wrangler.json', '--persist-to', '.wrangler/state'];
function execute(args) {
  const result = execFileSync(process.execPath, [...base, ...args, '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  return JSON.parse(result);
}
execute(['--command', 'CREATE TABLE IF NOT EXISTS __velocity_local_migrations (name TEXT PRIMARY KEY NOT NULL, sha256 TEXT NOT NULL)']);
const result = execute(['--command', 'SELECT name, sha256 FROM __velocity_local_migrations']);
const applied = new Map(result.flatMap(entry => entry.results || []).map(row => [row.name, row.sha256]));
const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'));
for (const entry of journal.entries) {
  const filename = `drizzle/${entry.tag}.sql`;
  const source = readFileSync(filename);
  const hash = createHash('sha256').update(source).digest('hex');
  if (applied.has(entry.tag)) {
    if (applied.get(entry.tag) !== hash) throw new Error(`An applied migration changed: ${filename}. Restore it and add a new migration.`);
    continue;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(entry.tag)) throw new Error('Invalid migration name.');
  execute(['--file', filename]);
  execute(['--command', `INSERT INTO __velocity_local_migrations (name, sha256) VALUES ('${entry.tag}', '${hash}')`]);
  console.log(`Applied ${filename} to the local database.`);
}
console.log('Local database migrations are up to date. Hosted data was not changed.');
