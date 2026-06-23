#!/usr/bin/env node
/**
 * @finch.app/plugins — install Finch plugins to the correct location.
 *
 * Zero npm dependencies. npm sources are fetched with `npm install --ignore-scripts`
 * so third-party install scripts never run during CLI install.
 */
import {
  existsSync, mkdirSync, readdirSync, cpSync, rmSync,
  readFileSync, writeFileSync, statSync,
} from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const LOCK_FILE = '.plugins-lock.json';

function finchHome() {
  return process.env.FINCH_HOME ?? join(homedir(), '.finch');
}
function globalPluginsDir() {
  return join(finchHome(), 'plugins');
}
function projectPluginsDir() {
  return join(process.cwd(), '.finch', 'plugins');
}
function targetDir(isGlobal) {
  return isGlobal ? globalPluginsDir() : projectPluginsDir();
}
function pluginsStatePath() {
  return join(finchHome(), 'plugins.json');
}
function lockPath(dir) {
  return join(dir, LOCK_FILE);
}
function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}
function writeJson(path, data) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}
function readLock(dir) {
  return readJson(lockPath(dir), {});
}
function writeLock(dir, lock) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(lockPath(dir), JSON.stringify(lock, null, 2) + '\n', 'utf-8');
}
function recordInstall(dir, id, source) {
  const lock = readLock(dir);
  lock[id] = { ...source, installedAt: new Date().toISOString() };
  writeLock(dir, lock);
}
function deleteRecord(dir, id) {
  const lock = readLock(dir);
  delete lock[id];
  writeLock(dir, lock);
}

function readPackageJson(dir) {
  const file = join(dir, 'package.json');
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf-8')); } catch { return null; }
}

function pluginInfo(dir) {
  const pkg = readPackageJson(dir);
  const manifest = pkg?.finch;
  if (!pkg || !manifest || typeof manifest !== 'object') return null;
  const id = String(manifest.id ?? pkg.name ?? '').trim();
  if (!id) return { error: 'package.json#finch 缺少 id' };
  const main = String(manifest.main ?? pkg.main ?? 'dist/index.js');
  if (!existsSync(join(dir, main))) return { error: `入口文件不存在: ${main}（请先构建插件）`, id };
  return {
    id,
    name: pkg.name ?? id,
    version: pkg.version ?? '0.0.0',
    displayName: typeof manifest.displayName === 'string'
      ? manifest.displayName
      : manifest.displayName?.default ?? manifest.displayName?.['en-US'] ?? manifest.displayName?.['zh-CN'] ?? id,
    main,
  };
}

function findPluginDirs(root, maxDepth = 4) {
  const found = [];
  const seen = new Set();
  function visit(dir, depth) {
    const key = dir.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const info = pluginInfo(dir);
    if (info && !info.error) found.push(dir);
    if (depth <= 0) return;
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === '.git' || e.name === '.cache') continue;
      visit(join(dir, e.name), depth - 1);
    }
  }
  visit(root, maxDepth);
  return found;
}

function installPluginDir(srcDir, destRoot, lockSource) {
  const info = pluginInfo(srcDir);
  if (!info) throw new Error(`不是 Finch 插件: ${srcDir}`);
  if (info.error) throw new Error(info.error);
  mkdirSync(destRoot, { recursive: true });
  const dest = join(destRoot, info.id);
  cpSync(srcDir, dest, { recursive: true, force: true, dereference: false });
  recordInstall(destRoot, info.id, lockSource);
  console.log(`✓ Added "${info.displayName}" (${info.id}) → ${dest}`);
  console.log('  Installed only. Open Finch → Toolcase → Plugins to review permissions and enable.');
  return info.id;
}

function npmInstallToTemp(spec, tmp) {
  mkdirSync(tmp, { recursive: true });
  const r = spawnSync('npm', ['install', '--ignore-scripts', '--omit=dev', '--prefix', tmp, spec], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
  });
  if (r.status !== 0) {
    throw new Error(`npm install failed:\n${r.stderr || r.stdout}`);
  }
}

function isLocalSource(src) {
  return src.startsWith('./') || src.startsWith('../') || src.startsWith('/') || src.startsWith('~');
}
function expandHome(path) {
  return path.replace(/^~(?=\/|$)/, homedir());
}

async function cmdAdd(src, opts) {
  const dest = targetDir(opts.global);
  if (isLocalSource(src)) {
    const abs = resolve(expandHome(src));
    if (!existsSync(abs)) throw new Error(`path not found: ${abs}`);
    const direct = pluginInfo(abs);
    if (direct && !direct.error) {
      installPluginDir(abs, dest, { type: 'local', localPath: abs });
      return;
    }
    const found = findPluginDirs(abs, 3);
    if (found.length === 0) throw new Error('No Finch plugin found in the given directory.');
    for (const dir of found) installPluginDir(dir, dest, { type: 'local', localPath: dir });
    return;
  }

  const tmp = join(tmpdir(), `finch-plugin-${randomUUID()}`);
  try {
    npmInstallToTemp(src, tmp);
    const found = findPluginDirs(join(tmp, 'node_modules'), 5);
    if (found.length === 0) throw new Error('No package with package.json#finch found in npm package.');
    // Prefer the top-level package matching the requested spec when possible.
    const first = found[0];
    installPluginDir(first, dest, { type: 'npm', package: src });
  } finally {
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

function listInstalled(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ dir: e.name, path: join(dir, e.name), info: pluginInfo(join(dir, e.name)) }))
    .filter((x) => x.info && !x.info.error);
}

