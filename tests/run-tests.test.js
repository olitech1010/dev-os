import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveTestCommand } from '../lib/run-tests.js';
import { writeProjectConfig } from '../lib/config.js';

function makeTemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'devos-run-tests-'));
}

describe('devos test command resolution', () => {
  let dir;

  beforeEach(() => {
    dir = makeTemp();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('falls back to bun test without project config', () => {
    expect(resolveTestCommand(dir)).toBe('bun test');
  });

  test('uses commands.test from project.json', () => {
    writeProjectConfig(dir, {
      platform: 'server',
      stack: 'django',
      runtime: 'python',
      depth: 'deep',
      commands: { lint: 'ruff check .', test: 'pytest' },
      libraries: [],
      docsSources: []
    });
    expect(resolveTestCommand(dir)).toBe('pytest');
  });
});
