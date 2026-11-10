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
 *
 * Isolation and speed:
 *   - Every CLI spawn runs with DEVOS_OFFLINE=1 (no npx/gh/curl/brew) and a hard
 *     timeout, so a hang fails loudly instead of stalling the suite.
 *   - Eval scorecards go to a temp dir via DEVOS_EVAL_REPORTS_DIR, so the tracked
 *     .agents/evals/reports/latest-scorecard.json is only refreshed by `npm run eval`.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'bin', 'devos.js');
const SUITE_START = Date.now();

const CLI_TIMEOUT_MS = 60000;
const HOOK_TIMEOUT_MS = 15000;
const SLOW_CLI_MS = 5000;

// Scratch area for eval scorecards and test doubles; removed at the end.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-smoke-scratch-'));
const evalReportsDir = path.join(scratch, 'eval-reports');

// Base env for every child: offline, eval reports redirected, and no inherited
// approval tokens that would silently disable the gates under test.
const BASE_ENV = { ...process.env, DEVOS_OFFLINE: '1', DEVOS_EVAL_REPORTS_DIR: evalReportsDir };
['DEVOS_COMMIT_APPROVED', 'DEVOS_DESTRUCTIVE_APPROVED', 'DEVOS_SOLO_APPROVED', 'DEVOS_STOP_GATE',
  'DEVOS_ENFORCE_ORCHESTRATOR', 'DEVOS_ENFORCE_TASK_BOARD'].forEach((k) => { delete BASE_ENV[k]; });

