/**
 * Sync allowlisted framework docs into `.agents/knowledge/<id>/`.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { isAllowlistedUrl } = require('./registry');
const { readProjectConfig } = require('./config');
const { colors } = require('./colors');

/**
 * @param {string} url
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<{ ok: boolean, status: number, body: string, headers: Record<string, string> }>}
 */
function defaultFetch(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'devos-sync-docs/1.0' } }, (res) => {
      // Follow one redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).href;
        if (!isAllowlistedUrl(next)) {
          resolve({ ok: false, status: res.statusCode, body: '', headers: {} });
          return;
        }
        defaultFetch(next).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const headers = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (typeof v === 'string') headers[k.toLowerCase()] = v;
        }
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode || 0,
          body,
          headers
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

/**
 * Strip obvious HTML to rough text/markdown-ish content.
 * @param {string} html
 * @param {string} url
 */
function htmlToText(html, url) {
  if (!/<html|<!doctype/i.test(html.slice(0, 500))) {
    return html;
  }
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `# Cached docs\n\nSource: ${url}\n\n${text.slice(0, 200000)}\n`;
}

/**
 * @param {string} targetDir
 * @param {{ fetchImpl?: (url: string) => Promise<{ ok: boolean, status: number, body: string, headers: Record<string, string> }>, sources?: Array<{ id: string, url: string }> }} [opts]
 */
async function syncDocs(targetDir, opts) {
  const dir = targetDir || process.cwd();
  const fetchImpl = (opts && opts.fetchImpl) || defaultFetch;
  const config = readProjectConfig(dir);
  const sources =
    (opts && opts.sources) ||
    (config && config.docsSources) ||
    [];

  if (!sources.length) {
    console.log(
      `${colors.yellow}No docsSources found. Run ${colors.bold}devos init${colors.reset}${colors.yellow} first, or pass sources.${colors.reset}`
    );
    return { ok: [], failed: [] };
  }

  const knowledgeRoot = path.join(dir, '.agents', 'knowledge');
  if (!fs.existsSync(knowledgeRoot)) {
    fs.mkdirSync(knowledgeRoot, { recursive: true });
  }

  const ok = [];
  const failed = [];

  for (const src of sources) {
    if (!src.url) {
      console.log(
        `  [${colors.yellow}SKIP${colors.reset}] ${src.id} — unresolved docs URL (Researcher must locate official docs)`
      );
      failed.push({ id: src.id, url: src.url, reason: 'unresolved' });
      continue;
    }
    if (!isAllowlistedUrl(src.url)) {
      console.log(`  [${colors.red}SKIP${colors.reset}] ${src.id || src.url} — not allowlisted`);
      failed.push({ id: src.id, url: src.url, reason: 'not-allowlisted' });
      continue;
    }

    const destDir = path.join(knowledgeRoot, src.id || 'unknown');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    try {
      const res = await fetchImpl(src.url);
      if (!res.ok) {
        console.log(`  [${colors.red}FAIL${colors.reset}] ${src.id} — HTTP ${res.status}`);
        failed.push({ id: src.id, url: src.url, reason: `http-${res.status}` });
        continue;
      }
      const body = htmlToText(res.body, src.url);
      const meta = {
        id: src.id,
        url: src.url,
        fetchedAt: new Date().toISOString(),
        etag: res.headers.etag || null,
        hash: simpleHash(body),
        status: res.status
      };
      fs.writeFileSync(path.join(destDir, 'content.md'), body, 'utf8');
      fs.writeFileSync(path.join(destDir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
      console.log(`  [${colors.green}OK${colors.reset}] ${src.id} → .agents/knowledge/${src.id}/`);
      ok.push({ id: src.id, url: src.url });
    } catch (e) {
      console.log(`  [${colors.red}FAIL${colors.reset}] ${src.id} — ${e.message}`);
      failed.push({ id: src.id, url: src.url, reason: e.message });
    }
  }

  return { ok, failed };
}

/**
 * @param {string} s
 */
function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `h${Math.abs(h)}`;
}

module.exports = {
  syncDocs,
  defaultFetch,
  htmlToText,
  isAllowlistedUrl,
  simpleHash
};