function cmdList(opts) {
  const dir = targetDir(opts.global);
  const plugins = listInstalled(dir);
  if (plugins.length === 0) {
    console.log(`No plugins installed in ${dir}`);
    return;
  }
  for (const p of plugins) {
    console.log(`${p.info.id}\t${p.info.version}\t${p.info.displayName}\t${p.path}`);
  }
}

function cmdRemove(id, opts) {
  const dir = targetDir(opts.global);
  const target = join(dir, id);
  if (!existsSync(target)) throw new Error(`plugin not found: ${id}`);
  rmSync(target, { recursive: true, force: true });
  deleteRecord(dir, id);
  setEnabled(id, false);
  console.log(`✓ Removed ${id}`);
}

function normalizePluginState(raw) {
  const plugins = {};
  if (raw?.plugins && typeof raw.plugins === 'object') {
    for (const [id, record] of Object.entries(raw.plugins)) {
      if (!record || typeof record !== 'object') continue;
      plugins[id] = { ...record, enabled: record.enabled === true };
    }
  }
  if (Array.isArray(raw?.enabled)) {
    for (const id of raw.enabled) {
      if (typeof id === 'string') plugins[id] = { ...(plugins[id] ?? {}), enabled: true };
    }
  }
  return plugins;
}

function setEnabled(id, enabled) {
  const path = pluginsStatePath();
  const plugins = normalizePluginState(readJson(path, {}));
  plugins[id] = { ...(plugins[id] ?? {}), enabled };
  const enabledIds = Object.entries(plugins)
    .filter(([, record]) => record.enabled)
    .map(([pluginId]) => pluginId)
    .sort();
  writeJson(path, { enabled: enabledIds, plugins });
}

function cmdEnable(id, enabled) {
  setEnabled(id, enabled);
  console.log(`✓ ${enabled ? 'Enabled' : 'Disabled'} ${id}`);
  if (enabled) {
    console.log('  Note: CLI enable does not grant fine-grained permissions yet. Review plugin permissions in Finch when available.');
  }
}

function cmdWhere() {
  console.log(`Project: ${projectPluginsDir()}`);
  console.log(`Global:  ${globalPluginsDir()}`);
  console.log(`State:   ${pluginsStatePath()}`);
}

/** Collect JS/MJS/TS source files under a plugin dir (excludes node_modules/.git). */
function collectSourceFiles(root, maxDepth = 4) {
  const files = [];
  function visit(dir, depth) {
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === '.cache') continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (depth > 0) visit(full, depth - 1);
      } else if (/\.(mjs|cjs|js|ts)$/.test(e.name)) {
        files.push(full);
      }
    }
  }
  visit(root, maxDepth);
  return files;
}

/**
 * Static lint of a plugin's source for patterns that won't work or break the
 * sandboxing contract. Returns arrays of warning strings.
 */
