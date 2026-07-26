/**
 * Shared filesystem helpers for Dev-OS CLI (zero runtime deps).
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Recursive copy; skips VCS/deps and regenerable agent caches.
 * @param {string} src
 * @param {string} dest
 */
function copyRecursiveSync(src, dest) {
  const skipNested = new Set(['.git', 'node_modules', '__pycache__', '_backup', 'knowledge']);

  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      if (skipNested.has(childItemName)) return;
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else if (exists) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

/**
 * Ensure gitignore entries exist (append only).
 * @param {string} targetDir
 * @param {string[]} entries
 */
function ensureGitignore(targetDir, entries) {
  const gitignorePath = path.join(targetDir, '.gitignore');
  let base = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const missing = entries.filter((e) => !base.includes(e));
  if (!missing.length && fs.existsSync(gitignorePath)) return;

  if (missing.length) {
    const block = `\n# Dev-OS temporary / regenerable\n${missing.join('\n')}\n`;
    base = `${base.trimEnd()}${block}`;
    fs.writeFileSync(gitignorePath, base, 'utf8');
  } else if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(
      gitignorePath,
      `# Dev-OS temporary / regenerable\n${entries.join('\n')}\n`,
      'utf8'
    );
  }
}

/**
 * Merge package.json scripts without overwriting existing keys.
 * @param {string} targetDir
 * @param {Record<string, string>} scriptsToAdd
 * @returns {{ added: string[], skipped: string[] }}
 */
function mergePackageScripts(targetDir, scriptsToAdd) {
  const pkgPath = path.join(targetDir, 'package.json');
  const added = [];
  const skipped = [];
  if (!fs.existsSync(pkgPath)) {
    return { added, skipped: Object.keys(scriptsToAdd) };
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (!pkg.scripts || typeof pkg.scripts !== 'object') pkg.scripts = {};
  for (const [key, value] of Object.entries(scriptsToAdd)) {
    if (pkg.scripts[key]) {
      skipped.push(key);
    } else {
      pkg.scripts[key] = value;
      added.push(key);
    }
  }
  if (added.length) {
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  }
  return { added, skipped };
}

module.exports = {
  copyRecursiveSync,
  ensureGitignore,
  mergePackageScripts
};
