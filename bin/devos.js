#!/usr/bin/env node

/**
 * Olives Technologies Dev-OS CLI ('devos' / 'olives-devos')
 * Standard developer CLI interface modeled after industry tools (Claude Code, Gemini CLI, gh, Vercel).
 * Zero external npm dependencies for instant execution via npx.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Package metadata
const TEMPLATE_DIR = path.resolve(__dirname, '..');
const TARGET_DIR = process.cwd();
const PKG_PATH = path.join(TEMPLATE_DIR, 'package.json');
const PKG = fs.existsSync(PKG_PATH) ? JSON.parse(fs.readFileSync(PKG_PATH, 'utf8')) : { version: '1.0.0' };

// ANSI Color formatting
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  underline: '\x1b[4m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  white: '\x1b[37m'
};

// Flags parser helper
function parseArgs(args) {
  const flags = {
    stack: null,
    fresh: false,
    existing: false,
    json: false,
    quiet: false,
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
    } else if (arg === '--stack' || arg === '-s') {
      flags.stack = args[i + 1] || null;
      i++;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  return { command: positional[0] || null, positional: positional.slice(1), flags };
}

function printBanner() {
  console.log(`${colors.cyan}${colors.bold}Olives Dev-OS CLI${colors.reset} ${colors.gray}v${PKG.version}${colors.reset}`);
  console.log(`${colors.dim}Autonomous Multi-Agent Engineering Environment | Olives Technologies${colors.reset}\n`);
}

function printHelp() {
  printBanner();
  console.log(`${colors.bold}USAGE${colors.reset}`);
  console.log(`  $ ${colors.cyan}devos${colors.reset} <command> [flags]\n`);

  console.log(`${colors.bold}CORE COMMANDS${colors.reset}`);
  console.log(`  ${colors.green}init${colors.reset}, ${colors.green}setup${colors.reset}      Initialize or update Dev-OS multi-agent environment in target project`);
  console.log(`  ${colors.green}doctor${colors.reset}, ${colors.green}check${colors.reset}    Diagnose project setup, permissions, commit script, and health`);
  console.log(`  ${colors.green}list${colors.reset}, ${colors.green}agents${colors.reset}     Display active agent personas and installed specialist skills`);
  console.log(`  ${colors.green}status${colors.reset}           Show active project configuration, detected stack, and health summary`);
  console.log(`  ${colors.green}version${colors.reset}          Print Dev-OS CLI version, Node runtime, and environment information`);
  console.log(`  ${colors.green}help${colors.reset}             Display this command reference\n`);

  console.log(`${colors.bold}FLAGS${colors.reset}`);
  console.log(`  ${colors.cyan}-s, --stack <name>${colors.reset}  Specify target stack (nextjs, laravel, django, react-native, universal)`);
  console.log(`  ${colors.cyan}--fresh${colors.reset}             Non-interactive fresh project initialization`);
  console.log(`  ${colors.cyan}--existing${colors.reset}          Non-interactive existing project initialization`);
  console.log(`  ${colors.cyan}--json${colors.reset}              Output diagnostic and listing results as JSON`);
  console.log(`  ${colors.cyan}-q, --quiet${colors.reset}         Suppress header banners and non-essential log messages`);
  console.log(`  ${colors.cyan}-v, --version${colors.reset}       Print CLI version`);
  console.log(`  ${colors.cyan}-h, --help${colors.reset}          Show command options\n`);

  console.log(`${colors.bold}EXAMPLES${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx devos init${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx devos init --stack nextjs --existing${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx devos doctor${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx devos list${colors.reset}\n`);

  console.log(`${colors.gray}Documentation & Guides: https://github.com/olitech1010/dev-os${colors.reset}\n`);
}

function printVersion() {
  console.log(`Olives Dev-OS CLI v${PKG.version}`);
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
      if (childItemName === '.git' || childItemName === 'node_modules' || childItemName === '__pycache__') return;
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

async function promptInitOptions(flags) {
  let isFresh = false;
  let stack = flags.stack || 'universal';

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

    console.log(`${colors.bold}Step 1: Environment Type${colors.reset}`);
    console.log(`  1) Fresh Project (Initialize clean workspace with docs and default standards)`);
    console.log(`  2) Existing Project (Inject/update .agents team without modifying existing code or custom standards)`);
    const projAns = await ask(`\n${colors.cyan}Select option [1-2] (default 2): ${colors.reset}`);
    isFresh = projAns.trim() === '1';

    if (!flags.stack) {
      console.log(`\n${colors.bold}Step 2: Technology Stack${colors.reset}`);
      console.log(`  1) Next.js (TypeScript, Supabase, Vercel)`);
      console.log(`  2) Laravel (PHP, MySQL, cPanel/Forge)`);
      console.log(`  3) Django (Python, DRF, Celery, Redis)`);
      console.log(`  4) React Native (Expo Router, Zustand)`);
      console.log(`  5) Universal / Standard Template (Default)`);

      const stackAns = await ask(`\n${colors.cyan}Select option [1-5] (default 5): ${colors.reset}`);
      switch (stackAns.trim()) {
        case '1': stack = 'nextjs'; break;
        case '2': stack = 'laravel'; break;
        case '3': stack = 'django'; break;
        case '4': stack = 'react-native'; break;
        default: stack = 'universal'; break;
      }
    }
    rl.close();
  }

  return { isFresh, stack: stack.toLowerCase() };
}

async function runInit(flags) {
  if (!flags.quiet) printBanner();

  if (TEMPLATE_DIR === TARGET_DIR) {
    console.log(`${colors.yellow}[ WARN ] You are running init inside the Dev-OS source repository itself.${colors.reset}\n`);
  }

  const { isFresh, stack } = await promptInitOptions(flags);

  console.log(`\n${colors.cyan}[ INFO ] Initializing Dev-OS in target directory...${colors.reset}`);
  console.log(`${colors.gray}Target Path: ${TARGET_DIR}${colors.reset}`);
  console.log(`${colors.gray}Mode: ${isFresh ? 'Fresh Project' : 'Existing Project'} | Stack: [${stack.toUpperCase()}]${colors.reset}\n`);

  // Step 1: Copy .agents/ directory
  process.stdout.write(`${colors.gray}Installing agent roster and skills into .agents/... ${colors.reset}`);
  const srcAgents = path.join(TEMPLATE_DIR, '.agents');
  const destAgents = path.join(TARGET_DIR, '.agents');
  copyRecursiveSync(srcAgents, destAgents);
  console.log(`${colors.green}done${colors.reset}`);

  // Step 2: Ensure commit script permissions
  process.stdout.write(`${colors.gray}Configuring human-in-the-loop commit script (commit.sh)... ${colors.reset}`);
  const commitScriptPath = path.join(destAgents, 'scripts', 'commit.sh');
  if (fs.existsSync(commitScriptPath)) {
    try {
      fs.chmodSync(commitScriptPath, '755');
      console.log(`${colors.green}executable (755)${colors.reset}`);
    } catch (e) {
      console.log(`${colors.yellow}chmod failed: ${e.message}${colors.reset}`);
    }
  } else {
    console.log(`${colors.red}missing${colors.reset}`);
  }

  // Step 3: Copy docs directory if fresh or missing
  const destDocs = path.join(TARGET_DIR, 'docs');
  if (isFresh || !fs.existsSync(destDocs)) {
    process.stdout.write(`${colors.gray}Installing project documentation into docs/... ${colors.reset}`);
    const srcDocs = path.join(TEMPLATE_DIR, 'docs');
    copyRecursiveSync(srcDocs, destDocs);
    console.log(`${colors.green}done${colors.reset}`);
  } else {
    console.log(`${colors.gray}Preserving existing docs/ directory${colors.reset}`);
  }

  // Step 4: Handle CODING_STANDARDS.md
  const targetStandards = path.join(TARGET_DIR, 'CODING_STANDARDS.md');
  if (isFresh || !fs.existsSync(targetStandards)) {
    process.stdout.write(`${colors.gray}Setting up CODING_STANDARDS.md for [${stack.toUpperCase()}]... ${colors.reset}`);
    let srcStandards = path.join(TEMPLATE_DIR, 'CODING_STANDARDS.md');
    if (stack !== 'universal') {
      const stackFile = path.join(destAgents, 'skills', 'stacks', `${stack}.md`);
      if (fs.existsSync(stackFile)) {
        srcStandards = stackFile;
      }
    }
    if (fs.existsSync(srcStandards)) {
      fs.copyFileSync(srcStandards, targetStandards);
      console.log(`${colors.green}done${colors.reset}`);
    } else {
      console.log(`${colors.yellow}skipped (template not found)${colors.reset}`);
    }
  } else {
    console.log(`${colors.gray}Preserving existing CODING_STANDARDS.md${colors.reset}`);
  }

  // Step 5: Update .gitignore
  process.stdout.write(`${colors.gray}Updating .gitignore rules... ${colors.reset}`);
  const gitignorePath = path.join(TARGET_DIR, '.gitignore');
  let gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  if (!gitignoreContent.includes('.agents/_backup')) {
    gitignoreContent += `\n# Dev-OS temporary backups\n.agents/_backup/\n`;
    fs.writeFileSync(gitignorePath, gitignoreContent.trim() + '\n', 'utf8');
    console.log(`${colors.green}updated${colors.reset}`);
  } else {
    console.log(`${colors.gray}already up to date${colors.reset}`);
  }

  // Summary Card
  console.log(`\n${colors.green}${colors.bold}[ OK ] Dev-OS Environment Initialized Successfully${colors.reset}\n`);
  console.log(`${colors.bold}INSTALLED COMPONENTS${colors.reset}`);
  console.log(`  • ${colors.cyan}.agents/agents/${colors.reset}   9 Agent Personas (Orchestrator, Developer, QA, DBA, Security...)`);
  console.log(`  • ${colors.cyan}.agents/skills/${colors.reset}   49 Specialist Engineering Skills`);
  console.log(`  • ${colors.cyan}.agents/scripts/${colors.reset}  Commit Checkpoint Gate (commit.sh)`);
  console.log(`  • ${colors.cyan}.agents/AGENTS.md${colors.reset} -> Team Roster & Triage Rules`);
  console.log(`  • ${colors.cyan}CODING_STANDARDS.md${colors.reset}-> Stack Standards [${stack.toUpperCase()}]\n`);

  console.log(`${colors.bold}NEXT STEPS${colors.reset}`);
  console.log(`  1. Open your AI engineering environment (Claude Code, Antigravity, Cursor, etc.).`);
  console.log(`  2. Prompt Orchestrator: ${colors.yellow}"Use your grill-me skill to brainstorm our project requirements."${colors.reset}`);
  console.log(`  3. Run ${colors.cyan}npx devos doctor${colors.reset} anytime to verify system health.\n`);
}

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
  agents.forEach((agent) => {
    console.log(`  ${colors.cyan}• ${agent.padEnd(16)}${colors.reset} ${colors.gray}(.agents/agents/${agent}.md)${colors.reset}`);
  });

  console.log(`\n${colors.bold}SPECIALIST SKILLS (${skills.length})${colors.reset}`);
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

function runDoctor(flags) {
  if (!flags.quiet && !flags.json) printBanner();

  const checks = [
    { name: '.agents/ directory', path: path.join(TARGET_DIR, '.agents'), type: 'dir' },
    { name: 'Agent personas (.agents/agents/)', path: path.join(TARGET_DIR, '.agents', 'agents'), type: 'dir' },
    { name: 'Specialist skills (.agents/skills/)', path: path.join(TARGET_DIR, '.agents', 'skills'), type: 'dir' },
    { name: 'Human commit script (.agents/scripts/commit.sh)', path: path.join(TARGET_DIR, '.agents', 'scripts', 'commit.sh'), type: 'file', exec: true },
    { name: 'Team roster (.agents/AGENTS.md)', path: path.join(TARGET_DIR, '.agents', 'AGENTS.md'), type: 'file' },
    { name: 'Coding standards (CODING_STANDARDS.md)', path: path.join(TARGET_DIR, 'CODING_STANDARDS.md'), type: 'file' },
    { name: 'Documentation (docs/)', path: path.join(TARGET_DIR, 'docs'), type: 'dir' }
  ];

  const results = [];
  let passedCount = 0;

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

    const status = exists && (!check.exec || isExec) ? 'PASS' : 'FAIL';
    if (status === 'PASS') passedCount++;

    results.push({ name: check.name, path: check.path, status, exec: check.exec ? isExec : undefined });
  });

  if (flags.json) {
    console.log(JSON.stringify({ target: TARGET_DIR, passedCount, totalChecks: checks.length, results }, null, 2));
    return;
  }

  console.log(`${colors.bold}DIAGNOSTIC REPORT${colors.reset} ${colors.gray}(Target: ${TARGET_DIR})${colors.reset}\n`);

  results.forEach((res) => {
    if (res.status === 'PASS') {
      const execLabel = res.exec !== undefined ? ` ${colors.gray}(Executable: 755)${colors.reset}` : '';
      console.log(`  [ ${colors.green}PASS${colors.reset} ] ${res.name}${execLabel}`);
    } else {
      const reason = !fs.existsSync(res.path) ? 'Missing' : 'Missing Executable Permissions (run chmod +x)';
      console.log(`  [ ${colors.red}FAIL${colors.reset} ] ${res.name} ${colors.gray}(${reason})${colors.reset}`);
    }
  });

  console.log(`\nDiagnostic Summary: ${passedCount}/${checks.length} checks passed.`);

  if (passedCount === checks.length) {
    console.log(`${colors.green}${colors.bold}[ OK ] Dev-OS environment is fully operational.${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}[ WARN ] System check incomplete. Run ${colors.bold}npx devos init${colors.reset}${colors.yellow} to repair your setup.${colors.reset}\n`);
  }
}

function runStatus(flags) {
  if (!flags.quiet) printBanner();

  const hasAgents = fs.existsSync(path.join(TARGET_DIR, '.agents'));
  const hasStandards = fs.existsSync(path.join(TARGET_DIR, 'CODING_STANDARDS.md'));
  const hasCommitScript = fs.existsSync(path.join(TARGET_DIR, '.agents', 'scripts', 'commit.sh'));

  console.log(`${colors.bold}PROJECT ENVIRONMENT STATUS${colors.reset}`);
  console.log(`  Target Path:   ${colors.cyan}${TARGET_DIR}${colors.reset}`);
  console.log(`  Dev-OS Status: ${hasAgents ? colors.green + 'Initialized' : colors.yellow + 'Not Initialized'}${colors.reset}`);
  console.log(`  Standards:     ${hasStandards ? colors.green + 'Present' : colors.gray + 'None'}${colors.reset}`);
  console.log(`  Commit Gate:   ${hasCommitScript ? colors.green + 'Active' : colors.gray + 'Disabled'}${colors.reset}\n`);

  if (!hasAgents) {
    console.log(`Run ${colors.cyan}npx devos init${colors.reset} to install Dev-OS in this project.\n`);
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
