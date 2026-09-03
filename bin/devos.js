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
const PKG = fs.existsSync(PKG_PATH) ? JSON.parse(fs.readFileSync(PKG_PATH, 'utf8')) : { version: '2.1.0' };

const STACKS = ['nextjs', 'laravel', 'django', 'react-native', 'express', 'fastapi', 'universal'];

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

// Flags parser helper
function parseArgs(args) {
  const flags = {
    stack: null,
    fresh: false,
    existing: false,
    json: false,
    quiet: false,
    claude: true,
    help: false,
    version: false
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
  console.log(`  ${colors.green}update${colors.reset}, ${colors.green}upgrade${colors.reset}    Safely refresh .agents/, skills, commands, and hooks`);
  console.log(`  ${colors.green}doctor${colors.reset}, ${colors.green}check${colors.reset}      Diagnose project setup, permissions, commit script, and health`);
  console.log(`  ${colors.green}list${colors.reset}, ${colors.green}agents${colors.reset}       Display active agent personas and installed specialist skills`);
  console.log(`  ${colors.green}status${colors.reset}             Show active project configuration, detected stack, and health summary`);
  console.log(`  ${colors.green}version${colors.reset}            Print Dev-OS CLI version, Node runtime, and environment information`);
  console.log(`  ${colors.green}help${colors.reset}               Display this command reference\n`);

  console.log(`${colors.bold}FLAGS${colors.reset}`);
  console.log(`  ${colors.cyan}-s, --stack <name>${colors.reset}  Target stack (${STACKS.join(', ')})`);
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
  console.log(`  $ ${colors.cyan}npx @olives/devos doctor${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx @olives/devos list${colors.reset}\n`);

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

  if (flags.stack && !STACKS.includes(flags.stack.toLowerCase())) {
    throw new Error(`Unknown stack '${flags.stack}'. Valid stacks: ${STACKS.join(', ')}`);
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
    rl.close();
  }

  return { isFresh, stack: stack.toLowerCase() };
}

// ---------------------------------------------------------------------------
// Claude Code integration — generate .claude/ from the .agents/ sources
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
  'release-manager': 'Dev-OS release specialist. Owns semantic versioning, changelog entries, and release notes.'
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
    '',
    '### Solo Session Protocol (Single-Agent Work)',
    '- Step 1: Check freshness via `git fetch --all --prune` and `git status -sb`.',
    '- Step 2: Implement following `CODING_STANDARDS.md`.',
    '- Step 3: Self-verify with typecheck (`tsc --noEmit` or equivalent) and automated tests.',
    '- Step 4: Present staged review summary to human.',
    '- Step 5: Route commit through `.agents/scripts/commit.sh`.',
    '- Step 6: Update `docs/CURRENT_STATE.md` and log incidents in `docs/LESSONS.md`.',
    '- Escalation: DB schema changes (DBA), security alterations (Security), or loops exceeding 3 attempts must escalate to human.',
    '',
    '### Tooling & Personas',
    '- Slash commands: `.claude/commands/` (generated from `.agents/commands/` — refresh with `devos update`).',
    '- Agent personas: `.claude/agents/` (generated from `.agents/agents/`).',
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

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

async function runInit(flags) {
  if (!flags.quiet) printBanner();

  const insideSource = TEMPLATE_DIR === TARGET_DIR;
  if (insideSource) {
    console.log(`${colors.yellow}[ WARN ] You are running init inside the Dev-OS source repository itself. Template copy steps will be skipped.${colors.reset}\n`);
  }

  const { isFresh, stack } = await promptInitOptions(flags);

  console.log(`\n${colors.cyan}[ INFO ] Initializing Dev-OS in target directory...${colors.reset}`);
  console.log(`${colors.gray}Target Path: ${TARGET_DIR}${colors.reset}`);
  console.log(`${colors.gray}Mode: ${isFresh ? 'Fresh Project' : 'Existing Project'} | Stack: [${stack.toUpperCase()}]${colors.reset}\n`);

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

  // Step 1: Back up any existing .agents/, then copy the template
  if (!insideSource) {
    if (fs.existsSync(destAgents)) {
      step('Backing up existing .agents/ to .agents/_backup/', () => {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(destAgents, '_backup', stamp);
        copyRecursiveSync(destAgents, backupDir);
        return `saved (${path.relative(TARGET_DIR, backupDir)})`;
      });
    }
    step('Installing agent roster and skills into .agents/', () => {
      copyRecursiveSync(srcAgents, destAgents);
    });
  }

  // Step 2: Ensure script permissions (commit gate + hook installer)
  step('Configuring commit gate scripts (commit.sh, install-hooks.sh)', () => {
    const scripts = ['commit.sh', 'install-hooks.sh'];
    const missing = [];
    scripts.forEach((name) => {
      const scriptPath = path.join(destAgents, 'scripts', name);
      if (fs.existsSync(scriptPath)) {
        fs.chmodSync(scriptPath, '755');
      } else {
        missing.push(name);
      }
    });
    if (missing.length === scripts.length) throw new Error('commit gate scripts are missing from .agents/scripts/');
    return missing.length ? `partial (missing: ${missing.join(', ')})` : 'executable (755)';
  });

  // Step 2b: Install git pre-commit hook automatically if inside a git repository
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

  // Step 3: Copy docs directory if fresh or missing
  const destDocs = path.join(TARGET_DIR, 'docs');
  if (!insideSource && (isFresh || !fs.existsSync(destDocs))) {
    step('Installing project documentation into docs/', () => {
      copyRecursiveSync(path.join(TEMPLATE_DIR, 'docs'), destDocs);
    });
  } else {
    console.log(`${colors.gray}Preserving existing docs/ directory${colors.reset}`);
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
  } else {
    console.log(`${colors.gray}Preserving existing CODING_STANDARDS.md${colors.reset}`);
  }

  // Step 5: Claude Code integration (.claude/commands, .claude/agents, CLAUDE.md)
  let claudeSummary = null;
  if (flags.claude) {
    step('Wiring Claude Code integration (.claude/, CLAUDE.md)', () => {
      const destClaude = path.join(TARGET_DIR, '.claude');
      const cmdCount = generateClaudeCommands(destAgents, destClaude);
      const agentCount = generateClaudeAgents(destAgents, destClaude);
      const claudeMd = bootstrapClaudeMd(TARGET_DIR);
      claudeSummary = { cmdCount, agentCount, claudeMd };
      return `${cmdCount} commands, ${agentCount} agents (CLAUDE.md ${claudeMd})`;
    });
  } else {
    console.log(`${colors.gray}Skipping Claude Code integration (--no-claude)${colors.reset}`);
  }

  // Step 6: Update .gitignore
  step('Updating .gitignore rules', () => {
    const gitignorePath = path.join(TARGET_DIR, '.gitignore');
    let gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
    if (gitignoreContent.includes('.agents/_backup')) return 'already up to date';
    gitignoreContent += `\n# Dev-OS temporary backups\n.agents/_backup/\n`;
    fs.writeFileSync(gitignorePath, gitignoreContent.trim() + '\n', 'utf8');
    return 'updated';
  });

  // Summary card
  const agentCount = countAgents(path.join(destAgents, 'agents'));
  const skillCount = countSkills(path.join(destAgents, 'skills'));

  const rows = [
    ['.agents/agents/', `${agentCount} Agent Personas (Orchestrator, Developer, QA, DBA, Security...)`],
    ['.agents/skills/', `${skillCount} Specialist Engineering Skills`],
    ['.agents/scripts/', 'Commit Checkpoint Gate (commit.sh) + Hook Installer'],
    ['.agents/AGENTS.md', 'Team Roster & Triage Rules'],
    ['CODING_STANDARDS.md', `Stack Standards [${stack.toUpperCase()}]`]
  ];
  if (claudeSummary) {
    rows.push(['.claude/', `${claudeSummary.cmdCount} Slash Commands + ${claudeSummary.agentCount} Subagents (Claude Code)`]);
  }

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
    console.log(`  1. Install the mechanical pre-commit gate: ${colors.cyan}./.agents/scripts/install-hooks.sh${colors.reset}`);
    console.log(`  2. Open your AI engineering environment (Claude Code, Antigravity, Cursor, etc.).`);
    console.log(`  3. Prompt the Orchestrator: ${colors.yellow}"Use your grill-me skill to brainstorm our project requirements."${colors.reset}`);
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

    // 2. Refresh .agents/
    step('Refreshing agent personas, skills, and scripts', () => {
      copyRecursiveSync(srcAgents, destAgents);
    });
  }

  // 3. Ensure executable permissions
  step('Verifying script permissions (commit.sh, install-hooks.sh)', () => {
    const scripts = ['commit.sh', 'install-hooks.sh'];
    scripts.forEach((name) => {
      const p = path.join(destAgents, 'scripts', name);
      if (fs.existsSync(p)) fs.chmodSync(p, '755');
    });
    return 'executable (755)';
  });

  // 4. Claude Code integration
  if (flags.claude) {
    step('Refreshing Claude Code commands and subagents', () => {
      const destClaude = path.join(TARGET_DIR, '.claude');
      const cmdCount = generateClaudeCommands(destAgents, destClaude);
      const agentCount = generateClaudeAgents(destAgents, destClaude);
      const claudeMd = bootstrapClaudeMd(TARGET_DIR);
      return `${cmdCount} commands, ${agentCount} agents (CLAUDE.md ${claudeMd})`;
    });
  }

  // 5. Pre-commit hook
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

  console.log(`\n${colors.bold}SPECIALIST SKILLS (${skills.length})${colors.reset}`);
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
    { name: 'Team roster (.agents/AGENTS.md)', path: path.join(TARGET_DIR, '.agents', 'AGENTS.md'), type: 'file' },
    { name: 'Coding standards (CODING_STANDARDS.md)', path: path.join(TARGET_DIR, 'CODING_STANDARDS.md'), type: 'file' },
    { name: 'Documentation (docs/)', path: path.join(TARGET_DIR, 'docs'), type: 'dir' },
    { name: 'Claude Code commands (.claude/commands/)', path: path.join(TARGET_DIR, '.claude', 'commands'), type: 'dir', optional: true },
    { name: 'Claude Code agents (.claude/agents/)', path: path.join(TARGET_DIR, '.claude', 'agents'), type: 'dir', optional: true },
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
      console.log(`${colors.yellow}[ WARN ] ${warns.length} optional item(s) not set up (Claude Code integration / pre-commit hook).${colors.reset}`);
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

  if (flags.json) {
    console.log(JSON.stringify({
      target: TARGET_DIR,
      initialized: hasAgents,
      standards: hasStandards,
      commitGate: hasCommitScript,
      preCommitHook: hasHook,
      claudeIntegration: hasClaude
    }, null, 2));
    return;
  }

  console.log(`${colors.bold}PROJECT ENVIRONMENT STATUS${colors.reset}`);
  console.log(`${colors.gray}${RULE}${colors.reset}`);
  console.log(`  Target Path:   ${colors.cyan}${TARGET_DIR}${colors.reset}`);
  console.log(`  Dev-OS Status: ${hasAgents ? colors.green + 'Initialized' : colors.yellow + 'Not Initialized'}${colors.reset}`);
  console.log(`  Standards:     ${hasStandards ? colors.green + 'Present' : colors.gray + 'None'}${colors.reset}`);
  console.log(`  Commit Gate:   ${hasCommitScript ? colors.green + 'Active' : colors.gray + 'Disabled'}${colors.reset}`);
  console.log(`  Git Hook:      ${hasHook ? colors.green + 'Installed' : colors.gray + 'Not Installed'}${colors.reset}`);
  console.log(`  Claude Code:   ${hasClaude ? colors.green + 'Wired (.claude/)' : colors.gray + 'Not Wired'}${colors.reset}\n`);

  if (!hasAgents) {
    console.log(`Run ${colors.cyan}npx @olives/devos init${colors.reset} to install Dev-OS in this project.\n`);
  }
}

// Main CLI Entrypoint
async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

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
    case 'doctor':
    case 'check':
      runDoctor(flags);
      break;
    case 'list':
    case 'agents':
    case 'skills':
      runList(flags);
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
