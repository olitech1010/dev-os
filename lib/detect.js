/**
 * Host project detection: stack identity + runtime metadata.
 * Stack = framework. Runtime = bun | node | deno | python | php | dart | rust | unknown.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { getStacks, getStack, docsForLibrary } = require('./registry');

/**
 * @typedef {Object} DetectionResult
 * @property {string} stack
 * @property {string} platform
 * @property {'deep'|'thin'} depth
 * @property {string} runtime
 * @property {string[]} libraries
 * @property {{ lint: string, test: string, qa: string }} commands
 * @property {import('./registry').DocsSource[]} docsSources
 * @property {boolean} empty
 * @property {string[]} matchedStacks
 * @property {Record<string, string>} signals
 */

/**
 * @param {string} dir
 * @param {string} name
 * @returns {boolean}
 */
function exists(dir, name) {
  return fs.existsSync(path.join(dir, name));
}

/**
 * @param {string} dir
 * @returns {object|null}
 */
function readJson(dir, name) {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {string} dir
 * @returns {string|null}
 */
function readText(dir, name) {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) return null;
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

/**
 * @param {object|null} pkg
 * @returns {Set<string>}
 */
function collectDeps(pkg) {
  const set = new Set();
  if (!pkg) return set;
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const block = pkg[field];
    if (block && typeof block === 'object') {
      for (const name of Object.keys(block)) set.add(name);
    }
  }
  return set;
}

/**
 * Infer JS runtime from lockfiles / packageManager / scripts.
 * @param {string} dir
 * @param {object|null} pkg
 * @returns {string}
 */
function detectJsRuntime(dir, pkg) {
  if (exists(dir, 'bun.lock') || exists(dir, 'bun.lockb')) return 'bun';
  if (pkg && typeof pkg.packageManager === 'string' && pkg.packageManager.startsWith('bun@')) return 'bun';
  if (exists(dir, 'deno.json') || exists(dir, 'deno.jsonc')) return 'deno';
  const scripts = (pkg && pkg.scripts) || {};
  const scriptBlob = Object.values(scripts).join(' ');
  if (/\bbun\b/.test(scriptBlob)) return 'bun';
  if (/\bdeno\b/.test(scriptBlob)) return 'deno';
  if (
    exists(dir, 'package-lock.json') ||
    exists(dir, 'pnpm-lock.yaml') ||
    exists(dir, 'yarn.lock') ||
    exists(dir, 'package.json')
  ) {
    return 'node';
  }
  return 'unknown';
}

/**
 * @param {string} dir
 * @param {object|null} pkg
 * @returns {string}
 */
function detectRuntime(dir, pkg) {
  if (exists(dir, 'composer.json') || exists(dir, 'artisan')) return 'php';
  if (exists(dir, 'pubspec.yaml')) return 'dart';
  if (exists(dir, 'src-tauri/Cargo.toml') || exists(dir, 'Cargo.toml')) {
    // Prefer rust only when not clearly a JS desktop shell with node tooling
    if (!pkg) return 'rust';
  }
  if (exists(dir, 'manage.py') || exists(dir, 'pyproject.toml') || exists(dir, 'requirements.txt')) {
    if (!pkg || !exists(dir, 'package.json')) return 'python';
  }
  return detectJsRuntime(dir, pkg);
}

/**
 * @param {string} dir
 * @returns {boolean}
 */
function hasFastapiSignal(dir) {
  const pyproject = readText(dir, 'pyproject.toml');
  if (pyproject && /\bfastapi\b/i.test(pyproject)) return true;
  const req = readText(dir, 'requirements.txt');
  if (req && /\bfastapi\b/i.test(req)) return true;
  return false;
}

/**
 * @param {string} dir
 * @returns {boolean}
 */
function hasDjangoSignal(dir) {
  if (exists(dir, 'manage.py')) return true;
  const pyproject = readText(dir, 'pyproject.toml');
  if (pyproject && /\bdjango\b/i.test(pyproject)) return true;
  const req = readText(dir, 'requirements.txt');
  if (req && /\bdjango\b/i.test(req)) return true;
  return false;
}

/**
 * @param {string} dir
 * @returns {boolean}
 */
function hasLaravelSignal(dir) {
  if (exists(dir, 'artisan')) return true;
  const composer = readJson(dir, 'composer.json');
  if (!composer) return false;
  const require = { ...(composer.require || {}), ...(composer['require-dev'] || {}) };
  return Boolean(require['laravel/framework']);
}

/**
 * @param {import('./registry').StackEntry} stack
 * @param {string} dir
 * @param {Set<string>} deps
 * @returns {boolean}
 */
function matchesStack(stack, dir, deps) {
  if (stack.id === 'universal') return false;

  if (stack.id === 'fastapi') return hasFastapiSignal(dir);
  if (stack.id === 'django') return hasDjangoSignal(dir);
  if (stack.id === 'laravel') return hasLaravelSignal(dir);

  const d = stack.detect || {};
  let depOk = true;
  let fileOk = true;

  if (d.deps && d.deps.length) {
    depOk = d.deps.every((name) => deps.has(name));
  }
  if (d.anyOfDeps && d.anyOfDeps.length) {
    depOk = d.anyOfDeps.some((group) => group.every((name) => deps.has(name)));
  }
  if (d.files && d.files.length) {
    // For RN: any of the config files is enough when deps match; for others require listed files if deps empty
    if (stack.id === 'react-native') {
      const hasRnDep = deps.has('react-native') || deps.has('expo');
      const hasConfig = d.files.some((f) => exists(dir, f));
      return hasRnDep || hasConfig;
    }
    if (stack.id === 'tauri') {
      return d.files.some((f) => exists(dir, f));
    }
    fileOk = d.files.every((f) => exists(dir, f));
  }

  // Prefer dep-based match when deps are specified
  if (d.deps && d.deps.length) return depOk;
  if (d.anyOfDeps && d.anyOfDeps.length) return depOk;
  return fileOk;
}