let failures = 0;
function check(label, ok, detail) {
  if (ok) {
    console.log(`[ PASS ] ${label}`);
  } else {
    failures++;
    console.error(`[ FAIL ] ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function runCli(args, cwd, opts = {}) {
  const started = Date.now();
  const res = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: CLI_TIMEOUT_MS,
    ...(opts.stdio ? { stdio: opts.stdio } : { input: opts.input !== undefined ? opts.input : '' }),
    env: { ...BASE_ENV, ...(opts.env || {}) }
  });
  const ms = Date.now() - started;
  if (res.error && res.error.code === 'ETIMEDOUT') {
    check(`devos ${args.join(' ')} finished within ${CLI_TIMEOUT_MS / 1000}s`, false, 'timed out (hang?)');
  } else if (ms > SLOW_CLI_MS) {
    console.log(`[ WARN ] slow CLI call (${ms}ms): devos ${args.join(' ')}`);
  }
  return res;
}

// Run a hook script. `input` is the stdin payload (hook JSON); `args` are the
// positional back-compat/test-mode arguments.
function runHook(script, { args = [], input = '', cwd, env = {} } = {}) {
  const res = spawnSync('bash', [script, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: HOOK_TIMEOUT_MS,
    input,
    env: { ...BASE_ENV, ...env }
  });
  if (res.error && res.error.code === 'ETIMEDOUT') {
    check(`hook ${path.basename(script)} finished within ${HOOK_TIMEOUT_MS / 1000}s`, false, 'timed out (hang?)');
  }
  return res;
}

// Claude Code only blocks a tool call on exit 2; the reason must be on stderr.
function isBlocked(res, needle) {
  const stderr = res.stderr || '';
  return res.status === 2 && stderr.trim().length > 0 && (!needle || stderr.includes(needle));
}

function hookDetail(res) {
  return `exit=${res.status} stderr=${(res.stderr || '').trim().slice(0, 160)} stdout=${(res.stdout || '').trim().slice(0, 160)}`;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}

// Number of hook entries for an event whose command runs one of the seven Dev-OS hook scripts.
const DEVOS_HOOK_RE = /\.agents\/hooks\/(session-start|user-prompt-submit|pre-tool-use|post-tool-use|stop|subagent-stop|session-end|pre-compact|post-compact|subagent-start|task-completed|instructions-loaded)\.sh/;
function devosHookEntries(settings, event) {
  const list = settings && settings.hooks && Array.isArray(settings.hooks[event]) ? settings.hooks[event] : [];
  return list.filter((entry) => Array.isArray(entry.hooks) && entry.hooks.some((h) => typeof h.command === 'string' && DEVOS_HOOK_RE.test(h.command)));
}

// A user hook that lives in .agents/hooks/ but is not a Dev-OS script
const USER_HOOK_CMD = '"$CLAUDE_PROJECT_DIR"/.agents/hooks/my-audit.sh';
function userHookPreserved(settings) {
  const list = settings && settings.hooks && Array.isArray(settings.hooks.PostToolUse) ? settings.hooks.PostToolUse : [];
  return list.some((g) => Array.isArray(g.hooks) && g.hooks.some((h) => h.command === USER_HOOK_CMD));
}

function denyList(settings) {
  return settings && settings.permissions && Array.isArray(settings.permissions.deny) ? settings.permissions.deny : [];
}

// Asserts the C1 contract on .claude/settings.json and that user keys survived.
function checkSettings(settingsPath, stage) {
  const settings = readJson(settingsPath);
  check(`[${stage}] .claude/settings.json exists and is valid JSON`, Boolean(settings));
  if (!settings) return;
  const pre = devosHookEntries(settings, 'PreToolUse');
  check(`[${stage}] exactly one Dev-OS PreToolUse entry`, pre.length === 1, `found ${pre.length}`);
  const preEntry = pre[0] || {};
  check(`[${stage}] PreToolUse matcher covers Bash and Edit`, typeof preEntry.matcher === 'string' && preEntry.matcher.includes('Bash') && preEntry.matcher.includes('Edit'), String(preEntry.matcher));
  check(`[${stage}] PreToolUse runs .agents/hooks/pre-tool-use.sh as type "command"`,
    Array.isArray(preEntry.hooks) && preEntry.hooks.some((h) => h.type === 'command' && String(h.command).includes('.agents/hooks/pre-tool-use.sh')));
  ['Stop', 'SessionStart', 'PostToolUse', 'SubagentStop', 'PreCompact', 'PostCompact', 'SubagentStart', 'TaskCompleted', 'InstructionsLoaded'].forEach((ev) => {
    const n = devosHookEntries(settings, ev).length;
    check(`[${stage}] exactly one Dev-OS ${ev} hook entry`, n === 1, `found ${n}`);
  });
  const post = devosHookEntries(settings, 'PostToolUse')[0] || {};
  check(`[${stage}] PostToolUse matcher is Edit|Write|MultiEdit and runs post-tool-use.sh`, post.matcher === 'Edit|Write|MultiEdit' &&
    Array.isArray(post.hooks) && post.hooks.some((h) => h.type === 'command' && h.command === '"$CLAUDE_PROJECT_DIR"/.agents/hooks/post-tool-use.sh'), JSON.stringify(post));
  const subStop = devosHookEntries(settings, 'SubagentStop')[0] || {};
  check(`[${stage}] SubagentStop runs subagent-stop.sh with no matcher`, subStop.matcher === undefined &&
    Array.isArray(subStop.hooks) && subStop.hooks.some((h) => h.command === '"$CLAUDE_PROJECT_DIR"/.agents/hooks/subagent-stop.sh'), JSON.stringify(subStop));
  const sessStart = devosHookEntries(settings, 'SessionStart')[0] || {};
  check(`[${stage}] SessionStart has no matcher (fires on compact too, so it is wired once)`, sessStart.matcher === undefined, JSON.stringify(sessStart));
  // W3: the four added events are wired once each, with no matcher, so PreCompact/PostCompact
  // cover both 'manual' and 'auto', SubagentStart covers every agent type, and
  // InstructionsLoaded covers every load_reason. TaskCompleted supports no matcher at all.
  [['PreCompact', 'pre-compact.sh'], ['PostCompact', 'post-compact.sh'], ['SubagentStart', 'subagent-start.sh'],
    ['TaskCompleted', 'task-completed.sh'], ['InstructionsLoaded', 'instructions-loaded.sh']].forEach(([ev, script]) => {
    const entry = devosHookEntries(settings, ev)[0] || {};
    check(`[${stage}] ${ev} runs ${script} with no matcher`, entry.matcher === undefined &&
      Array.isArray(entry.hooks) && entry.hooks.some((h) => h.type === 'command' && h.command === `"$CLAUDE_PROJECT_DIR"/.agents/hooks/${script}`), JSON.stringify(entry));
  });
  const deny = denyList(settings);
  const commitRules = deny.filter((r) => /^Bash\(git commit/.test(r));
  check(`[${stage}] permissions.deny has one raw git commit rule`, commitRules.length === 1, JSON.stringify(deny));
  check(`[${stage}] permissions.deny has no duplicates`, new Set(deny).size === deny.length, JSON.stringify(deny));
  const ask = settings.permissions && Array.isArray(settings.permissions.ask) ? settings.permissions.ask : [];
  check(`[${stage}] permissions.ask has the commit.sh approval rule exactly once`,
    ask.filter((r) => r === 'Bash(.agents/scripts/commit.sh *)').length === 1, JSON.stringify(ask));
  check(`[${stage}] permissions.ask has the git push approval rule exactly once`,
    ask.filter((r) => r === 'Bash(git push *)').length === 1, JSON.stringify(ask));
  check(`[${stage}] pre-existing user key "model" preserved`, settings.model === 'x');
  check(`[${stage}] pre-existing user deny rule preserved`, deny.includes('Read(./secret)'));
  check(`[${stage}] user hook .agents/hooks/my-audit.sh preserved`, userHookPreserved(settings), JSON.stringify(settings.hooks && settings.hooks.PostToolUse));
}

function mdFiles(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md') : [];
}

function findFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) findFiles(full, predicate, out);
    else if (predicate(full)) out.push(full);
  }
  return out;
}

const sha256 = (buf) => require('crypto').createHash('sha256').update(buf).digest('hex');
const PACKS = readJson(path.join(ROOT, '.agents', 'packs.json')) || { packs: {} };
const ALIASES = PACKS.aliases && typeof PACKS.aliases === 'object' ? PACKS.aliases : {};
const DEFAULT_AGENTS = mdFiles(path.join(ROOT, '.agents', 'agents')).map((f) => f.replace(/\.md$/, ''));
const MAINTAINER_AGENTS = mdFiles(path.join(ROOT, '.agents', 'maintainer', 'agents')).map((f) => f.replace(/\.md$/, ''));
const MAINTAINER_COMMANDS = mdFiles(path.join(ROOT, '.agents', 'maintainer', 'commands')).map((f) => f.replace(/\.md$/, ''));
// AGENT_DESCRIPTIONS.sre in the v4.5.0 CLI (its generator wrote it into .claude/agents/sre.md)
const SRE_45_DESCRIPTION = 'Dev-OS reliability engineer. Designs infrastructure-as-code (Terraform), observability pipelines, and disaster recovery runbooks.';
const SOURCE_SKILL_DIRS = fs.readdirSync(path.join(ROOT, '.agents', 'skills')).filter((f) => f !== '_backup' && fs.statSync(path.join(ROOT, '.agents', 'skills', f)).isDirectory());

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
  // A user-owned settings.json must survive init/update (C1 merge contract).
  const settingsPath = path.join(proj, '.claude', 'settings.json');
  fs.mkdirSync(path.join(proj, '.claude'), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify({
    model: 'x',
    permissions: { deny: ['Read(./secret)'] },
    hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: USER_HOOK_CMD }] }] }
  }, null, 2) + '\n', 'utf8');

  const init = runCli(['init', '--existing', '--stack', 'universal', '--quiet'], proj);
  check('devos init exits 0', init.status === 0, (init.stderr || init.stdout || '').trim().slice(0, 300));

  check('.agents/ installed', fs.existsSync(path.join(proj, '.agents', 'AGENTS.md')));
  check('CODING_STANDARDS.md installed', fs.existsSync(path.join(proj, 'CODING_STANDARDS.md')));
  check('CLAUDE.md bootstrapped', fs.existsSync(path.join(proj, 'CLAUDE.md')));

  const agentCount = fs.existsSync(path.join(proj, '.agents', 'agents'))
    ? fs.readdirSync(path.join(proj, '.agents', 'agents')).filter((f) => f.endsWith('.md')).length
    : 0;
  check(`default install has the 13-agent roster (found ${agentCount})`, agentCount === 13 && DEFAULT_AGENTS.length === 13, `source has ${DEFAULT_AGENTS.length}`);
  check('default install has no maintainer agents', MAINTAINER_AGENTS.every((a) => !fs.existsSync(path.join(proj, '.agents', 'agents', `${a}.md`)) && !fs.existsSync(path.join(proj, '.claude', 'agents', `${a}.md`))));
  check('default install has no maintainer commands', MAINTAINER_COMMANDS.length > 0 && MAINTAINER_COMMANDS.every((c) => !fs.existsSync(path.join(proj, '.agents', 'commands', `${c}.md`)) && !fs.existsSync(path.join(proj, '.claude', 'commands', `${c}.md`))), `maintainer commands: ${MAINTAINER_COMMANDS.join(', ') || 'none'}`);
  check('init does not copy the source repo manifest or latest-scorecard',
    !fs.existsSync(path.join(proj, '.agents', 'evals', 'reports', 'latest-scorecard.json')) &&
    (readJson(path.join(proj, '.agents', 'manifest.json')) || {}).generatedFiles !== undefined);
  check('.gitignore ignores .agents/bin/ (local gitleaks binary)', fs.existsSync(path.join(proj, '.gitignore')) && fs.readFileSync(path.join(proj, '.gitignore'), 'utf8').split(/\r?\n/).includes('.agents/bin/'));
  const claudeMdInit = fs.existsSync(path.join(proj, 'CLAUDE.md')) ? fs.readFileSync(path.join(proj, 'CLAUDE.md'), 'utf8') : '';
  check('rules digest carries Design Gate [R15], Humanizer [R16], Task Board [R23]', ['[R15] Mandatory Design Gate', '[R16] Humanizer Gate', '[R23] Task Board'].every((t) => claudeMdInit.includes(t)));

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

  // C3: tool allowlists pass through, and the source frontmatter is not duplicated into the body
  const qaGenerated = path.join(generated, 'qa.md');
  const qaContent = fs.existsSync(qaGenerated) ? fs.readFileSync(qaGenerated, 'utf8') : '';
  const qaFm = parseFrontmatter(qaContent);
  check('.claude/agents/qa.md has a tools: frontmatter line', Boolean(qaFm && qaFm.tools), qaFm ? JSON.stringify(qaFm) : 'no frontmatter');
  const qaBody = qaContent.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  check('.claude/agents/qa.md body does not start with a second frontmatter block', qaContent.length > 0 && !qaBody.trimStart().startsWith('---'));

  // Multi-Harness verification
  check('Cursor rules generated (.cursor/rules/devos.mdc)', fs.existsSync(path.join(proj, '.cursor', 'rules', 'devos.mdc')));
  check('Gemini integration generated (GEMINI.md)', fs.existsSync(path.join(proj, 'GEMINI.md')));
  check('Antigravity integration generated (ANTIGRAVITY.md)', fs.existsSync(path.join(proj, 'ANTIGRAVITY.md')));

  // W3: root AGENTS.md is the canonical cross-harness file; the others are thin pointers
  const rootAgentsMd = path.join(proj, 'AGENTS.md');
  const rootAgentsText = fs.existsSync(rootAgentsMd) ? fs.readFileSync(rootAgentsMd, 'utf8') : '';
  check('[W3] root AGENTS.md has a Dev-OS managed block', rootAgentsText.includes('<!-- BEGIN DEV-OS -->') && rootAgentsText.includes('<!-- END DEV-OS -->'));
  check('[W3] root AGENTS.md carries the digest, roster pointer, and spec pointer', ['[R1] Zero Destructive', '[R22]', '`.agents/AGENTS.md`', 'devos spec check'].every((t) => rootAgentsText.includes(t)));
  check(`[W3] root AGENTS.md stays well under Codex's 32 KiB limit (${Buffer.byteLength(rootAgentsText)} bytes)`, Buffer.byteLength(rootAgentsText) > 0 && Buffer.byteLength(rootAgentsText) < 16 * 1024);
  const claudeMdW3 = fs.readFileSync(path.join(proj, 'CLAUDE.md'), 'utf8');
  check('[W3] CLAUDE.md imports AGENTS.md (@AGENTS.md on its own line)', claudeMdW3.split(/\r?\n/).includes('@AGENTS.md'));
  check('[W3] CLAUDE.md is a thin pointer (no duplicated protocol sections)', !claudeMdW3.includes('Solo Session Protocol') && claudeMdW3.length < 6000, `${claudeMdW3.length} chars`);
  check('[W5] R22 digest line says a spec tasks.md counts as the plan', claudeMdW3.includes('docs/specs/<slug>/tasks.md') && rootAgentsText.includes('docs/specs/<slug>/tasks.md'));
  check('[W3] GEMINI.md imports AGENTS.md (@./AGENTS.md)', fs.readFileSync(path.join(proj, 'GEMINI.md'), 'utf8').split(/\r?\n/).includes('@./AGENTS.md'));
  const ocCfg = readJson(path.join(proj, 'opencode.json'));
  check('[W3] project-root opencode.json has $schema and an instructions array', Boolean(ocCfg && ocCfg.$schema === 'https://opencode.ai/config.json' && Array.isArray(ocCfg.instructions) && ocCfg.instructions.includes('.agents/AGENTS.md')), JSON.stringify(ocCfg));
  check('[W3] opencode.json has only keys in OpenCode\'s strict schema', Boolean(ocCfg) && Object.keys(ocCfg).every((k) => ['$schema', 'instructions'].includes(k)), JSON.stringify(ocCfg));
  check('[W3] OPENCODE.md, .opencode/opencode.json, .opencode/rules/devos-rules.md no longer written',
    !fs.existsSync(path.join(proj, 'OPENCODE.md')) && !fs.existsSync(path.join(proj, '.opencode', 'opencode.json')) && !fs.existsSync(path.join(proj, '.opencode', 'rules', 'devos-rules.md')));
  check('[W3] .codex/instructions.md no longer written (Codex reads AGENTS.md); .windsurfrules kept',
    !fs.existsSync(path.join(proj, '.codex', 'instructions.md')) && fs.existsSync(path.join(proj, '.windsurfrules')));
  const mdcText = fs.readFileSync(path.join(proj, '.cursor', 'rules', 'devos.mdc'), 'utf8');
  const mdcFm = (mdcText.match(/^---\n([\s\S]*?)\n---\n/) || [])[1] || '';
  check('[W3] devos.mdc frontmatter: alwaysApply true, no globs, description present', /^alwaysApply: true$/m.test(mdcFm) && !/^globs:/m.test(mdcFm) && /^description: \S/m.test(mdcFm), mdcFm);
  const installedSkillDirs = fs.readdirSync(path.join(proj, '.agents', 'skills')).filter((f) => f !== '_backup' && fs.statSync(path.join(proj, '.agents', 'skills', f)).isDirectory());
  const badLinks = installedSkillDirs.filter((n) => {
    const p = path.join(proj, '.claude', 'skills', n);
    try {
      return !(fs.lstatSync(p).isSymbolicLink() && fs.readlinkSync(p) === `../../.agents/skills/${n}` && fs.existsSync(path.join(p, 'SKILL.md')));
    } catch (e) { return true; }
  });
  check(`[W3] every installed skill is linked at .claude/skills/<name> -> ../../.agents/skills/<name> (${installedSkillDirs.length})`, installedSkillDirs.length > 0 && badLinks.length === 0, badLinks.join(', '));

  // Runtime Hooks verification (C1: hooks live in .claude/settings.json, merged with user keys)
  checkSettings(settingsPath, 'init');
  check('legacy .claude/hooks.json not generated', !fs.existsSync(path.join(proj, '.claude', 'hooks.json')));
  check('UserPromptSubmit hook wired for per-turn orchestrator injection', devosHookEntries(readJson(settingsPath), 'UserPromptSubmit').length === 1);
  const hookStart = path.join(proj, '.agents', 'hooks', 'session-start.sh');
  const hookPre = path.join(proj, '.agents', 'hooks', 'pre-tool-use.sh');
  const hookPrompt = path.join(proj, '.agents', 'hooks', 'user-prompt-submit.sh');
  const hookStop = path.join(proj, '.agents', 'hooks', 'stop.sh');
  check('runtime hooks installed', fs.existsSync(hookStart) && fs.existsSync(hookPre) && fs.existsSync(hookPrompt));
  check('stop.sh hook installed', fs.existsSync(hookStop));

  // C2: block = exit 2 + reason on stderr; allow = exit 0
  const destructivePos = runHook(hookPre, { args: ['rm -rf /tmp/devos-smoke-nonexistent'], cwd: proj });
  check('pre-tool-use.sh blocks destructive positional command with exit 2 + stderr', isBlocked(destructivePos), hookDetail(destructivePos));

  const commitJson = runHook(hookPre, { cwd: proj, input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m x' } }) });
  check('pre-tool-use.sh blocks raw git commit from stdin JSON with exit 2 + stderr', isBlocked(commitJson), hookDetail(commitJson));

  const destructiveJson = runHook(hookPre, { cwd: proj, input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git reset --hard origin/main' } }) });
  check('pre-tool-use.sh blocks destructive command from stdin JSON with exit 2', isBlocked(destructiveJson), hookDetail(destructiveJson));

  const lsJson = runHook(hookPre, { cwd: proj, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } }) });
  check('pre-tool-use.sh allows benign Bash JSON (ls) with exit 0', lsJson.status === 0, hookDetail(lsJson));

  const commitShJson = runHook(hookPre, { cwd: proj, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: '.agents/scripts/commit.sh --agent "feat: add thing"' } }) });
  check('pre-tool-use.sh allows canonical commit.sh via stdin JSON and asks the human', commitShJson.status === 0 &&
    /"permissionDecision":"ask"/.test(commitShJson.stdout || ''), hookDetail(commitShJson));

  const commitShPos = runHook(hookPre, { args: ['.agents/scripts/commit.sh "feat: add thing"'], cwd: proj });
  check('pre-tool-use.sh allows canonical commit.sh via positional arg', commitShPos.status === 0, hookDetail(commitShPos));

  // C2: stop.sh must never loop and must be a no-op outside a git repo
  const stopActive = runHook(hookStop, { cwd: proj, input: JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: true }) });
  check('stop.sh exits 0 when stop_hook_active is true', stopActive.status === 0, hookDetail(stopActive));
  const stopNoGit = runHook(hookStop, { cwd: empty, input: JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: false }) });
  check('stop.sh exits 0 outside a git repo', stopNoGit.status === 0, hookDetail(stopNoGit));

  // stop.sh gate: modified tracked code without docs/CURRENT_STATE.md asks for an update (exit 2)
  const gitCheck = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (gitCheck.status === 0) {
    const repo = path.join(scratch, 'stop-repo');
    fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
    const git = (args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8', timeout: HOOK_TIMEOUT_MS });
    git(['init', '-q']);
    fs.writeFileSync(path.join(repo, 'src', 'app.js'), 'module.exports = 1;\n', 'utf8');
    git(['add', 'src/app.js']);
    fs.writeFileSync(path.join(repo, 'src', 'app.js'), 'module.exports = 2;\n', 'utf8');
    const stopInput = JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: false });
    const stopGate = runHook(hookStop, { cwd: repo, input: stopInput });
    check('stop.sh blocks (exit 2) when code changed without docs/CURRENT_STATE.md', isBlocked(stopGate), hookDetail(stopGate));
    const stopOff = runHook(hookStop, { cwd: repo, input: stopInput, env: { DEVOS_STOP_GATE: 'off' } });
    check('stop.sh honours DEVOS_STOP_GATE=off', stopOff.status === 0, hookDetail(stopOff));
  }

  // Shared Memory Vault & Task Board verification
  check('memory vault installed (.agents/memory/)', fs.existsSync(path.join(proj, '.agents', 'memory', 'decisions', 'ADR-000-template.md')));
  check('task board installed (docs/TASK_BOARD.md)', fs.existsSync(path.join(proj, 'docs', 'TASK_BOARD.md')));
  check('manifest tracking installed (.agents/manifest.json)', fs.existsSync(path.join(proj, '.agents', 'manifest.json')));

  // CLI Subcommands verification: pack & memory
  const packList = runCli(['pack', 'list', '--json'], proj);
  check('devos pack list exits 0', packList.status === 0, packList.stderr);

   const packAdd = runCli(['pack', 'add', 'nextjs'], proj);
  check('devos pack add exits 0', packAdd.status === 0, packAdd.stderr);

  // Maintainer pack: agents + commands from .agents/maintainer/, opt-in only
  const packMaint = runCli(['pack', 'add', 'maintainer'], proj);
  check('devos pack add maintainer exits 0', packMaint.status === 0, (packMaint.stderr || packMaint.stdout || '').trim().slice(0, 300));
  check('pack add maintainer installs maintainer agents (.agents + .claude)', MAINTAINER_AGENTS.length > 0 && MAINTAINER_AGENTS.every((a) => fs.existsSync(path.join(proj, '.agents', 'agents', `${a}.md`)) && fs.existsSync(path.join(proj, '.claude', 'agents', `${a}.md`))));
  check('pack add maintainer installs maintainer commands (.claude/commands)', MAINTAINER_COMMANDS.length > 0 && MAINTAINER_COMMANDS.every((c) => fs.existsSync(path.join(proj, '.claude', 'commands', `${c}.md`))));
  check('manifest lists the maintainer pack', ((readJson(path.join(proj, '.agents', 'manifest.json')) || {}).installedPacks || []).includes('maintainer'));

  // Skill aliases: a merged name resolves to its primary with a WARN line
  const aliasPair = Object.entries(ALIASES).find(([, to]) => fs.existsSync(path.join(ROOT, '.agents', 'skills', to, 'SKILL.md')));
  if (aliasPair) {
    const aliasAdd = runCli(['skill', 'add', aliasPair[0]], proj);
    check(`devos skill add ${aliasPair[0]} resolves to ${aliasPair[1]}`, aliasAdd.status === 0 && (aliasAdd.stdout || '').includes(`[ WARN ] ${aliasPair[0]} was merged into ${aliasPair[1]}`) && fs.existsSync(path.join(proj, '.agents', 'skills', aliasPair[1], 'SKILL.md')), (aliasAdd.stderr || aliasAdd.stdout || '').trim().slice(0, 300));
  } else {
    check('packs.json defines skill aliases that resolve to shipped skills', false, 'no usable entry in packs.json "aliases"');
  }

  const skillList = runCli(['skill', 'list', '--json'], proj);
  check('devos skill list exits 0', skillList.status === 0, skillList.stderr);
  let parsedSkills = [];
  try { parsedSkills = JSON.parse(skillList.stdout); } catch (e) {}
  check('devos skill list --json outputs array of skill objects', Array.isArray(parsedSkills) && parsedSkills.length > 0 && typeof parsedSkills[0].tokens === 'number');

  const skillAudit = runCli(['skill', 'audit'], proj);
  check('devos skill audit exits 0', skillAudit.status === 0, skillAudit.stderr);

  const skillAuditJson = runCli(['skill', 'audit', '--json'], proj);
  check('devos skill audit --json exits 0', skillAuditJson.status === 0, skillAuditJson.stderr);
  let parsedAudit = null;
  try { parsedAudit = JSON.parse(skillAuditJson.stdout); } catch (e) {}
  check('devos skill audit --json outputs structured scorecard', Boolean(parsedAudit && parsedAudit.total > 0 && parsedAudit.errors === 0));

  const skillCheck = runCli(['skill', 'check', '--json'], proj);
  check('devos skill check --json exits 0', skillCheck.status === 0, skillCheck.stderr);
  let parsedCheck = null;
  try { parsedCheck = JSON.parse(skillCheck.stdout); } catch (e) {}
  check('devos skill check --json reports clean integrity', Boolean(parsedCheck && parsedCheck.total > 0 && parsedCheck.customizedCount === 0));

  const skillSyncDry = runCli(['skill', 'sync', '--dry-run'], proj);
  check('devos skill sync --dry-run exits 0', skillSyncDry.status === 0, skillSyncDry.stderr);

  // Customization safety backup test: modify an installed skill, run sync, verify backup directory
  const testSkillFile = path.join(proj, '.agents', 'skills', 'anti-ai-ui', 'SKILL.md');
  if (fs.existsSync(testSkillFile)) {
    fs.appendFileSync(testSkillFile, '\n<!-- modified by smoke-test -->\n');
    const syncRes = runCli(['skill', 'sync'], proj);
    check('devos skill sync exits 0 on modified skill', syncRes.status === 0, syncRes.stderr);
    const backupDir = path.join(proj, '.agents', '_backup', 'skills');
    const hasBackup = fs.existsSync(backupDir) && fs.readdirSync(backupDir).some((f) => f.startsWith('anti-ai-ui-'));
    check('customized skill automatically backed up to .agents/_backup/skills/', hasBackup);
  }

  const memList = runCli(['memory', 'list', '--json'], proj);
  check('devos memory list exits 0', memList.status === 0, memList.stderr);

  const memDoctor = runCli(['memory', 'doctor'], proj);
  check('devos memory doctor exits 0', memDoctor.status === 0, memDoctor.stderr);

  const memHandoff = runCli(['memory', 'handoff'], proj);
  check('devos memory handoff exits 0', memHandoff.status === 0, memHandoff.stderr);

  // Telemetry & SDLC Mode in Manifest verification
  const manifestData = JSON.parse(fs.readFileSync(path.join(proj, '.agents', 'manifest.json'), 'utf8'));
  check('manifest default telemetry is on', manifestData.telemetry === 'on');
  check('manifest default mode is interactive', manifestData.mode === 'interactive');

  // Humanizer scanner script verification
  const humanizeScript = path.join(proj, '.agents', 'scripts', 'humanize-check.sh');
  check('humanize-check.sh script installed and executable', fs.existsSync(humanizeScript) && (fs.statSync(humanizeScript).mode & 0o111) !== 0);

  // Anti-AI UI taste scanner script verification
  const uiTasteScript = path.join(proj, '.agents', 'scripts', 'ui-taste-check.sh');
  check('ui-taste-check.sh script installed and executable', fs.existsSync(uiTasteScript) && (fs.statSync(uiTasteScript).mode & 0o111) !== 0);

  // Verify ui-taste-check.sh catches AI slop and passes clean templates
  const testBadFile = path.join(proj, 'Bad.tsx');
  fs.writeFileSync(testBadFile, 'export const Bad = () => <button>🚀 Supercharge</button>;', 'utf8');
  const tasteFail = spawnSync('bash', [uiTasteScript, testBadFile], { cwd: proj, encoding: 'utf8' });
  check('ui-taste-check.sh catches raw emojis and AI slop', tasteFail.status === 1);
  fs.unlinkSync(testBadFile);

  const testGoodFile = path.join(proj, 'Good.tsx');
  fs.writeFileSync(testGoodFile, 'export const Good = () => <button className="active:scale-[0.98]">Deploy</button>;', 'utf8');
  const tastePass = spawnSync('bash', [uiTasteScript, testGoodFile], { cwd: proj, encoding: 'utf8' });
  check('ui-taste-check.sh passes clean distinctive UI code', tastePass.status === 0);
  fs.unlinkSync(testGoodFile);

  // Environment & Config Parity scanner script verification
  const envScript = path.join(proj, '.agents', 'scripts', 'env-check.sh');
  check('env-check.sh script installed and executable', fs.existsSync(envScript) && (fs.statSync(envScript).mode & 0o111) !== 0);

  const testEnvFile = path.join(proj, 'test-env.ts');
  fs.writeFileSync(testEnvFile, 'const key = process.env.TEST_PAYMENT_SECRET;\n', 'utf8');
  const envFail = spawnSync('bash', [envScript, proj], { cwd: proj, encoding: 'utf8' });
  check('env-check.sh catches missing variable in .env.example', envFail.status === 1);
  fs.writeFileSync(path.join(proj, '.env.example'), 'TEST_PAYMENT_SECRET=your_test_key\n', 'utf8');
  const envPass = spawnSync('bash', [envScript, proj], { cwd: proj, encoding: 'utf8' });
  check('env-check.sh passes when .env.example is synchronized', envPass.status === 0);
  fs.unlinkSync(testEnvFile);
  fs.unlinkSync(path.join(proj, '.env.example'));

  // Database & Migration Safety scanner script verification
  const dbScript = path.join(proj, '.agents', 'scripts', 'db-check.sh');
  check('db-check.sh script installed and executable', fs.existsSync(dbScript) && (fs.statSync(dbScript).mode & 0o111) !== 0);

  const testSqlFile = path.join(proj, '001_test.sql');
  fs.writeFileSync(testSqlFile, 'CREATE TABLE orders (id UUID PRIMARY KEY);\n', 'utf8');
  const dbFail = spawnSync('bash', [dbScript, testSqlFile], { cwd: proj, encoding: 'utf8' });
  check('db-check.sh catches table without RLS enabled', dbFail.status === 1);
  fs.writeFileSync(testSqlFile, 'CREATE TABLE orders (id UUID PRIMARY KEY);\nALTER TABLE orders ENABLE ROW LEVEL SECURITY;\n', 'utf8');
  const dbPass = spawnSync('bash', [dbScript, testSqlFile], { cwd: proj, encoding: 'utf8' });
  check('db-check.sh passes when RLS is enabled', dbPass.status === 0);
  fs.unlinkSync(testSqlFile);

  // Mandatory Design Gate hook enforcement verification
  const uiCheckFail = runHook(hookPre, { args: ['touch src/components/App.tsx'], cwd: proj });
  check('pre-tool-use.sh blocks UI file creation when DESIGN.md is absent (exit 2)', isBlocked(uiCheckFail, 'Mandatory Design Gate'), hookDetail(uiCheckFail));

  // C2: Edit/Write are gated on tool_input.file_path
  const uiFile = path.join(proj, 'src', 'components', 'Card.tsx');
  const editJson = JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: uiFile, old_string: 'a', new_string: 'b' } });
  const writeJson = JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: uiFile, content: 'export const Card = () => null;' } });
  const editBlocked = runHook(hookPre, { cwd: proj, input: editJson });
  check('design gate blocks Edit of .tsx via stdin JSON when DESIGN.md is absent', isBlocked(editBlocked, 'Design Gate'), hookDetail(editBlocked));
  const writeBlocked = runHook(hookPre, { cwd: proj, input: writeJson });
  check('design gate blocks Write of .tsx via stdin JSON when DESIGN.md is absent', isBlocked(writeBlocked, 'Design Gate'), hookDetail(writeBlocked));

  // Verify telemetry logged the gate violation
  const telemetryLog = path.join(proj, '.agents', 'telemetry', 'events.jsonl');
  check('telemetry events.jsonl logged gate violation', fs.existsSync(telemetryLog) && fs.readFileSync(telemetryLog, 'utf8').includes('MANDATORY_DESIGN_GATE'));

  // Create DESIGN.md at project root and verify pre-tool-use.sh passes
  fs.writeFileSync(path.join(proj, 'DESIGN.md'), '# Design Specification\n', 'utf8');
  const uiCheckPass = runHook(hookPre, { args: ['touch src/components/App.tsx'], cwd: proj });
  check('pre-tool-use.sh passes UI file creation when root DESIGN.md is present', uiCheckPass.status === 0, hookDetail(uiCheckPass));
  const editAllowed = runHook(hookPre, { cwd: proj, input: editJson });
  check('design gate allows Edit of .tsx via stdin JSON when DESIGN.md is present', editAllowed.status === 0, hookDetail(editAllowed));
  const writeAllowed = runHook(hookPre, { cwd: proj, input: writeJson });
  check('design gate allows Write of .tsx via stdin JSON when DESIGN.md is present', writeAllowed.status === 0, hookDetail(writeAllowed));

  // TASK-006: Orchestrator Persistence & Delegation Enforcement
  const sessionFile = path.join(proj, '.agents', 'memory', 'session.json');
  const sessionStart = runHook(hookStart, { cwd: proj });
  check('session-start.sh writes the session mode lock', sessionStart.status === 0 && fs.existsSync(sessionFile));
  let sessionData = {};
  try { sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8')); } catch (e) {}
  check('session.json has correct schema', sessionData.schemaVersion === '1.0.0' && sessionData.orchestratorLocked === true && typeof sessionData.delegationRequired === 'boolean');

  // W1: the using-devos bootstrap skill is injected at session start and after compaction,
  // and yields to Superpowers (which already carries the skill-check rule).
  const bootEnv = { DEVOS_OFFLINE: '1', DEVOS_SUPERPOWERS: 'off' };
  const bootSkillPath = path.join(proj, '.agents', 'skills', 'using-devos', 'SKILL.md');
  const bootSkill = fs.existsSync(bootSkillPath) ? fs.readFileSync(bootSkillPath, 'utf8') : '';
  check('[W1] using-devos is in the default install and under 3 KB', bootSkill.length > 0 && Buffer.byteLength(bootSkill) <= 3072, `${Buffer.byteLength(bootSkill)} bytes`);
  const bootOff = runHook(hookStart, { cwd: proj, env: bootEnv });
  check('[W1] session-start injects the using-devos bootstrap', bootOff.status === 0 && (bootOff.stdout || '').includes('--- using-devos') && (bootOff.stdout || '').includes('Check for a skill before you act') && !(bootOff.stdout || '').includes('name: using-devos'), hookDetail(bootOff));
  const bootCompact = runHook(hookStart, { cwd: proj, env: bootEnv, input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'compact' }) });
  check('[W1] the bootstrap is re-injected after compaction', bootCompact.status === 0 && (bootCompact.stdout || '').includes('Check for a skill before you act'), hookDetail(bootCompact));
  const bootOn = runHook(hookStart, { cwd: proj, env: { DEVOS_OFFLINE: '1', DEVOS_SUPERPOWERS: 'on' } });
  check('[W1] with Superpowers enabled only a short Dev-OS delta is injected', bootOn.status === 0 && (bootOn.stdout || '').includes('Superpowers is enabled') && !(bootOn.stdout || '').includes('Check for a skill before you act'), hookDetail(bootOn));
  const spHome = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-sphome-'));
  fs.mkdirSync(path.join(spHome, '.claude'));
  fs.writeFileSync(path.join(spHome, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'superpowers@claude-plugins-official': true } }));
  const bootAuto = runHook(hookStart, { cwd: proj, env: { DEVOS_OFFLINE: '1', HOME: spHome } });
  check('[W1] Superpowers is detected from enabledPlugins in ~/.claude/settings.json', (bootAuto.stdout || '').includes('Superpowers is enabled'), hookDetail(bootAuto));
  fs.writeFileSync(path.join(spHome, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'superpowers@claude-plugins-official': false } }));
  const bootDisabled = runHook(hookStart, { cwd: proj, env: { DEVOS_OFFLINE: '1', HOME: spHome } });
  check('[W1] a disabled Superpowers plugin does not suppress the bootstrap', (bootDisabled.stdout || '').includes('Check for a skill before you act'), hookDetail(bootDisabled));

  // W5: plugin hooks stand down when the project install already owns the hooks (Claude Code
  // runs a plugin copy of a handler in parallel with the settings.json copy).
  // W2: side-effect skills run only when asked for by name; the audit reports listing size and the
  // 1,536-character entry cap.
  const manualOnly = ['deploy-to-vercel', 'expose-localhost'].filter((n) => {
    const head = (fs.readFileSync(path.join(ROOT, '.agents', 'skills', n, 'SKILL.md'), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/) || [])[1] || '';
    const yamlPath = path.join(ROOT, '.agents', 'skills', n, 'agents', 'openai.yaml');
    return /^disable-model-invocation:\s*true\s*$/m.test(head) && fs.existsSync(yamlPath) && /allow_implicit_invocation:\s*false/.test(fs.readFileSync(yamlPath, 'utf8'));
  });
  check('[W2] deploy-to-vercel and expose-localhost are manual-only (Claude Code, Cursor and Codex)', manualOnly.length === 2, manualOnly.join(','));
  const capProj = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-cap-'));
  fs.mkdirSync(path.join(capProj, '.agents', 'skills', 'long-entry'), { recursive: true });
  fs.writeFileSync(path.join(capProj, '.agents', 'skills', 'long-entry', 'SKILL.md'),
    `---\nname: long-entry\ndescription: "Use when ${'testing the listing cap '.repeat(80)}ends here."\n---\n\n# Long entry\n`);
  const capRes = runCli(['skill', 'audit', '--json'], capProj);
  let capJson = null;
  try { capJson = JSON.parse(capRes.stdout); } catch (e) {}
  const capSkill = capJson && capJson.skills.find((x) => x.name === 'long-entry');
  check('[W2] skill audit warns when description + when_to_use passes the 1,536-character listing cap',
    Boolean(capSkill && capSkill.warnings.some((w) => /1,536/.test(w))) && capJson.errors === 0, (capRes.stderr || capRes.stdout || '').slice(0, 200));
  check('[W2] skill audit --json reports listingChars', Boolean(capJson) && typeof capJson.listingChars === 'number' && capJson.listingChars > 1500);

  // -------------------------------------------------------------------------
  // Phase 2, W3: four more Claude Code hook events.
  // Payload shapes and output contracts verified 2026-11-06 against
  // code.claude.com/docs/en/hooks and the installed CLI 2.1.319:
  //   PreCompact   {trigger, custom_instructions}  stdout = compaction summary instructions
  //   PostCompact  {trigger, compact_summary}      side effects only, no context injection
  //   SubagentStart{agent_id, agent_type}          hookSpecificOutput.additionalContext
  //   TaskCompleted{task_id, task_subject, task_description, teammate_name}  exit 2 blocks
  //   InstructionsLoaded {file_path, memory_type, load_reason, globs, ...}  exit code ignored
  // -------------------------------------------------------------------------
  const memDir = path.join(proj, '.agents', 'memory');
  const hookPreCompact = path.join(proj, '.agents', 'hooks', 'pre-compact.sh');
  const hookPostCompact = path.join(proj, '.agents', 'hooks', 'post-compact.sh');
  const hookSubStart = path.join(proj, '.agents', 'hooks', 'subagent-start.sh');
  const hookTaskDone = path.join(proj, '.agents', 'hooks', 'task-completed.sh');
  const hookInstr = path.join(proj, '.agents', 'hooks', 'instructions-loaded.sh');
  ['pre-compact.sh', 'post-compact.sh', 'subagent-start.sh', 'task-completed.sh', 'instructions-loaded.sh'].forEach((f) => {
    const p = path.join(proj, '.agents', 'hooks', f);
    let mode = null;
    try { mode = fs.statSync(p).mode & 0o111; } catch (e) {}
    check(`[W3] ${f} is installed and executable`, mode > 0, `mode=${mode}`);
  });

  // An IN_PROGRESS task so the compaction and subagent payloads have something to carry.
  fs.writeFileSync(path.join(proj, 'docs', 'TASK_BOARD.md'),
    '# Task Board\n\n### [ IN_PROGRESS ]\n- Wire the parity hooks\n  - Assignee: developer\n', 'utf8');

  const compactState = path.join(memDir, 'compact-state.json');
  const preC = runHook(hookPreCompact, { cwd: proj, input: JSON.stringify({ hook_event_name: 'PreCompact', trigger: 'auto', custom_instructions: null }) });
  const preCOut = preC.stdout || '';
  check('[W3] pre-compact.sh exits 0 and never blocks compaction', preC.status === 0, hookDetail(preC));
  check('[W3] pre-compact.sh stdout tells the summariser to keep the mode lock and the active task',
    /Wire the parity hooks/.test(preCOut) && /mode/i.test(preCOut) && /Hard Rule/.test(preCOut), preCOut.slice(0, 200));
  check('[W3] pre-compact.sh stdout stays under the 10,000-character cap', preCOut.length > 0 && preCOut.length < 10000, `${preCOut.length} chars`);
  const preCState = readJson(compactState);
  check('[W3] pre-compact.sh saves the pre-compaction state', Boolean(preCState) && preCState.trigger === 'auto' && typeof preCState.mode === 'string' && typeof preCState.activeTask === 'string', JSON.stringify(preCState));

  const postC = runHook(hookPostCompact, { cwd: proj, input: JSON.stringify({ hook_event_name: 'PostCompact', trigger: 'auto', compact_summary: 'A summary of the work so far.' }) });
  check('[W3] post-compact.sh exits 0 and prints nothing (its stdout is discarded)', postC.status === 0 && (postC.stdout || '').trim() === '', hookDetail(postC));
  const postCState = readJson(compactState);
  check('[W3] post-compact.sh records the compaction and the summary size',
    Boolean(postCState) && typeof postCState.compactedAt === 'string' && postCState.summaryChars === 29, JSON.stringify(postCState));

  const subStart = runHook(hookSubStart, { cwd: proj, input: JSON.stringify({ hook_event_name: 'SubagentStart', agent_id: 'agent-abc123', agent_type: 'zz-probe-agent' }) });
  let subStartJson = null;
  try { subStartJson = JSON.parse(subStart.stdout || ''); } catch (e) {}
  const subCtx = (subStartJson && subStartJson.hookSpecificOutput && subStartJson.hookSpecificOutput.additionalContext) || '';
  check('[W3] subagent-start.sh emits valid additionalContext JSON for the SubagentStart contract',
    subStart.status === 0 && Boolean(subStartJson) && subStartJson.hookSpecificOutput.hookEventName === 'SubagentStart' && subCtx.length > 0, hookDetail(subStart));
  check('[W3] the subagent contract carries the active task, the no-commit rule and the handoff duty',
    /Wire the parity hooks/.test(subCtx) && /commit/i.test(subCtx) && /handoff/i.test(subCtx), subCtx.slice(0, 240));
  check('[W3] the subagent contract names the agent it was injected into', /^Dev-OS task contract for this subagent \(zz-probe-agent\)/.test(subCtx), subCtx.slice(0, 240));

  const taskLog = path.join(memDir, 'task-completions.log');
  const taskDone = runHook(hookTaskDone, { cwd: proj, input: JSON.stringify({ hook_event_name: 'TaskCompleted', task_id: 'task-001', task_subject: 'Wire the parity hooks', teammate_name: 'developer' }) });
  check('[W3] task-completed.sh is advisory by default (exit 0)', taskDone.status === 0, hookDetail(taskDone));
  const taskLogged = fs.existsSync(taskLog) ? fs.readFileSync(taskLog, 'utf8') : '';
  check('[W3] task-completed.sh records the completion', /task-001/.test(taskLogged) && /Wire the parity hooks/.test(taskLogged), taskLogged.slice(0, 200));
  const verifyFail = runHook(hookTaskDone, { cwd: proj, env: { DEVOS_OFFLINE: '1', DEVOS_TASK_VERIFY: 'exit 1' }, input: JSON.stringify({ hook_event_name: 'TaskCompleted', task_id: 'task-002', task_subject: 'Ship it' }) });
  check('[W3] DEVOS_TASK_VERIFY blocks completion when the verify command fails', isBlocked(verifyFail, 'Ship it'), hookDetail(verifyFail));
  const verifyPass = runHook(hookTaskDone, { cwd: proj, env: { DEVOS_OFFLINE: '1', DEVOS_TASK_VERIFY: 'exit 0' }, input: JSON.stringify({ hook_event_name: 'TaskCompleted', task_id: 'task-003', task_subject: 'Ship it' }) });
  check('[W3] DEVOS_TASK_VERIFY allows completion when the verify command passes', verifyPass.status === 0, hookDetail(verifyPass));

  const instrLog = path.join(memDir, 'instructions-loaded.log');
  const instr = runHook(hookInstr, { cwd: proj, input: JSON.stringify({ hook_event_name: 'InstructionsLoaded', file_path: path.join(proj, 'AGENTS.md'), memory_type: 'Project', load_reason: 'include', parent_file_path: path.join(proj, 'CLAUDE.md') }) });
  check('[W3] instructions-loaded.sh exits 0', instr.status === 0, hookDetail(instr));
  const instrLogged = fs.existsSync(instrLog) ? fs.readFileSync(instrLog, 'utf8') : '';
  check('[W3] instructions-loaded.sh logs the file, its scope and why it loaded',
    /AGENTS\.md/.test(instrLogged) && /Project/.test(instrLogged) && /include/.test(instrLogged), instrLogged.slice(0, 200));
  const doctorInstr = runCli(['doctor'], proj);
  const doctorOut = (doctorInstr.stdout || '') + (doctorInstr.stderr || '');
  check('[W3] doctor proves the AGENTS.md instruction load from the InstructionsLoaded log',
    /Instruction load \(InstructionsLoaded hook\)/.test(doctorOut) && /AGENTS\.md/.test(doctorOut), doctorOut.slice(-400));

  // -------------------------------------------------------------------------
  // Phase 2, W4: subagent frontmatter parity. Keys and values verified
  // 2026-11-06 against code.claude.com/docs/en/sub-agents.
  // -------------------------------------------------------------------------
  const genAgent = (n) => {
    const f = path.join(proj, '.claude', 'agents', `${n}.md`);
    return fs.existsSync(f) ? (fs.readFileSync(f, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/) || [])[1] || '' : '';
  };
  check('[W4] every generated subagent declares a color', mdFiles(path.join(proj, '.agents', 'agents'))
    .every((f) => /^color: (red|blue|green|yellow|purple|orange|pink|cyan)$/m.test(genAgent(f.replace(/\.md$/, '')))),
    mdFiles(path.join(proj, '.agents', 'agents')).filter((f) => !/^color:/m.test(genAgent(f.replace(/\.md$/, '')))).join(','));
  check('[W4] tech-lead gets high effort for arbitration', /^effort: high$/m.test(genAgent('tech-lead')), genAgent('tech-lead'));
  check('[W4] effort is raised on tech-lead only, so ordinary delegation is not repriced',
    mdFiles(path.join(proj, '.agents', 'agents')).filter((f) => /^effort:/m.test(genAgent(f.replace(/\.md$/, '')))).join(',') === 'tech-lead.md',
    mdFiles(path.join(proj, '.agents', 'agents')).filter((f) => /^effort:/m.test(genAgent(f.replace(/\.md$/, '')))).join(','));
  check('[W4] qa preloads its core skills', /^skills:/m.test(genAgent('qa')) && /testing-guide/.test(genAgent('qa')), genAgent('qa'));

  // C1: memory: on a persona makes Claude Code add Read, Write and Edit to its tool set
  // ("Read, Write, and Edit tools are automatically enabled so the subagent can manage its
  // memory files"), which would silently break the read-only contract researcher and
  // tech-lead both state in their own descriptions. No persona declares it.
  const rosterDirs = [path.join(ROOT, '.agents', 'agents'), path.join(ROOT, '.agents', 'maintainer', 'agents')];
  const withMemory = [];
  rosterDirs.forEach((d) => mdFiles(d).forEach((n) => {
    const head = (fs.readFileSync(path.join(d, n), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/) || [])[1] || '';
    if (/^memory:/m.test(head)) withMemory.push(n);
  }));
  check('[W4] no persona declares memory: (it would add Write and Edit to a read-only role)', withMemory.length === 0, withMemory.join(','));
  check('[W4] researcher and tech-lead keep their read-only tool allowlists',
    ['researcher', 'tech-lead'].every((n) => !/Write|Edit/.test(genAgent(n).match(/^tools:.*$/m) || [''])[0]),
    `${(genAgent('researcher').match(/^tools:.*$/m) || [''])[0]} | ${(genAgent('tech-lead').match(/^tools:.*$/m) || [''])[0]}`);

  // C2: the instruction-load proof must be able to FAIL. These three cases pin it down.
  const instrLogPath = path.join(memDir, 'instructions-loaded.log');
  const runDoctorOut = () => { const r = runCli(['doctor'], proj); return (r.stdout || '') + (r.stderr || ''); };
  const proofOk = /\[ OK \][^\n]*AGENTS\.md reached Claude Code/;
  fs.rmSync(instrLogPath, { force: true });
  const noLogOut = runDoctorOut();
  check('[W3] with no hook log, doctor reports no record and does NOT claim the import resolved',
    /no record yet/.test(noLogOut) && !proofOk.test(noLogOut), noLogOut.slice(-300));
  fs.writeFileSync(instrLogPath, `2026-11-06T00:00:00Z\ts-1\tProject\tsession_start\t${path.join(proj, 'CLAUDE.md')}\t\n`, 'utf8');
  const claudeOnlyOut = runDoctorOut();
  check('[W3] with CLAUDE.md loaded but no AGENTS.md, doctor warns instead of claiming success',
    /was not among the instruction files/.test(claudeOnlyOut) && !proofOk.test(claudeOnlyOut), claudeOnlyOut.slice(-300));
  // A stale row from an earlier session must not prove anything about this one.
  fs.writeFileSync(instrLogPath, [
    `2026-11-05T00:00:00Z\told-session\tProject\tsession_start\t${path.join(proj, 'CLAUDE.md')}\t`,
    `2026-11-05T00:00:01Z\told-session\tProject\tinclude\t${path.join(proj, 'AGENTS.md')}\t${path.join(proj, 'CLAUDE.md')}`,
    `2026-11-06T00:00:00Z\tnew-session\tProject\tsession_start\t${path.join(proj, 'CLAUDE.md')}\t`,
    ''
  ].join('\n'), 'utf8');
  const staleOut = runDoctorOut();
  check('[W3] doctor reads only the newest session, so a stale AGENTS.md row proves nothing',
    /was not among the instruction files/.test(staleOut) && !proofOk.test(staleOut), staleOut.slice(-300));
  fs.writeFileSync(instrLogPath, [
    `2026-11-06T00:00:00Z\tnew-session\tProject\tsession_start\t${path.join(proj, 'CLAUDE.md')}\t`,
    `2026-11-06T00:00:01Z\tnew-session\tProject\tinclude\t${path.join(proj, 'AGENTS.md')}\t${path.join(proj, 'CLAUDE.md')}`,
    ''
  ].join('\n'), 'utf8');
  const proofOut = runDoctorOut();
  check('[W3] with AGENTS.md loaded this session, doctor proves the import resolved', proofOk.test(proofOut), proofOut.slice(-300));
  // The hook records the session id, which is what makes the scoping above possible.
  fs.rmSync(instrLogPath, { force: true });
  runHook(hookInstr, { cwd: proj, input: JSON.stringify({ hook_event_name: 'InstructionsLoaded', session_id: 'sess-xyz', file_path: path.join(proj, 'CLAUDE.md'), memory_type: 'Project', load_reason: 'session_start' }) });
  check('[W3] instructions-loaded.sh records the session id for per-session scoping',
    /\tsess-xyz\t/.test(fs.readFileSync(instrLogPath, 'utf8')), fs.readFileSync(instrLogPath, 'utf8'));

  // I1 + re-graded Minor 2: every string the compaction hooks interpolate is escaped, and a
  // weird session mode must not word-split or glob into the JSON.
  const quoteBranch = 'feat/a"b';
  runHook(hookPreCompact, { cwd: proj, input: JSON.stringify({ hook_event_name: 'PreCompact', trigger: 'manual' }) });
  const tabBoard = path.join(proj, 'docs', 'TASK_BOARD.md');
  const savedBoard = fs.readFileSync(tabBoard, 'utf8');
  fs.writeFileSync(tabBoard, '# Task Board\n\n### [ IN_PROGRESS ]\n- Task with\ta tab and a "quote" and a \\ backslash\n  - Assignee: developer\n', 'utf8');
  const sessionJson = path.join(memDir, 'session.json');
  const savedSession = fs.readFileSync(sessionJson, 'utf8');
  fs.writeFileSync(sessionJson, JSON.stringify({ schemaVersion: '1.0.0', mode: '*', orchestratorLocked: true, delegationRequired: false }), 'utf8');
  runHook(hookPreCompact, { cwd: proj, input: JSON.stringify({ hook_event_name: 'PreCompact', trigger: 'auto' }) });
  const hostileState = readJson(compactState);
  check('[W3] compact-state.json stays valid JSON for a tab, a quote and a backslash in the task',
    Boolean(hostileState) && /a tab/.test(hostileState.activeTask) && /"quote"/.test(hostileState.activeTask), String(fs.existsSync(compactState) && fs.readFileSync(compactState, 'utf8')).slice(0, 300));
  check('[W3] a glob-like session mode does not word-split into the state file',
    Boolean(hostileState) && hostileState.mode === '*' && typeof hostileState.delegationRequired === 'boolean', JSON.stringify(hostileState));
  const hostilePost = runHook(hookPostCompact, { cwd: proj, input: JSON.stringify({ hook_event_name: 'PostCompact', trigger: 'auto', compact_summary: 'x' }) });
  check('[W3] post-compact.sh also writes valid JSON for hostile input', hostilePost.status === 0 && Boolean(readJson(compactState)), hookDetail(hostilePost));
  fs.writeFileSync(tabBoard, savedBoard, 'utf8');
  fs.writeFileSync(sessionJson, savedSession, 'utf8');

  // I2: post-compact.sh must not wait on a stdin nobody closes (the documented command-hook
  // timeout is 600s; every other Dev-OS hook uses a bounded read for exactly this reason).
  // A FIFO whose writer lingers: the hook must return on its own bounded read rather than
  // waiting for EOF. The writer gets all three streams detached — an inherited stderr would
  // hold the harness pipe open past the hook's exit and time the probe out for the wrong
  // reason. The FIFO lives in the suite's scratch dir, which is cleaned up with it.
  const fifoPath = path.join(scratch, 'post-compact-stdin.fifo');
  const mkfifo = spawnSync('mkfifo', [fifoPath], { encoding: 'utf8' });
  if (mkfifo.status === 0) {
    const payload = JSON.stringify({ hook_event_name: 'PostCompact', trigger: 'auto', compact_summary: 'abc' });
    const openStarted = Date.now();
    const openStdin = spawnSync('bash', ['-c',
      `( printf '%s' '${payload}'; sleep 8 ) > '${fifoPath}' 2>/dev/null </dev/null & w=$!; '${hookPostCompact}' < '${fifoPath}'; c=$?; kill $w 2>/dev/null; exit $c`],
      { cwd: proj, encoding: 'utf8', timeout: 6000, env: BASE_ENV });
    const openMs = Date.now() - openStarted;
    check('[W3] post-compact.sh returns on its own bounded read when stdin is left open',
      openStdin.status === 0 && openMs < 5000, `status=${openStdin.status} ms=${openMs} err=${openStdin.error && openStdin.error.code}`);
  } else {
    console.log('[ WARN ] skipped the post-compact open-stdin probe (mkfifo unavailable)');
  }

  // Minor 1: a null summary must measure 0, not the length of whatever string follows it.
  runHook(hookPostCompact, { cwd: proj, input: JSON.stringify({ hook_event_name: 'PostCompact', trigger: 'auto', compact_summary: null, session_id: 'abc123' }) });
  check('[W3] a null compact_summary measures 0 rather than the next string in the payload',
    (readJson(compactState) || {}).summaryChars === 0, JSON.stringify(readJson(compactState)));

  // I3: DEVOS_TASK_VERIFY=1 resolves the project's script properly instead of grepping text.
  const vProj = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-verify-'));
  try {
    fs.cpSync(path.join(proj, '.agents'), path.join(vProj, '.agents'), { recursive: true });
    fs.writeFileSync(path.join(vProj, 'package.json'), JSON.stringify({ name: 'v', scripts: { build: 'echo build' }, dependencies: { verify: '^1.0.0' } }), 'utf8');
    const noScript = runHook(path.join(vProj, '.agents', 'hooks', 'task-completed.sh'),
      { cwd: vProj, env: { DEVOS_OFFLINE: '1', DEVOS_TASK_VERIFY: '1' }, input: JSON.stringify({ hook_event_name: 'TaskCompleted', task_id: 't1', task_subject: 'No verify script here' }) });
    check('[W3] DEVOS_TASK_VERIFY=1 does not block when package.json has no verify or test script',
      noScript.status === 0, hookDetail(noScript));
    fs.writeFileSync(path.join(vProj, 'package.json'), JSON.stringify({ name: 'v', scripts: { verify: 'exit 3' } }), 'utf8');
    const realScript = runHook(path.join(vProj, '.agents', 'hooks', 'task-completed.sh'),
      { cwd: vProj, env: { DEVOS_OFFLINE: '1', DEVOS_TASK_VERIFY: '1' }, input: JSON.stringify({ hook_event_name: 'TaskCompleted', task_id: 't2', task_subject: 'Real verify script' }) });
    check('[W3] DEVOS_TASK_VERIFY=1 blocks when the project\'s real verify script fails', isBlocked(realScript, 'Real verify script'), hookDetail(realScript));
  } finally {
    fs.rmSync(vProj, { recursive: true, force: true });
  }

  // Minor 4: a task subject containing escaped quotes must not be truncated in the log.
  runHook(hookTaskDone, { cwd: proj, input: JSON.stringify({ hook_event_name: 'TaskCompleted', task_id: 'task-q', task_subject: 'Fix the "login" bug' }) });
  check('[W3] a quoted task subject is logged whole', /Fix the "login" bug/.test(fs.readFileSync(taskLog, 'utf8')), fs.readFileSync(taskLog, 'utf8').slice(-200));

  // I4: devos_json_escape must not depend on awk gsub replacement semantics, which differ
  // between BWK awk (macOS) and gawk. A character scan has no replacement semantics at all.
  // Build the probe input in a file rather than through two layers of shell quoting, so the
  // bytes the escaper sees are exactly these: one backslash, a quote, a real tab.
  const escIn = path.join(scratch, 'esc-input.txt');
  const escExpected = 'C:\\Users and a "quote" and a\treal tab';
  fs.writeFileSync(escIn, escExpected, 'utf8');
  const escProbe = spawnSync('bash', ['-c', `. '${path.join(proj, '.agents', 'hooks', 'lib', 'common.sh')}'; devos_json_escape < '${escIn}'`],
    { encoding: 'utf8', timeout: HOOK_TIMEOUT_MS, env: BASE_ENV });
  let escRound = null;
  try { escRound = JSON.parse(`"${(escProbe.stdout || '')}"`); } catch (e) {}
  check('[W3] devos_json_escape round-trips a backslash, a quote and a tab through JSON.parse',
    escRound === escExpected, `out=${JSON.stringify(escProbe.stdout)} parsed=${JSON.stringify(escRound)}`);
  check('[W3] devos_json_escape uses a character scan, not awk gsub replacements',
    !/gsub\(/.test(fs.readFileSync(path.join(ROOT, '.agents', 'hooks', 'lib', 'common.sh'), 'utf8').split('devos_json_escape()')[1] || 'gsub('));

  // -------------------------------------------------------------------------
  // Phase 3, W6: one core, thin adapters. The harness is named by the generated
  // config (DEVOS_HOOK_FORMAT=<harness>), never guessed from env markers, and
  // common.sh renders the context and denial shape that harness documents.
  // Verified 2026-11-08: Claude Code and Codex take plain stdout for session
  // context and block on exit 2; Cursor takes {"additional_context": ...} with
  // snake_case keys; Antigravity takes {"injectSteps":[{"systemMessage": ...}]}
  // and a required {"decision":"deny"} (exit 2 is not documented as a block).
  // -------------------------------------------------------------------------
  const commonSh = path.join(proj, '.agents', 'hooks', 'lib', 'common.sh');
  const runFmt = (fmt, script) => spawnSync('bash', ['-c', `. '${commonSh}'; ${script}`],
    { cwd: proj, encoding: 'utf8', timeout: HOOK_TIMEOUT_MS, env: { ...BASE_ENV, ...(fmt ? { DEVOS_HOOK_FORMAT: fmt } : {}) } });

  check('[W6] an unknown or absent DEVOS_HOOK_FORMAT falls back to the Claude Code shape',
    (runFmt('', 'devos_hook_format').stdout || '').trim() === 'claude' &&
    (runFmt('nonsense-harness', 'devos_hook_format').stdout || '').trim() === 'claude');

  const plainCtx = runFmt('claude', 'devos_emit_context "line one" ""');
  check('[W6] Claude Code and Codex get plain stdout for session context',
    (plainCtx.stdout || '').trim() === 'line one' &&
    (runFmt('codex', 'devos_emit_context "line one" ""').stdout || '').trim() === 'line one', hookDetail(plainCtx));

  const claudeEvt = runFmt('claude', 'devos_emit_context "ctx text" SubagentStart');
  let claudeEvtJson = null;
  try { claudeEvtJson = JSON.parse(claudeEvt.stdout || ''); } catch (e) {}
  check('[W6] with an event name, the Claude Code shape is hookSpecificOutput.additionalContext',
    Boolean(claudeEvtJson) && claudeEvtJson.hookSpecificOutput.hookEventName === 'SubagentStart' &&
    claudeEvtJson.hookSpecificOutput.additionalContext === 'ctx text', hookDetail(claudeEvt));

  const cursorCtx = runFmt('cursor', 'devos_emit_context "ctx \\"quoted\\" text" SubagentStart');
  let cursorJson = null;
  try { cursorJson = JSON.parse(cursorCtx.stdout || ''); } catch (e) {}
  check('[W6] Cursor gets snake_case additional_context, escaped, ignoring the Claude event name',
    Boolean(cursorJson) && cursorJson.additional_context === 'ctx "quoted" text' && !('hookSpecificOutput' in cursorJson), hookDetail(cursorCtx));

  const agCtx = runFmt('antigravity', 'devos_emit_context "ctx text" SessionStart');
  let agJson = null;
  try { agJson = JSON.parse(agCtx.stdout || ''); } catch (e) {}
  check('[W6] Antigravity gets injectSteps[].systemMessage (it has no additionalContext)',
    Boolean(agJson) && Array.isArray(agJson.injectSteps) && agJson.injectSteps[0].systemMessage === 'ctx text', hookDetail(agCtx));

  const emptyCtx = runFmt('cursor', 'devos_emit_context "" ""');
  check('[W6] no context means no output at all, on every harness', (emptyCtx.stdout || '') === '', hookDetail(emptyCtx));

  // The buffer: hooks collect lines and flush once, so a harness that needs JSON gets one object.
  const buffered = runFmt('cursor', 'devos_say "first"; devos_say "second"; devos_flush_context ""');
  let bufJson = null;
  try { bufJson = JSON.parse(buffered.stdout || ''); } catch (e) {}
  check('[W6] buffered lines flush as ONE JSON object with newlines preserved',
    Boolean(bufJson) && bufJson.additional_context === 'first\nsecond', hookDetail(buffered));
  const bufPlain = runFmt('claude', 'devos_say "first"; devos_say "second"; devos_flush_context ""');
  check('[W6] the same buffer prints as plain lines on Claude Code',
    (bufPlain.stdout || '').trim() === 'first\nsecond', hookDetail(bufPlain));

  // Denial: exit 2 everywhere Dev-OS verified it blocks; JSON decision on Antigravity.
  const blockClaude = runFmt('claude', 'devos_block "no you do not"');
  check('[W6] Claude Code, Codex and Cursor denial is exit 2 with the reason on stderr',
    isBlocked(blockClaude, 'no you do not') &&
    isBlocked(runFmt('codex', 'devos_block "nope"'), 'nope') &&
    isBlocked(runFmt('cursor', 'devos_block "nope"'), 'nope'), hookDetail(blockClaude));
  const blockAg = runFmt('antigravity', 'devos_block "no you do not"');
  let blockAgJson = null;
  try { blockAgJson = JSON.parse(blockAg.stdout || ''); } catch (e) {}
  check('[W6] Antigravity denial is {"decision":"deny"} on stdout with exit 0',
    blockAg.status === 0 && Boolean(blockAgJson) && blockAgJson.decision === 'deny' && /no you do not/.test(blockAgJson.reason), hookDetail(blockAg));

  // Superpowers is a Claude Code plugin. Yielding to it on another harness would drop the
  // Dev-OS bootstrap for a plugin that is not loaded there, so the yield is Claude-Code-only.
  const spEnabledHome = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-sp2-'));
  fs.mkdirSync(path.join(spEnabledHome, '.claude'));
  fs.writeFileSync(path.join(spEnabledHome, '.claude', 'settings.json'),
    JSON.stringify({ enabledPlugins: { 'superpowers@claude-plugins-official': true } }), 'utf8');
  const spClaude = runHook(hookStart, { cwd: proj, env: { DEVOS_OFFLINE: '1', HOME: spEnabledHome } });
  check('[W6] the Superpowers yield applies to Claude Code only (it yields there)',
    /Superpowers is enabled/.test(spClaude.stdout || ''), hookDetail(spClaude));
  ['opencode', 'codex', 'cursor', 'antigravity'].forEach((fmt) => {
    const r = runHook(hookStart, { cwd: proj, env: { DEVOS_OFFLINE: '1', HOME: spEnabledHome, DEVOS_HOOK_FORMAT: fmt } });
    const text = fmt === 'cursor' || fmt === 'antigravity'
      ? (() => { try { const j = JSON.parse(r.stdout || ''); return j.additional_context || (j.injectSteps && j.injectSteps[0].systemMessage) || ''; } catch (e) { return ''; } })()
      : (r.stdout || '');
    check(`[W6] ${fmt} still gets the full Dev-OS bootstrap when Claude Code has Superpowers enabled`,
      /Check for a skill before you act/.test(text) && !/Superpowers is enabled/.test(text), hookDetail(r));
  });

  // session-start.sh must respect the format it is told, without changing its content.
  const ssCursor = runHook(hookStart, { cwd: proj, env: { DEVOS_OFFLINE: '1', DEVOS_SUPERPOWERS: 'off', DEVOS_HOOK_FORMAT: 'cursor' } });
  let ssCursorJson = null;
  try { ssCursorJson = JSON.parse(ssCursor.stdout || ''); } catch (e) {}
  check('[W6] session-start.sh emits one Cursor JSON object carrying the whole directive',
    ssCursor.status === 0 && Boolean(ssCursorJson) && /Dev-OS Active/.test(ssCursorJson.additional_context) &&
    /Check for a skill before you act/.test(ssCursorJson.additional_context), hookDetail(ssCursor));
  const ssAg = runHook(hookStart, { cwd: proj, env: { DEVOS_OFFLINE: '1', DEVOS_SUPERPOWERS: 'off', DEVOS_HOOK_FORMAT: 'antigravity' } });
  let ssAgJson = null;
  try { ssAgJson = JSON.parse(ssAg.stdout || ''); } catch (e) {}
  check('[W6] session-start.sh emits Antigravity injectSteps carrying the whole directive',
    ssAg.status === 0 && Boolean(ssAgJson) && /Dev-OS Active/.test(ssAgJson.injectSteps[0].systemMessage), hookDetail(ssAg));
  const ssPlain = runHook(hookStart, { cwd: proj, env: { DEVOS_OFFLINE: '1', DEVOS_SUPERPOWERS: 'off' } });
  check('[W6] with no format set, session-start.sh still prints plain text (Claude Code unchanged)',
    ssPlain.status === 0 && /^=+$/m.test(ssPlain.stdout || '') && /Dev-OS Active/.test(ssPlain.stdout || '') &&
    !/additional_context|injectSteps/.test(ssPlain.stdout || ''), hookDetail(ssPlain));
  const upsCursor = runHook(path.join(proj, '.agents', 'hooks', 'user-prompt-submit.sh'),
    { cwd: proj, env: { DEVOS_OFFLINE: '1', DEVOS_HOOK_FORMAT: 'cursor' }, input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: 'do a thing' }) });
  let upsJson = null;
  try { upsJson = JSON.parse(upsCursor.stdout || ''); } catch (e) {}
  check('[W6] user-prompt-submit.sh honours the format too',
    upsCursor.status === 0 && (upsCursor.stdout || '').trim() === '' ? true : Boolean(upsJson) && typeof upsJson.additional_context === 'string', hookDetail(upsCursor));

  // -------------------------------------------------------------------------
  // Phase 3, W6: the generated per-harness configs. Schemas verified 2026-11-08
  // against each harness's own docs; they differ in nesting, key case and
  // timeout units, which is why each one gets a fixture rather than a shared
  // assumption.
  // -------------------------------------------------------------------------
  const allProj = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-harness-'));
  try {
    const initAll = runCli(['init', '--existing', '--stack', 'universal', '--platform', 'all', '--quiet'], allProj);
    check('[W6] init --platform all succeeds', initAll.status === 0, (initAll.stderr || initAll.stdout || '').slice(-300));

    // Every generated command must find its script without depending on the harness's cwd,
    // and must carry the format tag that tells the hook which shape to emit.
    const cmdOk = (cmd, fmt, script) => typeof cmd === 'string' &&
      cmd.includes(`DEVOS_HOOK_FORMAT=${fmt}`) && cmd.includes(`.agents/hooks/${script}`) &&
      !/^\/|\/Users\/|\/home\//.test(cmd);

    // --- Codex: nested matcher groups like Claude Code, timeout in SECONDS ---
    const codexCfg = readJson(path.join(allProj, '.codex', 'hooks.json'));
    check('[W6] Codex gets .codex/hooks.json with a top-level "hooks" map', Boolean(codexCfg && codexCfg.hooks), JSON.stringify(codexCfg).slice(0, 200));
    if (codexCfg && codexCfg.hooks) {
      const cx = codexCfg.hooks;
      check('[W6] Codex wires the events it documents, and none it does not',
        ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'SubagentStop', 'SessionEnd', 'PreCompact', 'PostCompact', 'SubagentStart'].every((e) => Array.isArray(cx[e])) &&
        !('InstructionsLoaded' in cx) && !('TaskCompleted' in cx), Object.keys(cx).join(','));
      const cxPre = (cx.PreToolUse && cx.PreToolUse[0]) || {};
      check('[W6] Codex uses nested matcher groups with type "command"',
        Array.isArray(cxPre.hooks) && cxPre.hooks[0].type === 'command' && cmdOk(cxPre.hooks[0].command, 'codex', 'pre-tool-use.sh'), JSON.stringify(cxPre));
      check('[W6] every Codex timeout is a plain number of seconds (not milliseconds)',
        Object.values(cx).every((groups) => groups.every((g) => (g.hooks || []).every((h) => typeof h.timeout === 'number' && h.timeout > 0 && h.timeout <= 600))), JSON.stringify(cx).slice(0, 300));
    }

    // --- Cursor: FLAT map, required integer "version", camelCase events ---
    const cursorCfg = readJson(path.join(allProj, '.cursor', 'hooks.json'));
    check('[W6] Cursor gets .cursor/hooks.json with the required integer version',
      Boolean(cursorCfg) && Number.isInteger(cursorCfg.version) && cursorCfg.version >= 1, JSON.stringify(cursorCfg).slice(0, 200));
    if (cursorCfg && cursorCfg.hooks) {
      const cu = cursorCfg.hooks;
      check('[W6] Cursor events are camelCase and the handler list is flat (no matcher groups)',
        ['sessionStart', 'preToolUse', 'stop', 'sessionEnd'].every((e) => Array.isArray(cu[e]) && typeof cu[e][0].command === 'string' && !('hooks' in cu[e][0])), Object.keys(cu).join(','));
      // Cursor documents beforeSubmitPrompt's output as {continue, user_message} with no
      // additional_context, so the per-turn directive cannot be injected there and the event
      // is deliberately not wired.
      check('[W6] Cursor does not wire beforeSubmitPrompt, which cannot inject context',
        !('beforeSubmitPrompt' in cu), Object.keys(cu).join(','));
      check('[W6] Cursor preToolUse sets failClosed so a hook crash does not let the call through',
        cu.preToolUse[0].failClosed === true, JSON.stringify(cu.preToolUse[0]));
      check('[W6] Cursor preToolUse carries the cursor format tag',
        cmdOk(cu.preToolUse[0].command, 'cursor', 'pre-tool-use.sh'), cu.preToolUse[0].command);
      check('[W6] Cursor is not wired on both preToolUse and beforeShellExecution (that would gate every shell call twice)',
        !('beforeShellExecution' in cu), Object.keys(cu).join(','));
    }

    // --- Antigravity: named bundle, lifecycle handlers directly under the event key ---
    const agCfg = readJson(path.join(allProj, '.agents', 'hooks.json'));
    check('[W6] Antigravity gets .agents/hooks.json as a named, enabled bundle',
      Boolean(agCfg && agCfg.devos && agCfg.devos.enabled === true), JSON.stringify(agCfg).slice(0, 200));
    if (agCfg && agCfg.devos) {
      const ag = agCfg.devos;
      check('[W6] Antigravity wires only the six events it documents',
        ['SessionStart', 'PreToolUse', 'PostToolUse', 'Stop'].every((e) => e in ag) &&
        !('UserPromptSubmit' in ag) && !('SubagentStart' in ag) && !('SessionEnd' in ag), Object.keys(ag).join(','));
      check('[W6] Antigravity SessionStart puts the handler directly under the event key',
        Array.isArray(ag.SessionStart) && typeof ag.SessionStart[0].command === 'string' &&
        !('hooks' in ag.SessionStart[0]) && !('matcher' in ag.SessionStart[0]) &&
        cmdOk(ag.SessionStart[0].command, 'antigravity', 'session-start.sh'), JSON.stringify(ag.SessionStart));
      check('[W6] Antigravity PreToolUse uses a matcher group',
        Array.isArray(ag.PreToolUse) && Array.isArray(ag.PreToolUse[0].hooks) &&
        cmdOk(ag.PreToolUse[0].hooks[0].command, 'antigravity', 'pre-tool-use.sh'), JSON.stringify(ag.PreToolUse));
      check('[W6] .agents/hooks.json does not disturb the .agents/hooks/ script directory',
        fs.statSync(path.join(allProj, '.agents', 'hooks')).isDirectory() &&
        fs.statSync(path.join(allProj, '.agents', 'hooks.json')).isFile());
    }

    // --- OpenCode: a JS plugin, because it has no shell-hook mechanism at all ---
    const ocPlugin = path.join(allProj, '.opencode', 'plugins', 'devos.js');
    check('[W6] OpenCode gets a plugin at .opencode/plugins/devos.js', fs.existsSync(ocPlugin));
    if (fs.existsSync(ocPlugin)) {
      const src = fs.readFileSync(ocPlugin, 'utf8');
      const syn = spawnSync(process.execPath, ['--check', ocPlugin], { encoding: 'utf8' });
      check('[W6] the OpenCode plugin is syntactically valid JavaScript', syn.status === 0, (syn.stderr || '').slice(0, 300));
      check('[W6] the OpenCode plugin uses only hooks that exist in the installed typings',
        ['tool.execute.before', 'experimental.chat.system.transform', 'experimental.session.compacting'].every((h) => src.includes(h)) &&
        !src.includes('permission.asked') && !src.includes('session.created') && !src.includes('session.compacted'), 'see plugin source');
      check('[W6] the OpenCode plugin has no imports, so it adds no dependency (R12)',
        !/^\s*(import|require)\s*\(?["']/m.test(src.replace(/^\s*\/\/.*$/gm, '').replace(/node:child_process|node:path|node:fs/g, 'OK')) || /from ["']node:/.test(src), 'see plugin source');
      check('[W6] the OpenCode plugin blocks a tool call by throwing (its hook cannot return a decision)',
        /throw new Error/.test(src), 'see plugin source');
    }

    // doctor must say which harnesses enforce and which are only advisory, and must not
    // claim enforcement for the one that needs a human trust step.
    const docAll = runCli(['doctor'], allProj);
    const docOut = (docAll.stdout || '') + (docAll.stderr || '');
    check('[W6] doctor reports a per-harness enforcement section', /Cross-harness hooks/i.test(docOut), docOut.slice(-500));
    check('[W6] doctor names the Codex trust step, which Dev-OS cannot perform for the human',
      /\/hooks/.test(docOut) && /trust/i.test(docOut), docOut.slice(-500));
    check('[W6] doctor labels the harnesses Dev-OS could not live-verify',
      /fixture-verified/i.test(docOut), docOut.slice(-500));
  } finally {
    fs.rmSync(allProj, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // Review fix pass. Each case below reproduces a defect the whole-branch
  // review found. Antigravity's arg spellings and decision values re-verified
  // 2026-11-09 against antigravity.google/docs/hooks?tab=cli.
  // -------------------------------------------------------------------------
  const helper = path.join(proj, '.agents', 'hooks', 'lib', 'hook-input.js');
  const parse = (payload) => {
    const r = spawnSync(process.execPath, [helper], { input: JSON.stringify(payload), encoding: 'utf8', timeout: HOOK_TIMEOUT_MS, env: BASE_ENV });
    const out = {};
    (r.stdout || '').split('\n').filter(Boolean).forEach((line) => {
      const i = line.indexOf('=');
      const k = line.slice(0, i);
      if (k === 'TARGET' || k === 'UTARGET') { (out[k] = out[k] || []).push(line.slice(i + 1)); }
      else out[k] = line.slice(i + 1);
    });
    return out;
  };

  // C1: Antigravity's run_command puts the command under toolCall.args.CommandLine
  // (PascalCase). Folded to the Claude spelling, every gate was dead on that harness.
  const agDestructive = parse({ hook_event_name: 'PreToolUse', toolCall: { name: 'run_command', args: { CommandLine: 'rm -rf / --no-preserve-root', Cwd: proj } }, workspacePaths: [proj] });
  check('[fix C1] Antigravity CommandLine is read as the command', agDestructive.COMMAND === 'rm -rf / --no-preserve-root', JSON.stringify(agDestructive).slice(0, 200));
  check('[fix C1] a destructive Antigravity command is recognised as destructive', Boolean(agDestructive.DESTRUCTIVE), JSON.stringify(agDestructive).slice(0, 200));
  const agCommit = parse({ hook_event_name: 'PreToolUse', toolCall: { name: 'run_command', args: { CommandLine: 'git commit -m x' } }, workspacePaths: [proj] });
  check('[fix C1] the commit gate sees an Antigravity git commit', agCommit.GIT_COMMIT === '1', JSON.stringify(agCommit).slice(0, 160));
  const agWrite = parse({ hook_event_name: 'PreToolUse', toolCall: { name: 'write_to_file', args: { TargetFile: path.join(proj, 'src', 'App.tsx'), CodeContent: 'x' } }, workspacePaths: [proj] });
  check('[fix C1] Antigravity TargetFile is read as the written path', /App\.tsx$/.test(agWrite.FILE_PATH || ''), JSON.stringify(agWrite).slice(0, 200));
  const agBlock = runHook(hookPre, { cwd: proj, env: { DEVOS_OFFLINE: '1', DEVOS_HOOK_FORMAT: 'antigravity' },
    input: JSON.stringify({ hook_event_name: 'PreToolUse', toolCall: { name: 'run_command', args: { CommandLine: 'rm -rf /' } }, workspacePaths: [proj] }) });
  let agBlockJson = null;
  try { agBlockJson = JSON.parse(agBlock.stdout || ''); } catch (e) {}
  check('[fix C1] Antigravity actually refuses a destructive command, as a decision',
    agBlock.status === 0 && Boolean(agBlockJson) && agBlockJson.decision === 'deny', hookDetail(agBlock));

  // C2: the design and orchestration gates were tool-name-agnostic. Claude Code's matcher hid
  // that; the new adapters fire on every tool, so reading a .tsx file was refused.
  fs.rmSync(path.join(proj, 'DESIGN.md'), { force: true });
  const readProbe = (toolName, input, fmt) => runHook(hookPre, { cwd: proj, env: { DEVOS_OFFLINE: '1', ...(fmt ? { DEVOS_HOOK_FORMAT: fmt } : {}) },
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: toolName, tool_input: input, cwd: proj }) });
  const uiFileRel = path.join(proj, 'src', 'Probe.tsx');
  fs.mkdirSync(path.dirname(uiFileRel), { recursive: true });
  fs.writeFileSync(uiFileRel, 'export const Probe = () => null;\n', 'utf8');
  [['Read', { file_path: uiFileRel }], ['Grep', { pattern: 'x', path: uiFileRel }], ['Glob', { path: uiFileRel }]].forEach(([tool, input]) => {
    const r = readProbe(tool, input);
    check(`[fix C2] a read-only ${tool} of a frontend file is allowed without DESIGN.md`, r.status === 0, hookDetail(r));
  });
  const writeStillBlocked = readProbe('Write', { file_path: uiFileRel, content: 'x' });
  check('[fix C2] writing a frontend file without DESIGN.md is still refused', isBlocked(writeStillBlocked), hookDetail(writeStillBlocked));
  const ocRead = readProbe('read', { filePath: uiFileRel }, 'opencode');
  check('[fix C2] OpenCode\'s lowercase read tool is allowed too', ocRead.status === 0, hookDetail(ocRead));
  fs.writeFileSync(path.join(proj, 'DESIGN.md'), '# Design Specification\n', 'utf8');

  // C4: the fail-closed paths bypassed devos_block, so on Antigravity they failed OPEN.
  const noNodeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-nonode-'));
  // Shadow node with a stub that fails, rather than emptying PATH: the hook needs grep, sed
  // and friends to reach its fail-closed path at all.
  fs.writeFileSync(path.join(noNodeDir, 'node'), '#!/bin/sh\nexit 127\n', { mode: 0o755 });
  const failClosed = runHook(hookPre, { cwd: proj,
    env: { DEVOS_OFFLINE: '1', DEVOS_HOOK_FORMAT: 'antigravity', PATH: `${noNodeDir}:${process.env.PATH}` },
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf /' }, cwd: proj }) });
  let failClosedJson = null;
  try { failClosedJson = JSON.parse(failClosed.stdout || ''); } catch (e) {}
  check('[fix C4] with no parser available, Antigravity still gets a deny decision',
    Boolean(failClosedJson) && failClosedJson.decision === 'deny', hookDetail(failClosed));
  fs.rmSync(noNodeDir, { recursive: true, force: true });

  // C5: the commit ask JSON was printed on every harness, bypassing the output layer. On
  // Antigravity it could even concatenate with a deny, making both unparseable.
  const commitCmd = '.agents/scripts/commit.sh --agent "feat: x"';
  const askClaude = runHook(hookPre, { cwd: proj, env: { DEVOS_OFFLINE: '1', CLAUDECODE: '1' },
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: commitCmd }, cwd: proj }) });
  check('[fix C5] Claude Code still gets the permissionDecision ask for a canonical commit',
    /"permissionDecision"\s*:\s*"ask"/.test(askClaude.stdout || ''), hookDetail(askClaude));
  ['cursor', 'antigravity', 'opencode', 'codex'].forEach((fmt) => {
    const r = runHook(hookPre, { cwd: proj, env: { DEVOS_OFFLINE: '1', CLAUDECODE: '1', DEVOS_HOOK_FORMAT: fmt },
      input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: commitCmd }, cwd: proj }) });
    const out = (r.stdout || '').trim();
    check(`[fix C5] ${fmt} never gets the Claude-shaped ask object`, !/permissionDecision/.test(out), hookDetail(r));
    const parsed = (() => { try { return out ? JSON.parse(out) : {}; } catch (e) { return null; } })();
    check(`[fix C5] ${fmt} output for a commit call is a single parseable response`, parsed !== null, out.slice(0, 200));
  });

  // I6: Antigravity marks decision Required, so the allow path must say allow.
  const agAllow = runHook(hookPre, { cwd: proj, env: { DEVOS_OFFLINE: '1', DEVOS_HOOK_FORMAT: 'antigravity' },
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git status -sb' }, cwd: proj }) });
  let agAllowJson = null;
  try { agAllowJson = JSON.parse(agAllow.stdout || ''); } catch (e) {}
  check('[fix I6] a permitted Antigravity call returns {"decision":"allow"}',
    agAllow.status === 0 && Boolean(agAllowJson) && agAllowJson.decision === 'allow', hookDetail(agAllow));

  // I7: subagent-start bypassed the output layer, so Cursor got a Claude-shaped reply.
  const subCursor = runHook(hookSubStart, { cwd: proj, env: { DEVOS_OFFLINE: '1', DEVOS_HOOK_FORMAT: 'cursor' },
    input: JSON.stringify({ hook_event_name: 'SubagentStart', agent_id: 'a1', agent_type: 'developer' }) });
  let subCursorJson = null;
  try { subCursorJson = JSON.parse(subCursor.stdout || ''); } catch (e) {}
  check('[fix I7] subagent-start speaks Cursor\'s shape on Cursor',
    Boolean(subCursorJson) && typeof subCursorJson.additional_context === 'string' && !('hookSpecificOutput' in subCursorJson), hookDetail(subCursor));

  // I8: the lib/common.sh fallback did not define devos_hook_format, so session-start crashed
  // into plain text on the harnesses that need JSON.
  const partial = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-partial-'));
  try {
    fs.cpSync(path.join(proj, '.agents'), path.join(partial, '.agents'), { recursive: true });
    fs.cpSync(path.join(proj, 'docs'), path.join(partial, 'docs'), { recursive: true });
    fs.rmSync(path.join(partial, '.agents', 'hooks', 'lib', 'common.sh'), { force: true });
    const r = runHook(path.join(partial, '.agents', 'hooks', 'session-start.sh'), { cwd: partial, env: { DEVOS_OFFLINE: '1', DEVOS_HOOK_FORMAT: 'cursor' } });
    check('[fix I8] a partial install does not print an undefined-function error', !/command not found/.test(r.stderr || ''), (r.stderr || '').slice(0, 200));
    check('[fix I8] a partial install still exits 0', r.status === 0, hookDetail(r));
  } finally {
    fs.rmSync(partial, { recursive: true, force: true });
  }

  // I10: isolation: remote is not in the subagent docs, so it must not be accepted.
  check('[fix I10] the generator accepts only the documented isolation value',
    /const AGENT_ISOLATIONS = \['worktree'\];/.test(fs.readFileSync(path.join(ROOT, 'bin', 'devos.js'), 'utf8')));

  // Generator validation, on a throwaway roster.
  const w4 = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-w4-'));
  try {
    runCli(['init', '--existing', '--stack', 'universal', '--platform', 'claude', '--no-hooks', '--quiet'], w4);
    const srcA = path.join(w4, '.agents', 'agents');
    const writeAgent = (n, fm) => fs.writeFileSync(path.join(srcA, `${n}.md`), `---\nname: ${n}\ndescription: Use when testing the ${n} generator path.\n${fm}\n---\n\n# ${n}\n\nBody.\n`, 'utf8');
    writeAgent('fullkeys', [
      'tools: Read, Grep', 'disallowedTools: Write', 'model: claude-opus-5-5', 'effort: xhigh',
      'maxTurns: 25', 'color: cyan', 'memory: local', 'isolation: worktree', 'omitClaudeMd: true',
      'background: true', 'autoCompactWindow: 200000', 'skills: qa, testing-guide'
    ].join('\n'));
    writeAgent('badvalues', ['model: gpt-4', 'effort: extreme', 'color: beige', 'memory: everywhere', 'isolation: sandbox', 'maxTurns: lots'].join('\n'));
    writeAgent('bedrockmodel', ['model: us.anthropic.claude-opus-4-5-v1:0'].join('\n'));
    writeAgent('vertexmodel', ['model: claude-sonnet-4-5@20250929'].join('\n'));
    writeAgent('ignoredkeys', ['permissionMode: bypassPermissions', 'hooks: {}', 'mcpServers: foo', 'initialPrompt: go'].join('\n'));
    writeAgent('missingskill', ['skills: qa, no-such-skill-here'].join('\n'));
    const upd = runCli(['update', '--yes', '--force'], w4);
    const gen = (n) => {
      const f = path.join(w4, '.claude', 'agents', `${n}.md`);
      return fs.existsSync(f) ? (fs.readFileSync(f, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/) || [])[1] || '' : '';
    };
    const full = gen('fullkeys');
    check('[W4] every documented subagent key is passed through', [
      /^tools: Read, Grep$/m, /^disallowedTools: Write$/m, /^model: claude-opus-5-5$/m, /^effort: xhigh$/m,
      /^maxTurns: 25$/m, /^color: cyan$/m, /^memory: local$/m, /^isolation: worktree$/m,
      /^omitClaudeMd: true$/m, /^background: true$/m, /^autoCompactWindow: 200000$/m, /^skills: qa, testing-guide$/m
    ].every((re) => re.test(full)), full);
    const bad = gen('badvalues');
    check('[W4] invalid values are dropped rather than written through',
      !/^effort:/m.test(bad) && !/^color:/m.test(bad) && !/^memory:/m.test(bad) && !/^isolation:/m.test(bad) && !/^maxTurns:/m.test(bad), bad);
    check('[W4] an unknown model is dropped with a warning', !/gpt-4/.test(bad) && /unknown model/.test(upd.stdout + upd.stderr));
    check('[W4] a Bedrock-style full model id is kept, not dropped as unknown',
      /^model: us\.anthropic\.claude-opus-4-5-v1:0$/m.test(gen('bedrockmodel')), gen('bedrockmodel'));
    check('[W4] a Vertex-style full model id is kept, not dropped as unknown',
      /^model: claude-sonnet-4-5@20250929$/m.test(gen('vertexmodel')), gen('vertexmodel'));
    const ign = gen('ignoredkeys');
    check('[W4] keys Claude Code ignores on plugin agents are never emitted',
      !/^permissionMode:/m.test(ign) && !/^hooks:/m.test(ign) && !/^mcpServers:/m.test(ign) && !/^initialPrompt:/m.test(ign), ign);
    check('[W4] dropping an ignored key says so, without claiming .claude/agents ignores it',
      /permissionMode/.test(upd.stdout + upd.stderr) && !/Claude Code ignores on a plugin-provided agent/.test(upd.stdout + upd.stderr), (upd.stdout + upd.stderr).slice(0, 400));
    const miss = gen('missingskill');
    check('[W4] a preloaded skill that is not installed is dropped, the rest are kept',
      /^skills: qa$/m.test(miss) && /no-such-skill-here/.test(upd.stdout + upd.stderr), miss);
  } finally {
    fs.rmSync(w4, { recursive: true, force: true });
  }

  const gateProj = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-gate-'));
  fs.cpSync(path.join(proj, '.agents'), path.join(gateProj, '.agents'), { recursive: true });
  const gateHook = path.join(gateProj, '.agents', 'hooks', 'session-start.sh');
  const gateEnv = { DEVOS_PLUGIN_MODE: '1', DEVOS_OFFLINE: '1', DEVOS_SUPERPOWERS: 'off', CLAUDE_PROJECT_DIR: gateProj };
  const gateNoSettings = runHook(gateHook, { cwd: gateProj, env: gateEnv });
  check('[W5] plugin hooks run in a Dev-OS project that did not wire .claude/settings.json', gateNoSettings.status === 0 && (gateNoSettings.stdout || '').includes('Dev-OS Active'), hookDetail(gateNoSettings));
  fs.mkdirSync(path.join(gateProj, '.claude'));
  fs.copyFileSync(path.join(proj, '.claude', 'settings.json'), path.join(gateProj, '.claude', 'settings.json'));
  const gateOwned = runHook(gateHook, { cwd: gateProj, env: gateEnv });
  check('[W5] plugin hooks stand down when the project install wires .agents/hooks/', gateOwned.status === 0 && (gateOwned.stdout || '').trim() === '', hookDetail(gateOwned));
  const gateDirect = runHook(gateHook, { cwd: gateProj, env: { ...gateEnv, DEVOS_PLUGIN_MODE: '' } });
  check('[W5] the project install itself still runs (gate is a no-op without DEVOS_PLUGIN_MODE)', gateDirect.status === 0 && (gateDirect.stdout || '').includes('Dev-OS Active'), hookDetail(gateDirect));

  const promptHook = runHook(hookPrompt, { cwd: proj });
  check('user-prompt-submit.sh emits the orchestrator directive', promptHook.status === 0 && promptHook.stdout.includes('Orchestrator Directive') && promptHook.stdout.includes('Mode:'));

  const modeStatus = runCli(['mode', 'status', '--quiet'], proj);
  check('devos mode status exits 0', modeStatus.status === 0 && modeStatus.stdout.includes('Mode:'));
  const modeSet = runCli(['mode', 'auto', '--quiet'], proj);
  sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  check('devos mode auto sets delegationRequired', modeSet.status === 0 && sessionData.mode === 'auto' && sessionData.delegationRequired === true);

  fs.writeFileSync(path.join(proj, 'docs', 'TASK_BOARD.md'), '# Board\n\n### [ IN_PROGRESS ]\n*(none)*\n\n### [ QUEUED ]\n\n### [ BACKLOG ]\n\n### [ DONE ]\n', 'utf8');
  const orchBlock = runHook(hookPre, { args: ['echo x > src/app.js'], cwd: proj });
  check('Orchestration Gate blocks solo production write without an assigned active task (exit 2)', isBlocked(orchBlock, 'Orchestration Gate'), hookDetail(orchBlock));

  const orchEditJson = JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: path.join(proj, 'src', 'app.js'), content: 'x' } });
  const orchBlockJson = runHook(hookPre, { cwd: proj, input: orchEditJson });
  check('Orchestration Gate blocks Write via stdin JSON without an assigned active task', isBlocked(orchBlockJson, 'Orchestration Gate'), hookDetail(orchBlockJson));

  const orchEscape = runHook(hookPre, { args: ['echo x > src/app.js'], cwd: proj, env: { DEVOS_SOLO_APPROVED: 'true' } });
  check('Orchestration Gate escape hatch allows approved solo work', orchEscape.status === 0, hookDetail(orchEscape));

  fs.writeFileSync(path.join(proj, 'docs', 'TASK_BOARD.md'), '# Board\n\n### [ IN_PROGRESS ]\n- **TASK-X**: thing\n  - **Assignee:** Developer\n\n### [ QUEUED ]\n\n### [ BACKLOG ]\n\n### [ DONE ]\n', 'utf8');
  const orchAllow = runHook(hookPre, { args: ['echo x > src/app.js'], cwd: proj });
  check('Orchestration Gate allows writes when an assigned active task exists', orchAllow.status === 0, hookDetail(orchAllow));
  const orchAllowJson = runHook(hookPre, { cwd: proj, input: orchEditJson });
  check('Orchestration Gate allows Write via stdin JSON when an assigned active task exists', orchAllowJson.status === 0, hookDetail(orchAllowJson));

  const modeReset = runCli(['mode', 'interactive', '--quiet'], proj);
  sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  check('devos mode interactive clears delegation requirement', modeReset.status === 0 && sessionData.delegationRequired === false);

  // CLI Subcommands verification: run/auto & telemetry
  const autoList = runCli(['auto', '--list', '--quiet'], proj);
  check('devos auto --list exits 0 and shows 10 stages', autoList.status === 0 && autoList.stdout.includes('Inception') && autoList.stdout.includes('Humanizer Audit'));

  const autoDryRun = runCli(['auto', '--dry-run', 'Build an MVP habit tracker', '--quiet'], proj);
  check('devos auto --dry-run exits 0', autoDryRun.status === 0 && autoDryRun.stdout.includes('DRY-RUN'));

  const autoInit = runCli(['auto', 'Build an MVP habit tracker', '--quiet'], proj);
  const sdlcStatePath = path.join(proj, '.agents', 'memory', 'sdlc-state.json');
  check('devos auto initialises pipeline and writes sdlc-state.json', autoInit.status === 0 && fs.existsSync(sdlcStatePath));

  const sdlcState = fs.existsSync(sdlcStatePath) ? JSON.parse(fs.readFileSync(sdlcStatePath, 'utf8')) : {};
  check('sdlc-state.json has correct schema', sdlcState.schemaVersion === '1.0.0' && sdlcState.currentStage === 'inception' && sdlcState.mode === 'auto');

  const autoStatus = runCli(['auto', '--status', '--quiet'], proj);
  check('devos auto --status exits 0', autoStatus.status === 0 && autoStatus.stdout.includes('inception'));

  const autoStep = runCli(['auto', '--step', 'inception', '--quiet'], proj);
  check('devos auto --step inception exits 0 with delegation prompt', autoStep.status === 0 && autoStep.stdout.includes('Architect Agent') && autoStep.stdout.includes('grill-me'));

  const autoStepDesign = runCli(['auto', '--step', 'design', '--quiet'], proj);
  check('devos auto --step design shows gate status', autoStepDesign.status === 0 && autoStepDesign.stdout.includes('Gate Check'));

  const autoJson = runCli(['auto', '--status', '--json'], proj);
  check('devos auto --status --json outputs valid JSON', (() => { try { const j = JSON.parse(autoJson.stdout); return j.currentStage === 'inception'; } catch { return false; } })());

  const autoReset = runCli(['auto', '--reset', '--quiet'], proj);
  check('devos auto --reset clears state', autoReset.status === 0 && !fs.existsSync(path.join(proj, '.agents', 'memory', 'sdlc-state.json')));

  const telemStatus = runCli(['telemetry', 'status', '--quiet'], proj);
  check('devos telemetry status exits 0', telemStatus.status === 0 && telemStatus.stdout.includes('Enabled (on - recommended)'));

  const telemReport = runCli(['telemetry', 'report', '--quiet'], proj);
  check('devos telemetry report exits 0', telemReport.status === 0);

  // Telemetry Ingestion & Auto-PR Feedback Loop verification (TASK-004)
  const mockGhToken = ['ghp', '111122223333444455556666777788889999'].join('_');
  const mockAntKey = ['sk-ant-api03', '12345678901234567890123456789012'].join('-');
  const telemLog = runCli(['telemetry', 'log', '--type', 'HOOK_VIOLATION', '--rule', 'ORCHESTRATION_GATE', '--detail', 'Blocked write to src/app.ts with token ' + mockGhToken, '--quiet'], proj);
  check('devos telemetry log exits 0', telemLog.status === 0);

  const telemReportJson = runCli(['telemetry', 'report', '--json'], proj);
  check('devos telemetry report --json outputs valid RCA schema', (() => {
    try {
      const rep = JSON.parse(telemReportJson.stdout);
      return rep.status === 'enabled' && rep.total > 0 && Array.isArray(rep.clusters) && rep.clusters.length > 0;
    } catch { return false; }
  })());

  const telemIssueDry = runCli(['telemetry', 'issue', '--dry-run', '--quiet'], proj);
  check('devos telemetry issue --dry-run exits 0 and sanitizes output', telemIssueDry.status === 0 && !telemIssueDry.stdout.includes(mockGhToken) && fs.existsSync(path.join(proj, '.agents', 'telemetry', 'reports')));

  const telemPrDry = runCli(['telemetry', 'pr', '--dry-run', '--quiet'], proj);
  check('devos telemetry pr --dry-run exits 0', telemPrDry.status === 0 && telemPrDry.stdout.includes('UPSTREAM DIAGNOSTIC PR (DRY-RUN)'));

  // C5: publishing upstream needs --yes or an interactive TTY confirm. A fake gh on
  // PATH records any invocation so a regression can never file a real issue.
  const fakeBin = path.join(scratch, 'fake-bin');
  const ghMarker = path.join(scratch, 'gh-called');
  fs.mkdirSync(fakeBin, { recursive: true });
  fs.writeFileSync(path.join(fakeBin, 'gh'), `#!/bin/sh\necho "$@" >> "${ghMarker}"\nexit 1\n`, { mode: 0o755 });
  const telemIssueNoConsent = runCli(['telemetry', 'issue', '--quiet'], proj, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: `${fakeBin}${path.delimiter}${process.env.PATH || ''}` }
  });
  check('devos telemetry issue without --yes/--dry-run in non-TTY exits non-zero', telemIssueNoConsent.status !== 0 && telemIssueNoConsent.status !== null, `exit=${telemIssueNoConsent.status}`);
  check('devos telemetry issue without consent never calls gh', !fs.existsSync(ghMarker), fs.existsSync(ghMarker) ? fs.readFileSync(ghMarker, 'utf8').trim() : '');

  const telemIssueYes = runCli(['telemetry', 'issue', '--yes', '--quiet'], proj, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: `${fakeBin}${path.delimiter}${process.env.PATH || ''}` }
  });
  check('devos telemetry issue --yes is still refused without an interactive TTY', telemIssueYes.status !== 0 && telemIssueYes.status !== null && !fs.existsSync(ghMarker), `exit=${telemIssueYes.status}`);
  const telemPrAgent = runCli(['telemetry', 'pr', '--yes', '--quiet'], proj, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: `${fakeBin}${path.delimiter}${process.env.PATH || ''}`, CLAUDECODE: '1' }
  });
  check('devos telemetry pr --yes refuses inside an agent shell (CLAUDECODE=1)', telemPrAgent.status !== 0 && /agent shell/.test(telemPrAgent.stderr || '') && !fs.existsSync(ghMarker), (telemPrAgent.stderr || '').trim().slice(0, 200));

  const telemExport = runCli(['telemetry', 'export', '--quiet'], proj);
  check('devos telemetry export exits 0', telemExport.status === 0);

  const { sanitizeTelemetry } = require(CLI);
  const testSanitized = sanitizeTelemetry('Found key ' + mockAntKey + ' and token ' + mockGhToken + ' in ' + proj + '/src/auth.ts', { targetDir: proj });
  check('sanitizeTelemetry masks credentials and repo paths', testSanitized.includes('[REDACTED_ANTHROPIC_KEY]') && testSanitized.includes('[REDACTED_GITHUB_TOKEN]') && !testSanitized.includes(proj));

  // Evaluation Runner & Benchmarks verification
  check('eval suites installed (.agents/evals/suites/)', fs.existsSync(path.join(proj, '.agents', 'evals', 'suites', 'gates.eval.json')));
  const evalList = runCli(['eval', 'list', '--quiet'], proj);
  check('devos eval list exits 0', evalList.status === 0 && evalList.stdout.includes('gates'));
  const evalRun = runCli(['eval', 'run', '--suite', 'memory-preservation', '--quiet'], proj);
  check('devos eval run exits 0', evalRun.status === 0 && evalRun.stdout.includes('EVAL_PASSED'));
  const evalScorecard = runCli(['eval', 'scorecard', '--quiet'], proj);
  check('devos eval scorecard exits 0', evalScorecard.status === 0 && evalScorecard.stdout.includes('DEV-OS EVALUATION SCORECARD'));

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
  checkSettings(settingsPath, 're-init');

  // Legacy Dev-OS hooks.json is removed by update (C1)
  fs.writeFileSync(path.join(proj, '.claude', 'hooks.json'), JSON.stringify({ hooks: { PreToolUse: [{ command: 'bash .agents/hooks/pre-tool-use.sh' }] } }, null, 2), 'utf8');

  // -------------------------------------------------------------------------
  // 3b. devos update safely refreshes components
  // -------------------------------------------------------------------------
  const update = runCli(['update', '--quiet'], proj);
  check('devos update exits 0', update.status === 0, (update.stderr || update.stdout || '').trim().slice(0, 300));
  checkSettings(settingsPath, 'update');
  check('devos update removes legacy Dev-OS .claude/hooks.json', !fs.existsSync(path.join(proj, '.claude', 'hooks.json')));
  const hooksJsonBackups = fs.readdirSync(path.join(proj, '.agents', '_backup')).filter((d) => d.startsWith('migration-') &&
    fs.existsSync(path.join(proj, '.agents', '_backup', d, '.claude', 'hooks.json')));
  check('[F8] legacy .claude/hooks.json is backed up to _backup/migration-*/ before removal', hooksJsonBackups.length === 1);
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
    const ocPolicy = (readJson(path.join(ocProj, '.agents', 'manifest.json')) || {}).commitPolicy;
    check('[commit-policy] non-Claude install (opencode) defaults to human', ocPolicy === 'human', String(ocPolicy));
    check('devos init --platform opencode exits 0', ocInit.status === 0, ocInit.stderr);
    check('AGENTS.md created for opencode platform', fs.existsSync(path.join(ocProj, 'AGENTS.md')));
    check('opencode.json created at the project root for opencode platform', Boolean(readJson(path.join(ocProj, 'opencode.json'))));
    check('.claude/ not created when targeting only opencode', !fs.existsSync(path.join(ocProj, '.claude')));
    const ocDoctor = runCli(['doctor', '--quiet'], ocProj);
    check('devos doctor exits 0 in opencode-targeted project', ocDoctor.status === 0);
  } finally {
    fs.rmSync(ocProj, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // 3e. auto mode and options verification
  // -------------------------------------------------------------------------
  const autoProj = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-auto-'));
  try {
    // Equals-form flags (--key=value) must be honoured like the spaced form.
    const autoInit = runCli(['init', '--existing', '--stack=nextjs', '--mode=auto', '--platform=antigravity', '--all-skills', '--no-hooks', '--quiet'], autoProj);
    check('devos init with --mode auto and --all-skills exits 0', autoInit.status === 0, autoInit.stderr);
    const autoManifest = JSON.parse(fs.readFileSync(path.join(autoProj, '.agents', 'manifest.json'), 'utf8'));
    check('manifest mode is auto', autoManifest.mode === 'auto');
    check('manifest platform is antigravity', autoManifest.platform === 'antigravity');
    const nextStandards = path.join(ROOT, '.agents', 'skills', 'stacks', 'nextjs.md');
    const autoStandards = path.join(autoProj, 'CODING_STANDARDS.md');
    check('--stack=nextjs (equals form) installs the nextjs standards',
      fs.existsSync(autoStandards) && fs.existsSync(nextStandards) && fs.readFileSync(autoStandards, 'utf8') === fs.readFileSync(nextStandards, 'utf8'));
    const installedCount = fs.readdirSync(path.join(autoProj, '.agents', 'skills')).filter((f) => f !== '_backup' && fs.statSync(path.join(autoProj, '.agents', 'skills', f)).isDirectory()).length;
    check('all skills installed when --all-skills specified', installedCount === SOURCE_SKILL_DIRS.length, `installed: ${installedCount} of ${SOURCE_SKILL_DIRS.length}`);
    check('--all-skills does not install maintainer agents', MAINTAINER_AGENTS.every((a) => !fs.existsSync(path.join(autoProj, '.agents', 'agents', `${a}.md`))));
    check('hooks not wired when --no-hooks specified', !fs.existsSync(path.join(autoProj, '.claude', 'settings.json')) && !fs.existsSync(path.join(autoProj, '.claude', 'hooks.json')));
  } finally {
    fs.rmSync(autoProj, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // 3f. non-TTY init without --fresh/--existing fails clearly and writes nothing
  // -------------------------------------------------------------------------
  const ttyProj = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-notty-'));
  try {
    const noTty = runCli(['init', '--quiet'], ttyProj, { stdio: ['ignore', 'pipe', 'pipe'] });
    check('non-TTY init without --fresh/--existing exits non-zero', noTty.status !== 0 && noTty.status !== null, `exit=${noTty.status}`);
    check('non-TTY init without --fresh/--existing writes no .agents/', !fs.existsSync(path.join(ttyProj, '.agents')));
  } finally {
    fs.rmSync(ttyProj, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // 3g. 4.x -> 5.0 migration (simulated 4.5 install with old-named files)
  // -------------------------------------------------------------------------
  const migProj = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-mig-'));
  try {
    const migInit = runCli(['init', '--existing', '--stack', 'universal', '--platform', 'claude', '--no-hooks', '--quiet'], migProj);
    check('migration fixture: init exits 0', migInit.status === 0, migInit.stderr);
    const a = (...p) => path.join(migProj, '.agents', ...p);
    const c = (...p) => path.join(migProj, '.claude', ...p);
    // 4.5-style generated subagent: name/description frontmatter + source body
    const legacyAgent = (name, body) => `---\nname: ${name}\ndescription: Dev-OS ${name}\n---\n\n${body.trim()}\n`;
    const manifestPath = a('manifest.json');
    const manifest = readJson(manifestPath) || {};
    manifest.version = '4.5.0';
    manifest.generatedFiles = manifest.generatedFiles || {};
    manifest.skills = manifest.skills || {};

    // (1) executive-proxy: Dev-OS wrote it (hash recorded) and nobody edited it -> removed
    const epBody = '# Executive Proxy\n\nAutonomous delivery persona.\n';
    fs.writeFileSync(a('agents', 'executive-proxy.md'), epBody);
    manifest.generatedFiles['.agents/agents/executive-proxy.md'] = sha256(Buffer.from(epBody));
    fs.writeFileSync(c('agents', 'executive-proxy.md'), legacyAgent('executive-proxy', epBody));
    manifest.generatedFiles['.claude/agents/executive-proxy.md'] = sha256(Buffer.from(legacyAgent('executive-proxy', epBody)));
    // (2) release-manager: the user edited both copies -> kept (and backed up)
    fs.writeFileSync(a('agents', 'release-manager.md'), '# Release Manager\n\nMy team notes.\n');
    fs.writeFileSync(c('agents', 'release-manager.md'), legacyAgent('release-manager', '# Release Manager (custom)\n\nEdited by hand.'));
    // (3) a moved command generated by 4.x from its own source copy -> both handled; the copy matches no release so it is kept
    fs.writeFileSync(c('commands', 'eval.md'), '---\ndescription: Run evals\n---\n\nRun the eval suites.\n\n## Dev-OS Routing\n\n- Adopt the persona defined in `.agents/agents/eval-engineer.md`.\n');
    fs.writeFileSync(a('commands', 'eval.md'), '---\nname: eval\ndescription: Run evals\nagent: eval-engineer\n---\n\nRun the eval suites.\n');
    // (4) sre from the real v4.5.0 release, when git history is available
    let sre45 = null;
    const gitShow = spawnSync('git', ['-C', ROOT, 'show', 'v4.5.0:.agents/agents/sre.md'], { encoding: 'utf8' });
    if (gitShow.status === 0 && gitShow.stdout) {
      sre45 = gitShow.stdout;
      fs.writeFileSync(a('agents', 'sre.md'), sre45);
      // The exact v4.5.0 generator output (its AGENT_DESCRIPTIONS.sre)
      fs.writeFileSync(c('agents', 'sre.md'), `---\nname: sre\ndescription: ${SRE_45_DESCRIPTION}\n---\n\n${sre45.trim()}\n`);
    }
    // (5) merged skills: one untouched (hash recorded), one customized (no record)
    const aliasNames = Object.keys(ALIASES).filter((n) => !SOURCE_SKILL_DIRS.includes(n));
    const [cleanOld, customOld] = aliasNames;
    const mkSkill = (name, extra) => {
      fs.mkdirSync(a('skills', name), { recursive: true });
      fs.writeFileSync(a('skills', name, 'SKILL.md'), `---\nname: ${name}\ndescription: legacy\n---\n${extra}\n`);
    };
    if (cleanOld) {
      mkSkill(cleanOld, 'as shipped');
      const { computeSkillHash } = require(CLI);
      manifest.skills[cleanOld] = { source: 'core', hash: computeSkillHash(a('skills', cleanOld)), customized: false };
      fs.rmSync(a('skills', ALIASES[cleanOld]), { recursive: true, force: true });
    }
    if (customOld) mkSkill(customOld, 'customized by the user');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

    const migUpdate = runCli(['update', '--quiet'], migProj);
    check('migration: devos update exits 0', migUpdate.status === 0, (migUpdate.stderr || migUpdate.stdout || '').trim().slice(-400));
    check('migration: unedited generated executive-proxy removed (.agents + .claude)', !fs.existsSync(a('agents', 'executive-proxy.md')) && !fs.existsSync(c('agents', 'executive-proxy.md')));
    const migBackups = fs.existsSync(a('_backup')) ? fs.readdirSync(a('_backup')).filter((d) => d.startsWith('migration-')) : [];
    const inBackup = (...rel) => migBackups.some((d) => fs.existsSync(path.join(a('_backup'), d, ...rel)));
    check('migration: removed files backed up to .agents/_backup/migration-*/', inBackup('.agents', 'agents', 'executive-proxy.md') && inBackup('.claude', 'agents', 'executive-proxy.md'));
    check('migration: user-edited release-manager kept in place, untouched',
      fs.existsSync(a('agents', 'release-manager.md')) && fs.readFileSync(a('agents', 'release-manager.md'), 'utf8').includes('My team notes'));
    check('migration: user-edited .claude/agents/release-manager.md is not regenerated over',
      fs.existsSync(c('agents', 'release-manager.md')) && fs.readFileSync(c('agents', 'release-manager.md'), 'utf8').includes('Edited by hand'));
    check('migration: [ WARN ] names the kept file', (migUpdate.stdout || '').includes('kept .agents/agents/release-manager.md'));
    check('migration: edited .agents/commands/eval.md and its hand-made .claude/ output both kept',
      fs.existsSync(a('commands', 'eval.md')) && fs.existsSync(c('commands', 'eval.md')) && fs.readFileSync(c('commands', 'eval.md'), 'utf8').includes('Run the eval suites.'));
    const evalCmd = fs.existsSync(c('commands', 'eval.md')) ? fs.readFileSync(c('commands', 'eval.md'), 'utf8') : '';
    check('migration: commands for retired agents route through AGENT_ALIASES or their kept source', !evalCmd || evalCmd.includes('## Dev-OS Routing'));
    if (sre45) {
      check('migration: v4.5.0 sre.md recognised by legacy hash and removed (.agents + .claude)', !fs.existsSync(a('agents', 'sre.md')) && !fs.existsSync(c('agents', 'sre.md')));
    }
    if (cleanOld) {
      check(`migration: uncustomized merged skill ${cleanOld} removed, primary ${ALIASES[cleanOld]} installed`,
        !fs.existsSync(a('skills', cleanOld)) && fs.existsSync(a('skills', ALIASES[cleanOld], 'SKILL.md')));
    } else {
      check('migration: packs.json aliases available for skill migration', false, 'no alias whose old dir is gone from .agents/skills');
    }
    if (customOld) {
      const skillBackups = fs.existsSync(a('_backup', 'skills')) ? fs.readdirSync(a('_backup', 'skills')) : [];
      check(`migration: customized merged skill ${customOld} backed up before removal`,
        !fs.existsSync(a('skills', customOld)) && skillBackups.some((d) => d.startsWith(`${customOld}-`)));
    }
    const migManifest = readJson(manifestPath) || {};
    check('migration: manifest updated (version, migratedFrom, no retired skill entries)',
      migManifest.version === require(path.join(ROOT, 'package.json')).version && migManifest.migratedFrom === '4.5.0' &&
      (!cleanOld || !migManifest.skills[cleanOld]) && !migManifest.generatedFiles['.agents/agents/executive-proxy.md']);
    const migDirsBefore = fs.readdirSync(a('_backup')).filter((d) => d.startsWith('migration-')).length;
    const migAgain = runCli(['update', '--quiet'], migProj);
    check('migration: a second update with only kept (edited) retired files creates no new _backup/migration-* dir',
      fs.readdirSync(a('_backup')).filter((d) => d.startsWith('migration-')).length === migDirsBefore);
    check('migration: a second update removes nothing more and keeps edited files', migAgain.status === 0 && !(migAgain.stdout || '').includes('retired file(s) removed') && fs.existsSync(a('agents', 'release-manager.md')));
  } finally {
    fs.rmSync(migProj, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // 3h. Upgrade data safety on a REAL v4.5.0 install (extracted from git history)
  // F1 edited .claude files kept, F4 hooks choice, F5 new core skills, F6 whole-file match
  // -------------------------------------------------------------------------
  const old45 = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-v450-'));
  const tagOk = spawnSync('git', ['-C', ROOT, 'rev-parse', '--verify', '-q', 'v4.5.0^{commit}'], { encoding: 'utf8' }).status === 0 &&
    spawnSync('bash', ['-c', `git -C "${ROOT}" archive v4.5.0 | tar -x -C "${old45}"`], { encoding: 'utf8' }).status === 0 &&
    fs.existsSync(path.join(old45, 'bin', 'devos.js'));
  // v4.5.0 init with --no-hooks never touches the network
  const init45 = (dir, extra = []) => spawnSync(process.execPath, [path.join(old45, 'bin', 'devos.js'), 'init', '--existing', '--platform', 'claude', '--no-hooks', '--quiet', ...extra], {
    cwd: dir, encoding: 'utf8', input: '', timeout: CLI_TIMEOUT_MS, env: BASE_ENV
  });
  const migrationDirs = (dir) => (fs.existsSync(path.join(dir, '.agents', '_backup')) ? fs.readdirSync(path.join(dir, '.agents', '_backup')).filter((d) => d.startsWith('migration-')) : []);
  const inMigrationBackup = (dir, ...rel) => migrationDirs(dir).find((d) => fs.existsSync(path.join(dir, '.agents', '_backup', d, ...rel)));
  if (!tagOk) {
    console.log('[ WARN ] v4.5.0 tag not available (shallow clone?); real 4.5 upgrade scenarios skipped');
  } else {
    const p1 = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-up45-'));
    const p2 = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-up45h-'));
    try {
      spawnSync('git', ['init', '-q'], { cwd: p1 });
      const r45 = init45(p1, ['--stack', 'nextjs']);
      check('v4.5.0 fixture: real 4.5 init --no-hooks exits 0', r45.status === 0, (r45.stderr || '').slice(0, 200));
      const a = (...p) => path.join(p1, '.agents', ...p);
      const c = (...p) => path.join(p1, '.claude', ...p);
      const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
      const append = (f, text) => fs.writeFileSync(f, read(f) + text);

      // F1: an edited non-retired file, and a user-authored file named like a new 5.0 command
      append(c('agents', 'developer.md'), '\nMY TEAM RULE: always pair.\n');
      fs.writeFileSync(c('commands', 'spec.md'), '---\ndescription: our own spec command\n---\n\nUser-authored spec flow.\n');
      const qa45 = read(c('agents', 'qa.md'));
      // F6: edits only in frontmatter / after the "## Dev-OS Routing" footer of retired files
      fs.writeFileSync(c('agents', 'sre.md'), read(c('agents', 'sre.md')).replace(/^description: .*$/m, 'description: our on-call lead'));
      append(c('commands', 'telemetry.md'), '- Team note: page #ops on failures.\n');
      const exec45 = read(c('agents', 'executive-proxy.md'));
      // F5: one customized skill
      append(a('skills', 'humanizer', 'SKILL.md'), '\nTEAM HUMANIZER NOTE\n');

      const up1 = runCli(['update', '--quiet'], p1);
      const out1 = up1.stdout || '';
      check('[4.5 upgrade] devos update exits 0', up1.status === 0, (up1.stderr || out1).slice(-300));
      check('[F1] edited .claude/agents/developer.md kept in place', read(c('agents', 'developer.md')).includes('MY TEAM RULE'));
      check('[F1] [ WARN ] tells how to regenerate the kept file',
        out1.includes("[ WARN ] kept your edited .claude/agents/developer.md; run 'devos update --force' to regenerate (a backup is taken)"));
      check('[F1] user-authored .claude/commands/spec.md (Dev-OS name, never generated) kept', read(c('commands', 'spec.md')).includes('User-authored spec flow'));
      check('[F1] unedited 4.5 .claude/agents/qa.md regenerated without a warning',
        read(c('agents', 'qa.md')) !== qa45 && !out1.includes('kept your edited .claude/agents/qa.md'));
      check('[F6] retired sre.md with an edited frontmatter is kept', read(c('agents', 'sre.md')).includes('our on-call lead'));
      check('[F6] retired telemetry.md with an edit after the routing footer is kept', read(c('commands', 'telemetry.md')).includes('page #ops'));
      check('[F6] unedited retired executive-proxy.md (exact 4.5 output) removed and backed up',
        exec45 && !fs.existsSync(c('agents', 'executive-proxy.md')) && Boolean(inMigrationBackup(p1, '.claude', 'agents', 'executive-proxy.md')));
      const m1 = readJson(a('manifest.json')) || {};
      check('[F4] 4.5 --no-hooks install stays unhooked after update (settings.json not wired, manifest false)',
        m1.hooksEnabled === false && devosHookEntries(readJson(c('settings.json')), 'PreToolUse').length === 0);
      const coreSkills = (PACKS.packs.core && PACKS.packs.core.skills) || [];
      const missingCore = coreSkills.filter((sk) => !fs.existsSync(a('skills', sk, 'SKILL.md')));
      check('[F5] upgrade installs every core skill missing from the 4.5 install (writing-plans, grill-me, qa, ...)', missingCore.length === 0, missingCore.join(', '));
      const nextSkills = ((PACKS.packs.nextjs || {}).skills || []).filter((sk) => !fs.existsSync(a('skills', sk, 'SKILL.md')));
      check('[F5] upgrade installs missing skills of the installed stack pack', nextSkills.length === 0, nextSkills.join(', '));
      check('[F5] customized skill kept with a [ WARN ]', read(a('skills', 'humanizer', 'SKILL.md')).includes('TEAM HUMANIZER NOTE') &&
        out1.includes('kept your customized skill .agents/skills/humanizer/'));
      const unedited = ['git-ops', 'code-reviewer', 'autonomous-sdlc'].filter((sk) => fs.existsSync(path.join(ROOT, '.agents', 'skills', sk)));
      const stale = unedited.filter((sk) => read(a('skills', sk, 'SKILL.md')) !== read(path.join(ROOT, '.agents', 'skills', sk, 'SKILL.md')));
      check('[F5] unedited 4.5 skills refreshed to the 5.x text', stale.length === 0, stale.join(', '));

      // A no-op update creates no new migration backup dir
      const before = migrationDirs(p1).length;
      const up2 = runCli(['update', '--quiet'], p1);
      check('no-op update creates no new _backup/migration-* dir', up2.status === 0 && migrationDirs(p1).length === before, `${before} -> ${migrationDirs(p1).length}`);
      check('[F1] a second update still keeps the edited file', read(c('agents', 'developer.md')).includes('MY TEAM RULE'));

      // --force: back up, then regenerate / refresh
      const up3 = runCli(['update', '--force', '--quiet'], p1);
      const bk = inMigrationBackup(p1, '.claude', 'agents', 'developer.md');
      check('[F1] update --force regenerates the edited file', up3.status === 0 && !read(c('agents', 'developer.md')).includes('MY TEAM RULE'));
      check('[F1] update --force backs the edited file up first',
        Boolean(bk) && read(path.join(p1, '.agents', '_backup', bk, '.claude', 'agents', 'developer.md')).includes('MY TEAM RULE'));
      const skillBk = fs.existsSync(a('_backup', 'skills')) ? fs.readdirSync(a('_backup', 'skills')).filter((d) => d.startsWith('humanizer-')) : [];
      check('[F5] update --force refreshes a customized skill after backing it up',
        !read(a('skills', 'humanizer', 'SKILL.md')).includes('TEAM HUMANIZER NOTE') && skillBk.length === 1);

      // F4 + F8: a 4.5 install with hooks (legacy .claude/hooks.json present) gets hooks on upgrade
      spawnSync('git', ['init', '-q'], { cwd: p2 });
      const r45h = init45(p2, ['--stack', 'universal']);
      fs.writeFileSync(path.join(p2, '.claude', 'hooks.json'), JSON.stringify({ hooks: { PreToolUse: [{ command: 'bash .agents/hooks/pre-tool-use.sh' }] } }, null, 2));
      const up4 = runCli(['update', '--quiet'], p2);
      const m2 = readJson(path.join(p2, '.agents', 'manifest.json')) || {};
      check('[F4] 4.5 install with Dev-OS hooks.json keeps hooks on upgrade (wired, manifest true)',
        r45h.status === 0 && up4.status === 0 && m2.hooksEnabled === true && devosHookEntries(readJson(path.join(p2, '.claude', 'settings.json')), 'PreToolUse').length === 1);
      check('[F8] legacy hooks.json backed up before removal on a 4.5 upgrade',
        !fs.existsSync(path.join(p2, '.claude', 'hooks.json')) && Boolean(inMigrationBackup(p2, '.claude', 'hooks.json')));
    } finally {
      fs.rmSync(p1, { recursive: true, force: true });
      fs.rmSync(p2, { recursive: true, force: true });
    }
  }
  fs.rmSync(old45, { recursive: true, force: true });

  // -------------------------------------------------------------------------
  // 3i. re-init merges the manifest (F2), pack add keeps user edits (F1, F3),
  //     skill audit treats third-party nesting as a warning (F7)
  // -------------------------------------------------------------------------
  const p3 = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-reinit-'));
  try {
    const a = (...p) => path.join(p3, '.agents', ...p);
    const c = (...p) => path.join(p3, '.claude', ...p);
    const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
    const i1 = runCli(['init', '--existing', '--stack', 'universal', '--platform', 'claude', '--no-hooks', '--quiet'], p3);
    const optPack = Object.keys(PACKS.packs).find((id) => id !== 'core' && !PACKS.packs[id].default && !PACKS.packs[id].stack &&
      !(PACKS.packs[id].agents || []).length && (PACKS.packs[id].skills || []).length);
    const optSkill = optPack ? PACKS.packs[optPack].skills[0] : null;
    const pa1 = runCli(['pack', 'add', optPack, '--quiet'], p3);
    const pa2 = runCli(['pack', 'add', 'maintainer', '--quiet'], p3);
    check('re-init fixture: init + pack add exit 0', i1.status === 0 && pa1.status === 0 && pa2.status === 0, `${optPack}`);

    // F3: pack add over a customized skill keeps it; --force backs it up first
    fs.appendFileSync(a('skills', optSkill, 'SKILL.md'), '\nMY SKILL TWEAK\n');
    const pa3 = runCli(['pack', 'add', optPack, '--quiet'], p3);
    check(`[F3] pack add keeps customized skill ${optSkill} with a [ WARN ]`,
      pa3.status === 0 && read(a('skills', optSkill, 'SKILL.md')).includes('MY SKILL TWEAK') && (pa3.stdout || '').includes(`kept your customized skill .agents/skills/${optSkill}/`));
    const pa4 = runCli(['pack', 'add', optPack, '--force', '--quiet'], p3);
    const optBk = fs.existsSync(a('_backup', 'skills')) ? fs.readdirSync(a('_backup', 'skills')).filter((d) => d.startsWith(`${optSkill}-`)) : [];
    check('[F3] pack add --force backs the customized skill up, then refreshes it',
      pa4.status === 0 && !read(a('skills', optSkill, 'SKILL.md')).includes('MY SKILL TWEAK') && optBk.length === 1);

    // F1 (pack add): an edited generated subagent is not overwritten
    const maintAgent = MAINTAINER_AGENTS[0];
    fs.appendFileSync(c('agents', `${maintAgent}.md`), '\nLOCAL AGENT EDIT\n');
    const pa5 = runCli(['pack', 'add', 'maintainer', '--quiet'], p3);
    check('[F1] pack add keeps an edited .claude/agents file with a [ WARN ]',
      pa5.status === 0 && read(c('agents', `${maintAgent}.md`)).includes('LOCAL AGENT EDIT') && (pa5.stdout || '').includes(`kept your edited .claude/agents/${maintAgent}.md`));

    // F2: re-init (no hooks flag) keeps packs, skill records, generatedFiles and the hooks choice
    const before = readJson(a('manifest.json')) || {};
    const ri = runCli(['init', '--existing', '--stack', 'universal', '--platform', 'claude', '--quiet'], p3);
    const after = readJson(a('manifest.json')) || {};
    check('[F2] re-init keeps user-added packs in installedPacks', ri.status === 0 && [optPack, 'maintainer'].every((id) => (after.installedPacks || []).includes(id)), JSON.stringify(after.installedPacks));
    check('[F2] re-init keeps skill records and generatedFiles of pack assets',
      Boolean(after.skills && after.skills[optSkill]) && Boolean(after.generatedFiles && after.generatedFiles[`.agents/agents/${maintAgent}.md`]));
    check('[F2] re-init without a hooks flag keeps the recorded --no-hooks choice',
      before.hooksEnabled === false && after.hooksEnabled === false && devosHookEntries(readJson(c('settings.json')), 'PreToolUse').length === 0);
    const up = runCli(['update', '--quiet'], p3);
    check('[F2] update after re-init keeps user-added pack assets',
      up.status === 0 && fs.existsSync(a('agents', `${maintAgent}.md`)) && fs.existsSync(a('skills', optSkill, 'SKILL.md')) &&
      MAINTAINER_COMMANDS.every((cmd) => fs.existsSync(c('commands', `${cmd}.md`))));
    const ri2 = runCli(['init', '--existing', '--stack', 'universal', '--platform', 'claude', '--hooks', '--quiet'], p3);
    const ri3 = runCli(['init', '--existing', '--stack', 'universal', '--platform', 'claude', '--no-hooks', '--quiet'], p3);
    check('[F2] an explicit --no-hooks on re-init still wins over a recorded hooks-on choice',
      ri2.status === 0 && ri3.status === 0 && (readJson(a('manifest.json')) || {}).hooksEnabled === false);

    // F7: nested SKILL.md is an error only in skills Dev-OS ships
    fs.mkdirSync(a('skills', 'vendor-skill', 'references', 'extra'), { recursive: true });
    fs.writeFileSync(a('skills', 'vendor-skill', 'SKILL.md'), '---\nname: vendor-skill\ndescription: Use when testing that third-party skills with nested references only warn in the Dev-OS audit.\n---\n\nBody.\n');
    fs.writeFileSync(a('skills', 'vendor-skill', 'references', 'extra', 'SKILL.md'), '---\nname: extra\ndescription: nested\n---\n');
    const au1 = runCli(['skill', 'audit', '--quiet'], p3);
    check('[F7] skill audit passes with a nested SKILL.md in a third-party skill (WARN only)',
      au1.status === 0 && /\[ WARN \][^\n]*vendor-skill[^\n]*Nested SKILL\.md/.test(au1.stdout || ''), (au1.stdout || '').split('\n').filter((l) => /FAIL|vendor/.test(l)).join(' | ').slice(0, 300));
    const shipped = (PACKS.packs.core.skills || [])[0];
    fs.mkdirSync(a('skills', shipped, 'references', 'nested'), { recursive: true });
    fs.writeFileSync(a('skills', shipped, 'references', 'nested', 'SKILL.md'), '---\nname: nested\ndescription: nested\n---\n');
    const au2 = runCli(['skill', 'audit', '--quiet'], p3);
    check(`[F7] skill audit still fails on a nested SKILL.md in a Dev-OS skill (${shipped})`, au2.status !== 0 && /Nested SKILL\.md/.test(au2.stdout || ''));
  } finally {
    fs.rmSync(p3, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // 3j. Wave 3: cross-harness migration, .claude/skills links, plugin, specs
  // -------------------------------------------------------------------------
  const w3 = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-w3-'));
  try {
    const projA = path.join(w3, 'a');
    fs.mkdirSync(path.join(projA, '.claude', 'skills', 'qa'), { recursive: true });
    // A user's own real directory at a Dev-OS skill name, present before init
    fs.writeFileSync(path.join(projA, '.claude', 'skills', 'qa', 'SKILL.md'), '---\ndescription: my own qa\n---\nmine\n');
    const initA = runCli(['init', '--existing', '--stack', 'universal', '--quiet'], projA);
    check('[W3] init exits 0 with a user-owned .claude/skills/qa/', initA.status === 0, (initA.stderr || initA.stdout || '').trim().slice(-300));
    const userQa = path.join(projA, '.claude', 'skills', 'qa');
    const qaIsUsers = () => !fs.lstatSync(userQa).isSymbolicLink() && fs.readFileSync(path.join(userQa, 'SKILL.md'), 'utf8').includes('mine');
    check('[W3] init never replaces a real user directory at .claude/skills/<name>', qaIsUsers());
    check('[W3] init warns that it kept .claude/skills/qa', /\[ WARN \] kept your \.claude\/skills\/qa/.test(initA.stdout || ''));

    // Legacy harness files, as 5.0-and-earlier wrote them
    const A = (...p) => path.join(projA, ...p);
    fs.writeFileSync(A('OPENCODE.md'), '<!-- BEGIN DEV-OS -->\n# Dev-OS — OpenCode Instructions\nold\n<!-- END DEV-OS -->\n');
    fs.mkdirSync(A('.opencode', 'rules'), { recursive: true });
    fs.writeFileSync(A('.opencode', 'opencode.json'), JSON.stringify({ name: 'Dev-OS', version: '4.5.0', rules: ['.opencode/rules/devos-rules.md'], manifest: '.agents/manifest.json' }, null, 2) + '\n');
    fs.writeFileSync(A('.opencode', 'rules', 'devos-rules.md'), '# OpenCode Dev-OS Rules\nold\n');
    fs.mkdirSync(A('.codex'), { recursive: true });
    fs.writeFileSync(A('.codex', 'instructions.md'), '# My Codex notes\nkeep me\n\n<!-- BEGIN DEV-OS -->\n# Dev-OS — Codex Instructions\nold\n<!-- END DEV-OS -->\n');
    fs.writeFileSync(A('.codex', 'config.toml'), 'model = "x"\n');
    fs.writeFileSync(A('opencode.json'), JSON.stringify({ model: 'mine/model', instructions: ['CONTRIBUTING.md'] }, null, 2) + '\n');
    fs.unlinkSync(A('.claude', 'skills', 'git-ops')); // drift: a missing link
    const driftDoc = runCli(['doctor', '--json'], projA);
    let driftRes = null;
    try { driftRes = JSON.parse(driftDoc.stdout); } catch (e) {}
    const skillRow = driftRes && driftRes.results.find((r) => r.name.startsWith('Claude Code skills'));
    check('[W3] doctor reports .claude/skills drift (missing link) as WARN', Boolean(skillRow && skillRow.status === 'WARN' && /git-ops/.test(skillRow.reason || '')), JSON.stringify(skillRow));

    const updA = runCli(['update', '--quiet'], projA);
    check('[W3] update over legacy harness files exits 0', updA.status === 0, (updA.stderr || updA.stdout || '').trim().slice(-300));
    const migBackup = (rel) => fs.readdirSync(A('.agents', '_backup')).some((d) => d.startsWith('migration-') && fs.existsSync(path.join(A('.agents', '_backup'), d, rel)));
    check('[W3] Dev-OS-only OPENCODE.md removed after a backup', !fs.existsSync(A('OPENCODE.md')) && migBackup('OPENCODE.md'));
    check('[W3] legacy .opencode/opencode.json and devos-rules.md removed after a backup',
      !fs.existsSync(A('.opencode', 'opencode.json')) && !fs.existsSync(A('.opencode', 'rules', 'devos-rules.md')) && migBackup(path.join('.opencode', 'opencode.json')));
    const codexAfter = fs.existsSync(A('.codex', 'instructions.md')) ? fs.readFileSync(A('.codex', 'instructions.md'), 'utf8') : '';
    check('[W3] .codex/instructions.md: Dev-OS block removed, user text kept, backup taken',
      codexAfter.includes('keep me') && !codexAfter.includes('DEV-OS') && migBackup(path.join('.codex', 'instructions.md')), codexAfter);
    check('[W3] other .codex/ files untouched', fs.readFileSync(A('.codex', 'config.toml'), 'utf8') === 'model = "x"\n');
    const ocA = readJson(A('opencode.json')) || {};
    check('[W3] user opencode.json merged: user keys and instructions kept, Dev-OS entry and $schema added',
      ocA.model === 'mine/model' && Array.isArray(ocA.instructions) && ocA.instructions[0] === 'CONTRIBUTING.md' && ocA.instructions.includes('.agents/AGENTS.md') && ocA.$schema === 'https://opencode.ai/config.json', JSON.stringify(ocA));
    check('[W3] update restores the missing .claude/skills link', fs.lstatSync(A('.claude', 'skills', 'git-ops')).isSymbolicLink());
    check('[W3] update never replaces the user directory at .claude/skills/qa', qaIsUsers());
    // A user's own files (no markers) stay untouched and unannounced
    fs.writeFileSync(A('OPENCODE.md'), '# My OpenCode notes\n');
    fs.writeFileSync(A('.cursor', 'rules', 'devos.mdc'), fs.readFileSync(A('.cursor', 'rules', 'devos.mdc'), 'utf8') + '\nmy edit\n');
    const updA2 = runCli(['update', '--quiet'], projA);
    check('[W3] a user-authored OPENCODE.md is left untouched', fs.readFileSync(A('OPENCODE.md'), 'utf8') === '# My OpenCode notes\n');
    check('[W3] an edited .cursor/rules/devos.mdc is kept with a [ WARN ]',
      fs.readFileSync(A('.cursor', 'rules', 'devos.mdc'), 'utf8').includes('my edit') && /kept your edited \.cursor\/rules\/devos\.mdc/.test(updA2.stdout || ''));
    const rootAgents = fs.readFileSync(A('AGENTS.md'), 'utf8');
    check('[W3] re-running update keeps exactly one Dev-OS block in AGENTS.md', rootAgents.split('<!-- BEGIN DEV-OS -->').length === 2);
    const docA = runCli(['doctor', '--json'], projA);
    let docAJson = null;
    try { docAJson = JSON.parse(docA.stdout); } catch (e) {}
    const skillRowA = docAJson && docAJson.results.find((r) => r.name.startsWith('Claude Code skills'));
    check('[W3] doctor: .claude/skills in sync after update (user dir is not drift)', Boolean(skillRowA && skillRowA.status === 'PASS'), JSON.stringify(skillRowA));

    // Damaged markers: BEGIN with its END lost, user text below. Left unchanged
    // (with a backup and a [ WARN ]) on every update; never appended to.
    const damaged = '# My agents notes\n\n<!-- BEGIN DEV-OS -->\nold Dev-OS text\n\n## My section\nkeep me below the lost END\n';
    fs.writeFileSync(A('AGENTS.md'), damaged);
    const dupClaude = '# Mine\n\n<!-- BEGIN DEV-OS -->\na\n<!-- END DEV-OS -->\n\n<!-- BEGIN DEV-OS -->\nb\n<!-- END DEV-OS -->\n\nmy claude text\n';
    fs.writeFileSync(A('CLAUDE.md'), dupClaude);
    const dmg1 = runCli(['update', '--quiet'], projA);
    const dmg2 = runCli(['update', '--quiet'], projA);
    check('[W3] a damaged Dev-OS block (BEGIN without END) survives two updates byte-for-byte, user section kept',
      dmg1.status === 0 && dmg2.status === 0 && fs.readFileSync(A('AGENTS.md'), 'utf8') === damaged, fs.readFileSync(A('AGENTS.md'), 'utf8').slice(0, 300));
    check('[W3] damaged block: update prints the [ WARN ] each time',
      [dmg1, dmg2].every((r) => /\[ WARN \] AGENTS\.md has a damaged Dev-OS block \(BEGIN without END\); left unchanged, fix the markers and re-run/.test(r.stdout || '')), (dmg2.stdout || '').slice(-400));
    check('[W3] damaged block: a backup of the file is taken', migBackup('AGENTS.md') &&
      fs.readdirSync(A('.agents', '_backup')).some((d) => d.startsWith('migration-') && fs.existsSync(path.join(A('.agents', '_backup'), d, 'AGENTS.md')) &&
        fs.readFileSync(path.join(A('.agents', '_backup'), d, 'AGENTS.md'), 'utf8') === damaged));
    check('[W3] duplicated Dev-OS markers in CLAUDE.md: left unchanged with a [ WARN ]',
      fs.readFileSync(A('CLAUDE.md'), 'utf8') === dupClaude && /\[ WARN \] CLAUDE\.md has a damaged Dev-OS block \(duplicated markers\)/.test(dmg1.stdout || ''));
    // Legacy '# Dev-OS' heading: never replaces a root AGENTS.md (4.x never wrote one);
    // other files are replaced only after a backup
    const userDevosAgents = '# Dev-OS integration notes (mine)\nmy own words\n';
    fs.writeFileSync(A('AGENTS.md'), userDevosAgents);
    fs.writeFileSync(A('CLAUDE.md'), '# Mine\nmy claude text\n');
    const legacyGemini = '# Dev-OS — Gemini CLI Instructions\nold 4.x text\n';
    fs.writeFileSync(A('GEMINI.md'), legacyGemini);
    runCli(['update', '--quiet'], projA);
    const agentsAfterLegacy = fs.readFileSync(A('AGENTS.md'), 'utf8');
    check("[W3] a root AGENTS.md starting with '# Dev-OS' keeps the user's text; the block is appended",
      agentsAfterLegacy.startsWith(userDevosAgents.trimEnd()) && agentsAfterLegacy.split('<!-- BEGIN DEV-OS -->').length === 2, agentsAfterLegacy.slice(0, 200));
    const geminiAfter = fs.readFileSync(A('GEMINI.md'), 'utf8');
    const geminiBackedUp = fs.readdirSync(A('.agents', '_backup')).some((d) => d.startsWith('migration-') &&
      fs.existsSync(path.join(A('.agents', '_backup'), d, 'GEMINI.md')) && fs.readFileSync(path.join(A('.agents', '_backup'), d, 'GEMINI.md'), 'utf8') === legacyGemini);
    check('[W3] a legacy 4.x GEMINI.md is backed up before it is replaced by the block', geminiAfter.startsWith('<!-- BEGIN DEV-OS -->') && geminiBackedUp);

    // Copy fallback (as on Windows): copies recorded in generatedFiles, refreshed when stale, kept when edited
    const projB = path.join(w3, 'b');
    fs.mkdirSync(projB);
    const B = (...p) => path.join(projB, ...p);
    const copyEnv = { env: { DEVOS_SKILL_LINKS: 'copy' } };
    const initB = runCli(['init', '--existing', '--stack', 'universal', '--platform', 'claude', '--quiet'], projB, copyEnv);
    const gfB = ((readJson(B('.agents', 'manifest.json')) || {}).generatedFiles) || {};
    const qaCopy = B('.claude', 'skills', 'qa');
    check('[W3] copy fallback: .claude/skills/<name> is a real directory with SKILL.md', initB.status === 0 && fs.existsSync(path.join(qaCopy, 'SKILL.md')) && !fs.lstatSync(qaCopy).isSymbolicLink());
    check('[W3] copy fallback: copies are recorded in manifest.generatedFiles', typeof gfB['.claude/skills/qa/'] === 'string' && gfB['.claude/skills/qa/'].length === 64);
    fs.appendFileSync(B('.agents', 'skills', 'qa', 'SKILL.md'), '\nlocal addition\n');
    const docB = runCli(['doctor', '--json'], projB);
    let docBJson = null;
    try { docBJson = JSON.parse(docB.stdout); } catch (e) {}
    const rowB = docBJson && docBJson.results.find((r) => r.name.startsWith('Claude Code skills'));
    check('[W3] doctor reports a stale skill copy as drift', Boolean(rowB && rowB.status === 'WARN' && /stale copies: qa/.test(rowB.reason || '')), JSON.stringify(rowB));
    runCli(['update', '--quiet'], projB, copyEnv);
    check('[W3] update refreshes a stale Dev-OS skill copy', fs.readFileSync(path.join(qaCopy, 'SKILL.md'), 'utf8').includes('local addition'));
    fs.appendFileSync(path.join(qaCopy, 'SKILL.md'), '\nedited in .claude\n');
    const updB = runCli(['update', '--quiet'], projB);
    check('[W3] an edited skill copy is kept, never replaced by a link', !fs.lstatSync(qaCopy).isSymbolicLink() &&
      fs.readFileSync(path.join(qaCopy, 'SKILL.md'), 'utf8').includes('edited in .claude') && /kept your \.claude\/skills\/qa/.test(updB.stdout || ''));
    const gitOpsB = B('.claude', 'skills', 'git-ops');
    check('[W3] unedited copies become links once symlinks are available', fs.lstatSync(gitOpsB).isSymbolicLink());

    // Copy mode with a __pycache__ in the source: the copy skips it, and the hash
    // must too, or every update re-copies the skill
    const projD = path.join(w3, 'd');
    fs.mkdirSync(projD);
    runCli(['init', '--existing', '--stack', 'universal', '--platform', 'claude', '--quiet'], projD, copyEnv);
    fs.mkdirSync(path.join(projD, '.agents', 'skills', 'git-ops', '__pycache__'), { recursive: true });
    fs.writeFileSync(path.join(projD, '.agents', 'skills', 'git-ops', '__pycache__', 'x.cpython-312.pyc'), 'bytecode');
    const syncLine = (r) => ((r.stdout || '').split('\n').find((l) => l.includes('Syncing Claude Code skill links')) || '');
    runCli(['update'], projD, copyEnv);
    const updD2 = runCli(['update'], projD, copyEnv);
    check('[W3] copy mode: a source __pycache__ does not make the copy stale (second update: 0 changes)',
      updD2.status === 0 && /\.\.\. \d+ unchanged\s*$/.test(syncLine(updD2)) && !fs.existsSync(path.join(projD, '.claude', 'skills', 'git-ops', '__pycache__')), syncLine(updD2));

    // .claude/skills is itself a symlink (shared dir): links are computed from the
    // real location, never dangle, and a second update changes nothing
    const projE = path.join(w3, 'e');
    const sharedSkills = path.join(w3, 'shared-skills');
    fs.mkdirSync(path.join(projE, '.claude'), { recursive: true });
    fs.mkdirSync(sharedSkills);
    fs.symlinkSync(path.relative(path.join(projE, '.claude'), sharedSkills), path.join(projE, '.claude', 'skills'), 'dir');
    const initE = runCli(['init', '--existing', '--stack', 'universal', '--platform', 'claude'], projE);
    const sharedEntries = fs.readdirSync(sharedSkills);
    const danglingE = sharedEntries.filter((f) => !fs.existsSync(path.join(sharedSkills, f)));
    check('[W3] symlinked .claude/skills: init writes links that resolve (none dangling)',
      initE.status === 0 && sharedEntries.length > 0 && danglingE.length === 0 && fs.existsSync(path.join(projE, '.claude', 'skills', 'qa', 'SKILL.md')), danglingE.join(', '));
    check('[W3] symlinked .claude/skills: init warns about the redirected location', /\[ WARN \] \.claude\/skills resolves through a symlink/.test(initE.stdout || ''));
    runCli(['update'], projE);
    const updE2 = runCli(['update'], projE);
    check('[W3] symlinked .claude/skills: a second update reports 0 changes',
      updE2.status === 0 && /\.\.\. \d+ unchanged\s*$/.test(syncLine(updE2)) && fs.readdirSync(sharedSkills).every((f) => fs.existsSync(path.join(sharedSkills, f))), syncLine(updE2));

    // W4: build-plugin
    const plugOut = path.join(w3, 'plugin');
    const bp = runCli(['build-plugin', '--out', plugOut, '--json'], w3);
    let bpJson = null;
    try { bpJson = JSON.parse(bp.stdout); } catch (e) {}
    check('[W4] devos build-plugin --out exits 0 with JSON', bp.status === 0 && Boolean(bpJson && bpJson.ok), (bp.stderr || bp.stdout || '').slice(0, 300));
    const plugJson = readJson(path.join(plugOut, '.claude-plugin', 'plugin.json'));
    const pkgVersion = (readJson(path.join(ROOT, 'package.json')) || {}).version;
    check('[W4] plugin.json is valid JSON with name devos, version, description, author.name',
      Boolean(plugJson && plugJson.name === 'devos' && plugJson.version === pkgVersion && plugJson.description && plugJson.author && plugJson.author.name), JSON.stringify(plugJson));
    const hooksJson = readJson(path.join(plugOut, 'hooks', 'hooks.json'));
    check('[W4] hooks/hooks.json is valid JSON wrapped in a top-level "hooks" key', Boolean(hooksJson && hooksJson.hooks && hooksJson.hooks.PreToolUse));
    const hookCmds = [];
    Object.values((hooksJson && hooksJson.hooks) || {}).forEach((groups) => groups.forEach((g) => (g.hooks || []).forEach((h) => hookCmds.push(h.command))));
    const missingHookFiles = hookCmds.filter((c) => {
      const m = /^DEVOS_PLUGIN_MODE=1 "\$\{CLAUDE_PLUGIN_ROOT\}"\/(.+)$/.exec(c || '');
      if (!m) return true;
      const f = path.join(plugOut, m[1]);
      return !fs.existsSync(f) || (fs.statSync(f).mode & 0o111) === 0;
    });
    check(`[W4] every hooks.json command is "\${CLAUDE_PLUGIN_ROOT}"/... and resolves to an executable file (${hookCmds.length})`, hookCmds.length === 12 && missingHookFiles.length === 0, missingHookFiles.join(', '));
    check(`[W4] every plugin hooks.json command contains DEVOS_PLUGIN_MODE=1 (${hookCmds.length})`, hookCmds.length > 0 && hookCmds.every((c) => typeof c === 'string' && c.includes('DEVOS_PLUGIN_MODE=1')));
    const plugReadme = fs.readFileSync(path.join(plugOut, 'README.md'), 'utf8');
    check('[W4] plugin README: install lines, devos-init-only hooks, once-per-session command source',
      ['/plugin marketplace add olitech1010/dev-os', '/plugin install devos@olives-devos', 'only act in projects initialized with', 'once per session'].every((t) => plugReadme.includes(t)));
    check('[W4] no repo-relative .agents/ paths remain in the plugin hooks.json', !fs.readFileSync(path.join(plugOut, 'hooks', 'hooks.json'), 'utf8').includes('.agents/'));
    check('[W4] plugin ships the hook helper lib', fs.existsSync(path.join(plugOut, 'hooks', 'lib', 'hook-input.js')));
    check('[W4] plugin agents/ holds the 13-agent roster', mdFiles(path.join(plugOut, 'agents')).length === DEFAULT_AGENTS.length && DEFAULT_AGENTS.length === 13);
    check('[W4] plugin commands/ is populated', mdFiles(path.join(plugOut, 'commands')).length >= 9);
    const coreSkills = (PACKS.packs.core && PACKS.packs.core.skills) || [];
    const plugSkills = fs.readdirSync(path.join(plugOut, 'skills'));
    check(`[W4] plugin skills/ is exactly the core pack (${coreSkills.length})`, plugSkills.length === coreSkills.length && coreSkills.every((n) => fs.existsSync(path.join(plugOut, 'skills', n, 'SKILL.md'))));
    const pp = runCli(['build-plugin', '--out', plugOut, '--print-path'], w3);
    check('[W4] --print-path rebuilds in place and prints exactly one absolute path', pp.status === 0 && pp.stdout === `${path.resolve(plugOut)}\n`, JSON.stringify(pp.stdout));
    const foreign = path.join(w3, 'foreign');
    fs.mkdirSync(foreign);
    fs.writeFileSync(path.join(foreign, 'keep.txt'), 'x');
    const bpForeign = runCli(['build-plugin', '--out', foreign], w3);
    check('[W4] build-plugin refuses a non-empty directory that is not a previous build', bpForeign.status !== 0 && fs.readFileSync(path.join(foreign, 'keep.txt'), 'utf8') === 'x');
    const bpDefault = runCli(['build-plugin', '--quiet'], w3);
    check('[W4] build-plugin defaults to dist/claude-plugin/', bpDefault.status === 0 && fs.existsSync(path.join(w3, 'dist', 'claude-plugin', '.claude-plugin', 'plugin.json')));
    const market = readJson(path.join(ROOT, '.claude-plugin', 'marketplace.json'));
    const entry = market && Array.isArray(market.plugins) ? market.plugins.find((pl) => pl.name === 'devos') : null;
    check('[W4] repo .claude-plugin/marketplace.json: name, owner.name, and a devos plugin entry',
      Boolean(market && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(market.name) && market.owner && market.owner.name && entry));
    check('[W4] marketplace devos entry builds this exact version via a command source',
      Boolean(entry && entry.source && entry.source.source === 'command' && entry.source.command.includes(`@olives/devos@${pkgVersion} build-plugin`) &&
        entry.source.command.includes('--print-path') && entry.source.command.length <= 500 && !/ {4}/.test(entry.source.command) && entry.source.mode === 'copy'), JSON.stringify(entry && entry.source));
    check('[W5] marketplace --out directory is named for the package version, not a stale one',
      Boolean(entry && entry.source && entry.source.command.includes(`/claude-plugin/${pkgVersion}"`)), JSON.stringify(entry && entry.source && entry.source.command));
    check('[W4] dist/ is gitignored', fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split(/\r?\n/).includes('dist/'));

    // W5: spec waves / spec check. docs/specs/_template ships with init (T1 -> T2 -> T3, R1 + R2).
    const specOk = runCli(['spec', 'check', '_template'], projA);
    check('[W5] devos spec check _template passes', specOk.status === 0 && /\[ OK \]/.test(specOk.stdout || ''), (specOk.stderr || specOk.stdout || '').slice(0, 300));
    const wavesT = runCli(['spec', 'waves', '_template', '--json'], projA);
    let wavesTJson = null;
    try { wavesTJson = JSON.parse(wavesT.stdout); } catch (e) {}
    check('[W5] devos spec waves _template --json is T1 -> T2 -> T3', wavesT.status === 0 && Boolean(wavesTJson) && JSON.stringify(wavesTJson.waves) === '[["T1"],["T2"],["T3"]]', wavesT.stdout.slice(0, 200));
    const specDir = (slug) => path.join(projA, 'docs', 'specs', slug);
    const writeSpec = (slug, req, tasks) => {
      fs.mkdirSync(specDir(slug), { recursive: true });
      fs.writeFileSync(path.join(specDir(slug), 'requirements.md'), req);
      fs.writeFileSync(path.join(specDir(slug), 'tasks.md'), tasks);
    };
    const REQ2 = '# R\n\n### R1: First\nWHEN x THE SYSTEM SHALL y.\n\n### R2: Second\n';
    const task = (id, dep, cov, verify = 'npm test') => `### ${id}: Task ${id}\nfree text\n- depends: ${dep}\n- covers: ${cov}\n${verify === null ? '' : `- verify: ${verify}\n`}\n`;
    writeSpec('parallel', REQ2.replace(/\n/g, '\r\n'), ('## Tasks\n\n```\n### T9: fenced example, ignored\n- depends: T7\n```\n\n' + task('T1', 'none', 'R1') + task('T2', 'none', 'R2') + task('T3', 'T1,T2', 'R1, R2')).replace(/\n/g, '\r\n'));
    const par = runCli(['spec', 'waves', 'parallel', '--json'], projA);
    let parJson = null;
    try { parJson = JSON.parse(par.stdout); } catch (e) {}
    check('[W5] waves: independent tasks share a wave; fences ignored; CRLF accepted', par.status === 0 && Boolean(parJson) && JSON.stringify(parJson.waves) === '[["T1","T2"],["T3"]]', par.stdout.slice(0, 300));
    check('[W5] check passes on the parallel fixture', runCli(['spec', 'check', 'parallel'], projA).status === 0);
    // ~~~ fences, a ``` inside a ~~~ fence, and a ```` fence holding ``` lines are all skipped
    writeSpec('tilde', REQ2, '## Tasks\n\n~~~markdown\n```\n### T9: inside a tilde fence\n- depends: T7\n~~~\n\n````\n```\n### T8: inside a four-backtick fence\n```\n````\n\n' +
      task('T1', 'none', 'R1') + task('T2', 'T1', 'R2'));
    const tilde = runCli(['spec', 'waves', 'tilde', '--json'], projA);
    let tildeJson = null;
    try { tildeJson = JSON.parse(tilde.stdout); } catch (e) {}
    check('[W5] waves: ~~~ fences and longer fences are skipped; a fence closes only on a matching fence',
      tilde.status === 0 && Boolean(tildeJson) && JSON.stringify(tildeJson.waves) === '[["T1"],["T2"]]' && runCli(['spec', 'check', 'tilde'], projA).status === 0, (tilde.stdout || tilde.stderr || '').slice(0, 300));
    const failCase = (slug, req, tasks, cmd, needle, label) => {
      writeSpec(slug, req, tasks);
      const r = runCli(['spec', cmd, slug], projA);
      check(`[W5] ${label}`, r.status === 1 && (r.stderr || '').includes(needle), `exit=${r.status} ${(r.stderr || r.stdout || '').trim().slice(0, 200)}`);
    };
    failCase('cycle', REQ2, task('T1', 'T2', 'R1') + task('T2', 'T1', 'R2'), 'waves', 'dependency cycle among T1, T2', 'waves fails on a dependency cycle');
    failCase('selfdep', REQ2, task('T1', 'T1', 'R1, R2'), 'waves', 'T1 depends on itself', 'waves fails on a self-dependency');
    failCase('unknowntask', REQ2, task('T1', 'none', 'R1') + task('T2', 'T7', 'R2'), 'waves', 'T2 depends on unknown task T7', 'waves fails on an unknown depends id');
    failCase('uncovered', REQ2, task('T1', 'none', 'R1'), 'check', 'requirement R2 (Second) is not covered', 'check fails on an uncovered requirement');
    failCase('unknownreq', REQ2, task('T1', 'none', 'R1, R2, R9'), 'check', 'T1 covers unknown requirement R9', 'check fails on a covers id that does not exist');
    failCase('noverify', REQ2, task('T1', 'none', 'R1, R2', null), 'check', "T1 is missing '- verify:'", 'check fails on a missing verify line');
    failCase('repeated', REQ2, task('T1', 'none', 'R1, R2').replace('- verify: npm test', '- verify: a\n- verify: b'), 'check', "T1 repeats '- verify:'", 'check fails on a repeated field');
    failCase('dupid', REQ2, task('T1', 'none', 'R1') + task('T1', 'none', 'R2'), 'check', 'duplicate task id T1', 'check fails on a duplicate task id');
    failCase('dupreq', REQ2 + '### R2: Again\n', task('T1', 'none', 'R1, R2'), 'check', 'duplicate requirement id R2', 'check fails on a duplicate requirement id');
    failCase('nonecovers', REQ2, task('T1', 'none', 'none'), 'check', "covers 'none'", "check rejects 'covers: none'");
    const cycleJson = runCli(['spec', 'check', 'cycle', '--json'], projA);
    let cycleParsed = null;
    try { cycleParsed = JSON.parse(cycleJson.stdout); } catch (e) {}
    check('[W5] spec check --json exits 1 with ok:false and problems[]', cycleJson.status === 1 && Boolean(cycleParsed && cycleParsed.ok === false && cycleParsed.problems.length > 0));
    const badSlug1 = runCli(['spec', 'check', '../etc'], projA);
    const badSlug2 = runCli(['spec', 'waves', 'a/b'], projA);
    check("[W5] spec rejects slugs containing '..' or '/'", badSlug1.status === 1 && badSlug2.status === 1 && /Invalid spec slug/.test(badSlug1.stderr + badSlug2.stderr));
    // sdlc-runner plan gate accepts docs/specs/<slug>/tasks.md (never the shipped _template)
    fs.writeFileSync(A('DESIGN.md'), '# Design\n');
    ['parallel', 'tilde', 'cycle', 'selfdep', 'unknowntask', 'uncovered', 'unknownreq', 'noverify', 'repeated', 'dupid', 'dupreq', 'nonecovers'].forEach((slug) => fs.rmSync(specDir(slug), { recursive: true, force: true }));
    const gateTemplateOnly = runCli(['auto', '--step', 'implementation'], projA);
    check('[W5] plan gate is not satisfied by docs/specs/_template alone', /BLOCKED[^\n]*docs\/specs/.test(gateTemplateOnly.stdout || ''), (gateTemplateOnly.stdout || '').split('\n').filter((l) => /Gate/.test(l)).join(' | '));
    writeSpec('feature', REQ2, task('T1', 'none', 'R1, R2'));
    const gateSpec = runCli(['auto', '--step', 'implementation'], projA);
    check('[W5] plan gate accepts docs/specs/<slug>/tasks.md as the plan', !/BLOCKED[^\n]*docs\/specs/.test(gateSpec.stdout || '') && /Gate Check/.test(gateSpec.stdout || ''), (gateSpec.stdout || '').split('\n').filter((l) => /Gate/.test(l)).join(' | '));
    const help = runCli(['help'], w3);
    check('[W5] help documents spec waves, spec check, and build-plugin', ['spec waves <slug>', 'spec check <slug>', 'build-plugin', '--out <dir>', '--print-path'].every((t) => (help.stdout || '').includes(t)));
  } finally {
    fs.rmSync(w3, { recursive: true, force: true });
  }
} finally {
  fs.rmSync(proj, { recursive: true, force: true });
  fs.rmSync(empty, { recursive: true, force: true });
  fs.rmSync(scratch, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// 4. content integrity of the shipped sources
// ---------------------------------------------------------------------------
const agentsDir = path.join(ROOT, '.agents', 'agents');
const commandsDir = path.join(ROOT, '.agents', 'commands');
const skillsDir = path.join(ROOT, '.agents', 'skills');

const agentNames = DEFAULT_AGENTS;

[[commandsDir, DEFAULT_AGENTS, 'default-roster'], [path.join(ROOT, '.agents', 'maintainer', 'commands'), [...MAINTAINER_AGENTS, ...DEFAULT_AGENTS], 'default or maintainer']].forEach(([dir, allowed, label]) => {
  mdFiles(dir).forEach((file) => {
    const fm = parseFrontmatter(fs.readFileSync(path.join(dir, file), 'utf8'));
    check(`command ${file} has valid frontmatter`, Boolean(fm && fm.name && fm.description && fm.agent));
    if (fm && fm.agent) {
      check(`command ${file} targets a ${label} agent (${fm.agent})`, allowed.includes(fm.agent));
    }
  });
});

// Packs: every listed skill/agent/command exists, every skill dir is in a pack,
// aliases point at shipped skills, and the maintainer pack is opt-in.
const packSkills = new Set();
Object.entries(PACKS.packs || {}).forEach(([id, p]) => {
  const missing = (p.skills || []).filter((sk) => !fs.existsSync(path.join(ROOT, '.agents', 'skills', sk, 'SKILL.md')));
  (p.skills || []).forEach((sk) => packSkills.add(sk));
  check(`pack ${id}: every skill exists`, missing.length === 0, missing.join(', '));
  const missingAssets = [
    ...(p.agents || []).filter((n) => !fs.existsSync(path.join(ROOT, '.agents', 'maintainer', 'agents', `${n}.md`)) && !fs.existsSync(path.join(agentsDir, `${n}.md`))),
    ...(p.commands || []).filter((n) => !fs.existsSync(path.join(ROOT, '.agents', 'maintainer', 'commands', `${n}.md`)) && !fs.existsSync(path.join(commandsDir, `${n}.md`)))
  ];
  check(`pack ${id}: every agent/command exists`, missingAssets.length === 0, missingAssets.join(', '));
});
const unpacked = SOURCE_SKILL_DIRS.filter((d) => !packSkills.has(d));
check('every skill directory is in at least one pack', unpacked.length === 0, unpacked.join(', '));
const maintPack = (PACKS.packs || {}).maintainer;
check('maintainer pack exists, is not default, and ships agents + commands', Boolean(maintPack && maintPack.default !== true && (maintPack.agents || []).length && (maintPack.commands || []).length));
const badAliases = Object.entries(ALIASES).filter(([from, to]) => SOURCE_SKILL_DIRS.includes(from) || !SOURCE_SKILL_DIRS.includes(to));
check(`packs.json aliases (${Object.keys(ALIASES).length}) map retired names to shipped skills`, Object.keys(ALIASES).length > 0 && badAliases.length === 0, badAliases.map((x) => x.join('->')).join(', '));
const nested = findFiles(skillsDir, (f) => path.basename(f) === 'SKILL.md' && path.relative(skillsDir, f).split(path.sep).includes('references'));
check('no nested SKILL.md under any references/ dir', nested.length === 0, nested.map((f) => path.relative(ROOT, f)).join(', '));

// Packaging: the repo's own manifest and scorecard never ship
const pkgJson = readJson(path.join(ROOT, 'package.json')) || {};
const npmignore = fs.existsSync(path.join(ROOT, '.npmignore')) ? fs.readFileSync(path.join(ROOT, '.npmignore'), 'utf8').split(/\r?\n/) : [];
check('package.json files does not ship .agents/manifest.json', !(pkgJson.files || []).some((f) => f.includes('manifest.json')));
check('.npmignore excludes .agents/manifest.json and latest-scorecard.json', npmignore.includes('.agents/manifest.json') && npmignore.includes('.agents/evals/reports/latest-scorecard.json'));
check('VERSION matches package.json version', fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim() === pkgJson.version);

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
  ...fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md')).map((f) => path.join(commandsDir, f)),
  ...['agents', 'commands'].flatMap((k) => mdFiles(path.join(ROOT, '.agents', 'maintainer', k)).map((f) => path.join(ROOT, '.agents', 'maintainer', k, f)))
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

// ---------------------------------------------------------------------------
// Commit policy (v5.1): human-only by default; with "agent", Claude Code agents commit through
// .agents/scripts/commit.sh --agent and the human approves each commit in the permission prompt.
// ---------------------------------------------------------------------------
{
  const AGENT_VARS = ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'GEMINI_CLI', 'CODEX_SANDBOX',
    'CODEX_SANDBOX_NETWORK_DISABLED', 'CODEX_THREAD_ID', 'CURSOR_AGENT', 'AI_AGENT', 'DEVOS_AGENT_SHELL',
    'DEVOS_AGENT_COMMIT', 'DEVOS_HEADLESS_COMMIT', 'CI'];
  const HUMAN_ENV = { ...BASE_ENV, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' };
  AGENT_VARS.forEach((k) => { delete HUMAN_ENV[k]; });
  const AGENT_ENV = { ...HUMAN_ENV, CLAUDECODE: '1' };
  const cp = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-commitpolicy-'));
  const cpSpawn = (cmd, args, env, opts = {}) => spawnSync(cmd, args, { cwd: opts.cwd || cp, encoding: 'utf8', timeout: HOOK_TIMEOUT_MS, input: '', env });
  const cpCli = (args, env) => spawnSync(process.execPath, [CLI, ...args], { cwd: cp, encoding: 'utf8', timeout: CLI_TIMEOUT_MS, input: '', env });
  const out = (r) => `exit=${r.status} ${((r.stderr || '') + (r.stdout || '')).trim().slice(-240)}`;
  const commits = () => {
    const r = cpSpawn('git', ['rev-list', '--count', 'HEAD'], HUMAN_ENV);
    return r.status === 0 ? parseInt(r.stdout, 10) : 0;
  };
  const stage = (name) => {
    fs.writeFileSync(path.join(cp, name), `${name}\n`);
    cpSpawn('git', ['add', name], HUMAN_ENV);
  };
  const policyOf = () => (readJson(path.join(cp, '.agents', 'manifest.json')) || {}).commitPolicy;
  const COMMIT_SH = '.agents/scripts/commit.sh';
  try {
    cpSpawn('git', ['init', '-q'], HUMAN_ENV);
    const cpInit = cpCli(['init', '--existing', '--stack', 'universal', '--platform', 'claude', '--quiet'], HUMAN_ENV);
    check('[commit-policy] init exits 0', cpInit.status === 0, out(cpInit));
    check('[commit-policy] pre-commit hook installed', fs.existsSync(path.join(cp, '.git', 'hooks', 'pre-commit')));

    const st = cpCli(['commit-policy', '--json'], HUMAN_ENV);
    const stJson = (() => { try { return JSON.parse(st.stdout); } catch (e) { return {}; } })();
    check('[commit-policy] Claude Code install defaults to agent, ask rule wired', stJson.commitPolicy === 'agent' && stJson.askRuleWired === true, out(st));
    const toHuman = cpCli(['commit-policy', 'human'], AGENT_ENV);
    check('[commit-policy] switching to human works from an agent shell', toHuman.status === 0 && policyOf() === 'human', out(toHuman));
    const keep = cpCli(['update', '--quiet'], HUMAN_ENV);
    check('[commit-policy] update keeps an explicit human choice', keep.status === 0 && policyOf() === 'human', out(keep));

    stage('a.txt');
    const offPolicy = cpSpawn(COMMIT_SH, ['--agent', 'feat: add a'], AGENT_ENV);
    check('[commit-policy] human policy: commit.sh --agent refused', offPolicy.status !== 0 && /disabled/.test(offPolicy.stderr) && commits() === 0, out(offPolicy));
    const plainAgent = cpSpawn(COMMIT_SH, [], AGENT_ENV);
    check('[commit-policy] human policy: agent shell refused on the interactive path', plainAgent.status !== 0 && /agent shell/.test(plainAgent.stderr), out(plainAgent));

    const bogus = cpCli(['commit-policy', 'robots'], HUMAN_ENV);
    check('[commit-policy] unknown policy rejected', bogus.status !== 0 && /Unknown commit policy/.test(bogus.stderr), out(bogus));
    const enable = cpCli(['update', '--commit-policy', 'agent', '--quiet'], AGENT_ENV);
    check('[commit-policy] the agent can switch to agent policy (each commit still needs the prompt)', enable.status === 0 && policyOf() === 'agent', out(enable));

    const noFlag = cpSpawn(COMMIT_SH, [], AGENT_ENV);
    check('[commit-policy] agent policy: plain commit.sh from an agent points at --agent', noFlag.status !== 0 && /--agent/.test(noFlag.stderr), out(noFlag));
    const badMsg = cpSpawn(COMMIT_SH, ['--agent', 'added stuff'], AGENT_ENV);
    check('[commit-policy] agent policy: non-conventional message refused', badMsg.status !== 0 && /Conventional Commit/.test(badMsg.stderr) && commits() === 0, out(badMsg));
    const absPath = cpSpawn(path.join(cp, COMMIT_SH), ['--agent', 'feat: add a'], AGENT_ENV);
    check('[commit-policy] agent policy: absolute-path invocation refused', absPath.status !== 0 && /Run exactly/.test(absPath.stderr) && commits() === 0, out(absPath));
    const sub = path.join(cp, 'sub');
    fs.mkdirSync(sub);
    const fromSub = cpSpawn('../' + COMMIT_SH, ['--agent', 'feat: add a'], AGENT_ENV, { cwd: sub });
    check('[commit-policy] agent policy: invocation outside the repo root refused', fromSub.status !== 0 && commits() === 0, out(fromSub));
    const codex = cpSpawn(COMMIT_SH, ['--agent', 'feat: add a'], { ...AGENT_ENV, CODEX_THREAD_ID: 'x' });
    check('[commit-policy] agent policy: other harness marker refused', codex.status !== 0 && /only supported in Claude Code/.test(codex.stderr) && commits() === 0, out(codex));
    const noMarker = cpSpawn(COMMIT_SH, ['--agent', 'feat: add a'], HUMAN_ENV);
    check('[commit-policy] --agent without an agent shell refused', noMarker.status !== 0 && commits() === 0, out(noMarker));

    const settingsFile = path.join(cp, '.claude', 'settings.json');
    const savedSettings = fs.readFileSync(settingsFile, 'utf8');
    const stripped = JSON.parse(savedSettings);
    stripped.permissions.ask = [];
    fs.writeFileSync(settingsFile, JSON.stringify(stripped));
    const noAsk = cpSpawn(COMMIT_SH, ['--agent', 'feat: add a'], AGENT_ENV);
    check('[commit-policy] agent policy: missing ask rule refused', noAsk.status !== 0 && /not wired/.test(noAsk.stderr) && commits() === 0, out(noAsk));
    fs.writeFileSync(settingsFile, savedSettings);

    const ok = cpSpawn(COMMIT_SH, ['--agent', 'feat(core): add a\n\nBody line.'], AGENT_ENV);
    const msg = cpSpawn('git', ['log', '-1', '--format=%s'], HUMAN_ENV).stdout.trim();
    check('[commit-policy] agent policy: canonical commit.sh --agent commits', ok.status === 0 && commits() === 1 && msg === 'feat(core): add a', out(ok));

    stage('b.txt');
    const rawNoToken = cpSpawn('git', ['commit', '-m', 'feat: b'], { ...AGENT_ENV, DEVOS_COMMIT_APPROVED: 'true' });
    check('[commit-policy] pre-commit refuses an agent raw commit without DEVOS_AGENT_COMMIT', rawNoToken.status !== 0 && commits() === 1, out(rawNoToken));
    const otherHarness = cpSpawn('git', ['commit', '-m', 'feat: b'], { ...AGENT_ENV, GEMINI_CLI: '1', DEVOS_COMMIT_APPROVED: 'true', DEVOS_AGENT_COMMIT: '1' });
    check('[commit-policy] pre-commit refuses other harness markers even with the agent token', otherHarness.status !== 0 && commits() === 1, out(otherHarness));

    const disable = cpCli(['commit-policy', 'human'], AGENT_ENV);
    check('[commit-policy] switching back to human', disable.status === 0 && policyOf() === 'human', out(disable));
    const afterDisable = cpSpawn('git', ['commit', '-m', 'feat: b'], { ...AGENT_ENV, DEVOS_COMMIT_APPROVED: 'true', DEVOS_AGENT_COMMIT: '1' });
    check('[commit-policy] human policy: pre-commit refuses the agent token', afterDisable.status !== 0 && commits() === 1, out(afterDisable));

    // PreToolUse: only the canonical spelling reaches the ask rule
    const hook = path.join(cp, '.agents', 'hooks', 'pre-tool-use.sh');
    [
      'bash .agents/scripts/commit.sh --agent "feat: x"',
      'sh .agents/scripts/commit.sh --agent "feat: x"',
      './.agents/scripts/commit.sh --agent "feat: x"',
      `${cp}/.agents/scripts/commit.sh --agent "feat: x"`,
      'source .agents/scripts/commit.sh',
      'eval ".agents/scripts/commit.sh --agent x"',
      'echo $(.agents/scripts/commit.sh --agent x)',
      'C=.agents/scripts/commit.sh; $C --agent "feat: x"',
      'DEVOS_AGENT_COMMIT=1 git status'
    ].forEach((c) => {
      const r = runHook(hook, { cwd: cp, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: c }, cwd: cp }), env: AGENT_ENV });
      check(`[commit-policy] hook blocks: ${c}`, isBlocked(r), hookDetail(r));
    });
    ['git add -A && .agents/scripts/commit.sh --agent "feat: x"', 'cat .agents/scripts/commit.sh'].forEach((c) => {
      const r = runHook(hook, { cwd: cp, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: c }, cwd: cp }), env: AGENT_ENV });
      check(`[commit-policy] hook allows: ${c}`, r.status === 0, hookDetail(r));
    });
  } finally {
    fs.rmSync(cp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Phase 4, W5: harness conformance fixture.
// Every external fact Dev-OS depends on is pinned in .agents/evals/conformance.json
// with its doc URL and the date it was verified. These checks make the fixture
// binding: wiring an event or emitting a frontmatter key that no recorded fact
// supports is a test failure, not a silent assumption.
// ---------------------------------------------------------------------------
function checkConformance() {
  const fixturePath = path.join(ROOT, '.agents', 'evals', 'conformance.json');
  const fx = readJson(fixturePath);
  check('[W5] .agents/evals/conformance.json exists and is valid JSON', Boolean(fx), fixturePath);
  if (!fx) return;

  check('[W5] the fixture is shipped in the npm tarball',
    (require(path.join(ROOT, 'package.json')).files || []).some((p) => p === '.agents/evals/conformance.json' || p === '.agents/evals/'),
    JSON.stringify(require(path.join(ROOT, 'package.json')).files));

  const harnesses = fx.harnesses || {};
  check('[W5] the fixture covers every harness Dev-OS writes hooks for',
    ['claude', 'codex', 'cursor', 'antigravity', 'opencode'].every((h) => harnesses[h] && Array.isArray(harnesses[h].hookEvents)),
    Object.keys(harnesses).join(','));

  // Every fact carries a URL and an ISO date, so "when was this last checked" is answerable.
  const stale = [];
  const malformed = [];
  Object.entries(harnesses).forEach(([key, h]) => {
    (h.docs || []).forEach((d) => {
      if (!/^https:\/\//.test(d.url || '') || !/^\d{4}-\d{2}-\d{2}$/.test(d.verified || '')) malformed.push(`${key}:${d.url}`);
    });
    if (!Array.isArray(h.docs) || !h.docs.length) malformed.push(`${key}: no docs`);
  });
  check('[W5] every recorded fact carries an https doc URL and an ISO verification date', malformed.length === 0, malformed.join('; '));

  // The binding part: what the CLI generates must be backed by the fixture. Read from the
  // CLI's exported objects — an earlier version regexed the source, and a quoted key, a
  // different indent or double quotes made the check pass while missing the event entirely.
  const devosExports = require(path.join(ROOT, 'bin', 'devos.js'));
  check('[W5] the CLI exports its wired events for the conformance check', Boolean(devosExports.wiredHookEvents));
  Object.entries(devosExports.wiredHookEvents || {}).forEach(([harness, events]) => {
    const recorded = (harnesses[harness] || {}).hookEvents || [];
    const unbacked = events.filter((e) => !recorded.includes(e));
    check(`[W5] every ${harness} event the CLI wires is a recorded event (${events.length})`,
      events.length > 0 && unbacked.length === 0, unbacked.join(','));
  });
  const ocUsed = devosExports.openCodePluginHooks || [];
  check('[W5] the OpenCode plugin only uses recorded hook names',
    ocUsed.length > 0 && ocUsed.every((h) => (harnesses.opencode.pluginHooks || []).includes(h)),
    `used=${ocUsed.join(',')}`);
  const recordedKeys = (harnesses.claude.subagentKeys || []).concat(harnesses.claude.subagentKeysIgnoredForPlugins || []);
  check('[W5] every subagent key the generator emits is a recorded key',
    (devosExports.subagentKeysEmitted || []).length > 0 &&
    (devosExports.subagentKeysEmitted || []).every((k) => recordedKeys.includes(k)),
    (devosExports.subagentKeysEmitted || []).filter((k) => !recordedKeys.includes(k)).join(','));
  check('[W5] every key the generator drops is recorded as ignored for plugin agents',
    (devosExports.subagentKeysDropped || []).length > 0 &&
    (devosExports.subagentKeysDropped || []).every((k) => (harnesses.claude.subagentKeysIgnoredForPlugins || []).includes(k)),
    (devosExports.subagentKeysDropped || []).join(','));
  // Enumerated values are recorded too: isolation: remote shipped once on no source at all.
  [['agentIsolations', 'subagentIsolationValues'], ['agentEfforts', 'subagentEffortValues'],
    ['agentColors', 'subagentColorValues'], ['agentMemoryScopes', 'subagentMemoryValues']].forEach(([exp, rec]) => {
    const have = devosExports[exp] || [];
    const want = harnesses.claude[rec] || [];
    check(`[W5] every ${exp} value the generator accepts is recorded`,
      have.length > 0 && want.length > 0 && have.every((v) => want.includes(v)),
      `have=${have.join(',')} recorded=${want.join(',')}`);
  });

  // The offline self-check must agree, and must be runnable without the network.
  const selfCheck = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-conformance.js')],
    { cwd: ROOT, encoding: 'utf8', timeout: CLI_TIMEOUT_MS, env: BASE_ENV });
  check('[W5] scripts/check-conformance.js passes offline and exits 0', selfCheck.status === 0,
    ((selfCheck.stdout || '') + (selfCheck.stderr || '')).slice(-400));
  check('[W5] the conformance checker reports the oldest verification date',
    /verified/i.test((selfCheck.stdout || '')), (selfCheck.stdout || '').slice(-300));

  // A scheduled job re-fetches the docs; it must exist and must not be the CLI's job.
  const wf = path.join(ROOT, '.github', 'workflows', 'harness-conformance.yml');
  check('[W5] a scheduled workflow re-checks the harness docs', fs.existsSync(wf));
  if (fs.existsSync(wf)) {
    const y = fs.readFileSync(wf, 'utf8');
    check('[W5] the workflow runs on a schedule and can open an issue',
      /schedule:/.test(y) && /cron:/.test(y) && /issues:\s*write/.test(y), y.slice(0, 300));
    check('[W5] the workflow calls the conformance checker with --fetch',
      /check-conformance\.js --fetch|check-conformance\.js\s+--fetch/.test(y), y.slice(0, 400));
  }
  const cliSource = fs.readFileSync(path.join(ROOT, 'bin', 'devos.js'), 'utf8');
  check('[W5] the CLI itself never fetches for conformance (it stays offline and zero-dependency)',
    !/fetch\(/.test(cliSource), 'bin/devos.js must not call fetch()');
}
checkConformance();

console.log('');
console.log(`Elapsed: ${((Date.now() - SUITE_START) / 1000).toFixed(1)}s`);
if (failures > 0) {
  console.error(`[ FAIL ] Smoke test finished with ${failures} failure(s).`);
  process.exit(1);
}
console.log('[ OK ] Smoke test passed.');
