import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const publicAssets = join(root, 'public', 'assets');
const sourceRuntime = join(root, 'Preston_Remake_Full_Asset_Pack_v4', 'runtime');
const manifestPath = join(publicAssets, 'asset-manifest.json');

const requiredImages = [
  'player.default',
  'enemy.01',
  'enemy.02',
  'enemy.03',
  'enemy.04',
  'projectile.default',
  'background.openingTile',
  'background.openingMirrorSupertile',
  'background.openingFixed',
  'background.gameplayTile',
  'background.gameplayMirrorSupertile',
  'background.gameplayFixed',
  'ui.knob',
];

const requiredAudio = [
  'music.opening',
  'music.gameplay',
  'sfx.shoot',
  'voice.start.leon',
  'voice.player.jimmy',
  'voice.player.zac',
];

const expectedDimensions = new Map([
  ['player.default', [914, 1268]],
  ['enemy.01', [57, 65]],
  ['enemy.02', [85, 96]],
  ['enemy.03', [95, 107]],
  ['enemy.04', [139, 178]],
  ['projectile.default', [48, 100]],
  ['background.openingTile', [168, 288]],
  ['background.openingMirrorSupertile', [336, 576]],
  ['background.openingFixed', [1080, 1920]],
  ['background.gameplayTile', [131, 169]],
  ['background.gameplayMirrorSupertile', [262, 338]],
  ['background.gameplayFixed', [1080, 1920]],
  ['ui.knob', [64, 64]],
]);

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function normalizeRelative(path) {
  return path.split(sep).join('/');
}

function safeRuntimePath(value) {
  return typeof value === 'string' && !value.startsWith('/') && !value.includes('..') && !value.includes('\\');
}

function pngDimensions(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== signature || buffer.subarray(12, 16).toString('ascii') !== 'IHDR') {
    return undefined;
  }
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function isOgg(buffer) {
  return buffer.subarray(0, 4).toString('ascii') === 'OggS';
}

function isMp3(buffer) {
  return buffer.subarray(0, 3).toString('ascii') === 'ID3' || (buffer[0] === 0xff && ((buffer[1] ?? 0) & 0xe0) === 0xe0);
}

function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
assert(manifest.schemaVersion === 1, 'Manifest schemaVersion must be 1.');
assert(manifest.basePath === '/assets', 'Manifest basePath must be /assets.');
assert(manifest.images && typeof manifest.images === 'object', 'Manifest images map is missing.');
assert(manifest.audio && typeof manifest.audio === 'object', 'Manifest audio map is missing.');

for (const key of requiredImages) assert(typeof manifest.images?.[key] === 'string', `Required image key is missing: ${key}`);
for (const key of requiredAudio) {
  const sources = manifest.audio?.[key];
  assert(Array.isArray(sources) && sources.length === 2, `Required OGG/MP3 audio pair is missing: ${key}`);
}

assert(manifest.backgroundRendering?.designAspectRatio === '9:16', 'Background design aspect ratio must be 9:16.');
assert(manifest.backgroundRendering?.opening?.wrap === 'mirror', 'Opening background must use mirror wrapping.');
assert(JSON.stringify(manifest.backgroundRendering?.opening?.originalTileRepeat) === '[10,10]', 'Opening tile repeat must be 10x10.');
assert(manifest.backgroundRendering?.gameplay?.wrap === 'mirror', 'Gameplay background must use mirror wrapping.');
assert(JSON.stringify(manifest.backgroundRendering?.gameplay?.originalTileRepeat) === '[2,2]', 'Gameplay tile repeat must be 2x2.');

const referenced = new Set(['asset-manifest.json']);
for (const [key, path] of Object.entries(manifest.images ?? {})) {
  assert(safeRuntimePath(path), `Unsafe image path for ${key}: ${path}`);
  if (!safeRuntimePath(path)) continue;
  referenced.add(path);
  const buffer = await readFile(join(publicAssets, path)).catch(() => undefined);
  assert(Boolean(buffer), `Image file is missing for ${key}: ${path}`);
  if (!buffer) continue;
  const dimensions = pngDimensions(buffer);
  assert(Boolean(dimensions), `Image is not a decodable PNG for ${key}: ${path}`);
  const expected = expectedDimensions.get(key);
  assert(!expected || JSON.stringify(dimensions) === JSON.stringify(expected), `Unexpected dimensions for ${key}: ${dimensions?.join('x')}`);
}

for (const [key, sources] of Object.entries(manifest.audio ?? {})) {
  if (!Array.isArray(sources)) continue;
  const extensions = new Set();
  for (const path of sources) {
    assert(safeRuntimePath(path), `Unsafe audio path for ${key}: ${path}`);
    if (!safeRuntimePath(path)) continue;
    referenced.add(path);
    const buffer = await readFile(join(publicAssets, path)).catch(() => undefined);
    assert(Boolean(buffer), `Audio file is missing for ${key}: ${path}`);
    if (!buffer) continue;
    const extension = extname(path).toLowerCase();
    extensions.add(extension);
    assert((extension === '.ogg' && isOgg(buffer)) || (extension === '.mp3' && isMp3(buffer)), `Audio signature does not match ${extension}: ${path}`);
  }
  assert(extensions.has('.ogg') && extensions.has('.mp3'), `Audio ${key} must provide OGG and MP3.`);
}

const shippedFiles = (await listFiles(publicAssets)).map((path) => normalizeRelative(relative(publicAssets, path))).sort();
for (const file of shippedFiles) assert(referenced.has(file), `Unregistered file ships under public/assets: ${file}`);
for (const file of referenced) assert(shippedFiles.includes(file), `Manifest references an absent shipping file: ${file}`);

for (const file of shippedFiles) {
  const shipped = await readFile(join(publicAssets, file));
  const source = await readFile(join(sourceRuntime, file)).catch(() => undefined);
  assert(Boolean(source), `Shipping file has no v4 runtime source: ${file}`);
  if (source) assert(digest(shipped) === digest(source), `Shipping copy differs from v4 runtime source: ${file}`);
}

const forbiddenPattern = /\.(?:ttf|otf|woff2?|wasm|data|unityweb|cs)$/i;
const forbiddenName = /(?:unityloader|\.framework\.|webgl\.loader)/i;
for (const directory of [join(root, 'public'), join(root, 'src')]) {
  try {
    for (const file of await listFiles(directory)) {
      const path = normalizeRelative(relative(root, file));
      assert(!forbiddenPattern.test(path) && !forbiddenName.test(path), `Forbidden production file: ${path}`);
      assert((await stat(file)).size > 0, `Empty production file: ${path}`);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`asset verification: ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`asset verification: ${requiredImages.length} image keys, ${requiredAudio.length} audio keys, ${shippedFiles.length - 1} files verified`);
}