/**
 * Pick interesting libraries from deps for project.json.
 * @param {Set<string>} deps
 * @returns {string[]}
 */
function pickLibraries(deps) {
  const interesting = [
    'hono',
    'next',
    'react',
    'vite',
    'express',
    'fastify',
    '@nestjs/core',
    'zod',
    'drizzle-orm',
    'prisma',
    '@supabase/supabase-js',
    'vue',
    'nuxt',
    'svelte',
    '@sveltejs/kit',
    'electron',
    'expo',
    'react-native',
    'typescript'
  ];
  return interesting.filter((name) => deps.has(name));
}

/**
 * Prefer host package.json scripts when present.
 * Tester → commands.test; QA → commands.qa (tracked separately).
 * @param {object|null} pkg
 * @param {{ lint?: string, test?: string, qa?: string }} hints
 * @param {string} runtime
 */
function resolveCommands(pkg, hints, runtime) {
  const scripts = (pkg && pkg.scripts) || {};
  let lint = hints.lint || 'npm run lint';
  let test = hints.test || 'npm test';
  let qa = hints.qa || hints.lint || 'npm run lint';

  if (scripts.lint) {
    lint = runtime === 'bun' ? 'bun run lint' : 'npm run lint';
  } else if (runtime === 'bun' && hints.lint && hints.lint.startsWith('npm ')) {
    lint = hints.lint.replace(/^npm /, 'bun ');
  }

  if (scripts.test) {
    if (runtime === 'bun') test = 'bun test';
    else if (scripts.test) test = 'npm test';
  } else if (runtime === 'bun') {
    test = 'bun test';
  }

  if (scripts.qa) {
    qa = runtime === 'bun' ? 'bun run qa' : 'npm run qa';
  } else if (runtime === 'bun' && qa.startsWith('npm ')) {
    qa = qa.replace(/^npm /, 'bun ');
  }

  return { lint, test, qa };
}

/**
 * Build docsSources from stack + detected libraries.
 * @param {import('./registry').StackEntry} stack
 * @param {string[]} libraries
 */
function buildDocsSources(stack, libraries) {
  const byId = new Map();
  for (const src of stack.docsSources || []) {
    byId.set(src.id, { ...src });
  }
  for (const lib of libraries) {
    const src = docsForLibrary(lib);
    if (src && !byId.has(src.id)) byId.set(src.id, src);
  }
  return Array.from(byId.values());
}

/**
 * Detect stack/runtime/libraries for a project directory.
 * @param {string} [targetDir]
 * @returns {DetectionResult}
 */
function detectProject(targetDir) {
  const dir = targetDir || process.cwd();
  const pkg = readJson(dir, 'package.json');
  const deps = collectDeps(pkg);
  const runtime = detectRuntime(dir, pkg);

  const signals = {};
  if (pkg) signals.packageJson = 'present';
  if (exists(dir, 'bun.lock') || exists(dir, 'bun.lockb')) signals.lock = 'bun';
  else if (exists(dir, 'package-lock.json')) signals.lock = 'npm';
  else if (exists(dir, 'pnpm-lock.yaml')) signals.lock = 'pnpm';
  else if (exists(dir, 'yarn.lock')) signals.lock = 'yarn';
  if (exists(dir, 'composer.json')) signals.composer = 'present';
  if (exists(dir, 'manage.py')) signals.django = 'manage.py';
  if (exists(dir, 'pubspec.yaml')) signals.flutter = 'pubspec.yaml';

  const stacks = getStacks().filter((s) => s.id !== 'universal');
  const matched = stacks
    .filter((s) => matchesStack(s, dir, deps))
    .sort((a, b) => b.priority - a.priority);

  const empty =
    !pkg &&
    !exists(dir, 'composer.json') &&
    !exists(dir, 'manage.py') &&
    !exists(dir, 'pyproject.toml') &&
    !exists(dir, 'pubspec.yaml') &&
    !exists(dir, 'Cargo.toml');

  /** @type {import('./registry').StackEntry} */
  let chosen = matched[0] || getStack('universal');

  // Avoid false fastapi/django when matched only loosely — already handled by signals

  // next.js beats react-vite when both match
  if (matched.some((m) => m.id === 'nextjs')) {
    chosen = matched.find((m) => m.id === 'nextjs');
  }
  // hono beats express when both present
  if (matched.some((m) => m.id === 'hono')) {
    chosen = matched.find((m) => m.id === 'hono');
  }

  const libraries = pickLibraries(deps);
  if (chosen.id === 'hono' && !libraries.includes('hono')) libraries.unshift('hono');

  const commands = resolveCommands(pkg, chosen.commands || {}, runtime);
  const docsSources = buildDocsSources(chosen, libraries);

  return {
    stack: chosen.id,
    platform: chosen.platform,
    depth: chosen.depth,
    runtime: chosen.platform === 'universal' && empty ? 'unknown' : runtime,
    libraries,
    commands,
    docsSources,
    empty: Boolean(empty),
    matchedStacks: matched.map((m) => m.id),
    signals
  };
}

module.exports = {
  detectProject,
  detectRuntime,
  detectJsRuntime,
  collectDeps,
  matchesStack,
  resolveCommands,
  buildDocsSources,
  pickLibraries,
  hasFastapiSignal,
  hasDjangoSignal,
  hasLaravelSignal
};
