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

  // Multi-Harness verification
  check('Cursor rules generated (.cursor/rules/devos.mdc)', fs.existsSync(path.join(proj, '.cursor', 'rules', 'devos.mdc')));
  check('OpenCode integration generated (OPENCODE.md)', fs.existsSync(path.join(proj, 'OPENCODE.md')));
  check('OpenCode rules generated (.opencode/rules/devos-rules.md)', fs.existsSync(path.join(proj, '.opencode', 'rules', 'devos-rules.md')));
  check('Gemini integration generated (GEMINI.md)', fs.existsSync(path.join(proj, 'GEMINI.md')));
  check('Antigravity integration generated (ANTIGRAVITY.md)', fs.existsSync(path.join(proj, 'ANTIGRAVITY.md')));
  check('Codex instructions generated (.codex/instructions.md)', fs.existsSync(path.join(proj, '.codex', 'instructions.md')));

  // Runtime Hooks verification
  check('.claude/hooks.json generated', fs.existsSync(path.join(proj, '.claude', 'hooks.json')));
  const hookStart = path.join(proj, '.agents', 'hooks', 'session-start.sh');
  const hookPre = path.join(proj, '.agents', 'hooks', 'pre-tool-use.sh');
  check('runtime hooks installed', fs.existsSync(hookStart) && fs.existsSync(hookPre));

  // Shared Memory Vault & Task Board verification
  check('memory vault installed (.agents/memory/)', fs.existsSync(path.join(proj, '.agents', 'memory', 'decisions', 'ADR-000-template.md')));
  check('task board installed (docs/TASK_BOARD.md)', fs.existsSync(path.join(proj, 'docs', 'TASK_BOARD.md')));
  check('manifest tracking installed (.agents/manifest.json)', fs.existsSync(path.join(proj, '.agents', 'manifest.json')));

  // CLI Subcommands verification: pack & memory
  const packList = runCli(['pack', 'list', '--json'], proj);
  check('devos pack list exits 0', packList.status === 0, packList.stderr);

  const packAdd = runCli(['pack', 'add', 'nextjs'], proj);
  check('devos pack add exits 0', packAdd.status === 0, packAdd.stderr);

  const memList = runCli(['memory', 'list', '--json'], proj);
  check('devos memory list exits 0', memList.status === 0, memList.stderr);

  const memDoctor = runCli(['memory', 'doctor'], proj);
  check('devos memory doctor exits 0', memDoctor.status === 0, memDoctor.stderr);

  const memHandoff = runCli(['memory', 'handoff'], proj);
  check('devos memory handoff exits 0', memHandoff.status === 0, memHandoff.stderr);

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

  // -------------------------------------------------------------------------
  // 3b. devos update safely refreshes components
  // -------------------------------------------------------------------------
  const update = runCli(['update', '--quiet'], proj);
  check('devos update exits 0', update.status === 0, (update.stderr || update.stdout || '').trim().slice(0, 300));
  const claudeContent = fs.readFileSync(path.join(proj, 'CLAUDE.md'), 'utf8');
  check('CLAUDE.md contains Hard Rules digest', claudeContent.includes('Hard Rules Digest'));

  // -------------------------------------------------------------------------
  // 3c. platform targeting (--platform antigravity)
  // -------------------------------------------------------------------------
  const agyProj = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-agy-'));
  try {
    const agyInit = runCli(['init', '--existing', '--stack', 'universal', '--platform', 'antigravity', '--quiet'], agyProj);
    check('devos init --platform antigravity exits 0', agyInit.status === 0, agyInit.stderr);
    check('ANTIGRAVITY.md created for antigravity platform', fs.existsSync(path.join(agyProj, 'ANTIGRAVITY.md')));
    check('GEMINI.md created for antigravity platform', fs.existsSync(path.join(agyProj, 'GEMINI.md')));
    check('.claude/ not created when targeting only antigravity', !fs.existsSync(path.join(agyProj, '.claude')));
    const agyDoctor = runCli(['doctor', '--quiet'], agyProj);
    check('devos doctor exits 0 in antigravity-targeted project', agyDoctor.status === 0);
  } finally {
    fs.rmSync(agyProj, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // 3d. platform targeting (--platform opencode)
  // -------------------------------------------------------------------------
  const ocProj = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-oc-'));
  try {
    const ocInit = runCli(['init', '--existing', '--stack', 'universal', '--platform', 'opencode', '--quiet'], ocProj);
    check('devos init --platform opencode exits 0', ocInit.status === 0, ocInit.stderr);
    check('OPENCODE.md created for opencode platform', fs.existsSync(path.join(ocProj, 'OPENCODE.md')));
    check('.opencode/ rules created for opencode platform', fs.existsSync(path.join(ocProj, '.opencode', 'rules', 'devos-rules.md')));
    check('.claude/ not created when targeting only opencode', !fs.existsSync(path.join(ocProj, '.claude')));
    const ocDoctor = runCli(['doctor', '--quiet'], ocProj);
    check('devos doctor exits 0 in opencode-targeted project', ocDoctor.status === 0);
  } finally {
    fs.rmSync(ocProj, { recursive: true, force: true });
  }
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
