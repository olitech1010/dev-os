import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { detectProject } from '../lib/detect.js';

function makeTemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'devos-detect-'));
}

function write(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
}

describe('detectProject', () => {
  let dir;

  beforeEach(() => {
    dir = makeTemp();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('detects empty repo as universal', () => {
    const result = detectProject(dir);
    expect(result.empty).toBe(true);
    expect(result.stack).toBe('universal');
  });

  test('detects Hono stack with Bun runtime from bun.lock', () => {
    write(
      dir,
      'package.json',
      JSON.stringify({
        name: 'api',
        dependencies: { hono: '^4.0.0', zod: '^3.0.0' },
        scripts: { test: 'bun test' }
      })
    );
    write(dir, 'bun.lock', '# bun lockfile\n');
    const result = detectProject(dir);
    expect(result.stack).toBe('hono');
    expect(result.runtime).toBe('bun');
    expect(result.libraries).toContain('hono');
    expect(result.libraries).toContain('zod');
    expect(result.platform).toBe('server');
  });

  test('detects Next.js over React+Vite', () => {
    write(
      dir,
      'package.json',
      JSON.stringify({
        dependencies: { next: '15.0.0', react: '19.0.0', vite: '6.0.0' }
      })
    );
    write(dir, 'package-lock.json', '{}');
    const result = detectProject(dir);
    expect(result.stack).toBe('nextjs');
    expect(result.runtime).toBe('node');
  });

  test('detects Laravel from artisan + composer', () => {
    write(
      dir,
      'composer.json',
      JSON.stringify({ require: { 'laravel/framework': '^12.0' } })
    );
    write(dir, 'artisan', '#!/usr/bin/env php\n');
    const result = detectProject(dir);
    expect(result.stack).toBe('laravel');
    expect(result.runtime).toBe('php');
  });

  test('detects FastAPI from requirements.txt', () => {
    write(dir, 'requirements.txt', 'fastapi==0.115.0\nuvicorn\n');
    const result = detectProject(dir);
    expect(result.stack).toBe('fastapi');
    expect(result.runtime).toBe('python');
  });

  test('prefers Hono when express also present', () => {
    write(
      dir,
      'package.json',
      JSON.stringify({ dependencies: { hono: '4.0.0', express: '4.0.0' } })
    );
    const result = detectProject(dir);
    expect(result.stack).toBe('hono');
  });
});
