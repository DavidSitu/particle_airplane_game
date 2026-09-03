import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceRoot = join(root, 'src');
const failures = [];

async function listTypeScript(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listTypeScript(path)));
    else if (entry.isFile() && /\.tsx?$/.test(entry.name)) files.push(path);
  }
  return files;
}

const normalize = (path) => path.split(sep).join('/');
const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g;

for (const file of await listTypeScript(sourceRoot)) {
  const source = await readFile(file, 'utf8');
  const display = normalize(relative(root, file));
  const systemMatch = display.match(/^src\/systems\/([^/]+)\//);

  if (/['"`]\/assets\//.test(source)) failures.push(`${display}: raw /assets path; use Asset Catalog.`);
  if (/UnityLoader|\.unityweb|\.wasm['"`]|\.data['"`]/i.test(source)) failures.push(`${display}: Unity runtime reference is forbidden.`);

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier) continue;

    if (systemMatch) {
      if (specifier === 'phaser' || specifier.includes('/adapters/') || specifier.includes('/presentation/') || specifier.includes('/app/')) {
        failures.push(`${display}: domain system imports forbidden dependency ${specifier}.`);
      }

      const ownSystem = systemMatch[1];
      const otherSystem = specifier.match(/systems\/([^/]+)(?:\/(.+))?/);
      if (otherSystem && otherSystem[1] !== ownSystem && otherSystem[2] && otherSystem[2] !== 'index') {
        failures.push(`${display}: imports another system's private file ${specifier}.`);
      }
    }

    if (display.startsWith('src/app/') && specifier.includes('/systems/')) {
      const tail = specifier.split('/systems/')[1] ?? '';
      if (tail.includes('/') && !tail.endsWith('/index')) failures.push(`${display}: app imports private system file ${specifier}.`);
    }

    const privateSystemImport = /\/systems\/[^/]+\/(?!index(?:\.[cm]?[jt]s)?$).+/.test(specifier);
    if (display.startsWith('src/presentation/') && (specifier.includes('/adapters/') || privateSystemImport)) {
      failures.push(`${display}: presentation bypasses a public entrypoint via ${specifier}.`);
    }
  }
}

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const packages = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
for (const forbidden of ['react', 'react-dom', '@supabase/supabase-js']) {
  if (packages[forbidden]) failures.push(`package.json: forbidden V1 dependency ${forbidden}.`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`boundary check: ${failure}`);
  process.exitCode = 1;
} else {
  console.log('boundary check: dependency direction and forbidden-runtime rules passed');
}
