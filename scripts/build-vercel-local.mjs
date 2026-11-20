import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Vercel's Windows builder uses PATH; Node chooses one case-sensitive key when
// an environment object contains both PATH and Path. Keep one populated key.
export function buildEnvironment(source) {
  const result = { ...source };
  const keys = Object.keys(result).filter(key => key.toLowerCase() === 'path');
  const searchPath = result.PATH || keys.map(key => result[key]).find(Boolean);
  for (const key of keys) delete result[key];
  if (searchPath) result.PATH = searchPath;
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cli = process.argv[2];
  if (!cli) throw new Error('Usage: node scripts/build-vercel-local.mjs <path-to-vercel-vc.js> [build options]');
  const result = spawnSync(process.execPath, [cli, 'build', '--prod', ...process.argv.slice(3)], {
    env: buildEnvironment(process.env),
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
