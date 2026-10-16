import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
});
// Packaging always consumes a fresh production build, never a leftover dist/.
await run('npm', ['run', 'build']);
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const output = path.join(root, 'artifacts/electron', `${pkg.version}-${stamp}`);
const staging = path.join(output, 'staging');
await fs.mkdir(staging, { recursive: true });
await fs.cp(path.join(root, 'dist'), path.join(staging, 'dist'), { recursive: true });
await fs.mkdir(path.join(staging, 'electron'));
for (const name of ['main.cjs', 'assets.cjs']) await fs.copyFile(path.join(root, 'electron', name), path.join(staging, 'electron', name));
await fs.writeFile(path.join(staging, 'package.json'), JSON.stringify({ name: pkg.name, version: pkg.version, description: pkg.description, author: 'INTUITION Robotique & Technologies', private: true, main: 'electron/main.cjs' }, null, 2));
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
const frontendFiles = {};
async function fingerprint(directory, relative = '') {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const name = path.join(relative, entry.name);
    if (entry.isDirectory()) await fingerprint(path.join(directory, entry.name), name);
    else frontendFiles[name] = createHash('sha256').update(await fs.readFile(path.join(directory, entry.name))).digest('hex');
  }
}
await fingerprint(path.join(staging, 'dist'));
await fs.writeFile(path.join(output, 'build-info.json'), JSON.stringify({ version: pkg.version, sourceCommit, sourceDirty, builtAt: new Date().toISOString(), frontendFiles }, null, 2) + '\n');
const builder = path.join(root, 'node_modules/electron-builder/out/cli/cli.js');
await run(process.execPath, [builder, '--projectDir', staging, '--config', path.join(root, 'electron-builder.cjs'), '--config.directories.output', output, '--config.electronVersion', pkg.devDependencies.electron, '--mac', '--arm64']);
console.log(`Electron artifacts: ${output}`);
