import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveSuiteCommand } from '../lib/run-tests.js';
import { writeProjectConfig } from '../lib/config.js';

function makeTemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'devos-run-tests-'));
}

describe('devos test / qa suite resolution', () => {
  let dir;

  beforeEach(() => {
    dir = makeTemp();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('test falls back to bun test without project config', () => {
    expect(resolveSuiteCommand(dir, 'test')).toBe('bun test');
  });

  test('qa falls back to npm run lint without project config', () => {
    expect(resolveSuiteCommand(dir, 'qa')).toBe('npm run lint');
  });

  test('uses commands.test and commands.qa from project.json', () => {
    writeProjectConfig(dir, {
      platform: 'server',
      stack: 'django',
      runtime: 'python',
      depth: 'deep',
      commands: {
        lint: 'ruff check .',
        test: 'pytest',
        qa: 'ruff check . && pytest -m smoke'
      },
      libraries: [],
      docsSources: []
    });
    expect(resolveSuiteCommand(dir, 'test')).toBe('pytest');
    expect(resolveSuiteCommand(dir, 'qa')).toBe('ruff check . && pytest -m smoke');
  });
});
