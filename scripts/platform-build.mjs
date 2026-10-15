#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { delimiter, dirname } from 'node:path';

// Reproducible platform entry point; credentials stay in the caller's environment.
const platform = process.argv[2] ?? 'desktop';
const extra = process.argv.slice(3);
// rustup owns mobile targets even when a package-manager Rust is earlier on PATH.
if (platform === 'android' || platform === 'ios') {
  const rustc = spawnSync('rustup', ['which', 'rustc'], { encoding: 'utf8' });
  if (rustc.status === 0) process.env.PATH = dirname(rustc.stdout.trim()) + delimiter + process.env.PATH;
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (...args) => {
  const result = spawnSync(npm, args, { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
if (platform === 'web') run('run', 'build');
else if (platform === 'desktop') run('run', 'tauri', '--', 'build', ...extra);
else if (platform === 'android' || platform === 'ios') {
  const generated = platform === 'android' ? 'src-tauri/gen/android' : 'src-tauri/gen/apple';
  if (!existsSync(generated)) run('run', 'tauri', '--', platform, 'init', '--ci');
  run('run', 'tauri', '--', platform, 'build', ...extra);
} else {
  console.error('Usage: node scripts/platform-build.mjs web|desktop|android|ios [Tauri build flags]');
  process.exit(2);
}
