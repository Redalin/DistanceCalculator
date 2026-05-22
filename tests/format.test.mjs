import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import { transform } from 'esbuild';

const sourcePath = new URL('../src/format.ts', import.meta.url);
const outputDir = new URL('./.tmp/', import.meta.url);
const outputPath = new URL('./.tmp/format.mjs', import.meta.url);

async function loadFormatModule() {
  const source = await readFile(sourcePath, 'utf8');
  const result = await transform(source, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
    target: 'es2020',
  });

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, result.code);
  return import(`${outputPath.href}?cacheBust=${Date.now()}`);
}

test('formatKm uses metres below 1km and one decimal for kilometres', async () => {
  const { formatKm } = await loadFormatModule();

  assert.equal(formatKm(0), '0 m');
  assert.equal(formatKm(0.234), '234 m');
  assert.equal(formatKm(0.999), '999 m');
  assert.equal(formatKm(1), '1.0 km');
  assert.equal(formatKm(12.345), '12.3 km');
});

test('formatDuration rounds up to minutes and rolls over to hours', async () => {
  const { formatDuration } = await loadFormatModule();

  assert.equal(formatDuration(1), '1m');
  assert.equal(formatDuration(60), '1m');
  assert.equal(formatDuration(61), '2m');
  assert.equal(formatDuration(59 * 60), '59m');
  assert.equal(formatDuration(60 * 60), '1h');
  assert.equal(formatDuration(90 * 60), '1h 30m');
});

test('cleanup generated test module', async () => {
  await rm(outputDir, { recursive: true, force: true });
});
