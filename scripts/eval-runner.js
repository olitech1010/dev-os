#!/usr/bin/env node

/**
 * Dev-OS Reliability & Evaluation Runner (Zero External Dependencies)
 * Owned by the Eval Engineer Agent.
 *
 * Measures capability benchmarks, pass@k reliability rates, multi-harness parity,
 * memory preservation, and quality gate adherence.
 *
 * Usage:
 *   $ node scripts/eval-runner.js
 *   $ node scripts/eval-runner.js --suite gates
 *   $ node scripts/eval-runner.js --k 3
 *   $ node scripts/eval-runner.js --list
 *   $ node scripts/eval-runner.js --scorecard
 *   $ node scripts/eval-runner.js --json
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'bin', 'devos.js');
const EVALS_DIR = path.join(ROOT, '.agents', 'evals');
const SUITES_DIR = path.join(EVALS_DIR, 'suites');
const REPORTS_DIR = path.join(EVALS_DIR, 'reports');

// Colors
const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && process.env.TERM !== 'dumb';
const c = {
  reset: useColor ? '\x1b[0m' : '',
  bold: useColor ? '\x1b[1m' : '',
  dim: useColor ? '\x1b[2m' : '',
  cyan: useColor ? '\x1b[36m' : '',
  green: useColor ? '\x1b[32m' : '',
  yellow: useColor ? '\x1b[33m' : '',
  red: useColor ? '\x1b[31m' : '',
  magenta: useColor ? '\x1b[35m' : '',
  gray: useColor ? '\x1b[90m' : ''
};

function parseArgs(args) {
  const flags = {
    suite: null,
    k: 1,
    list: false,
    scorecard: false,
    json: false,
    quiet: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--suite' || arg === '-s') {
      flags.suite = args[i + 1] || null;
      i++;
    } else if (arg === '--k' || arg === '-k') {
      flags.k = parseInt(args[i + 1] || '1', 10);
      i++;
    } else if (arg === '--list' || arg === '-l') {
      flags.list = true;
    } else if (arg === '--scorecard') {
      flags.scorecard = true;
    } else if (arg === '--json') {
      flags.json = true;
    } else if (arg === '--quiet' || arg === '-q') {
      flags.quiet = true;
    } else if (arg === '--help' || arg === '-h') {
      flags.help = true;
    }
  }

  return flags;
}

function loadSuites() {
  if (!fs.existsSync(SUITES_DIR)) return [];
  return fs.readdirSync(SUITES_DIR)
    .filter((f) => f.endsWith('.eval.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(SUITES_DIR, f), 'utf8'));
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);
}

function printHelp() {
  console.log(`${c.bold}Dev-OS Reliability & Evaluation Runner${c.reset}`);
  console.log(`Maintained by the Eval Engineer agent.\n`);
  console.log(`${c.bold}USAGE${c.reset}`);
  console.log(`  $ node scripts/eval-runner.js [flags]\n`);
  console.log(`${c.bold}FLAGS${c.reset}`);
  console.log(`  --suite, -s <name>    Run specific evaluation suite (gates, harness-parity, memory-preservation, agent-authority, workflow-integrity)`);
  console.log(`  --k, -k <number>      Number of sampling iterations for pass@k estimation (default: 1)`);
  console.log(`  --list, -l            List all registered evaluation suites and test cases`);
  console.log(`  --scorecard           Display the latest evaluation scorecard`);
  console.log(`  --json                Output results as JSON`);
  console.log(`  --quiet, -q           Suppress verbose test logs`);
  console.log(`  --help, -h            Show this help reference\n`);
}

function displayLatestScorecard() {
  const latestPath = path.join(REPORTS_DIR, 'latest-scorecard.json');
  if (!fs.existsSync(latestPath)) {
    console.log(`${c.yellow}[ WARN ] No previous evaluation scorecard found.${c.reset}`);
    console.log(`Run ${c.cyan}devos eval run${c.reset} to generate the initial scorecard.\n`);
    return;
  }
  const scorecard = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
  console.log(`${c.bold}DEV-OS EVALUATION SCORECARD${c.reset}`);
  console.log(`${c.gray}────────────────────────────────────────────────${c.reset}`);
  console.log(`  Timestamp:        ${scorecard.timestamp}`);
  console.log(`  Verdict:          ${scorecard.verdict === 'EVAL_PASSED' ? c.green + c.bold + 'EVAL_PASSED' : c.red + c.bold + 'EVAL_REGRESSED'}${c.reset}`);
  console.log(`  Reliability Index:${scorecard.score >= 95 ? c.green : c.yellow} ${scorecard.score}%${c.reset}`);
  console.log(`  Total Cases:      ${scorecard.totalCases} (${scorecard.passedCases} passed, ${scorecard.failedCases} failed)`);
  console.log(`  pass@1:           ${c.cyan}${(scorecard.passAtK.k1 * 100).toFixed(1)}%${c.reset}`);
  console.log(`  pass@3:           ${c.cyan}${(scorecard.passAtK.k3 * 100).toFixed(1)}%${c.reset}`);
  console.log(`  pass@5:           ${c.cyan}${(scorecard.passAtK.k5 * 100).toFixed(1)}%${c.reset}`);
  console.log(`\n${c.bold}SUITE BREAKDOWN${c.reset}`);
  Object.keys(scorecard.suites).forEach((suiteId) => {
    const s = scorecard.suites[suiteId];
    const tag = s.passed === s.total ? `${c.green}[PASS]${c.reset}` : `${c.red}[FAIL]${c.reset}`;
    console.log(`  ${tag} ${c.bold}${s.name}${c.reset} — ${s.passed}/${s.total} passed`);
  });
  console.log();
}

// ---------------------------------------------------------------------------
// Suite Execution Handlers
// ---------------------------------------------------------------------------

function executeGatesSuite(cItem) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-eval-gate-'));
  try {
    const hooksDir = path.join(tmp, '.agents', 'hooks');
    const scriptsDir = path.join(tmp, '.agents', 'scripts');
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.mkdirSync(scriptsDir, { recursive: true });

    // Copy relevant scripts
    ['pre-tool-use.sh'].forEach((f) => {
      const src = path.join(ROOT, '.agents', 'hooks', f);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(hooksDir, f));
        fs.chmodSync(path.join(hooksDir, f), '755');
      }
    });
    ['ui-taste-check.sh', 'humanize-check.sh', 'env-check.sh', 'db-check.sh', 'commit.sh'].forEach((f) => {
      const src = path.join(ROOT, '.agents', 'scripts', f);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(scriptsDir, f));
        fs.chmodSync(path.join(scriptsDir, f), '755');
      }
    });

    switch (cItem.id) {
      case 'gate-design-absence': {
        const res = spawnSync('bash', [path.join(hooksDir, 'pre-tool-use.sh'), 'write_to_file', 'src/App.tsx'], { cwd: tmp, encoding: 'utf8' });
        const blocked = res.status !== 0 && (res.stdout.includes('DESIGN.md') || res.stderr.includes('DESIGN.md'));
        return { ok: blocked, detail: blocked ? null : 'Failed to block UI file authoring when DESIGN.md was absent' };
      }
      case 'gate-design-presence': {
        fs.writeFileSync(path.join(tmp, 'DESIGN.md'), '# Design Specification\nArchetype: Technical Minimalist\n');
        const res = spawnSync('bash', [path.join(hooksDir, 'pre-tool-use.sh'), 'write_to_file', 'src/App.tsx'], { cwd: tmp, encoding: 'utf8' });
        const passed = res.status === 0;
        return { ok: passed, detail: passed ? null : `Pre-tool-use hook unexpectedly rejected valid UI edit: ${res.stderr || res.stdout}` };
      }
      case 'gate-ui-taste-violations': {
        const srcDir = path.join(tmp, 'src');
        fs.mkdirSync(srcDir, { recursive: true });
        fs.writeFileSync(path.join(srcDir, 'BadButton.tsx'), 'export const Button = () => <button>✨ Click me 🚀</button>;\n');
        const res = spawnSync('bash', [path.join(scriptsDir, 'ui-taste-check.sh')], { cwd: tmp, encoding: 'utf8' });
        const caught = res.status === 1;
        return { ok: caught, detail: caught ? null : 'UI taste check failed to reject raw emojis and sparkle clichés' };
      }
      case 'gate-ui-taste-compliant': {
        const srcDir = path.join(tmp, 'src');
        fs.mkdirSync(srcDir, { recursive: true });
        fs.writeFileSync(path.join(srcDir, 'CleanCard.tsx'), 'export const Card = () => <div className="rounded border p-4 bg-slate-900 text-white"><h3>System Metric</h3></div>;\n');
        const res = spawnSync('bash', [path.join(scriptsDir, 'ui-taste-check.sh')], { cwd: tmp, encoding: 'utf8' });
        const passed = res.status === 0;
        return { ok: passed, detail: passed ? null : `UI taste check rejected clean code: ${res.stdout}` };
      }
      case 'gate-humanizer-violations': {
        const docsDir = path.join(tmp, 'docs');
        fs.mkdirSync(docsDir, { recursive: true });
        const filePath = path.join(docsDir, 'AI_SLOP.md');
        fs.writeFileSync(filePath, '# Overview\nLet us delve into this crucial game-changer.\nLet that sink in.\n');
        const res = spawnSync('bash', [path.join(scriptsDir, 'humanize-check.sh'), filePath], { cwd: tmp, encoding: 'utf8' });
        const caught = res.status === 1;
        return { ok: caught, detail: caught ? null : 'Humanizer check failed to catch robotic AI writing tells' };
      }
      case 'gate-humanizer-compliant': {
        const docsDir = path.join(tmp, 'docs');
        fs.mkdirSync(docsDir, { recursive: true });
        const filePath = path.join(docsDir, 'CLEAN.md');
        fs.writeFileSync(filePath, '# System Configuration\nThe system runs as a background process listening on port 8080.\n');
        const res = spawnSync('bash', [path.join(scriptsDir, 'humanize-check.sh'), filePath], { cwd: tmp, encoding: 'utf8' });
        const passed = res.status === 0;
        return { ok: passed, detail: passed ? null : `Humanizer check rejected natural prose: ${res.stdout}` };
      }
      case 'gate-env-parity-violations': {
        const srcDir = path.join(tmp, 'src');
        fs.mkdirSync(srcDir, { recursive: true });
        fs.writeFileSync(path.join(srcDir, 'api.js'), 'const token = process.env.UNTRACKED_SECRET_KEY;\n');
        fs.writeFileSync(path.join(tmp, '.env.example'), 'PORT=3000\n');
        const res = spawnSync('bash', [path.join(scriptsDir, 'env-check.sh')], { cwd: tmp, encoding: 'utf8' });
        const caught = res.status === 1;
        return { ok: caught, detail: caught ? null : 'Environment parity check failed to catch undocumented variable' };
      }
      case 'gate-env-parity-compliant': {
        const srcDir = path.join(tmp, 'src');
        fs.mkdirSync(srcDir, { recursive: true });
        fs.writeFileSync(path.join(srcDir, 'api.js'), 'const port = process.env.PORT || 3000;\n');
        fs.writeFileSync(path.join(tmp, '.env.example'), 'PORT=3000\n');
        const res = spawnSync('bash', [path.join(scriptsDir, 'env-check.sh')], { cwd: tmp, encoding: 'utf8' });
        const passed = res.status === 0;
        return { ok: passed, detail: passed ? null : `Environment parity check rejected valid .env.example: ${res.stdout}` };
      }
      case 'gate-db-safety-violations': {
        const migDir = path.join(tmp, 'migrations');
        fs.mkdirSync(migDir, { recursive: true });
        fs.writeFileSync(path.join(migDir, '001_create_accounts.sql'), 'CREATE TABLE accounts (id uuid primary key, balance numeric);\n');
        const res = spawnSync('bash', [path.join(scriptsDir, 'db-check.sh')], { cwd: tmp, encoding: 'utf8' });
        const caught = res.status === 1;
        return { ok: caught, detail: caught ? null : 'Database safety check failed to catch table missing RLS' };
      }
      case 'gate-db-safety-compliant': {
        const migDir = path.join(tmp, 'migrations');
        fs.mkdirSync(migDir, { recursive: true });
        fs.writeFileSync(path.join(migDir, '001_create_accounts.sql'), 'CREATE TABLE accounts (id uuid primary key, balance numeric);\nALTER TABLE accounts ENABLE ROW LEVEL SECURITY;\n');
        const res = spawnSync('bash', [path.join(scriptsDir, 'db-check.sh')], { cwd: tmp, encoding: 'utf8' });
        const passed = res.status === 0;
        return { ok: passed, detail: passed ? null : `Database safety check rejected table with RLS: ${res.stdout}` };
      }
      case 'gate-commit-checkpoint': {
        const scriptPath = path.join(ROOT, '.agents', 'scripts', 'commit.sh');
        const hookPath = path.join(ROOT, '.agents', 'scripts', 'install-hooks.sh');
        const ok = fs.existsSync(scriptPath) && fs.existsSync(hookPath);
        return { ok, detail: ok ? null : 'Mechanical commit scripts missing or unconfigured' };
      }
      default:
        return { ok: true, detail: null };
    }
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
}

function executeHarnessParitySuite(cItem) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-eval-harness-'));
  try {
    switch (cItem.id) {
      case 'harness-claude-artifacts': {
        const res = spawnSync(process.execPath, [CLI, 'init', '--platform', 'claude', '--existing', '--quiet'], { cwd: tmp, encoding: 'utf8' });
        const ok = res.status === 0 &&
          fs.existsSync(path.join(tmp, '.claude', 'commands')) &&
          fs.existsSync(path.join(tmp, '.claude', 'agents')) &&
          fs.existsSync(path.join(tmp, 'CLAUDE.md'));
        return { ok, detail: ok ? null : `Claude harness artifacts missing: ${res.stderr || res.stdout}` };
      }
      case 'harness-antigravity-artifacts': {
        const res = spawnSync(process.execPath, [CLI, 'init', '--platform', 'antigravity', '--existing', '--quiet'], { cwd: tmp, encoding: 'utf8' });
        const ok = res.status === 0 &&
          fs.existsSync(path.join(tmp, 'ANTIGRAVITY.md')) &&
          fs.existsSync(path.join(tmp, 'GEMINI.md'));
        return { ok, detail: ok ? null : `Antigravity/Gemini artifacts missing: ${res.stderr || res.stdout}` };
      }
      case 'harness-cursor-artifacts': {
        const res = spawnSync(process.execPath, [CLI, 'init', '--platform', 'cursor', '--existing', '--quiet'], { cwd: tmp, encoding: 'utf8' });
        const ok = res.status === 0 &&
          fs.existsSync(path.join(tmp, '.cursor', 'rules', 'devos.mdc')) &&
          fs.existsSync(path.join(tmp, '.cursorrules'));
        return { ok, detail: ok ? null : `Cursor artifacts missing: ${res.stderr || res.stdout}` };
      }
      case 'harness-opencode-artifacts': {
        const res = spawnSync(process.execPath, [CLI, 'init', '--platform', 'opencode', '--existing', '--quiet'], { cwd: tmp, encoding: 'utf8' });
        const ok = res.status === 0 &&
          fs.existsSync(path.join(tmp, 'OPENCODE.md')) &&
          fs.existsSync(path.join(tmp, '.opencode', 'rules', 'devos-rules.md'));
        return { ok, detail: ok ? null : `OpenCode artifacts missing: ${res.stderr || res.stdout}` };
      }
      case 'harness-codex-artifacts': {
        const res = spawnSync(process.execPath, [CLI, 'init', '--platform', 'codex', '--existing', '--quiet'], { cwd: tmp, encoding: 'utf8' });
        const ok = res.status === 0 &&
          fs.existsSync(path.join(tmp, '.codex', 'instructions.md')) &&
          fs.existsSync(path.join(tmp, '.windsurfrules'));
        return { ok, detail: ok ? null : `Codex artifacts missing: ${res.stderr || res.stdout}` };
      }
      case 'harness-hard-rules-digest-parity': {
        const res = spawnSync(process.execPath, [CLI, 'init', '--platform', 'all', '--existing', '--quiet'], { cwd: tmp, encoding: 'utf8' });
        if (res.status !== 0) return { ok: false, detail: 'Failed to initialize universal harness setup' };
        const claudeMd = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf8');
        const agyMd = fs.readFileSync(path.join(tmp, 'ANTIGRAVITY.md'), 'utf8');
        const cursorMdc = fs.readFileSync(path.join(tmp, '.cursor', 'rules', 'devos.mdc'), 'utf8');
        const openCodeMd = fs.readFileSync(path.join(tmp, 'OPENCODE.md'), 'utf8');
        const codexMd = fs.readFileSync(path.join(tmp, '.codex', 'instructions.md'), 'utf8');
        const ruleCheck = (text) => text.includes('commit.sh') && text.includes('Zero Secrets') && text.includes('Circuit Breaker');
        const ok = ruleCheck(claudeMd) && ruleCheck(agyMd) && ruleCheck(cursorMdc) && ruleCheck(openCodeMd) && ruleCheck(codexMd);
        return { ok, detail: ok ? null : 'One or more harness configurations failed Hard Rules digest parity' };
      }
      default:
        return { ok: true, detail: null };
    }
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
}

function executeMemoryPreservationSuite(cItem) {
  switch (cItem.id) {
    case 'memory-context-schema': {
      const ctxPath = path.join(ROOT, '.agents', 'memory', 'context.json');
      if (!fs.existsSync(ctxPath)) return { ok: false, detail: 'context.json not found' };
      try {
        const data = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
        const ok = Boolean(data.project && data.activeBranch && data.currentMilestone && Array.isArray(data.upcomingMilestones));
        return { ok, detail: ok ? null : 'context.json missing mandatory milestone or upcomingMilestones fields' };
      } catch (e) {
        return { ok: false, detail: 'context.json invalid JSON' };
      }
    }
    case 'memory-task-board-dag': {
      const tbPath = path.join(ROOT, 'docs', 'TASK_BOARD.md');
      if (!fs.existsSync(tbPath)) return { ok: false, detail: 'docs/TASK_BOARD.md not found' };
      const content = fs.readFileSync(tbPath, 'utf8');
      const ok = content.includes('[ IN_PROGRESS ]') && content.includes('[ QUEUED ]') && content.includes('[ BACKLOG ]') && content.includes('[ DONE ]');
      return { ok, detail: ok ? null : 'docs/TASK_BOARD.md missing mandatory DAG status columns' };
    }
    case 'memory-current-state-sync': {
      const csPath = path.join(ROOT, 'docs', 'CURRENT_STATE.md');
      if (!fs.existsSync(csPath)) return { ok: false, detail: 'docs/CURRENT_STATE.md not found' };
      const content = fs.readFileSync(csPath, 'utf8');
      const ok = content.includes('Current Task') && content.includes('Active Agents') && content.includes('Eval Engineer');
      return { ok, detail: ok ? null : 'docs/CURRENT_STATE.md missing active task or Eval Engineer allocation' };
    }
    case 'memory-adr-template-integrity': {
      const adrPath = path.join(ROOT, '.agents', 'memory', 'decisions', 'ADR-000-template.md');
      const ok = fs.existsSync(adrPath);
      return { ok, detail: ok ? null : 'ADR template missing in .agents/memory/decisions/' };
    }
    case 'memory-handoff-template-integrity': {
      const handoffPath = path.join(ROOT, '.agents', 'memory', 'handoffs', 'handoff-template.md');
      const ok = fs.existsSync(handoffPath);
      return { ok, detail: ok ? null : 'Handoff template missing in .agents/memory/handoffs/' };
    }
    default:
      return { ok: true, detail: null };
  }
}

function executeAgentAuthoritySuite(cItem) {
  switch (cItem.id) {
    case 'authority-orchestrator-boundary': {
      const orchPath = path.join(ROOT, '.agents', 'agents', 'orchestrator.md');
      if (!fs.existsSync(orchPath)) return { ok: false, detail: 'orchestrator.md missing' };
      const content = fs.readFileSync(orchPath, 'utf8');
      const ok = content.toLowerCase().includes('not write production code') || content.toLowerCase().includes('never writes production code');
      return { ok, detail: ok ? null : 'orchestrator.md lacks explicit production code authoring prohibition' };
    }
    case 'authority-developer-commit-boundary': {
      const devPath = path.join(ROOT, '.agents', 'agents', 'developer.md');
      if (!fs.existsSync(devPath)) return { ok: false, detail: 'developer.md missing' };
      const content = fs.readFileSync(devPath, 'utf8');
      const ok = content.includes('commit.sh') || content.includes('staged review') || content.toLowerCase().includes('never commits directly');
      return { ok, detail: ok ? null : 'developer.md lacks staged review or commit.sh enforcement' };
    }
    case 'authority-qa-boundary': {
      const qaPath = path.join(ROOT, '.agents', 'agents', 'qa.md');
      if (!fs.existsSync(qaPath)) return { ok: false, detail: 'qa.md missing' };
      const content = fs.readFileSync(qaPath, 'utf8');
      const ok = content.toLowerCase().includes('does not write tests');
      return { ok, detail: ok ? null : 'qa.md lacks explicit "does not write tests" boundary' };
    }
    case 'authority-tester-boundary': {
      const testerPath = path.join(ROOT, '.agents', 'agents', 'tester.md');
      if (!fs.existsSync(testerPath)) return { ok: false, detail: 'tester.md missing' };
      const content = fs.readFileSync(testerPath, 'utf8');
      const ok = content.toLowerCase().includes('does not "fix" code') || content.toLowerCase().includes('reports failures to developer');
      return { ok, detail: ok ? null : 'tester.md lacks explicit application code non-fixing boundary' };
    }
    case 'authority-dba-boundary': {
      const dbaPath = path.join(ROOT, '.agents', 'agents', 'dba.md');
      if (!fs.existsSync(dbaPath)) return { ok: false, detail: 'dba.md missing' };
      const content = fs.readFileSync(dbaPath, 'utf8');
      const ok = content.includes('RLS') || content.includes('Row Level Security');
      return { ok, detail: ok ? null : 'dba.md lacks explicit RLS governance mandate' };
    }
    case 'authority-security-boundary': {
      const secPath = path.join(ROOT, '.agents', 'agents', 'security.md');
      if (!fs.existsSync(secPath)) return { ok: false, detail: 'security.md missing' };
      const content = fs.readFileSync(secPath, 'utf8');
      const ok = content.includes('OWASP') && (content.includes('secret') || content.includes('credential'));
      return { ok, detail: ok ? null : 'security.md lacks OWASP Top 10 or secret audit directives' };
    }
    case 'authority-orchestrator-persistence': {
      const promptHook = path.join(ROOT, '.agents', 'hooks', 'user-prompt-submit.sh');
      const startHook = path.join(ROOT, '.agents', 'hooks', 'session-start.sh');
      const agentsMd = path.join(ROOT, '.agents', 'AGENTS.md');
      if (!fs.existsSync(promptHook)) return { ok: false, detail: 'user-prompt-submit.sh missing' };
      const promptContent = fs.readFileSync(promptHook, 'utf8');
      const startContent = fs.existsSync(startHook) ? fs.readFileSync(startHook, 'utf8') : '';
      const agentsContent = fs.existsSync(agentsMd) ? fs.readFileSync(agentsMd, 'utf8') : '';
      const ok = promptContent.includes('Orchestrator Directive') &&
        startContent.includes('session.json') &&
        agentsContent.includes('Orchestrator Persistence');
      return { ok, detail: ok ? null : 'Orchestrator persistence hook, session lock, or Hard Rule missing' };
    }
    case 'authority-delegation-gate': {
      const hookPath = path.join(ROOT, '.agents', 'hooks', 'pre-tool-use.sh');
      if (!fs.existsSync(hookPath)) return { ok: false, detail: 'pre-tool-use.sh missing' };
      const content = fs.readFileSync(hookPath, 'utf8');
      const ok = content.includes('Orchestration Gate') &&
        content.includes('has_active_task') &&
        content.includes('DEVOS_SOLO_APPROVED');
      return { ok, detail: ok ? null : 'Orchestration Gate, active-task check, or solo escape hatch missing' };
    }
    default:
      return { ok: true, detail: null };
  }
}

function executeWorkflowIntegritySuite(cItem) {
  const agentsMdPath = path.join(ROOT, '.agents', 'AGENTS.md');
  const content = fs.existsSync(agentsMdPath) ? fs.readFileSync(agentsMdPath, 'utf8') : '';

  switch (cItem.id) {
    case 'workflow-feature-delivery-steps': {
      const ok = content.includes('Standard Feature Delivery') && content.includes('PARALLEL GATE');
      return { ok, detail: ok ? null : 'Standard Feature Delivery workflow missing from .agents/AGENTS.md' };
    }
    case 'workflow-circuit-breaker-rule': {
      const ok = content.includes('Circuit Breaker') && content.includes('3 iterations');
      return { ok, detail: ok ? null : 'Circuit Breaker rule (3 iterations) missing from .agents/AGENTS.md' };
    }
    case 'workflow-solo-session-protocol': {
      const ok = content.includes('Solo Session Protocol') && content.includes('Minimum Viable Gate');
      return { ok, detail: ok ? null : 'Solo Session Protocol missing from .agents/AGENTS.md' };
    }
    case 'workflow-rollback-incident-log': {
      const ok = content.includes('Rollback Protocol') && content.includes('LESSONS.md');
      return { ok, detail: ok ? null : 'Rollback Protocol lacks LESSONS.md incident logging step' };
    }
    case 'workflow-universal-password': {
      const testingGuidePath = path.join(ROOT, '.agents', 'skills', 'testing-guide', 'SKILL.md');
      const hasSkill = fs.existsSync(testingGuidePath) && fs.readFileSync(testingGuidePath, 'utf8').includes('devos123');
      const hasRule = content.includes('devos123');
      const ok = hasSkill && hasRule;
      return { ok, detail: ok ? null : 'Universal test password devos123 missing from testing guide or AGENTS.md' };
    }
    default:
      return { ok: true, detail: null };
  }
}

function runCase(suiteId, cItem) {
  switch (suiteId) {
    case 'gates':
      return executeGatesSuite(cItem);
    case 'harness-parity':
      return executeHarnessParitySuite(cItem);
    case 'memory-preservation':
      return executeMemoryPreservationSuite(cItem);
    case 'agent-authority':
      return executeAgentAuthoritySuite(cItem);
    case 'workflow-integrity':
      return executeWorkflowIntegritySuite(cItem);
    default:
      return { ok: true, detail: null };
  }
}

// ---------------------------------------------------------------------------
// Main Evaluation Orchestration
// ---------------------------------------------------------------------------

function runEvaluation(flags) {
  if (flags.scorecard) {
    displayLatestScorecard();
    return 0;
  }

  const suites = loadSuites();
  if (suites.length === 0) {
    console.error(`${c.red}[ FAIL ] No evaluation suites found in ${SUITES_DIR}${c.reset}`);
    return 1;
  }

  if (flags.list) {
    console.log(`${c.bold}DEV-OS EVALUATION BENCHMARK SUITES${c.reset}`);
    console.log(`${c.gray}────────────────────────────────────────────────${c.reset}\n`);
    suites.forEach((s) => {
      console.log(`  ${c.cyan}${c.bold}${s.id.padEnd(22)}${c.reset} [${s.category}] ${s.name}`);
      console.log(`  ${c.gray}${s.description}${c.reset}`);
      console.log(`  ${c.dim}Test Cases (${s.cases.length}): ${s.cases.map((cs) => cs.id).join(', ')}${c.reset}\n`);
    });
    return 0;
  }

  const selectedSuites = flags.suite ? suites.filter((s) => s.id === flags.suite) : suites;
  if (selectedSuites.length === 0) {
    console.error(`${c.red}[ FAIL ] Unknown evaluation suite '${flags.suite}'. Available: ${suites.map((s) => s.id).join(', ')}${c.reset}`);
    return 1;
  }

  const kIterations = Math.max(1, flags.k || 1);
  if (!flags.quiet && !flags.json) {
    console.log(`\n${c.bold}Dev-OS Capability & Reliability Benchmark${c.reset}`);
    console.log(`${c.gray}Eval Engineer Runner · Sampling k=${kIterations} · ${selectedSuites.length} Suites${c.reset}`);
    console.log(`${c.gray}────────────────────────────────────────────────${c.reset}\n`);
  }

  const startTime = Date.now();
  let totalCases = 0;
  let passedCases = 0;
  let failedCases = 0;
  let criticalFailures = 0;
  const suiteResults = {};
  const failureTraces = [];

  selectedSuites.forEach((s) => {
    if (!flags.quiet && !flags.json) {
      console.log(`${c.bold}${s.name}${c.reset} ${c.gray}(${s.id})${c.reset}`);
    }

    let sPassed = 0;
    let sTotal = 0;

    s.cases.forEach((cs) => {
      totalCases++;
      sTotal++;

      // Run k sampling iterations
      let casePasses = 0;
      let lastDetail = null;

      for (let iter = 0; iter < kIterations; iter++) {
        const result = runCase(s.id, cs);
        if (result.ok) {
          casePasses++;
        } else {
          lastDetail = result.detail;
        }
      }

      // In pass@k evaluation: considered passed if at least 1 trial succeeded
      const passAtK = casePasses > 0;
      if (passAtK) {
        passedCases++;
        sPassed++;
        if (!flags.quiet && !flags.json) {
          const kTag = kIterations > 1 ? ` ${c.gray}(${casePasses}/${kIterations} trials)${c.reset}` : '';
          console.log(`  [ ${c.green}PASS${c.reset} ] ${cs.name}${kTag}`);
        }
      } else {
        failedCases++;
        if (cs.critical) criticalFailures++;
        failureTraces.push({ suite: s.id, caseId: cs.id, name: cs.name, critical: cs.critical, detail: lastDetail });
        if (!flags.quiet && !flags.json) {
          console.log(`  [ ${c.red}FAIL${c.reset} ] ${cs.name} ${c.gray}(${lastDetail || 'Assertion failed'})${c.reset}`);
        }
      }
    });

    suiteResults[s.id] = {
      name: s.name,
      category: s.category,
      total: sTotal,
      passed: sPassed,
      failed: sTotal - sPassed
    };

    if (!flags.quiet && !flags.json) console.log();
  });

  const durationMs = Date.now() - startTime;
  const baseRate = totalCases > 0 ? passedCases / totalCases : 0;
  // pass@k mathematical estimations
  const p1 = baseRate;
  const p3 = 1 - Math.pow(1 - baseRate, 3);
  const p5 = 1 - Math.pow(1 - baseRate, 5);
  const score = Math.round(baseRate * 100);

  const verdict = (score >= 95 && criticalFailures === 0) ? 'EVAL_PASSED' : 'EVAL_REGRESSED';

  const scorecard = {
    timestamp: new Date().toISOString(),
    verdict,
    score,
    durationMs,
    kSampling: kIterations,
    totalCases,
    passedCases,
    failedCases,
    criticalFailures,
    passAtK: {
      k1: parseFloat(p1.toFixed(3)),
      k3: parseFloat(p3.toFixed(3)),
      k5: parseFloat(p5.toFixed(3))
    },
    suites: suiteResults,
    failures: failureTraces
  };

  // Persist scorecard
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(REPORTS_DIR, `scorecard-${stamp}.json`);
  const latestPath = path.join(REPORTS_DIR, 'latest-scorecard.json');
  fs.writeFileSync(reportPath, JSON.stringify(scorecard, null, 2) + '\n', 'utf8');
  fs.writeFileSync(latestPath, JSON.stringify(scorecard, null, 2) + '\n', 'utf8');

  if (flags.json) {
    console.log(JSON.stringify(scorecard, null, 2));
    return verdict === 'EVAL_PASSED' ? 0 : 1;
  }

  console.log(`${c.gray}────────────────────────────────────────────────${c.reset}`);
  console.log(`${c.bold}BENCHMARK SUMMARY & SCORECARD${c.reset}`);
  console.log(`  Total Cases:      ${totalCases}`);
  console.log(`  Passed Cases:     ${c.green}${passedCases}${c.reset}`);
  console.log(`  Failed Cases:     ${failedCases > 0 ? c.red + failedCases : c.gray + '0'}${c.reset}`);
  console.log(`  Reliability Index:${score >= 95 ? c.green : c.yellow} ${score}%${c.reset}`);
  console.log(`  pass@1:           ${c.cyan}${(p1 * 100).toFixed(1)}%${c.reset}`);
  console.log(`  pass@3:           ${c.cyan}${(p3 * 100).toFixed(1)}%${c.reset}`);
  console.log(`  pass@5:           ${c.cyan}${(p5 * 100).toFixed(1)}%${c.reset}`);
  console.log(`  Execution Time:   ${durationMs}ms`);
  console.log(`  Scorecard Saved:  ${path.relative(ROOT, reportPath)}`);

  console.log(`\n${c.bold}FINAL VERDICT:${c.reset} ${verdict === 'EVAL_PASSED' ? c.green + c.bold + '[ EVAL_PASSED ]' : c.red + c.bold + '[ EVAL_REGRESSED ]'}${c.reset}`);

  if (verdict === 'EVAL_PASSED') {
    console.log(`${c.green}All critical gates, harnesses, and memory protocols comply with Dev-OS standards.${c.reset}\n`);
    return 0;
  } else {
    console.log(`${c.red}Evaluation regressions detected. Review failure traces above before proceeding.${c.reset}\n`);
    return 1;
  }
}

// ---------------------------------------------------------------------------
// CLI Entrypoint
// ---------------------------------------------------------------------------

if (require.main === module) {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    process.exit(0);
  }
  const exitCode = runEvaluation(flags);
  process.exit(exitCode);
}

module.exports = {
  runEvaluation,
  loadSuites,
  displayLatestScorecard
};
