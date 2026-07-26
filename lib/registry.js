/**
 * Stack catalog for Dev-OS.
 * Stack = framework identity. Runtime is inferred separately by detect.js.
 */

'use strict';

/** @typedef {'web'|'server'|'mobile'|'desktop'|'universal'} Platform */
/** @typedef {'deep'|'thin'} Depth */

/**
 * @typedef {Object} DocsSource
 * @property {string} id
 * @property {string} url
 * @property {string} [version]
 */

/**
 * @typedef {Object} StackEntry
 * @property {string} id
 * @property {Platform} platform
 * @property {Depth} depth
 * @property {string} label
 * @property {string} standardsFile — filename under .agents/skills/stacks/
 * @property {{ deps?: string[], files?: string[], anyOfDeps?: string[][] }} detect
 * @property {DocsSource[]} docsSources
 * @property {{ lint?: string, test?: string, qa?: string }} commands
 * @property {number} priority — higher wins when multiple stacks match
 */

/** @type {StackEntry[]} */
const STACKS = [
  {
    id: 'hono',
    platform: 'server',
    depth: 'deep',
    label: 'Hono (server framework; runtime inferred)',
    standardsFile: 'hono.md',
    detect: { deps: ['hono'] },
    docsSources: [
      { id: 'hono', url: 'https://hono.dev/docs/', version: 'latest' }
    ],
    commands: { lint: 'npm run lint', test: 'npm test', qa: 'npm run lint' },
    priority: 100
  },
  {
    id: 'nextjs',
    platform: 'web',
    depth: 'deep',
    label: 'Next.js (TypeScript, App Router)',
    standardsFile: 'nextjs.md',
    detect: { deps: ['next'] },
    docsSources: [
      { id: 'nextjs', url: 'https://nextjs.org/docs', version: 'latest' }
    ],
    commands: { lint: 'npm run lint', test: 'npm test', qa: 'npm run lint' },
    priority: 90
  },
  {
    id: 'laravel',
    platform: 'server',
    depth: 'deep',
    label: 'Laravel (PHP)',
    standardsFile: 'laravel.md',
    detect: { files: ['artisan', 'composer.json'], deps: [] },
    docsSources: [
      { id: 'laravel', url: 'https://laravel.com/docs', version: 'latest' }
    ],
    commands: { lint: './vendor/bin/pint --test', test: 'php artisan test', qa: './vendor/bin/pint --test' },
    priority: 85
  },
  {
    id: 'django',
    platform: 'server',
    depth: 'deep',
    label: 'Django (Python, DRF)',
    standardsFile: 'django.md',
    detect: { files: ['manage.py'], deps: [] },
    docsSources: [
      { id: 'django', url: 'https://docs.djangoproject.com/', version: 'latest' }
    ],
    commands: { lint: 'ruff check .', test: 'pytest', qa: 'ruff check .' },
    priority: 85
  },
  {
    id: 'react-native',
    platform: 'mobile',
    depth: 'deep',
    label: 'React Native (Expo)',
    standardsFile: 'react-native.md',
    detect: {
      anyOfDeps: [['react-native'], ['expo']],
      files: ['app.json', 'app.config.js', 'app.config.ts']
    },
    docsSources: [
      { id: 'expo', url: 'https://docs.expo.dev/', version: 'latest' },
      { id: 'react-native', url: 'https://reactnative.dev/docs/getting-started', version: 'latest' }
    ],
    commands: { lint: 'npm run lint', test: 'npm test', qa: 'npm run lint' },
    priority: 80
  },
  {
    id: 'react-vite',
    platform: 'web',
    depth: 'thin',
    label: 'React + Vite',
    standardsFile: 'react-vite.md',
    detect: { deps: ['react', 'vite'] },
    docsSources: [
      { id: 'react', url: 'https://react.dev/reference/react', version: 'latest' },
      { id: 'vite', url: 'https://vite.dev/guide/', version: 'latest' }
    ],
    commands: { lint: 'npm run lint', test: 'npm test', qa: 'npm run lint' },
    priority: 50
  },
  {
    id: 'vue-nuxt',
    platform: 'web',
    depth: 'thin',
    label: 'Vue / Nuxt',
    standardsFile: 'vue-nuxt.md',
    detect: { anyOfDeps: [['nuxt'], ['vue']] },
    docsSources: [
      { id: 'nuxt', url: 'https://nuxt.com/docs', version: 'latest' },
      { id: 'vue', url: 'https://vuejs.org/guide/introduction.html', version: 'latest' }
    ],
    commands: { lint: 'npm run lint', test: 'npm test', qa: 'npm run lint' },
    priority: 55
  },
  {
    id: 'sveltekit',
    platform: 'web',
    depth: 'thin',
    label: 'Svelte / SvelteKit',
    standardsFile: 'sveltekit.md',
    detect: { anyOfDeps: [['@sveltejs/kit'], ['svelte']] },
    docsSources: [
      { id: 'sveltekit', url: 'https://svelte.dev/docs/kit', version: 'latest' }
    ],
    commands: { lint: 'npm run lint', test: 'npm test', qa: 'npm run lint' },
    priority: 55
  },
  {
    id: 'express',
    platform: 'server',
    depth: 'thin',
    label: 'Express.js',
    standardsFile: 'express.md',
    detect: { deps: ['express'] },
    docsSources: [
      { id: 'express', url: 'https://expressjs.com/en/4x/api.html', version: 'latest' }
    ],
    commands: { lint: 'npm run lint', test: 'npm test', qa: 'npm run lint' },
    priority: 40
  },
  {
    id: 'fastify',
    platform: 'server',
    depth: 'thin',
    label: 'Fastify',
    standardsFile: 'fastify.md',
    detect: { deps: ['fastify'] },
    docsSources: [
      { id: 'fastify', url: 'https://fastify.dev/docs/latest/', version: 'latest' }
    ],
    commands: { lint: 'npm run lint', test: 'npm test', qa: 'npm run lint' },
    priority: 45
  },
  {
    id: 'nestjs',
    platform: 'server',
    depth: 'thin',
    label: 'NestJS',
    standardsFile: 'nestjs.md',
    detect: { deps: ['@nestjs/core'] },
    docsSources: [
      { id: 'nestjs', url: 'https://docs.nestjs.com/', version: 'latest' }
    ],
    commands: { lint: 'npm run lint', test: 'npm test', qa: 'npm run lint' },
    priority: 60
  },
  {
    id: 'fastapi',
    platform: 'server',
    depth: 'thin',
    label: 'FastAPI',
    standardsFile: 'fastapi.md',
    detect: { files: ['pyproject.toml', 'requirements.txt'] },
    docsSources: [
      { id: 'fastapi', url: 'https://fastapi.tiangolo.com/', version: 'latest' }
    ],
    commands: { lint: 'ruff check .', test: 'pytest', qa: 'ruff check .' },
    priority: 30
  },
  {
    id: 'flutter',
    platform: 'mobile',
    depth: 'thin',
    label: 'Flutter',
    standardsFile: 'flutter.md',
    detect: { files: ['pubspec.yaml'] },
    docsSources: [
      { id: 'flutter', url: 'https://docs.flutter.dev/', version: 'latest' }
    ],
    commands: { lint: 'dart analyze', test: 'flutter test', qa: 'dart analyze' },
    priority: 70
  },
  {
    id: 'electron',
    platform: 'desktop',
    depth: 'thin',
    label: 'Electron',
    standardsFile: 'electron.md',
    detect: { deps: ['electron'] },
    docsSources: [
      { id: 'electron', url: 'https://www.electronjs.org/docs/latest/', version: 'latest' }
    ],
    commands: { lint: 'npm run lint', test: 'npm test', qa: 'npm run lint' },
    priority: 65
  },
  {
    id: 'tauri',
    platform: 'desktop',
    depth: 'thin',
    label: 'Tauri',
    standardsFile: 'tauri.md',
    detect: { files: ['src-tauri/Cargo.toml', 'src-tauri/tauri.conf.json'] },
    docsSources: [
      { id: 'tauri', url: 'https://v2.tauri.app/', version: 'latest' }
    ],
    commands: { lint: 'npm run lint', test: 'npm test', qa: 'npm run lint' },
    priority: 65
  },
  {
    id: 'universal',
    platform: 'universal',
    depth: 'thin',
    label: 'Universal / Standard Template',
    standardsFile: null,
    detect: { deps: [], files: [] },
    docsSources: [],
    commands: { lint: 'npm run lint', test: 'npm test', qa: 'npm run lint' },
    priority: 0
  }
];

