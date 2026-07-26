import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runInit } from '../lib/init.js';
import { readProjectConfig } from '../lib/config.js';
import { runDoctor } from '../lib/doctor.js';

const TEMPLATE = path.resolve(import.meta.dir, '..');

function makeTemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'devos-init-'));
}

describe('init + doctor', () => {
  let dir;

  beforeEach(() => {
    dir = makeTemp();
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'host',
        dependencies: { hono: '^4.0.0' },
        scripts: { test: 'bun test' }
      }),
      'utf8'
    );
    fs.writeFileSync(path.join(dir, 'bun.lock'), '# lock\n', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('non-interactive init writes project.json and agents', async () => {
    await runInit({
      templateDir: TEMPLATE,
      targetDir: dir,
      interactive: false,
      overrides: { isFresh: true, applyPatches: false }
    });

    expect(fs.existsSync(path.join(dir, '.agents', 'agents'))).toBe(true);
    expect(fs.existsSync(path.join(dir, '.agents', 'skills', 'stacks', 'hono.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'CODING_STANDARDS.md'))).toBe(true);

    const config = readProjectConfig(dir);
    expect(config).not.toBeNull();
    expect(config.stack).toBe('hono');
    expect(config.runtime).toBe('bun');
    expect(config.version).toBe(1);
    expect(Array.isArray(config.docsSources)).toBe(true);

    const gi = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
    expect(gi).toContain('.agents/_backup/');
    expect(gi).toContain('.agents/knowledge/');
  });

  test('doctor passes after init', async () => {
    await runInit({
      templateDir: TEMPLATE,
      targetDir: dir,
      interactive: false,
      overrides: { isFresh: true }
    });
    const result = runDoctor(dir);
    expect(result.ok).toBe(true);
    expect(result.passed).toBe(result.total);
  });

  test('opt-in patches do not overwrite existing test script', async () => {
    await runInit({
      templateDir: TEMPLATE,
      targetDir: dir,
      interactive: false,
      overrides: { isFresh: true, applyPatches: true }
    });
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    expect(pkg.scripts.test).toBe('bun test');
  });
});
