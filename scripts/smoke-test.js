#!/usr/bin/env node

/**
 * Dev-OS smoke test (zero external dependencies).
 * Run with: npm test
 *
 * Verifies the shipped package end-to-end:
 *   1. `devos init` installs a working environment into a clean directory
 *   2. `devos doctor` passes there (exit 0) and fails in an empty directory (exit 1)
 *   3. Re-running init creates a .agents/_backup/<timestamp>/ backup
 *   4. Content integrity: command frontmatter points at real agents, skills are
 *      well-formed, and skill paths referenced in prose resolve on disk.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'bin', 'devos.js');

let failures = 0;
function check(label, ok, detail) {
  if (ok) {
    console.log(`[ PASS ] ${label}`);
  } else {
    failures++;
    console.error(`[ FAIL ] ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  const data = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf(':');
    if (idx > 0) data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  });
  return data;
}

// ---------------------------------------------------------------------------
// 1. init into a clean project
// ---------------------------------------------------------------------------
const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-smoke-'));
const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-empty-'));

try {
  const init = runCli(['init', '--existing', '--stack', 'universal', '--quiet'], proj);
  check('devos init exits 0', init.status === 0, (init.stderr || init.stdout || '').trim().slice(0, 300));

  check('.agents/ installed', fs.existsSync(path.join(proj, '.agents', 'AGENTS.md')));
  check('CODING_STANDARDS.md installed', fs.existsSync(path.join(proj, 'CODING_STANDARDS.md')));
  check('CLAUDE.md bootstrapped', fs.existsSync(path.join(proj, 'CLAUDE.md')));

  const agentCount = fs.existsSync(path.join(proj, '.agents', 'agents'))
    ? fs.readdirSync(path.join(proj, '.agents', 'agents')).filter((f) => f.endsWith('.md')).length
    : 0;
  check(`agent personas installed (found ${agentCount})`, agentCount >= 10);

  const claudeAgents = fs.existsSync(path.join(proj, '.claude', 'agents'))
    ? fs.readdirSync(path.join(proj, '.claude', 'agents')).filter((f) => f.endsWith('.md')).length
    : 0;
  check('.claude/agents generated, one per persona', claudeAgents === agentCount, `${claudeAgents} vs ${agentCount}`);

  const claudeCommands = fs.existsSync(path.join(proj, '.claude', 'commands'))
    ? fs.readdirSync(path.join(proj, '.claude', 'commands')).filter((f) => f.endsWith('.md')).length
    : 0;
  check(`.claude/commands generated (found ${claudeCommands})`, claudeCommands >= 9);

  const generated = path.join(proj, '.claude', 'agents');
  if (claudeAgents > 0) {
    const sample = fs.readFileSync(path.join(generated, fs.readdirSync(generated)[0]), 'utf8');
    const fm = parseFrontmatter(sample);
    check('generated subagents have name + description frontmatter', Boolean(fm && fm.name && fm.description));
  }

  // -------------------------------------------------------------------------
  // 2. doctor: passes in the project, fails in an empty directory
  // -------------------------------------------------------------------------
  const doctorOk = runCli(['doctor', '--quiet'], proj);
  check('devos doctor exits 0 in initialized project', doctorOk.status === 0, (doctorOk.stdout || '').trim().slice(-300));

  const doctorFail = runCli(['doctor', '--quiet'], empty);
  check('devos doctor exits non-zero in empty directory', doctorFail.status !== 0);

  // -------------------------------------------------------------------------
  // 3. re-init creates a backup
  // -------------------------------------------------------------------------
  const reinit = runCli(['init', '--existing', '--stack', 'universal', '--quiet'], proj);
  const backupDir = path.join(proj, '.agents', '_backup');
  const backups = fs.existsSync(backupDir) ? fs.readdirSync(backupDir) : [];
  check('re-running init backs up .agents/ to _backup/<timestamp>/', reinit.status === 0 && backups.length >= 1);
} finally {
  fs.rmSync(proj, { recursive: true, force: true });
  fs.rmSync(empty, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// 4. content integrity of the shipped sources
// ---------------------------------------------------------------------------
const agentsDir = path.join(ROOT, '.agents', 'agents');
const commandsDir = path.join(ROOT, '.agents', 'commands');
const skillsDir = path.join(ROOT, '.agents', 'skills');

const agentNames = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', ''));

fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md') && f !== 'README.md').forEach((file) => {
  const fm = parseFrontmatter(fs.readFileSync(path.join(commandsDir, file), 'utf8'));
  check(`command ${file} has valid frontmatter`, Boolean(fm && fm.name && fm.description && fm.agent));
  if (fm && fm.agent) {
    check(`command ${file} targets a real agent (${fm.agent})`, agentNames.includes(fm.agent));
  }
});

const skillDirs = fs.readdirSync(skillsDir).filter((f) => {
  if (f === '_backup') return false;
  return fs.statSync(path.join(skillsDir, f)).isDirectory();
});
const skillsMissingManifest = skillDirs.filter((d) => !fs.existsSync(path.join(skillsDir, d, 'SKILL.md')));
check(`all ${skillDirs.length} skills have a SKILL.md`, skillsMissingManifest.length === 0, skillsMissingManifest.join(', '));

// Every `.agents/skills/<name>/` path mentioned in first-party prose must exist
const proseFiles = [
  path.join(ROOT, '.agents', 'AGENTS.md'),
  path.join(ROOT, '.agents', 'README.md'),
  ...fs.readdirSync(agentsDir).map((f) => path.join(agentsDir, f)),
  ...fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md')).map((f) => path.join(commandsDir, f))
];
const badRefs = [];
proseFiles.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  const re = /\.agents\/skills\/([A-Za-z0-9._-]+)\//g;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (m[1] !== '_backup' && !skillDirs.includes(m[1])) {
      badRefs.push(`${path.relative(ROOT, file)} -> ${m[1]}`);
    }
  }
});
check('all referenced skill paths resolve on disk', badRefs.length === 0, badRefs.join('; '));

// Every stack the CLI offers must have a template (universal uses root CODING_STANDARDS.md)
['nextjs', 'laravel', 'django', 'react-native', 'express', 'fastapi'].forEach((stack) => {
  check(`stack template exists: ${stack}`, fs.existsSync(path.join(skillsDir, 'stacks', `${stack}.md`)));
});

console.log('');
if (failures > 0) {
  console.error(`[ FAIL ] Smoke test finished with ${failures} failure(s).`);
  process.exit(1);
}
console.log('[ OK ] Smoke test passed.');