/**
 * Known npm package → official docs URL (for custom / detected libraries).
 * @type {Record<string, string>}
 */
const LIBRARY_DOCS = {
  hono: 'https://hono.dev/docs/',
  next: 'https://nextjs.org/docs',
  react: 'https://react.dev/reference/react',
  vite: 'https://vite.dev/guide/',
  express: 'https://expressjs.com/en/4x/api.html',
  fastify: 'https://fastify.dev/docs/latest/',
  '@nestjs/core': 'https://docs.nestjs.com/',
  zod: 'https://zod.dev/',
  'drizzle-orm': 'https://orm.drizzle.team/docs/overview',
  prisma: 'https://www.prisma.io/docs',
  '@supabase/supabase-js': 'https://supabase.com/docs',
  vue: 'https://vuejs.org/guide/introduction.html',
  nuxt: 'https://nuxt.com/docs',
  svelte: 'https://svelte.dev/docs',
  '@sveltejs/kit': 'https://svelte.dev/docs/kit',
  electron: 'https://www.electronjs.org/docs/latest/',
  expo: 'https://docs.expo.dev/',
  'react-native': 'https://reactnative.dev/docs/getting-started'
};

function getStacks() {
  return STACKS.slice();
}

/**
 * @param {string} id
 * @returns {StackEntry|undefined}
 */
function getStack(id) {
  return STACKS.find((s) => s.id === id);
}

/**
 * @param {string} packageName
 * @returns {DocsSource|null}
 */
function docsForLibrary(packageName) {
  const url = LIBRARY_DOCS[packageName];
  if (!url) return null;
  return { id: packageName.replace(/[^a-zA-Z0-9._-]/g, '_'), url, version: 'latest' };
}

/**
 * Allowlisted URL prefixes for sync-docs (official docs only).
 * @returns {string[]}
 */
function getAllowlistedDocPrefixes() {
  const prefixes = new Set();
  for (const stack of STACKS) {
    for (const src of stack.docsSources) {
      try {
        const u = new URL(src.url);
        prefixes.add(`${u.origin}/`);
      } catch {
        /* ignore invalid */
      }
    }
  }
  for (const url of Object.values(LIBRARY_DOCS)) {
    try {
      const u = new URL(url);
      prefixes.add(`${u.origin}/`);
    } catch {
      /* ignore */
    }
  }
  return Array.from(prefixes);
}

/**
 * @param {string} url
 * @returns {boolean}
 */
function isAllowlistedUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  return getAllowlistedDocPrefixes().some((prefix) => url.startsWith(prefix) || parsed.href.startsWith(prefix));
}

module.exports = {
  STACKS,
  LIBRARY_DOCS,
  getStacks,
  getStack,
  docsForLibrary,
  getAllowlistedDocPrefixes,
  isAllowlistedUrl
};
