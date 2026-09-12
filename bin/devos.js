#!/usr/bin/env node

/**
 * Dev-OS CLI ('devos' / 'olives-devos' / 'devos-init')
 * Olives Technologies Engineering OS — by Clement Olives.
 * Zero external npm dependencies for instant execution via npx.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Package metadata
const TEMPLATE_DIR = path.resolve(__dirname, '..');
const TARGET_DIR = process.cwd();
const PKG_PATH = path.join(TEMPLATE_DIR, 'package.json');
const PKG = fs.existsSync(PKG_PATH) ? JSON.parse(fs.readFileSync(PKG_PATH, 'utf8')) : { version: '3.0.0' };

const STACKS = ['nextjs', 'laravel', 'django', 'react-native', 'express', 'fastapi', 'universal'];
const HARNESSES = ['claude', 'cursor', 'opencode', 'antigravity', 'gemini', 'codex'];
const PLATFORMS = ['claude', 'antigravity', 'cursor', 'opencode', 'codex', 'all'];

// ANSI color formatting — disabled when piped, in CI, or when NO_COLOR is set
const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && process.env.TERM !== 'dumb';
const PALETTE = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};
const colors = {};
Object.keys(PALETTE).forEach((k) => { colors[k] = useColor ? PALETTE[k] : ''; });

const BANNER_WIDTH = 48;
const RULE = '─'.repeat(BANNER_WIDTH);

// Core Rules and Protocols
const DEVOS_RULES_DIGEST = [
  '1. Zero Destructive Actions: Never delete, drop, or truncate without an approved dry-run plan.',
  '2. Zero Secrets Stored or Logged: API keys & credentials must NEVER be hardcoded. Use `process.env.*`.',
  '3. Mechanical Commit Gate: Raw `git commit` is BLOCKED. Always commit via `.agents/scripts/commit.sh`.',
  '4. Staged Review: Agents write code but NEVER auto-commit. Present summaries for human review first.',
  '5. Circuit Breaker: Halt after 3 failed agent loop iterations and escalate to the human.',
  '6. Verify Before Implementing: Confirm actual library APIs and patterns before authoring code.',
  '7. No Heavy Dependencies: Packages >5MB or >50 dependencies require explicit human approval.',
  '8. Documentation in /docs: All plans, PRDs, architecture notes, and reports belong in `/docs/`.',
  '9. Session-Start Freshness: Run `git fetch --all --prune` and check `git status -sb` before scoping work.',
  '10. Session-End State Obligation: Update `docs/CURRENT_STATE.md` before concluding any session modifying code.',
  '11. Shared Memory Synchronization: Maintain architectural records in `.agents/memory/` (ADRs & handoffs).',
  '12. Task Board Governance: Keep task states in `docs/TASK_BOARD.md` aligned with current execution.'
];

const SOLO_SESSION_PROTOCOL = [
  '- Step 1: Check freshness via `git fetch --all --prune` and `git status -sb`.',
  '- Step 2: Implement following `CODING_STANDARDS.md`.',
  '- Step 3: Self-verify with typecheck (`tsc --noEmit` or equivalent) and automated tests.',
  '- Step 4: Present staged review summary to human.',
  '- Step 5: Route commit through `.agents/scripts/commit.sh`.',
  '- Step 6: Update `docs/CURRENT_STATE.md` and log incidents in `docs/LESSONS.md`.',
  '- Escalation: DB schema changes (DBA), security alterations (Security), or loops exceeding 3 attempts must escalate to human.'
];

// Flags parser helper
function parseArgs(args) {
  const flags = {
    stack: null,
    platform: null,
    fresh: false,
    existing: false,
    json: false,
    quiet: false,
    claude: true,
    help: false,
    version: false,
    allSkills: false,
    allHarnesses: false,
    harness: null,
    hooks: true,
    telemetry: true,
    mode: null,
    skills: false
  };

  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-v' || arg === '--version') {
      flags.version = true;
    } else if (arg === '-h' || arg === '--help') {
      flags.help = true;
    } else if (arg === '--fresh') {
      flags.fresh = true;
    } else if (arg === '--existing') {
      flags.existing = true;
    } else if (arg === '--json') {
      flags.json = true;
    } else if (arg === '--quiet' || arg === '-q') {
      flags.quiet = true;
    } else if (arg === '--no-claude') {
      flags.claude = false;
    } else if (arg === '--no-hooks') {
      flags.hooks = false;
    } else if (arg === '--all-skills') {
      flags.allSkills = true;
    } else if (arg === '--all-harnesses') {
      flags.allHarnesses = true;
    } else if (arg === '--no-telemetry') {
      flags.telemetry = false;
    } else if (arg === '--telemetry') {
      flags.telemetry = true;
    } else if (arg === '--skills') {
      flags.skills = true;
    } else if (arg === '--mode' || arg === '-m') {
      flags.mode = args[i + 1] || null;
      i++;
    } else if (arg === '--platform' || arg === '-p') {
      flags.platform = args[i + 1] || null;
      i++;
    } else if (arg === '--harness') {
      flags.harness = args[i + 1] || null;
      i++;
    } else if (arg === '--stack' || arg === '-s') {
      flags.stack = args[i + 1] || null;
      i++;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  return { command: positional[0] || null, positional: positional.slice(1), flags };
}

const BANNER_ART = [
  '██████╗ ███████╗██╗   ██╗      ██████╗ ███████╗',
  '██╔══██╗██╔════╝██║   ██║     ██╔═══██╗██╔════╝',
  '██║  ██║█████╗  ██║   ██║█████╗██║   ██║███████╗',
  '██║  ██║██╔══╝  ╚██╗ ██╔╝╚════╝██║   ██║╚════██║',
  '██████╔╝███████╗ ╚████╔╝      ╚██████╔╝███████║',
  '╚═════╝ ╚══════╝  ╚═══╝        ╚═════╝ ╚══════╝'
];

function printBanner() {
  const wide = !process.stdout.isTTY || !process.stdout.columns || process.stdout.columns >= BANNER_WIDTH + 2;
  const tagline = 'Autonomous Multi-Agent Engineering Environment';
  const credit = 'by Clement Olives · Olives Technologies';
  const version = `v${PKG.version}`;

  if (useColor && wide) {
    console.log();
    BANNER_ART.forEach((line) => console.log(`${colors.cyan}${line}${colors.reset}`));
    console.log(`${colors.gray}${RULE}${colors.reset}`);
    console.log(`  ${colors.bold}${tagline}${colors.reset}`);
    const pad = Math.max(1, BANNER_WIDTH - 2 - credit.length - version.length);
    console.log(`  ${colors.gray}${credit}${' '.repeat(pad)}${colors.reset}${colors.cyan}${version}${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}\n`);
  } else {
    console.log(`Dev-OS ${version} — ${tagline}`);
    console.log(`${credit}\n`);
  }
}

function printHelp() {
  printBanner();
  console.log(`${colors.bold}USAGE${colors.reset}`);
  console.log(`  $ ${colors.cyan}devos${colors.reset} <command> [flags]\n`);

  console.log(`${colors.bold}CORE COMMANDS${colors.reset}`);
  console.log(`  ${colors.green}init${colors.reset}, ${colors.green}setup${colors.reset}        Initialize Dev-OS multi-agent environment in target project`);
  console.log(`  ${colors.green}update${colors.reset}, ${colors.green}upgrade${colors.reset}    Safely refresh .agents/, skills, commands, harnesses, and hooks`);
  console.log(`  ${colors.green}run${colors.reset}, ${colors.green}auto${colors.reset}         Launch autonomous hands-off SDLC mode (devos run "<product idea>")`);
  console.log(`  ${colors.green}telemetry${colors.reset}            Manage anonymous failure telemetry (status, report, enable, disable)`);
  console.log(`  ${colors.green}doctor${colors.reset}, ${colors.green}check${colors.reset}      Diagnose setup, hooks, memory vault, task board, and health`);
  console.log(`  ${colors.green}pack${colors.reset}, ${colors.green}packs${colors.reset}        Manage composable capability packs (pack list, pack add <name>)`);
  console.log(`  ${colors.green}skill${colors.reset}, ${colors.green}skills${colors.reset}       Manage agent skills from skills.sh (skill list, add <repo>, update, find)`);
  console.log(`  ${colors.green}memory${colors.reset}             Shared memory vault operations (memory list, memory handoff, memory doctor)`);
  console.log(`  ${colors.green}list${colors.reset}, ${colors.green}agents${colors.reset}       Display active agent personas and installed specialist skills`);
  console.log(`  ${colors.green}status${colors.reset}             Show active project configuration, detected stack, and health summary`);
  console.log(`  ${colors.green}version${colors.reset}            Print Dev-OS CLI version, Node runtime, and environment information`);
  console.log(`  ${colors.green}help${colors.reset}               Display this command reference\n`);

  console.log(`${colors.bold}FLAGS${colors.reset}`);
  console.log(`  ${colors.cyan}-s, --stack <name>${colors.reset}    Target stack (${STACKS.join(', ')})`);
  console.log(`  ${colors.cyan}-p, --platform <name>${colors.reset} Target AI platform (${PLATFORMS.join(', ')})`);
  console.log(`  ${colors.cyan}-m, --mode <name>${colors.reset}     SDLC execution mode (interactive, guided, auto, audit)`);
  console.log(`  ${colors.cyan}--telemetry / --no-telemetry${colors.reset} Enable or disable anonymous failure telemetry (default: on)`);
  console.log(`  ${colors.cyan}--harness <list>${colors.reset}      Target AI harnesses: ${HARNESSES.join(', ')}`);
  console.log(`  ${colors.cyan}--all-harnesses${colors.reset}       Generate configurations for all supported AI harnesses`);
  console.log(`  ${colors.cyan}--all-skills${colors.reset}          Install all skills instead of lean stack pack`);
  console.log(`  ${colors.cyan}--skills${colors.reset}              Update or sync installed skills from upstream registry`);
  console.log(`  ${colors.cyan}--no-hooks${colors.reset}            Skip wiring runtime lifecycle hooks (.claude/hooks.json)`);
  console.log(`  ${colors.cyan}--fresh${colors.reset}             Non-interactive fresh project initialization`);
  console.log(`  ${colors.cyan}--existing${colors.reset}          Non-interactive existing project initialization`);
  console.log(`  ${colors.cyan}--no-claude${colors.reset}         Skip generating .claude/ (Claude Code commands & agents)`);
  console.log(`  ${colors.cyan}--json${colors.reset}              Output diagnostic and listing results as JSON`);
  console.log(`  ${colors.cyan}-q, --quiet${colors.reset}         Suppress header banners and non-essential log messages`);
  console.log(`  ${colors.cyan}-v, --version${colors.reset}       Print CLI version`);
  console.log(`  ${colors.cyan}-h, --help${colors.reset}          Show command options\n`);

  console.log(`${colors.bold}EXAMPLES${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx @olives/devos init${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx @olives/devos init --stack nextjs --existing${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx @olives/devos pack list${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx @olives/devos memory handoff${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx @olives/devos doctor${colors.reset}\n`);

  console.log(`${colors.gray}Documentation & Guides: https://github.com/olitech1010/dev-os${colors.reset}\n`);
}

function printVersion() {
  console.log(`Dev-OS CLI v${PKG.version} — by Clement Olives · Olives Technologies`);
  console.log(`Node.js Runtime: ${process.version}`);
  console.log(`OS Platform: ${process.platform} (${process.arch})`);
  console.log(`Install Path: ${TEMPLATE_DIR}`);
}

// Recursive file copy helper
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      if (childItemName === '.git' || childItemName === 'node_modules' || childItemName === '__pycache__' || childItemName === '_backup') return;
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

// Minimal YAML frontmatter parser (flat key: value pairs only)
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: content };
  const data = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf(':');
    if (idx > 0) {
      data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    }
  });
  return { data, body: content.slice(match[0].length) };
}

function countAgents(agentsDir) {
  if (!fs.existsSync(agentsDir)) return 0;
  return fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md')).length;
}

function countSkills(skillsDir) {
  if (!fs.existsSync(skillsDir)) return 0;
  return fs.readdirSync(skillsDir).filter((f) => {
    if (f === '_backup') return false;
    return fs.statSync(path.join(skillsDir, f)).isDirectory();
  }).length;
}

function hintFor(err) {
  if (err && err.code === 'EACCES') return 'Permission denied — check write access to the target directory.';
  if (err && err.code === 'ENOSPC') return 'Disk full — free up space and retry.';
  if (err && err.code === 'EROFS') return 'Target is on a read-only filesystem.';
  return 'Re-run with a writable target directory, or file an issue: https://github.com/olitech1010/dev-os/issues';
}

async function promptInitOptions(flags) {
  let isFresh = false;
  let stack = flags.stack || 'universal';
  let platform = flags.platform || flags.harness || (flags.allHarnesses ? 'all' : null);

  if (flags.stack && !STACKS.includes(flags.stack.toLowerCase())) {
    throw new Error(`Unknown stack '${flags.stack}'. Valid stacks: ${STACKS.join(', ')}`);
  }

  if (platform && platform !== 'all') {
    const list = platform.split(',').map((s) => s.trim().toLowerCase());
    for (let item of list) {
      if (item === 'gemini') item = 'antigravity';
      if (item === 'windsurf') item = 'codex';
      if (!HARNESSES.includes(item) && !PLATFORMS.includes(item)) {
        throw new Error(`Unknown platform/harness '${item}'. Valid options: ${PLATFORMS.join(', ')}`);
      }
    }
  }

  if (flags.fresh) {
    isFresh = true;
  } else if (flags.existing) {
    isFresh = false;
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

    console.log(`${colors.bold}Step 1 · Environment Type${colors.reset}`);
    console.log(`  1) Fresh Project (Initialize clean workspace with docs and default standards)`);
    console.log(`  2) Existing Project (Inject/update .agents team without modifying existing code or custom standards)`);
    const projAns = await ask(`\n${colors.cyan}Select option [1-2] (default 2): ${colors.reset}`);
    isFresh = projAns.trim() === '1';

    if (!flags.stack) {
      console.log(`\n${colors.bold}Step 2 · Technology Stack${colors.reset}`);
      console.log(`  1) Next.js (TypeScript, Supabase, Vercel)`);
      console.log(`  2) Laravel (PHP, MySQL, cPanel/Forge)`);
      console.log(`  3) Django (Python, DRF, Celery, Redis)`);
      console.log(`  4) React Native (Expo Router, Zustand)`);
      console.log(`  5) Express (Node.js, TypeScript)`);
      console.log(`  6) FastAPI (Python, Pydantic)`);
      console.log(`  7) Universal / Standard Template (Default)`);

      const stackAns = await ask(`\n${colors.cyan}Select option [1-7] (default 7): ${colors.reset}`);
      switch (stackAns.trim()) {
        case '1': stack = 'nextjs'; break;
        case '2': stack = 'laravel'; break;
        case '3': stack = 'django'; break;
        case '4': stack = 'react-native'; break;
        case '5': stack = 'express'; break;
        case '6': stack = 'fastapi'; break;
        default: stack = 'universal'; break;
      }
    }

    if (!platform) {
      console.log(`\n${colors.bold}Step 3 · AI Coding Platform / Harness${colors.reset}`);
      console.log(`  1) Claude Code (Anthropic Claude CLI, .claude/ commands & agents)`);
      console.log(`  2) Google Antigravity / Gemini (ANTIGRAVITY.md, GEMINI.md)`);
      console.log(`  3) Cursor (.cursor/rules/devos.mdc, .cursorrules)`);
      console.log(`  4) OpenCode (.opencode/rules/, OPENCODE.md)`);
      console.log(`  5) Codex / Windsurf (.codex/instructions.md, .windsurfrules)`);
      console.log(`  6) All Platforms (Universal Multi-Platform Setup) [Default]`);

      const platAns = await ask(`\n${colors.cyan}Select option [1-6] (default 6): ${colors.reset}`);
      switch (platAns.trim()) {
        case '1': platform = 'claude'; break;
        case '2': platform = 'antigravity'; break;
        case '3': platform = 'cursor'; break;
        case '4': platform = 'opencode'; break;
        case '5': platform = 'codex'; break;
        default: platform = 'all'; break;
      }
    }

    let telemetry = flags.telemetry;
    if (flags.telemetry === undefined || flags.telemetry === null) {
      console.log(`\n${colors.bold}Step 4 · Anonymous Failure Telemetry${colors.reset}`);
      console.log(`  1) On (Recommended) — Anonymously captures execution errors & RCA reports to improve Dev-OS`);
      console.log(`  2) Off — Completely disable anonymous failure logging`);
      const telemAns = await ask(`\n${colors.cyan}Select option [1-2] (default 1): ${colors.reset}`);
      telemetry = telemAns.trim() !== '2';
    }

    let mode = flags.mode || 'interactive';
    if (!flags.mode) {
      console.log(`\n${colors.bold}Step 5 · Default SDLC Execution Mode${colors.reset}`);
      console.log(`  1) Interactive (Default pair-programming with staged human reviews)`);
      console.log(`  2) Guided (Step-by-step confirmation checkpoints at each SDLC stage)`);
      console.log(`  3) Auto (Hands-off MVP builder for founders/CEOs — idea to full working MVP)`);
      console.log(`  4) Audit (Read-only security, architecture, and code health evaluation)`);
      const modeAns = await ask(`\n${colors.cyan}Select option [1-4] (default 1): ${colors.reset}`);
      switch (modeAns.trim()) {
        case '2': mode = 'guided'; break;
        case '3': mode = 'auto'; break;
        case '4': mode = 'audit'; break;
        default: mode = 'interactive'; break;
      }
    }

    rl.close();
  }

  return {
    isFresh,
    stack: stack.toLowerCase(),
    platform: (platform || 'all').toLowerCase(),
    telemetry: flags.telemetry !== false,
    mode: (flags.mode || 'interactive').toLowerCase()
  };
}

// ---------------------------------------------------------------------------
// Multi-Harness Generators
// ---------------------------------------------------------------------------

const AGENT_DESCRIPTIONS = {
  orchestrator: 'Dev-OS team lead. Triages tasks, delegates to specialist agents, sequences work, and enforces workflow protocols and the human commit gate.',
  developer: 'Dev-OS implementation specialist. Writes features and bug fixes following CODING_STANDARDS.md; hands work to QA and never commits directly.',
  qa: 'Dev-OS code reviewer. Reviews changes for correctness, standards compliance, and security before human approval. Does not write tests.',
  tester: 'Dev-OS test engineer. Writes and executes automated tests, reproduces bugs, and reports coverage gaps.',
  security: 'Dev-OS security auditor. Scans code and dependencies for vulnerabilities, secret leaks, and forbidden patterns.',
  dba: 'Dev-OS database specialist. Designs and reviews schemas, migrations, queries, and RLS policies; requires human approval for CRITICAL changes.',
  devops: 'Dev-OS infrastructure specialist. Handles CI/CD, deployment, environment configuration, and rollback protocols.',
  architect: 'Dev-OS system architect. Runs project inception (grill-me), designs architecture, and produces requirements documents.',
  researcher: 'Dev-OS research specialist. Investigates libraries, APIs, compatibility, and best practices; returns concise verdicts.',
  'memory-manager': 'Dev-OS memory custodian. Maintains docs/CURRENT_STATE.md and docs/LESSONS.md, compacts context, and manages session handoffs.',
  'release-manager': 'Dev-OS release specialist. Owns semantic versioning, changelog entries, and release notes.',
  'ui-designer': 'Dev-OS UI/UX design specialist. Formulates design systems, extracts tokens from ui-ux-pro-max, and authors docs/DESIGN.md to satisfy the Mandatory Design Gate.',
  'executive-proxy': 'Dev-OS autonomous tech lead proxy. Oversees hands-off MVP delivery from idea to working software across all 10 SDLC stages.',
  telemetry: 'Dev-OS observability specialist. Tracks runtime errors, failure logs in .agents/telemetry/, and drafts RCA reports.',
  'eval-engineer': 'Dev-OS evaluation engineer. Measures capability benchmarks, pass@k, and prevents workflow regressions.'
};

function generateClaudeCommands(destAgents, destClaude) {
  const srcCommands = path.join(destAgents, 'commands');
  const outDir = path.join(destClaude, 'commands');
  if (!fs.existsSync(srcCommands)) return 0;
  fs.mkdirSync(outDir, { recursive: true });

  let count = 0;
  fs.readdirSync(srcCommands).forEach((file) => {
    if (!file.endsWith('.md') || file === 'README.md') return;
    const raw = fs.readFileSync(path.join(srcCommands, file), 'utf8');
    const { data, body } = parseFrontmatter(raw);
    const name = data.name || file.replace('.md', '');
    const agent = data.agent || 'orchestrator';
    const triage = data.triage_level || 'STANDARD';
    const workflow = data.workflow || 'standard';

    const out = [
      '---',
      `description: ${data.description || `Dev-OS /${name} command`}`,
      '---',
      '',
      body.trim(),
      '',
      '## Dev-OS Routing',
      '',
      `- Adopt the persona defined in \`.agents/agents/${agent}.md\` (delegate to the \`${agent}\` subagent if available).`,
      `- Triage level: ${triage}. Workflow: ${workflow}. Follow the matching protocol in \`.agents/AGENTS.md\`.`,
      '- Honor all Hard Rules in `.agents/AGENTS.md`, including the mechanical commit gate (`.agents/scripts/commit.sh`).',
      ''
    ].join('\n');

    fs.writeFileSync(path.join(outDir, `${name}.md`), out, 'utf8');
    count++;
  });
  return count;
}

function generateClaudeAgents(destAgents, destClaude) {
  const srcAgents = path.join(destAgents, 'agents');
  const outDir = path.join(destClaude, 'agents');
  if (!fs.existsSync(srcAgents)) return 0;
  fs.mkdirSync(outDir, { recursive: true });

  let count = 0;
  fs.readdirSync(srcAgents).forEach((file) => {
    if (!file.endsWith('.md')) return;
    const name = file.replace('.md', '');
    const body = fs.readFileSync(path.join(srcAgents, file), 'utf8');
    const description = AGENT_DESCRIPTIONS[name] ||
      `Dev-OS ${name} agent persona. Use for tasks assigned to the ${name} role in .agents/AGENTS.md.`;

    const out = [
      '---',
      `name: ${name}`,
      `description: ${description}`,
      '---',
      '',
      body.trim(),
      ''
    ].join('\n');

    fs.writeFileSync(path.join(outDir, file), out, 'utf8');
    count++;
  });
  return count;
}

function bootstrapClaudeMd(targetDir) {
  const claudeMdPath = path.join(targetDir, 'CLAUDE.md');
  const startMarker = '<!-- BEGIN DEV-OS -->';
  const endMarker = '<!-- END DEV-OS -->';
  const block = [
    startMarker,
    '## Dev-OS — Multi-Agent Engineering OS',
    '',
    'This project uses Dev-OS by Olives Technologies.',
    '',
    '### Hard Rules Digest (Must be strictly obeyed at all times)',
    ...DEVOS_RULES_DIGEST,
    '',
    '### Solo Session Protocol (Single-Agent Work)',
    ...SOLO_SESSION_PROTOCOL,
    '',
    '### Tooling & Personas',
    '- Slash commands: `.claude/commands/` (generated from `.agents/commands/` — refresh with `devos update`).',
    '- Agent personas: `.claude/agents/` (generated from `.agents/agents/`).',
    '- Task Board: `docs/TASK_BOARD.md` (active DAG state).',
    '- Memory Vault: `.agents/memory/` (ADRs in `decisions/`, handoffs in `handoffs/`).',
    '- Coding standards: `CODING_STANDARDS.md`.',
    '- Master roster & full rules: `.agents/AGENTS.md`.',
    endMarker,
    ''
  ].join('\n');

  if (fs.existsSync(claudeMdPath)) {
    const current = fs.readFileSync(claudeMdPath, 'utf8');
    if (current.includes(startMarker) && current.includes(endMarker)) {
      const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'g');
      const updated = current.replace(regex, block.trim());
      fs.writeFileSync(claudeMdPath, updated.trimEnd() + '\n', 'utf8');
      return 'updated';
    }
    fs.writeFileSync(claudeMdPath, current.trimEnd() + '\n\n' + block, 'utf8');
    return 'appended';
  }
  fs.writeFileSync(claudeMdPath, block, 'utf8');
  return 'created';
}

function generateCursorConfig(targetDir) {
  const cursorDir = path.join(targetDir, '.cursor', 'rules');
  fs.mkdirSync(cursorDir, { recursive: true });
  const mdcPath = path.join(cursorDir, 'devos.mdc');
  const mdcContent = [
    '---',
    'description: Dev-OS Autonomous Multi-Agent Engineering rules, Hard Rules, and solo session protocols',
    'globs: *',
    'alwaysApply: true',
    '---',
    '',
    '# Dev-OS — Multi-Agent Engineering OS (Cursor Rules)',
    '',
    'This project uses Dev-OS by Olives Technologies.',
    '',
    '### Hard Rules Digest (Must be strictly obeyed at all times)',
    ...DEVOS_RULES_DIGEST,
    '',
    '### Solo Session Protocol',
    ...SOLO_SESSION_PROTOCOL,
    '',
    '### Mechanical Commit Gate',
    'Raw `git commit` is strictly blocked. Always commit through `.agents/scripts/commit.sh`.',
    ''
  ].join('\n');
  fs.writeFileSync(mdcPath, mdcContent, 'utf8');

  const cursorrulesPath = path.join(targetDir, '.cursorrules');
  const cursorrulesContent = [
    '# Dev-OS Cursor Rules',
    'Follow all Hard Rules defined in .agents/AGENTS.md and .cursor/rules/devos.mdc.',
    'Always use .agents/scripts/commit.sh for committing changes.',
    ''
  ].join('\n');
  fs.writeFileSync(cursorrulesPath, cursorrulesContent, 'utf8');

  return 'rules/devos.mdc + .cursorrules';
}

function generateOpenCodeConfig(targetDir) {
  const opencodeDir = path.join(targetDir, '.opencode');
  const rulesDir = path.join(opencodeDir, 'rules');
  fs.mkdirSync(rulesDir, { recursive: true });

  const rulesPath = path.join(rulesDir, 'devos-rules.md');
  const rulesContent = [
    '# OpenCode Dev-OS Rules',
    '',
    '## Hard Rules Digest',
    ...DEVOS_RULES_DIGEST,
    '',
    '## Solo Session Protocol',
    ...SOLO_SESSION_PROTOCOL,
    '',
    '## Team Roster & Routing',
    'Read `.agents/AGENTS.md` for agent roles (Orchestrator, Developer, QA, Tester, Security, DevOps, etc.).',
    'Route all git commits through `.agents/scripts/commit.sh`.',
    ''
  ].join('\n');
  fs.writeFileSync(rulesPath, rulesContent, 'utf8');

  const openCodeMdPath = path.join(targetDir, 'OPENCODE.md');
  const openCodeMdContent = [
    '# Dev-OS — OpenCode Instructions',
    '',
    'This project uses Dev-OS by Olives Technologies.',
    '',
    '### Hard Rules Digest',
    ...DEVOS_RULES_DIGEST,
    '',
    '### Solo Session Protocol',
    ...SOLO_SESSION_PROTOCOL,
    '',
    '### Core Resources',
    '- Personas: `.agents/agents/`',
    '- Skills: `.agents/skills/`',
    '- Task Board: `docs/TASK_BOARD.md`',
    '- Memory Vault: `.agents/memory/`',
    '- Commit Gate: `.agents/scripts/commit.sh`',
    ''
  ].join('\n');
  fs.writeFileSync(openCodeMdPath, openCodeMdContent, 'utf8');

  const configPath = path.join(opencodeDir, 'opencode.json');
  const configContent = JSON.stringify({
    name: 'Dev-OS',
    version: PKG.version,
    rules: ['.opencode/rules/devos-rules.md'],
    manifest: '.agents/manifest.json'
  }, null, 2) + '\n';
  fs.writeFileSync(configPath, configContent, 'utf8');

  return 'OPENCODE.md + .opencode/rules/devos-rules.md';
}

function generateAntigravityConfig(targetDir) {
  const antigravityMdPath = path.join(targetDir, 'ANTIGRAVITY.md');
  const geminiMdPath = path.join(targetDir, 'GEMINI.md');
  const content = [
    '# Dev-OS — Google Antigravity & Gemini Instructions',
    '',
    'This project uses Dev-OS by Olives Technologies.',
    '',
    '### Hard Rules Digest (Must be strictly obeyed at all times)',
    ...DEVOS_RULES_DIGEST,
    '',
    '### Solo Session Protocol',
    ...SOLO_SESSION_PROTOCOL,
    '',
    '### Core Resources',
    '- Personas: `.agents/agents/`',
    '- Specialist Skills: `.agents/skills/`',
    '- Task Board: `docs/TASK_BOARD.md`',
    '- Shared Memory Vault: `.agents/memory/`',
    '',
    '### Mechanical Commit Gate',
    'Never execute raw `git commit`. Always commit through `.agents/scripts/commit.sh`.',
    ''
  ].join('\n');
  fs.writeFileSync(antigravityMdPath, content, 'utf8');
  fs.writeFileSync(geminiMdPath, content, 'utf8');
  return 'ANTIGRAVITY.md + GEMINI.md';
}

function generateGeminiConfig(targetDir) {
  return generateAntigravityConfig(targetDir);
}

function generateCodexConfig(targetDir) {
  const codexDir = path.join(targetDir, '.codex');
  fs.mkdirSync(codexDir, { recursive: true });
  const instructionsPath = path.join(codexDir, 'instructions.md');
  const content = [
    '# Dev-OS — Codex Instructions',
    '',
    '### Hard Rules Digest',
    ...DEVOS_RULES_DIGEST,
    '',
    '### Solo Session Protocol',
    ...SOLO_SESSION_PROTOCOL,
    '',
    'Always use `.agents/scripts/commit.sh` for commits.',
    ''
  ].join('\n');
  fs.writeFileSync(instructionsPath, content, 'utf8');

  const windsurfPath = path.join(targetDir, '.windsurfrules');
  fs.writeFileSync(windsurfPath, '# Dev-OS Windsurf Rules\nFollow rules in .agents/AGENTS.md and .codex/instructions.md.\n', 'utf8');
  return '.codex/instructions.md + .windsurfrules';
}

function wireHooks(destAgents, destClaude) {
  const hooksDir = path.join(destAgents, 'hooks');
  if (fs.existsSync(hooksDir)) {
    fs.readdirSync(hooksDir).forEach((file) => {
      if (file.endsWith('.sh')) {
        fs.chmodSync(path.join(hooksDir, file), '755');
      }
    });
  }

  if (destClaude) {
    fs.mkdirSync(destClaude, { recursive: true });
    const claudeHooksPath = path.join(destClaude, 'hooks.json');
    const hooksConfig = {
      hooks: {
        SessionStart: [{ command: '.agents/hooks/session-start.sh' }],
        PreToolUse: [{ matcher: 'bash', command: '.agents/hooks/pre-tool-use.sh' }],
        SessionEnd: [{ command: '.agents/hooks/session-end.sh' }]
      }
    };
    fs.writeFileSync(claudeHooksPath, JSON.stringify(hooksConfig, null, 2) + '\n', 'utf8');
    return 'executable hooks + .claude/hooks.json';
  }
  return 'executable hooks (.agents/hooks/)';
}

// ---------------------------------------------------------------------------
// Capability Packs & Skills Copying Helper
// ---------------------------------------------------------------------------

function installSkillsAndPacks(srcAgents, destAgents, stack, allSkills, telemetry = true, mode = 'interactive') {
  const srcSkills = path.join(srcAgents, 'skills');
  const destSkills = path.join(destAgents, 'skills');
  const packsPath = path.join(srcAgents, 'packs.json');
  const manifestPath = path.join(destAgents, 'manifest.json');
  fs.mkdirSync(destSkills, { recursive: true });

  const packsData = fs.existsSync(packsPath) ? JSON.parse(fs.readFileSync(packsPath, 'utf8')) : null;

  if (allSkills || !packsData) {
    copyRecursiveSync(srcSkills, destSkills);
    const installed = packsData ? Object.keys(packsData.packs) : ['all'];
    const manifest = {
      version: PKG.version,
      installedPacks: installed,
      hooksEnabled: true,
      telemetry: telemetry ? 'on' : 'off',
      mode: mode || 'interactive',
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    return { count: countSkills(destSkills), packs: installed };
  }

  // Lean pack installation
  const installedPacks = ['core'];
  const skillsToInstall = new Set(packsData.packs.core ? packsData.packs.core.skills : []);

  // Check if stack matches a pack
  Object.keys(packsData.packs).forEach((pKey) => {
    const p = packsData.packs[pKey];
    if (p.stack === stack || pKey === stack) {
      installedPacks.push(pKey);
      p.skills.forEach((s) => skillsToInstall.add(s));
    }
  });

  skillsToInstall.forEach((skillName) => {
    const src = path.join(srcSkills, skillName);
    const dest = path.join(destSkills, skillName);
    if (fs.existsSync(src)) {
      copyRecursiveSync(src, dest);
    }
  });

  const manifest = {
    version: PKG.version,
    installedPacks,
    hooksEnabled: true,
    telemetry: telemetry ? 'on' : 'off',
    mode: mode || 'interactive',
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  return { count: countSkills(destSkills), packs: installedPacks };
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

async function runInit(flags) {
  if (!flags.quiet) printBanner();

  const insideSource = TEMPLATE_DIR === TARGET_DIR;
  if (insideSource) {
    console.log(`${colors.yellow}[ WARN ] You are running init inside the Dev-OS source repository itself. Template copy steps will be skipped.${colors.reset}\n`);
  }

  const { isFresh, stack, platform, telemetry, mode } = await promptInitOptions(flags);

  // Determine target AI harnesses
  const selectedHarnesses = new Set();
  const rawChoice = flags.harness || flags.platform || platform || (flags.allHarnesses ? 'all' : null);

  if (rawChoice === 'all' || flags.allHarnesses) {
    selectedHarnesses.add('claude');
    selectedHarnesses.add('antigravity');
    selectedHarnesses.add('cursor');
    selectedHarnesses.add('opencode');
    selectedHarnesses.add('codex');
  } else if (rawChoice) {
    rawChoice.split(',').map((h) => h.trim().toLowerCase()).forEach((h) => {
      if (h === 'gemini') h = 'antigravity';
      if (h === 'windsurf') h = 'codex';
      if (h === 'all') {
        ['claude', 'antigravity', 'cursor', 'opencode', 'codex'].forEach((p) => selectedHarnesses.add(p));
      } else if (HARNESSES.includes(h) || PLATFORMS.includes(h)) {
        selectedHarnesses.add(h);
      }
    });
  } else {
    ['claude', 'antigravity', 'cursor', 'opencode', 'codex'].forEach((p) => selectedHarnesses.add(p));
  }

  if (flags.claude === false) {
    selectedHarnesses.delete('claude');
  }

  console.log(`\n${colors.cyan}[ INFO ] Initializing Dev-OS in target directory...${colors.reset}`);
  console.log(`${colors.gray}Target Path: ${TARGET_DIR}${colors.reset}`);
  console.log(`${colors.gray}Mode: ${isFresh ? 'Fresh Project' : 'Existing Project'} | Stack: [${stack.toUpperCase()}] | Platform: [${platform.toUpperCase()}]${colors.reset}\n`);

  const srcAgents = path.join(TEMPLATE_DIR, '.agents');
  const destAgents = path.join(TARGET_DIR, '.agents');
  const step = (label, fn) => {
    process.stdout.write(`${colors.gray}${label}... ${colors.reset}`);
    try {
      const result = fn();
      console.log(`${colors.green}${result || 'done'}${colors.reset}`);
    } catch (err) {
      console.log(`${colors.red}failed${colors.reset}`);
      console.error(`${colors.red}[ FAIL ] ${label}: ${err.message}${colors.reset}`);
      console.error(`${colors.yellow}         ${hintFor(err)}${colors.reset}`);
      process.exit(1);
    }
  };

  // Step 1: Back up any existing .agents/, then copy components
  let packSummary = null;
  if (!insideSource) {
    if (fs.existsSync(destAgents)) {
      step('Backing up existing .agents/ to .agents/_backup/', () => {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(destAgents, '_backup', stamp);
        copyRecursiveSync(destAgents, backupDir);
        return `saved (${path.relative(TARGET_DIR, backupDir)})`;
      });
    }

    step('Installing agent roster, hooks, and memory templates', () => {
      // Copy core structure excluding skills
      const subdirs = ['agents', 'commands', 'hooks', 'memory', 'scripts', 'templates'];
      subdirs.forEach((dir) => {
        const src = path.join(srcAgents, dir);
        const dest = path.join(destAgents, dir);
        if (fs.existsSync(src)) copyRecursiveSync(src, dest);
      });
      ['AGENTS.md', 'README.md', 'packs.json'].forEach((file) => {
        const src = path.join(srcAgents, file);
        const dest = path.join(destAgents, file);
        if (fs.existsSync(src)) fs.copyFileSync(src, dest);
      });
    });

    step('Installing specialist skills and capability packs', () => {
      packSummary = installSkillsAndPacks(srcAgents, destAgents, stack, flags.allSkills, telemetry, mode);
      return `${packSummary.count} skills (packs: ${packSummary.packs.join(', ')})`;
    });
  }

  // Ensure telemetry buffer directory exists
  fs.mkdirSync(path.join(destAgents, 'telemetry'), { recursive: true });

  // Step 2: Ensure script permissions (commit gate, hook installer, humanizer check)
  step('Configuring commit gate and verification scripts', () => {
    const scripts = ['commit.sh', 'install-hooks.sh', 'humanize-check.sh'];
    const missing = [];
    scripts.forEach((name) => {
      const scriptPath = path.join(destAgents, 'scripts', name);
      if (fs.existsSync(scriptPath)) {
        fs.chmodSync(scriptPath, '755');
      } else {
        missing.push(name);
      }
    });
    if (missing.length === scripts.length) throw new Error('critical scripts are missing from .agents/scripts/');
    return missing.length ? `partial (missing: ${missing.join(', ')})` : 'executable (755)';
  });

  // Step 2b: Wire runtime lifecycle hooks
  if (flags.hooks) {
    step('Wiring runtime lifecycle hooks (.agents/hooks/)', () => {
      const claudeDest = selectedHarnesses.has('claude') ? path.join(TARGET_DIR, '.claude') : null;
      return wireHooks(destAgents, claudeDest);
    });
  }

  // Step 2c: Install git pre-commit hook automatically if inside a git repository
  const gitDir = path.join(TARGET_DIR, '.git');
  if (fs.existsSync(gitDir)) {
    step('Installing mechanical pre-commit hook (.git/hooks/pre-commit)', () => {
      const hookInstaller = path.join(destAgents, 'scripts', 'install-hooks.sh');
      if (fs.existsSync(hookInstaller)) {
        const { spawnSync } = require('child_process');
        const res = spawnSync('bash', [hookInstaller], { cwd: TARGET_DIR, encoding: 'utf8' });
        if (res.status === 0) return 'installed';
        return `warning (installer exited ${res.status})`;
      }
      return 'skipped (install-hooks.sh missing)';
    });
  }

  // Step 3: Copy docs directory and TASK_BOARD.md if fresh or missing
  const destDocs = path.join(TARGET_DIR, 'docs');
  if (!insideSource && (isFresh || !fs.existsSync(destDocs))) {
    step('Installing project documentation into docs/', () => {
      copyRecursiveSync(path.join(TEMPLATE_DIR, 'docs'), destDocs);
    });
  } else {
    // Ensure docs/TASK_BOARD.md exists
    const srcBoard = path.join(TEMPLATE_DIR, 'docs', 'TASK_BOARD.md');
    const destBoard = path.join(destDocs, 'TASK_BOARD.md');
    if (fs.existsSync(srcBoard) && !fs.existsSync(destBoard)) {
      step('Installing deterministic task board (docs/TASK_BOARD.md)', () => {
        fs.mkdirSync(destDocs, { recursive: true });
        fs.copyFileSync(srcBoard, destBoard);
      });
    }
  }

  // Step 4: Handle CODING_STANDARDS.md
  const targetStandards = path.join(TARGET_DIR, 'CODING_STANDARDS.md');
  if (!insideSource && (isFresh || !fs.existsSync(targetStandards))) {
    step(`Setting up CODING_STANDARDS.md for [${stack.toUpperCase()}]`, () => {
      let srcStandards = path.join(TEMPLATE_DIR, 'CODING_STANDARDS.md');
      if (stack !== 'universal') {
        const stackFile = path.join(destAgents, 'skills', 'stacks', `${stack}.md`);
        if (fs.existsSync(stackFile)) {
          srcStandards = stackFile;
        }
      }
      if (!fs.existsSync(srcStandards)) return 'skipped (template not found)';
      fs.copyFileSync(srcStandards, targetStandards);
    });
  }

  // Step 5: Multi-Harness Integration (Claude Code, Antigravity/Gemini, Cursor, OpenCode, Codex)
  let claudeSummary = null;
  if (selectedHarnesses.has('claude')) {
    step('Wiring Claude Code integration (.claude/, CLAUDE.md)', () => {
      const destClaude = path.join(TARGET_DIR, '.claude');
      const cmdCount = generateClaudeCommands(destAgents, destClaude);
      const agentCount = generateClaudeAgents(destAgents, destClaude);
      const claudeMd = bootstrapClaudeMd(TARGET_DIR);
      claudeSummary = { cmdCount, agentCount, claudeMd };
      return `${cmdCount} commands, ${agentCount} agents (CLAUDE.md ${claudeMd})`;
    });
  }

  if (selectedHarnesses.has('antigravity') || selectedHarnesses.has('gemini')) {
    step('Wiring Google Antigravity / Gemini integration (ANTIGRAVITY.md, GEMINI.md)', () => {
      return generateAntigravityConfig(TARGET_DIR);
    });
  }

  if (selectedHarnesses.has('cursor')) {
    step('Wiring Cursor integration (.cursor/rules/devos.mdc, .cursorrules)', () => {
      return generateCursorConfig(TARGET_DIR);
    });
  }

  if (selectedHarnesses.has('opencode')) {
    step('Wiring OpenCode integration (OPENCODE.md, .opencode/)', () => {
      return generateOpenCodeConfig(TARGET_DIR);
    });
  }

  if (selectedHarnesses.has('codex')) {
    step('Wiring Codex / Windsurf integration (.codex/, .windsurfrules)', () => {
      return generateCodexConfig(TARGET_DIR);
    });
  }

  // Step 6: Update .gitignore
  step('Updating .gitignore rules', () => {
    const gitignorePath = path.join(TARGET_DIR, '.gitignore');
    let gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
    let updated = false;
    if (!gitignoreContent.includes('.agents/_backup')) {
      gitignoreContent += `\n# Dev-OS temporary backups\n.agents/_backup/\n`;
      updated = true;
    }
    if (updated) {
      fs.writeFileSync(gitignorePath, gitignoreContent.trim() + '\n', 'utf8');
      return 'updated';
    }
    return 'already up to date';
  });

  // Summary card
  const agentCount = countAgents(path.join(destAgents, 'agents'));
  const skillCount = countSkills(path.join(destAgents, 'skills'));
  const harnessesList = Array.from(selectedHarnesses);

  const rows = [
    ['.agents/agents/', `${agentCount} Agent Personas (Orchestrator, Developer, QA, DBA, Security...)`],
    ['.agents/skills/', `${skillCount} Specialist Skills (Packs: ${(packSummary ? packSummary.packs : ['core']).join(', ')})`],
    ['.agents/hooks/', 'Runtime Lifecycle Hooks (SessionStart, PreToolUse, SessionEnd)'],
    ['.agents/memory/', 'Shared Memory Vault (ADRs in decisions/, session handoffs)'],
    ['docs/TASK_BOARD.md', 'Deterministic Task Board & DAG Workflow State'],
    ['.agents/scripts/', 'Commit Checkpoint Gate (commit.sh) + Hook Installer'],
    ['.agents/AGENTS.md', 'Team Roster & Triage Rules'],
    ['CODING_STANDARDS.md', `Stack Standards [${stack.toUpperCase()}]`]
  ];
  if (claudeSummary) {
    rows.push(['.claude/', `${claudeSummary.cmdCount} Slash Commands + ${claudeSummary.agentCount} Subagents (Claude Code)`]);
  }
  rows.push(['Harnesses', harnessesList.join(', ')]);

  console.log(`\n${colors.green}${colors.bold}[ OK ] Dev-OS Environment Initialized Successfully${colors.reset}\n`);
  const labelWidth = Math.max(...rows.map((r) => r[0].length)) + 2;
  const bodyWidth = Math.max(...rows.map((r) => labelWidth + r[1].length), 'INSTALLED COMPONENTS'.length) + 4;
  console.log(`${colors.gray}╭${'─'.repeat(bodyWidth + 2)}╮${colors.reset}`);
  const boxLine = (text, plainLength) => {
    console.log(`${colors.gray}│${colors.reset} ${text}${' '.repeat(Math.max(0, bodyWidth - plainLength))} ${colors.gray}│${colors.reset}`);
  };
  boxLine(`${colors.bold}INSTALLED COMPONENTS${colors.reset}`, 'INSTALLED COMPONENTS'.length);
  rows.forEach(([label, desc]) => {
    const plain = `• ${label.padEnd(labelWidth)}${desc}`;
    boxLine(`• ${colors.cyan}${label.padEnd(labelWidth)}${colors.reset}${desc}`, plain.length);
  });
  console.log(`${colors.gray}╰${'─'.repeat(bodyWidth + 2)}╯${colors.reset}`);

  if (!flags.quiet) {
    console.log(`\n${colors.bold}NEXT STEPS${colors.reset}`);
    console.log(`  1. Open your AI engineering environment (${harnessesList.join(', ')}).`);
    console.log(`  2. Prompt the Orchestrator: ${colors.yellow}"Use your grill-me skill to brainstorm our project requirements."${colors.reset}`);
    console.log(`  3. Track tasks with: ${colors.cyan}/task${colors.reset} or inspect ${colors.cyan}docs/TASK_BOARD.md${colors.reset}.`);
    console.log(`  4. Run ${colors.cyan}devos doctor${colors.reset} anytime to verify system health.\n`);
  }
}

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

async function runUpdate(flags) {
  if (!flags.quiet) printBanner();

  const destAgents = path.join(TARGET_DIR, '.agents');
  if (!fs.existsSync(destAgents)) {
    console.error(`${colors.red}[ FAIL ] Dev-OS is not initialized in this directory (${TARGET_DIR}).${colors.reset}`);
    console.error(`${colors.yellow}         Run 'devos init' first to set up Dev-OS.${colors.reset}\n`);
    process.exit(1);
  }

  console.log(`\n${colors.cyan}[ INFO ] Updating Dev-OS components in target directory...${colors.reset}`);
  console.log(`${colors.gray}Target Path: ${TARGET_DIR}${colors.reset}\n`);

  const srcAgents = path.join(TEMPLATE_DIR, '.agents');
  const insideSource = TEMPLATE_DIR === TARGET_DIR;

  const step = (label, fn) => {
    process.stdout.write(`${colors.gray}${label}... ${colors.reset}`);
    try {
      const result = fn();
      console.log(`${colors.green}${result || 'done'}${colors.reset}`);
    } catch (err) {
      console.log(`${colors.red}failed${colors.reset}`);
      console.error(`${colors.red}[ FAIL ] ${label}: ${err.message}${colors.reset}`);
      process.exit(1);
    }
  };

  if (!insideSource) {
    // 1. Back up existing .agents/
    step('Backing up existing .agents/ to .agents/_backup/', () => {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(destAgents, '_backup', stamp);
      copyRecursiveSync(destAgents, backupDir);
      return `saved (${path.relative(TARGET_DIR, backupDir)})`;
    });

    // 2. Refresh .agents/ subdirectories
    step('Refreshing agent personas, hooks, memory, and scripts', () => {
      ['agents', 'commands', 'hooks', 'scripts', 'templates'].forEach((dir) => {
        const src = path.join(srcAgents, dir);
        const dest = path.join(destAgents, dir);
        if (fs.existsSync(src)) copyRecursiveSync(src, dest);
      });
      // Refresh memory templates without deleting user ADRs
      const srcMemDec = path.join(srcAgents, 'memory', 'decisions', 'ADR-000-template.md');
      const destMemDec = path.join(destAgents, 'memory', 'decisions');
      fs.mkdirSync(destMemDec, { recursive: true });
      if (fs.existsSync(srcMemDec)) fs.copyFileSync(srcMemDec, path.join(destMemDec, 'ADR-000-template.md'));

      const srcMemHand = path.join(srcAgents, 'memory', 'handoffs', 'handoff-template.md');
      const destMemHand = path.join(destAgents, 'memory', 'handoffs');
      fs.mkdirSync(destMemHand, { recursive: true });
      if (fs.existsSync(srcMemHand)) fs.copyFileSync(srcMemHand, path.join(destMemHand, 'handoff-template.md'));

      ['AGENTS.md', 'README.md', 'packs.json'].forEach((file) => {
        const src = path.join(srcAgents, file);
        const dest = path.join(destAgents, file);
        if (fs.existsSync(src)) fs.copyFileSync(src, dest);
      });
    });
  }

  // 3. Ensure executable script permissions
  step('Verifying script permissions (commit.sh, install-hooks.sh, humanize-check.sh, hooks/*.sh)', () => {
    const scripts = ['commit.sh', 'install-hooks.sh', 'humanize-check.sh'];
    scripts.forEach((name) => {
      const p = path.join(destAgents, 'scripts', name);
      if (fs.existsSync(p)) fs.chmodSync(p, '755');
    });
    const hooksDir = path.join(destAgents, 'hooks');
    if (fs.existsSync(hooksDir)) {
      fs.readdirSync(hooksDir).forEach((file) => {
        if (file.endsWith('.sh')) fs.chmodSync(path.join(hooksDir, file), '755');
      });
    }
    return 'executable (755)';
  });

  // 4. Update runtime lifecycle hooks
  if (flags.hooks) {
    step('Refreshing runtime lifecycle hooks', () => {
      return wireHooks(destAgents, path.join(TARGET_DIR, '.claude'));
    });
  }

  // 5. Multi-Harness refresh
  step('Refreshing AI harness configurations (Claude Code, Cursor, OpenCode, Antigravity, Codex)', () => {
    const destClaude = path.join(TARGET_DIR, '.claude');
    generateClaudeCommands(destAgents, destClaude);
    generateClaudeAgents(destAgents, destClaude);
    bootstrapClaudeMd(TARGET_DIR);
    generateCursorConfig(TARGET_DIR);
    generateOpenCodeConfig(TARGET_DIR);
    generateAntigravityConfig(TARGET_DIR);
    generateCodexConfig(TARGET_DIR);
    return 'Claude Code, Cursor, OpenCode, Antigravity/Gemini, Codex synchronized';
  });

  // 5b. Refresh skills if requested
  if (flags.skills || flags.allSkills) {
    step('Refreshing specialist skills and capability packs', () => {
      const srcSkills = path.join(srcAgents, 'skills');
      const destSkills = path.join(destAgents, 'skills');
      let msg = 'skipped';
      if (fs.existsSync(srcSkills)) {
        copyRecursiveSync(srcSkills, destSkills);
        msg = `${countSkills(destSkills)} skills synchronized`;
      }
      try {
        const { spawnSync } = require('child_process');
        spawnSync('npx', ['skills', 'update', '-y'], {
          cwd: TARGET_DIR,
          stdio: 'ignore',
          env: { ...process.env, CI: '1' }
        });
      } catch (e) {}
      return msg;
    });
  }

  // 6. Pre-commit hook
  const gitDir = path.join(TARGET_DIR, '.git');
  if (fs.existsSync(gitDir)) {
    step('Updating mechanical pre-commit hook', () => {
      const hookInstaller = path.join(destAgents, 'scripts', 'install-hooks.sh');
      if (fs.existsSync(hookInstaller)) {
        const { spawnSync } = require('child_process');
        const res = spawnSync('bash', [hookInstaller], { cwd: TARGET_DIR, encoding: 'utf8' });
        if (res.status === 0) return 'updated';
        return `warning (installer exited ${res.status})`;
      }
      return 'skipped';
    });
  }

  console.log(`\n${colors.green}${colors.bold}[ OK ] Dev-OS updated to v${PKG.version} successfully.${colors.reset}\n`);
}

// ---------------------------------------------------------------------------
// pack
// ---------------------------------------------------------------------------

function runPack(flags, positional) {
  const subCmd = positional[0] || 'list';
  const manifestPath = path.join(TARGET_DIR, '.agents', 'manifest.json');
  const packsPath = path.join(TEMPLATE_DIR, '.agents', 'packs.json');
  if (!fs.existsSync(packsPath)) {
    console.error(`${colors.red}[ FAIL ] Capability packs registry (.agents/packs.json) not found.${colors.reset}`);
    process.exit(1);
  }
  const packsData = JSON.parse(fs.readFileSync(packsPath, 'utf8'));
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { installedPacks: [] };

  if (subCmd === 'list') {
    if (!flags.quiet && !flags.json) printBanner();
    if (flags.json) {
      console.log(JSON.stringify({ availablePacks: packsData.packs, installedPacks: manifest.installedPacks || [] }, null, 2));
      return;
    }
    console.log(`${colors.bold}DEV-OS CAPABILITY PACKS${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}\n`);
    Object.keys(packsData.packs).forEach((key) => {
      const p = packsData.packs[key];
      const isInstalled = (manifest.installedPacks || []).includes(key);
      const tag = isInstalled ? `${colors.green}[installed]${colors.reset}` : `${colors.gray}[available]${colors.reset}`;
      console.log(`  ${colors.cyan}${colors.bold}${key.padEnd(12)}${colors.reset} ${tag} ${p.name}`);
      console.log(`  ${colors.gray}${p.description}${colors.reset}`);
      console.log(`  ${colors.dim}Skills (${p.skills.length}): ${p.skills.join(', ')}${colors.reset}\n`);
    });
    console.log(`Add a pack: ${colors.cyan}devos pack add <name>${colors.reset}\n`);
    return;
  }

  if (subCmd === 'add') {
    const packName = positional[1];
    if (!packName || !packsData.packs[packName]) {
      console.error(`${colors.red}[ FAIL ] Unknown pack '${packName}'. Available: ${Object.keys(packsData.packs).join(', ')}${colors.reset}`);
      process.exit(1);
    }
    const pack = packsData.packs[packName];
    const destSkills = path.join(TARGET_DIR, '.agents', 'skills');
    fs.mkdirSync(destSkills, { recursive: true });

    let addedCount = 0;
    pack.skills.forEach((skillName) => {
      const srcSkill = path.join(TEMPLATE_DIR, '.agents', 'skills', skillName);
      const destSkill = path.join(destSkills, skillName);
      if (fs.existsSync(srcSkill)) {
        copyRecursiveSync(srcSkill, destSkill);
        addedCount++;
      }
    });

    if (!manifest.installedPacks) manifest.installedPacks = [];
    if (!manifest.installedPacks.includes(packName)) manifest.installedPacks.push(packName);
    manifest.updatedAt = new Date().toISOString();
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    console.log(`${colors.green}[ OK ] Pack '${packName}' added successfully (${addedCount} skills installed).${colors.reset}`);
    return;
  }

  console.error(`${colors.red}[ FAIL ] Unknown pack subcommand '${subCmd}'. Use 'devos pack list' or 'devos pack add <name>'.${colors.reset}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// memory
// ---------------------------------------------------------------------------

function runMemory(flags, positional) {
  const subCmd = positional[0] || 'list';
  const memoryDir = path.join(TARGET_DIR, '.agents', 'memory');

  if (subCmd === 'list') {
    if (!flags.quiet && !flags.json) printBanner();
    const decisionsDir = path.join(memoryDir, 'decisions');
    const handoffsDir = path.join(memoryDir, 'handoffs');
    const adrs = fs.existsSync(decisionsDir) ? fs.readdirSync(decisionsDir).filter((f) => f.endsWith('.md')) : [];
    const handoffs = fs.existsSync(handoffsDir) ? fs.readdirSync(handoffsDir).filter((f) => f.endsWith('.md')) : [];
    const contextPath = path.join(memoryDir, 'context.json');
    const context = fs.existsSync(contextPath) ? JSON.parse(fs.readFileSync(contextPath, 'utf8')) : null;

    if (flags.json) {
      console.log(JSON.stringify({ adrs, handoffs, context }, null, 2));
      return;
    }

    console.log(`${colors.bold}DEV-OS SHARED MEMORY VAULT${colors.reset} ${colors.gray}(Target: ${TARGET_DIR})${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}\n`);
    if (context) {
      console.log(`${colors.bold}Active Context:${colors.reset} Milestone: ${colors.cyan}${context.currentMilestone || 'N/A'}${colors.reset} | Branch: ${colors.yellow}${context.activeBranch || 'N/A'}${colors.reset}\n`);
    }
    console.log(`${colors.bold}Architecture Decision Records (${adrs.length}):${colors.reset}`);
    if (adrs.length === 0) {
      console.log(`  ${colors.gray}No ADRs recorded yet.${colors.reset}`);
    } else {
      adrs.forEach((f) => console.log(`  ${colors.green}• ${f}${colors.reset}`));
    }
    console.log(`\n${colors.bold}Session Handoffs (${handoffs.length}):${colors.reset}`);
    if (handoffs.length === 0) {
      console.log(`  ${colors.gray}No session handoffs recorded yet.${colors.reset}`);
    } else {
      handoffs.slice(-5).forEach((f) => console.log(`  ${colors.cyan}• ${f}${colors.reset}`));
    }
    console.log();
    return;
  }

  if (subCmd === 'handoff') {
    const handoffsDir = path.join(memoryDir, 'handoffs');
    fs.mkdirSync(handoffsDir, { recursive: true });
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toISOString().slice(11, 16).replace(':', '');
    const filename = `handoff-${dateStr}-${timeStr}.md`;
    const targetFile = path.join(handoffsDir, filename);

    let branch = 'unknown';
    let gitStatus = 'clean';
    try {
      const { execSync } = require('child_process');
      branch = execSync('git branch --show-current', { encoding: 'utf8', cwd: TARGET_DIR }).trim();
      gitStatus = execSync('git status -s', { encoding: 'utf8', cwd: TARGET_DIR }).trim() || 'clean';
    } catch (e) {}

    const template = [
      `# Session Handoff: ${dateStr} ${timeStr}`,
      '',
      '## Executive Summary',
      `- **Active Branch:** \`${branch}\``,
      `- **Git Status:** ${gitStatus === 'clean' ? 'Clean' : 'Modified files present'}`,
      '- **Status:** [IN_PROGRESS | READY_FOR_REVIEW | DONE]',
      '',
      '## Completed in This Session',
      '- [ ] Summary of completed items',
      '',
      '## In-Progress / Blockers',
      '- [ ] Unfinished work',
      '',
      '## Immediate Next Steps',
      '1. Resume item 1',
      ''
    ].join('\n');

    fs.writeFileSync(targetFile, template, 'utf8');
    console.log(`${colors.green}[ OK ] Created session handoff template: ${colors.cyan}${path.relative(TARGET_DIR, targetFile)}${colors.reset}`);
    return;
  }

  if (subCmd === 'doctor') {
    const checks = [
      { name: 'Memory directory (.agents/memory/)', ok: fs.existsSync(memoryDir) },
      { name: 'Decisions folder (.agents/memory/decisions/)', ok: fs.existsSync(path.join(memoryDir, 'decisions')) },
      { name: 'Handoffs folder (.agents/memory/handoffs/)', ok: fs.existsSync(path.join(memoryDir, 'handoffs')) },
      { name: 'Context manifest (.agents/memory/context.json)', ok: fs.existsSync(path.join(memoryDir, 'context.json')) }
    ];
    let allOk = true;
    console.log(`${colors.bold}MEMORY VAULT HEALTH${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}`);
    checks.forEach((c) => {
      if (c.ok) console.log(`  [ ${colors.green}PASS${colors.reset} ] ${c.name}`);
      else { console.log(`  [ ${colors.red}FAIL${colors.reset} ] ${c.name}`); allOk = false; }
    });
    if (!allOk) process.exit(1);
    return;
  }

  console.error(`${colors.red}[ FAIL ] Unknown memory subcommand '${subCmd}'. Use 'list', 'handoff', or 'doctor'.${colors.reset}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

function runList(flags) {
  if (!flags.quiet && !flags.json) printBanner();

  const agentsDir = path.join(TARGET_DIR, '.agents', 'agents');
  const skillsDir = path.join(TARGET_DIR, '.agents', 'skills');

  const srcAgentsDir = fs.existsSync(agentsDir) ? agentsDir : path.join(TEMPLATE_DIR, '.agents', 'agents');
  const srcSkillsDir = fs.existsSync(skillsDir) ? skillsDir : path.join(TEMPLATE_DIR, '.agents', 'skills');

  const agents = [];
  if (fs.existsSync(srcAgentsDir)) {
    fs.readdirSync(srcAgentsDir).forEach((file) => {
      if (file.endsWith('.md')) {
        agents.push(file.replace('.md', ''));
      }
    });
  }

  const skills = [];
  if (fs.existsSync(srcSkillsDir)) {
    fs.readdirSync(srcSkillsDir).forEach((file) => {
      if (file === '_backup') return;
      const skillPath = path.join(srcSkillsDir, file);
      if (fs.statSync(skillPath).isDirectory()) {
        skills.push(file);
      }
    });
  }

  if (flags.json) {
    console.log(JSON.stringify({ agents, skills }, null, 2));
    return;
  }

  console.log(`${colors.bold}ACTIVE AGENT PERSONAS (${agents.length})${colors.reset}`);
  console.log(`${colors.gray}${RULE}${colors.reset}`);
  agents.forEach((agent) => {
    console.log(`  ${colors.cyan}• ${agent.padEnd(16)}${colors.reset} ${colors.gray}(.agents/agents/${agent}.md)${colors.reset}`);
  });

  console.log(`\n${colors.bold}INSTALLED SPECIALIST SKILLS (${skills.length})${colors.reset}`);
  console.log(`${colors.gray}${RULE}${colors.reset}`);
  const columns = 3;
  let line = '';
  skills.forEach((skill, index) => {
    line += `  ${colors.green}• ${skill.padEnd(28)}${colors.reset}`;
    if ((index + 1) % columns === 0 || index === skills.length - 1) {
      console.log(line);
      line = '';
    }
  });
  console.log();
}

// ---------------------------------------------------------------------------
// skill / skills
// ---------------------------------------------------------------------------

function runSkill(flags, positional) {
  const subCmd = positional[0] || 'list';
  const { spawnSync } = require('child_process');

  if (subCmd === 'list') {
    runList(flags);
    return;
  }

  if (subCmd === 'add' || subCmd === 'install') {
    const pkg = positional[1];
    if (!pkg) {
      console.error(`${colors.red}[ FAIL ] Missing skill package or repository name.${colors.reset}`);
      console.log(`\nUsage: ${colors.cyan}devos skill add <owner/repo>${colors.reset}`);
      console.log(`Example: ${colors.cyan}devos skill add vercel-labs/agent-skills${colors.reset}`);
      console.log(`Browse skills: https://skills.sh\n`);
      process.exit(1);
    }
    console.log(`${colors.bold}INSTALLING AGENT SKILL${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}\n`);
    console.log(`Fetching from skills.sh / GitHub (${colors.cyan}npx skills add ${pkg}${colors.reset})...\n`);
    const res = spawnSync('npx', ['skills', 'add', pkg, '--yes'], {
      cwd: TARGET_DIR,
      stdio: 'inherit',
      env: { ...process.env, CI: '1' }
    });
    if (res.status !== 0) {
      console.error(`\n${colors.red}[ FAIL ] Failed to install skill '${pkg}'. Check package name or network connectivity.${colors.reset}`);
      process.exit(res.status || 1);
    }
    console.log(`\n${colors.green}[ OK ] Skill '${pkg}' successfully installed into .agents/skills/.${colors.reset}\n`);
    return;
  }

  if (subCmd === 'update' || subCmd === 'upgrade') {
    console.log(`${colors.bold}UPDATING AGENT SKILLS${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}\n`);
    console.log(`Checking upstream repositories (${colors.cyan}npx skills update${colors.reset})...\n`);
    const res = spawnSync('npx', ['skills', 'update', '-y'], {
      cwd: TARGET_DIR,
      stdio: 'inherit',
      env: { ...process.env, CI: '1' }
    });
    if (res.status === 0) {
      console.log(`\n${colors.green}[ OK ] Upstream skills updated successfully.${colors.reset}`);
    }

    const srcSkills = path.join(TEMPLATE_DIR, '.agents', 'skills');
    const destSkills = path.join(TARGET_DIR, '.agents', 'skills');
    if (fs.existsSync(srcSkills)) {
      copyRecursiveSync(srcSkills, destSkills);
      console.log(`${colors.green}[ OK ] Dev-OS core skills synchronized (${countSkills(destSkills)} total).${colors.reset}\n`);
    }
    return;
  }

  if (subCmd === 'find' || subCmd === 'search') {
    const query = positional.slice(1).join(' ');
    console.log(`${colors.bold}SEARCHING AGENT SKILLS (skills.sh)${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}\n`);
    const args = ['skills', 'find'];
    if (query) args.push(query);
    spawnSync('npx', args, {
      cwd: TARGET_DIR,
      stdio: 'inherit',
      env: process.env
    });
    return;
  }

  if (subCmd === 'check') {
    console.log(`${colors.bold}CHECKING SKILL UPDATES${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}\n`);
    spawnSync('npx', ['skills', 'check'], {
      cwd: TARGET_DIR,
      stdio: 'inherit',
      env: { ...process.env, CI: '1' }
    });
    return;
  }

  console.error(`${colors.red}[ FAIL ] Unknown skill subcommand '${subCmd}'. Use 'list', 'add', 'update', 'check', or 'find'.${colors.reset}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// run / auto
// ---------------------------------------------------------------------------

function runAuto(flags, positional) {
  if (!flags.quiet && !flags.json) printBanner();
  const idea = positional.join(' ').trim();

  console.log(`${colors.bold}AUTONOMOUS SDLC RUNNER (devos run / devos auto)${colors.reset}`);
  console.log(`${colors.gray}${RULE}${colors.reset}`);
  console.log(`  Execution Mode: ${colors.green}Autonomous (Founder / Executive Proxy)${colors.reset}`);
  if (idea) {
    console.log(`  Target Goal:    ${colors.cyan}"${idea}"${colors.reset}\n`);
  } else {
    console.log(`  Target Goal:    ${colors.cyan}Continuous Autonomous Delivery${colors.reset}\n`);
  }

  console.log(`${colors.bold}10-Stage Professional SDLC Execution Pipeline:${colors.reset}`);
  console.log(`  ${colors.cyan}1. Inception:${colors.reset}            Architect (grill-me) → docs/PROJECT_REQUIREMENTS.md`);
  console.log(`  ${colors.cyan}2. Design Gate:${colors.reset}          UI Designer (ui-ux-pro-max) → docs/DESIGN.md`);
  console.log(`  ${colors.cyan}3. Architecture & DB:${colors.reset}    DBA → Migrations + Seed Fixtures (test password: devos123)`);
  console.log(`  ${colors.cyan}4. Task Decomposition:${colors.reset}   Orchestrator → docs/TASK_BOARD.md DAG`);
  console.log(`  ${colors.cyan}5. Implementation:${colors.reset}       Developer → Code authoring (dynamic subagents)`);
  console.log(`  ${colors.cyan}6. Test Suite:${colors.reset}           Tester → Automated unit & integration tests`);
  console.log(`  ${colors.cyan}7. Testing Guide:${colors.reset}        Tester → Interactive docs/TESTING_GUIDE.md`);
  console.log(`  ${colors.cyan}8. Quality Assurance:${colors.reset}    QA → Lint, types, standards & Design Gate audit`);
  console.log(`  ${colors.cyan}9. Security Audit:${colors.reset}       Security → OWASP, auth & secret scan`);
  console.log(`  ${colors.cyan}10. Humanizer Audit:${colors.reset}     Release Manager → Scrub AI tells from docs & copy\n`);

  console.log(`${colors.bold}Next Action:${colors.reset}`);
  console.log(`  To trigger this autonomous run in your AI coding harness, use:`);
  console.log(`    $ ${colors.green}/auto ${idea || '<your product idea>'}${colors.reset}`);
  console.log(`  Or hand off to the Executive Proxy:`);
  console.log(`    "Executive Proxy, run autonomous SDLC mode for: ${idea || '<your product idea>'}"\n`);
}

// ---------------------------------------------------------------------------
// telemetry
// ---------------------------------------------------------------------------

function runTelemetry(flags, positional) {
  if (!flags.quiet && !flags.json) printBanner();
  const sub = positional[0] || 'status';
  const manifestPath = path.join(TARGET_DIR, '.agents', 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { telemetry: 'on' };
  const telemetryDir = path.join(TARGET_DIR, '.agents', 'telemetry');
  const eventsPath = path.join(telemetryDir, 'events.jsonl');

  if (sub === 'enable') {
    manifest.telemetry = 'on';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`${colors.green}[ OK ] Anonymous failure telemetry enabled.${colors.reset}\n`);
    return;
  }

  if (sub === 'disable') {
    manifest.telemetry = 'off';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`${colors.yellow}[ OK ] Anonymous failure telemetry disabled.${colors.reset}\n`);
    return;
  }

  if (sub === 'clear') {
    if (fs.existsSync(eventsPath)) {
      fs.writeFileSync(eventsPath, '', 'utf8');
    }
    console.log(`${colors.green}[ OK ] Telemetry event buffer cleared.${colors.reset}\n`);
    return;
  }

  const isEnabled = manifest.telemetry !== 'off';
  let eventCount = 0;
  let lines = [];
  if (fs.existsSync(eventsPath)) {
    const raw = fs.readFileSync(eventsPath, 'utf8').trim();
    if (raw.length > 0) {
      lines = raw.split('\n').filter(Boolean);
      eventCount = lines.length;
    }
  }

  if (sub === 'report') {
    console.log(`${colors.bold}TELEMETRY & ROOT CAUSE ANALYSIS (RCA) REPORT${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}`);
    console.log(`  Status:       ${isEnabled ? colors.green + 'Enabled (on)' : colors.yellow + 'Disabled (off)'}${colors.reset}`);
    console.log(`  Event Buffer: ${colors.cyan}${eventCount} events recorded${colors.reset}\n`);

    if (eventCount === 0) {
      console.log(`  ${colors.green}✓ Zero failure events recorded. All runtime hooks and gates are operating cleanly.${colors.reset}\n`);
      return;
    }

    const rules = {};
    lines.forEach((l) => {
      try {
        const parsed = JSON.parse(l);
        const rule = parsed.rule || parsed.eventType || 'UNKNOWN';
        rules[rule] = (rules[rule] || 0) + 1;
      } catch (e) {}
    });

    console.log(`${colors.bold}Failure Breakdown:${colors.reset}`);
    Object.keys(rules).forEach((r) => {
      console.log(`  - ${colors.yellow}${r}${colors.reset}: ${rules[r]} occurrences`);
    });

    console.log(`\n${colors.bold}Recent Events (Last 3):${colors.reset}`);
    lines.slice(-3).forEach((l) => {
      try {
        const p = JSON.parse(l);
        console.log(`  ${colors.gray}[${p.timestamp || 'N/A'}]${colors.reset} ${colors.cyan}${p.rule || p.eventType}${colors.reset} — ${p.detail || ''}`);
      } catch (e) {}
    });
    console.log(`\nTo clear the buffer: ${colors.cyan}devos telemetry clear${colors.reset}\n`);
    return;
  }

  // default 'status'
  console.log(`${colors.bold}DEV-OS TELEMETRY STATUS${colors.reset}`);
  console.log(`${colors.gray}${RULE}${colors.reset}`);
  console.log(`  Status:       ${isEnabled ? colors.green + 'Enabled (on - recommended)' : colors.yellow + 'Disabled (off)'}${colors.reset}`);
  console.log(`  Log Buffer:   ${path.relative(TARGET_DIR, eventsPath)}`);
  console.log(`  Total Events: ${eventCount}`);
  console.log(`\nCommands:`);
  console.log(`  $ ${colors.cyan}devos telemetry report${colors.reset}   View RCA failure breakdown`);
  console.log(`  $ ${colors.cyan}devos telemetry enable${colors.reset}   Enable anonymous failure logging`);
  console.log(`  $ ${colors.cyan}devos telemetry disable${colors.reset}  Disable failure logging`);
  console.log(`  $ ${colors.cyan}devos telemetry clear${colors.reset}    Clear local event buffer\n`);
}

// ---------------------------------------------------------------------------
// doctor
// ---------------------------------------------------------------------------

function runDoctor(flags) {
  if (!flags.quiet && !flags.json) printBanner();

  const checks = [
    { name: '.agents/ directory', path: path.join(TARGET_DIR, '.agents'), type: 'dir' },
    { name: 'Agent personas (.agents/agents/)', path: path.join(TARGET_DIR, '.agents', 'agents'), type: 'dir' },
    { name: 'Specialist skills (.agents/skills/)', path: path.join(TARGET_DIR, '.agents', 'skills'), type: 'dir' },
    { name: 'Human commit script (.agents/scripts/commit.sh)', path: path.join(TARGET_DIR, '.agents', 'scripts', 'commit.sh'), type: 'file', exec: true },
    { name: 'Hook installer (.agents/scripts/install-hooks.sh)', path: path.join(TARGET_DIR, '.agents', 'scripts', 'install-hooks.sh'), type: 'file', exec: true },
    { name: 'Humanizer scanner (.agents/scripts/humanize-check.sh)', path: path.join(TARGET_DIR, '.agents', 'scripts', 'humanize-check.sh'), type: 'file', exec: true },
    { name: 'Runtime lifecycle hooks (.agents/hooks/)', path: path.join(TARGET_DIR, '.agents', 'hooks'), type: 'dir', optional: true },
    { name: 'Shared memory vault (.agents/memory/)', path: path.join(TARGET_DIR, '.agents', 'memory'), type: 'dir', optional: true },
    { name: 'Task board (docs/TASK_BOARD.md)', path: path.join(TARGET_DIR, 'docs', 'TASK_BOARD.md'), type: 'file', optional: true },
    { name: 'Telemetry buffer (.agents/telemetry/)', path: path.join(TARGET_DIR, '.agents', 'telemetry'), type: 'dir', optional: true },
    { name: 'Mandatory Design Gate (docs/DESIGN.md)', path: path.join(TARGET_DIR, 'docs', 'DESIGN.md'), type: 'file', optional: true },
    { name: 'Interactive Testing Guide (docs/TESTING_GUIDE.md)', path: path.join(TARGET_DIR, 'docs', 'TESTING_GUIDE.md'), type: 'file', optional: true },
    { name: 'Team roster (.agents/AGENTS.md)', path: path.join(TARGET_DIR, '.agents', 'AGENTS.md'), type: 'file' },
    { name: 'Coding standards (CODING_STANDARDS.md)', path: path.join(TARGET_DIR, 'CODING_STANDARDS.md'), type: 'file' },
    { name: 'Documentation (docs/)', path: path.join(TARGET_DIR, 'docs'), type: 'dir' },
    { name: 'Claude Code commands (.claude/commands/)', path: path.join(TARGET_DIR, '.claude', 'commands'), type: 'dir', optional: true },
    { name: 'Claude Code agents (.claude/agents/)', path: path.join(TARGET_DIR, '.claude', 'agents'), type: 'dir', optional: true },
    { name: 'Claude Code hooks (.claude/hooks.json)', path: path.join(TARGET_DIR, '.claude', 'hooks.json'), type: 'file', optional: true },
    { name: 'Cursor rules (.cursor/rules/devos.mdc)', path: path.join(TARGET_DIR, '.cursor', 'rules', 'devos.mdc'), type: 'file', optional: true },
    { name: 'OpenCode rules (.opencode/rules/devos-rules.md)', path: path.join(TARGET_DIR, '.opencode', 'rules', 'devos-rules.md'), type: 'file', optional: true },
    { name: 'Antigravity / Gemini instructions (ANTIGRAVITY.md)', path: path.join(TARGET_DIR, 'ANTIGRAVITY.md'), type: 'file', optional: true },
    { name: 'Codex instructions (.codex/instructions.md)', path: path.join(TARGET_DIR, '.codex', 'instructions.md'), type: 'file', optional: true },
    { name: 'Mechanical pre-commit hook (.git/hooks/pre-commit)', path: path.join(TARGET_DIR, '.git', 'hooks', 'pre-commit'), type: 'file', optional: true }
  ];

  const results = [];
  let passedCount = 0;
  let requiredTotal = 0;
  let failedRequired = 0;

  checks.forEach((check) => {
    const exists = fs.existsSync(check.path);
    let isExec = false;

    if (exists && check.exec) {
      try {
        fs.accessSync(check.path, fs.constants.X_OK);
        isExec = true;
      } catch (e) {
        isExec = false;
      }
    }

    const ok = exists && (!check.exec || isExec);
    const status = ok ? 'PASS' : (check.optional ? 'WARN' : 'FAIL');
    if (!check.optional) {
      requiredTotal++;
      if (ok) passedCount++;
      else failedRequired++;
    }

    results.push({ name: check.name, path: check.path, status, optional: Boolean(check.optional), exec: check.exec ? isExec : undefined });
  });

  if (flags.json) {
    console.log(JSON.stringify({ target: TARGET_DIR, passedCount, totalChecks: requiredTotal, results }, null, 2));
    if (failedRequired > 0) process.exit(1);
    return;
  }

  console.log(`${colors.bold}DIAGNOSTIC REPORT${colors.reset} ${colors.gray}(Target: ${TARGET_DIR})${colors.reset}`);
  console.log(`${colors.gray}${RULE}${colors.reset}\n`);

  results.forEach((res) => {
    if (res.status === 'PASS') {
      const execLabel = res.exec !== undefined ? ` ${colors.gray}(Executable: 755)${colors.reset}` : '';
      console.log(`  [ ${colors.green}PASS${colors.reset} ] ${res.name}${execLabel}`);
    } else {
      const reason = !fs.existsSync(res.path) ? 'Missing' : 'Missing Executable Permissions (run chmod +x)';
      const tagColor = res.status === 'WARN' ? colors.yellow : colors.red;
      console.log(`  [ ${tagColor}${res.status}${colors.reset} ] ${res.name} ${colors.gray}(${reason})${colors.reset}`);
    }
  });

  console.log(`\n${colors.gray}${RULE}${colors.reset}`);
  console.log(`Diagnostic Summary: ${passedCount}/${requiredTotal} required checks passed.`);

  if (failedRequired === 0) {
    console.log(`${colors.green}${colors.bold}[ OK ] Dev-OS environment is fully operational.${colors.reset}`);
    const warns = results.filter((r) => r.status === 'WARN');
    if (warns.length) {
      console.log(`${colors.yellow}[ WARN ] ${warns.length} optional item(s) not set up.${colors.reset}`);
      if (warns.some((w) => w.name.includes('pre-commit'))) {
        console.log(`${colors.gray}         Install the commit gate: ./.agents/scripts/install-hooks.sh${colors.reset}`);
      }
    }
    console.log();
  } else {
    console.log(`${colors.yellow}[ WARN ] System check incomplete. Run ${colors.bold}npx @olives/devos init${colors.reset}${colors.yellow} to repair your setup.${colors.reset}\n`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

function runStatus(flags) {
  if (!flags.quiet && !flags.json) printBanner();

  const hasAgents = fs.existsSync(path.join(TARGET_DIR, '.agents'));
  const hasStandards = fs.existsSync(path.join(TARGET_DIR, 'CODING_STANDARDS.md'));
  const hasCommitScript = fs.existsSync(path.join(TARGET_DIR, '.agents', 'scripts', 'commit.sh'));
  const hasHook = fs.existsSync(path.join(TARGET_DIR, '.git', 'hooks', 'pre-commit'));
  const hasClaude = fs.existsSync(path.join(TARGET_DIR, '.claude', 'commands'));
  const hasCursor = fs.existsSync(path.join(TARGET_DIR, '.cursor', 'rules', 'devos.mdc'));
  const hasOpenCode = fs.existsSync(path.join(TARGET_DIR, 'OPENCODE.md'));
  const hasAntigravity = fs.existsSync(path.join(TARGET_DIR, 'ANTIGRAVITY.md')) || fs.existsSync(path.join(TARGET_DIR, 'GEMINI.md'));
  const hasCodex = fs.existsSync(path.join(TARGET_DIR, '.codex', 'instructions.md')) || fs.existsSync(path.join(TARGET_DIR, '.windsurfrules'));
  const hasMemory = fs.existsSync(path.join(TARGET_DIR, '.agents', 'memory'));
  const hasTaskBoard = fs.existsSync(path.join(TARGET_DIR, 'docs', 'TASK_BOARD.md'));
  const hasDesign = fs.existsSync(path.join(TARGET_DIR, 'docs', 'DESIGN.md'));
  const hasTestingGuide = fs.existsSync(path.join(TARGET_DIR, 'docs', 'TESTING_GUIDE.md'));
  const manifestPath = path.join(TARGET_DIR, '.agents', 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;

  if (flags.json) {
    console.log(JSON.stringify({
      target: TARGET_DIR,
      initialized: hasAgents,
      standards: hasStandards,
      commitGate: hasCommitScript,
      preCommitHook: hasHook,
      memoryVault: hasMemory,
      taskBoard: hasTaskBoard,
      designGate: hasDesign,
      testingGuide: hasTestingGuide,
      manifest,
      harnesses: {
        claude: hasClaude,
        antigravity: hasAntigravity,
        cursor: hasCursor,
        openCode: hasOpenCode,
        codex: hasCodex
      }
    }, null, 2));
    return;
  }

  console.log(`${colors.bold}PROJECT ENVIRONMENT STATUS${colors.reset}`);
  console.log(`${colors.gray}${RULE}${colors.reset}`);
  console.log(`  Target Path:   ${colors.cyan}${TARGET_DIR}${colors.reset}`);
  console.log(`  Dev-OS Status: ${hasAgents ? colors.green + 'Initialized' : colors.yellow + 'Not Initialized'}${colors.reset}`);
  console.log(`  Telemetry:     ${manifest && manifest.telemetry === 'off' ? colors.gray + 'Off' : colors.green + 'Active (on - recommended)'}${colors.reset}`);
  console.log(`  SDLC Mode:     ${manifest && manifest.mode ? colors.cyan + manifest.mode : colors.cyan + 'interactive'}${colors.reset}`);
  console.log(`  Design Gate:   ${hasDesign ? colors.green + 'Ready (docs/DESIGN.md)' : colors.yellow + 'Pending docs/DESIGN.md'}${colors.reset}`);
  console.log(`  Testing Guide: ${hasTestingGuide ? colors.green + 'Ready (docs/TESTING_GUIDE.md)' : colors.gray + 'None'}${colors.reset}`);
  console.log(`  Standards:     ${hasStandards ? colors.green + 'Present' : colors.gray + 'None'}${colors.reset}`);
  console.log(`  Commit Gate:   ${hasCommitScript ? colors.green + 'Active' : colors.gray + 'Disabled'}${colors.reset}`);
  console.log(`  Git Hook:      ${hasHook ? colors.green + 'Installed' : colors.gray + 'Not Installed'}${colors.reset}`);
  console.log(`  Memory Vault:  ${hasMemory ? colors.green + 'Active (.agents/memory/)' : colors.gray + 'None'}${colors.reset}`);
  console.log(`  Task Board:    ${hasTaskBoard ? colors.green + 'Active (docs/TASK_BOARD.md)' : colors.gray + 'None'}${colors.reset}`);
  if (manifest && manifest.installedPacks) {
    console.log(`  Active Packs:  ${colors.cyan}${manifest.installedPacks.join(', ')}${colors.reset}`);
  }
  console.log(`  Harnesses:     Claude (${hasClaude ? '✓' : '✗'}), Antigravity (${hasAntigravity ? '✓' : '✗'}), Cursor (${hasCursor ? '✓' : '✗'}), OpenCode (${hasOpenCode ? '✓' : '✗'}), Codex (${hasCodex ? '✓' : '✗'})\n`);

  if (!hasAgents) {
    console.log(`Run ${colors.cyan}npx @olives/devos init${colors.reset} to install Dev-OS in this project.\n`);
  }
}

// Main CLI Entrypoint
async function main() {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));

  if (flags.version) {
    printVersion();
    return;
  }

  if (flags.help) {
    printHelp();
    return;
  }

  switch (command) {
    case 'init':
    case 'setup':
      await runInit(flags);
      break;
    case 'update':
    case 'upgrade':
      await runUpdate(flags);
      break;
    case 'run':
    case 'auto':
      runAuto(flags, positional);
      break;
    case 'telemetry':
      runTelemetry(flags, positional);
      break;
    case 'doctor':
    case 'check':
      runDoctor(flags);
      break;
    case 'pack':
    case 'packs':
      runPack(flags, positional);
      break;
    case 'memory':
      runMemory(flags, positional);
      break;
    case 'list':
    case 'agents':
      runList(flags);
      break;
    case 'skill':
    case 'skills':
      if (positional.length > 0 && ['add', 'install', 'update', 'upgrade', 'check', 'find', 'search'].includes(positional[0])) {
        runSkill(flags, positional);
      } else {
        runList(flags);
      }
      break;
    case 'status':
      runStatus(flags);
      break;
    case 'version':
      printVersion();
      break;
    case 'help':
    case null:
      printHelp();
      break;
    default:
      console.log(`${colors.red}Unknown command: '${command}'${colors.reset}\n`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
  process.exit(1);
});