function lintPluginSource(root) {
  const warnings = [];
  const files = collectSourceFiles(root);
  for (const file of files) {
    let text = '';
    try { text = readFileSync(file, 'utf-8'); } catch { continue; }
    const rel = file.slice(root.length + 1);

    // Runtime `import ... from 'finch'` fails — `finch` is a types-only module.
    if (/^\s*import\s+(?!type\b)[^;]*\bfrom\s+['"]finch['"]/m.test(text)) {
      warnings.push(`${rel}: 用了运行时 import from 'finch'；应为 \`import type * as finch from 'finch'\`（finch 仅提供类型，运行时通过 activate(ctx) 注入）。`);
    }
    // Legacy API surface that no longer exists.
    if (/\bFinchPluginAPI\b/.test(text)) {
      warnings.push(`${rel}: 引用了已移除的 FinchPluginAPI；请改用 activate(ctx) + ctx.*。`);
    }
    // Importing Electron or Finch internals breaks the host isolation boundary.
    if (/\bfrom\s+['"]electron['"]/.test(text) || /require\(\s*['"]electron['"]\s*\)/.test(text)) {
      warnings.push(`${rel}: 直接 import 'electron'；插件运行在隔离 host 中，无法访问 Electron API。`);
    }
    if (/from\s+['"][^'"]*\/src\/(main|renderer|shared)\//.test(text)) {
      warnings.push(`${rel}: 引用了 Finch 内部源码（src/main|renderer|shared）；只能通过 ctx.* 使用能力。`);
    }
  }
  return warnings;
}

function cmdDoctor(src = '.') {
  const abs = resolve(expandHome(src));
  const info = pluginInfo(abs);
  if (!info) throw new Error('Not a Finch plugin package (missing package.json#finch).');
  if (info.error) throw new Error(info.error);
  console.log(`✓ Finch plugin: ${info.displayName}`);
  console.log(`  id:      ${info.id}`);
  console.log(`  version: ${info.version}`);
  console.log(`  main:    ${info.main}`);

  const pkg = readPackageJson(abs);
  const manifest = pkg?.finch ?? {};
  // Surface recommended manifest metadata that's missing (non-fatal).
  const recommended = ['displayName', 'description', 'pluginType'];
  const missing = recommended.filter((k) => manifest[k] == null);
  if (missing.length) console.log(`  hint: manifest 建议补充字段: ${missing.join(', ')}`);
  if (manifest.permissions) {
    const p = manifest.permissions;
    const decl = [
      p.filesystem && p.filesystem !== 'none' ? `filesystem=${p.filesystem}` : null,
      p.network ? 'network' : null,
      p.shell ? 'shell' : null,
    ].filter(Boolean);
    if (decl.length) console.log(`  permissions: ${decl.join(', ')}（启用时会向用户展示）`);
  }

  const warnings = lintPluginSource(abs);
  if (warnings.length === 0) {
    console.log('✓ No issues found.');
    return;
  }
  console.log(`\n⚠ ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  - ${w}`);
}

function cmdUpdate(id, opts) {
  const dir = targetDir(opts.global);
  const target = join(dir, id);
  if (!existsSync(target)) throw new Error(`plugin not found: ${id}`);
  const source = readLock(dir)[id];
  if (!source) throw new Error(`no install record for "${id}"; reinstall it with \`add\` to enable updates.`);

  if (source.type === 'local') {
    const localPath = source.localPath ? expandHome(source.localPath) : '';
    if (!localPath || !existsSync(localPath)) {
      throw new Error(`local source no longer exists: ${source.localPath ?? '(unknown)'}`);
    }
    const info = pluginInfo(localPath);
    if (!info || info.error) throw new Error(info?.error ?? `not a Finch plugin: ${localPath}`);
    cpSync(localPath, target, { recursive: true, force: true, dereference: false });
    recordInstall(dir, id, source);
    console.log(`✓ Updated "${info.displayName}" (${id}) from local path`);
    return;
  }

  // npm source: reinstall the latest published version.
  const spec = source.package ?? id;
  const tmp = join(tmpdir(), `finch-plugin-${randomUUID()}`);
  try {
    npmInstallToTemp(spec, tmp);
    const found = findPluginDirs(join(tmp, 'node_modules'), 5).filter((d) => pluginInfo(d)?.id === id);
    const fresh = found[0] ?? findPluginDirs(join(tmp, 'node_modules'), 5)[0];
    if (!fresh) throw new Error('No matching Finch plugin found in npm package.');
    const info = pluginInfo(fresh);
    rmSync(target, { recursive: true, force: true });
    cpSync(fresh, target, { recursive: true, force: true, dereference: false });
    recordInstall(dir, id, source);
    console.log(`✓ Updated "${info.displayName}" (${id}) → v${info.version}`);
  } finally {
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

function parseArgs(argv) {
  const args = [...argv];
  const cmd = args.shift();
  const opts = { global: false };
  const rest = [];
  for (const a of args) {
    if (a === '--global' || a === '-g') opts.global = true;
    else rest.push(a);
  }
  return { cmd, rest, opts };
}

function help() {
  console.log(`@finch.app/plugins\n\nUsage:\n  finch-plugins add <npm-package|local-path> [--global]\n  finch-plugins update <id> [--global]\n  finch-plugins list [--global]\n  finch-plugins remove <id> [--global]\n  finch-plugins enable <id>\n  finch-plugins disable <id>\n  finch-plugins where\n  finch-plugins doctor [path]\n`);
}

(async () => {
  try {
    const { cmd, rest, opts } = parseArgs(process.argv.slice(2));
    if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') return help();
    if (cmd === 'add') {
      if (!rest[0]) throw new Error('missing source');
      await cmdAdd(rest[0], opts);
      return;
    }
    if (cmd === 'update' || cmd === 'up') {
      if (!rest[0]) throw new Error('missing plugin id');
      return cmdUpdate(rest[0], opts);
    }
    if (cmd === 'list' || cmd === 'ls') return cmdList(opts);
    if (cmd === 'remove' || cmd === 'rm') {
      if (!rest[0]) throw new Error('missing plugin id');
      return cmdRemove(rest[0], opts);
    }
    if (cmd === 'enable') {
      if (!rest[0]) throw new Error('missing plugin id');
      return cmdEnable(rest[0], true);
    }
    if (cmd === 'disable') {
      if (!rest[0]) throw new Error('missing plugin id');
      return cmdEnable(rest[0], false);
    }
    if (cmd === 'where') return cmdWhere();
    if (cmd === 'doctor') return cmdDoctor(rest[0] ?? '.');
    throw new Error(`unknown command: ${cmd}`);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
})();
