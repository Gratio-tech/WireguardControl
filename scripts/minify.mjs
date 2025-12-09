#!/usr/bin/env node
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');

const collectJsFiles = dir => {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const stats = fs.statSync(current);
    if (stats.isDirectory()) {
      const children = fs.readdirSync(current);
      children.forEach(child => stack.push(path.join(current, child)));
      continue;
    }
    if (current.endsWith('.js')) {
      results.push(current);
    }
  }
  return results;
};

const nodeTargets = collectJsFiles(distDir);
const targets = nodeTargets.map(file => ({ file, platform: 'node', target: ['node20'] }));

if (targets.length === 0) {
  console.log('No files to minify, skipping');
  process.exit(0);
}

await Promise.all(
  targets.map(({ file, platform, target }) =>
    build({
      entryPoints: [file],
      outfile: file,
      bundle: false,
      minify: true,
      sourcemap: false,
      platform,
      target,
      format: 'esm',
      treeShaking: true,
      legalComments: 'none',
      logLevel: 'silent',
      allowOverwrite: true
    }).catch(err => {
      console.error(`Failed to minify ${file}:`, err);
      process.exitCode = 1;
    })
  )
);

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}

console.log(`Minified ${targets.length} file(s).`);
