import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { syncDocs, isAllowlistedUrl } from '../lib/sync-docs.js';
import { writeProjectConfig } from '../lib/config.js';

function makeTemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'devos-sync-'));
}

describe('sync-docs', () => {
  let dir;

  beforeEach(() => {
    dir = makeTemp();
    fs.mkdirSync(path.join(dir, '.agents'), { recursive: true });
    writeProjectConfig(dir, {
      platform: 'server',
      stack: 'hono',
      runtime: 'bun',
      libraries: ['hono'],
      depth: 'deep',
      commands: { lint: 'npm run lint', test: 'bun test' },
      docsSources: [
        { id: 'hono', url: 'https://hono.dev/docs/', version: 'latest' },
        { id: 'evil', url: 'https://evil.example/steal', version: 'latest' }
      ]
    });
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('rejects non-allowlisted URLs', () => {
    expect(isAllowlistedUrl('https://evil.example/steal')).toBe(false);
  });

  test('caches allowlisted docs via mocked fetch', async () => {
    const fetchImpl = async (url) => {
      if (url.startsWith('https://hono.dev/')) {
        return {
          ok: true,
          status: 200,
          body: '<html><body><h1>Hono Docs</h1><p>Hello</p></body></html>',
          headers: { etag: '"abc"' }
        };
      }
      return { ok: false, status: 404, body: '', headers: {} };
    };

    const result = await syncDocs(dir, { fetchImpl });
    expect(result.ok.some((x) => x.id === 'hono')).toBe(true);
    expect(result.failed.some((x) => x.id === 'evil')).toBe(true);

    const content = fs.readFileSync(path.join(dir, '.agents', 'knowledge', 'hono', 'content.md'), 'utf8');
    expect(content).toContain('Hono Docs');
    const meta = JSON.parse(
      fs.readFileSync(path.join(dir, '.agents', 'knowledge', 'hono', 'meta.json'), 'utf8')
    );
    expect(meta.url).toBe('https://hono.dev/docs/');
    expect(meta.etag).toBe('"abc"');
  });
});
