import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const publicAssets = join(root, 'public', 'assets');
const distAssets = join(dist, 'assets');
const failures = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

const normalize = (path) => path.split(sep).join('/');
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex');

const indexPath = join(dist, 'index.html');
const index = await readFile(indexPath, 'utf8').catch(() => undefined);
assert(Boolean(index), 'dist/index.html is missing.');
if (index) {
  assert(/<script[^>]+src="\/assets\/index-[^"]+\.js"/.test(index), 'Production HTML has no hashed JavaScript entry.');
  assert(/<link[^>]+href="\/assets\/index-[^"]+\.css"/.test(index), 'Production HTML has no hashed stylesheet entry.');
  assert(!/(?:localhost|127\.0\.0\.1):\d+/i.test(index), 'Production HTML contains a localhost runtime assumption.');
}

const publicFiles = await listFiles(publicAssets);
for (const sourcePath of publicFiles) {
  const relativePath = relative(publicAssets, sourcePath);
  const builtPath = join(distAssets, relativePath);
  const [source, built] = await Promise.all([
    readFile(sourcePath),
    readFile(builtPath).catch(() => undefined),
  ]);
  assert(Boolean(built), `Production asset is missing: assets/${normalize(relativePath)}`);
  if (built) assert(digest(source) === digest(built), `Production asset differs from public source: assets/${normalize(relativePath)}`);
}

const distFiles = await listFiles(dist);
const forbiddenFile = /\.(?:cs|wasm|data|unityweb|map)$/i;
const forbiddenPath = /(?:source-originals|Preston_Remake_Full_Asset_Pack|UnityLoader|\.framework\.)/i;
for (const file of distFiles) {
  const path = normalize(relative(dist, file));
  assert(!forbiddenFile.test(extname(path)) && !forbiddenPath.test(path), `Forbidden release artifact: ${path}`);
  assert((await stat(file)).size > 0, `Empty release artifact: ${path}`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`release verification: ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`release verification: ${publicFiles.length} source assets copied byte-for-byte; ${distFiles.length} production files audited`);
}
