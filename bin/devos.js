#!/usr/bin/env node

/**
 * Olives Technologies Dev-OS CLI ('devos')
 * Automated installer and management tool for Dev-OS multi-agent engineering team.
 * Zero external npm dependencies for instant execution via npx.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ANSI color formatting
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

const TEMPLATE_DIR = path.resolve(__dirname, '..');
const TARGET_DIR = process.cwd();

function printHeader() {
  console.log(`${colors.cyan}${colors.bold}`);
  console.log('========================================================');
  console.log('            🚀 Olives Technologies Dev-OS 🤖             ');
  console.log('      Autonomous Multi-Agent Engineering Environment     ');
  console.log('========================================================');
  console.log(`${colors.reset}`);
}

function printHelp() {
  printHeader();
  console.log(`Usage: ${colors.bold}devos <command> [options]${colors.reset}\n`);
  console.log('Commands:');
  console.log(`  ${colors.green}init${colors.reset}       Initialize or update Dev-OS in the current project`);
  console.log(`  ${colors.green}list${colors.reset}       List all available agent personas and skills`);
  console.log(`  ${colors.green}doctor${colors.reset}     Diagnose current project's Dev-OS setup and permissions`);
  console.log(`  ${colors.green}help${colors.reset}       Show this help message\n`);
  console.log('Examples:');
  console.log(`  $ npx devos init`);
  console.log(`  $ npx devos doctor\n`);
}

// Recursive file copy utility
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      // Avoid copying git directories or node_modules
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

async function promptQuestions() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  console.log(`${colors.bold}Step 1: Is this a Fresh Project or an Existing Project?${colors.reset}`);
  console.log(`  1) Fresh Project (Initialize clean workspace with docs and default standards)`);
  console.log(`  2) Existing Project (Inject/update .agents team without modifying existing code or custom standards)`);
  
  const projAns = await question(`\n${colors.cyan}Enter choice [1-2] (default 2): ${colors.reset}`);
  const isFresh = projAns.trim() === '1';

  console.log(`\n${colors.bold}Step 2: Select your target technology stack for CODING_STANDARDS.md:${colors.reset}`);
  console.log(`  1) Next.js (TypeScript, Supabase, Vercel)`);
  console.log(`  2) Laravel (PHP, MySQL, cPanel/Forge)`);
  console.log(`  3) Django (Python, DRF, Celery, Redis)`);
  console.log(`  4) React Native (Expo Router, Zustand)`);
  console.log(`  5) Universal / Standard Template (Default)`);

  const stackAns = await question(`\n${colors.cyan}Enter choice [1-5] (default 5): ${colors.reset}`);
  rl.close();

  let stack = 'universal';
  switch (stackAns.trim()) {
    case '1': stack = 'nextjs'; break;
    case '2': stack = 'laravel'; break;
    case '3': stack = 'django'; break;
    case '4': stack = 'react-native'; break;
    default: stack = 'universal'; break;
  }

  return { isFresh, stack };
}

async function runInit() {
  printHeader();

  if (TEMPLATE_DIR === TARGET_DIR) {
    console.log(`${colors.yellow}⚠️  Notice: You are running init inside the Dev-OS source repository itself.${colors.reset}\n`);
  }

  const { isFresh, stack } = await promptQuestions();
  console.log(`\n${colors.cyan}ℹ️  Setting up Dev-OS (${isFresh ? 'Fresh Project' : 'Existing Project'}) with [${stack.toUpperCase()}] standards...${colors.reset}\n`);

  // Step 1: Copy .agents/ directory (Always updated to latest)
  console.log(`${colors.gray}• Installing agent roster and skills into .agents/...${colors.reset}`);
  const srcAgents = path.join(TEMPLATE_DIR, '.agents');
  const destAgents = path.join(TARGET_DIR, '.agents');
  copyRecursiveSync(srcAgents, destAgents);

  // Step 2: Ensure commit.sh is executable
  console.log(`${colors.gray}• Configuring human-in-the-loop commit script permissions...${colors.reset}`);
  const commitScriptPath = path.join(destAgents, 'scripts', 'commit.sh');
  if (fs.existsSync(commitScriptPath)) {
    try {
      fs.chmodSync(commitScriptPath, '755');
    } catch (e) {
      console.log(`${colors.yellow}  Warning: Could not set chmod 755 on commit.sh: ${e.message}${colors.reset}`);
    }
  }

  // Step 3: Copy documentation (If fresh project, or if docs folder doesn't exist)
  if (isFresh || !fs.existsSync(path.join(TARGET_DIR, 'docs'))) {
    console.log(`${colors.gray}• Installing project documentation into docs/...${colors.reset}`);
    const srcDocs = path.join(TEMPLATE_DIR, 'docs');
    const destDocs = path.join(TARGET_DIR, 'docs');
    copyRecursiveSync(srcDocs, destDocs);
  } else {
    console.log(`${colors.gray}• Existing project: Preserving your custom docs/ directory...${colors.reset}`);
  }

  // Step 4: Handle CODING_STANDARDS.md (If existing project already has one, don't overwrite unless requested or missing)
  const targetStandards = path.join(TARGET_DIR, 'CODING_STANDARDS.md');
  if (isFresh || !fs.existsSync(targetStandards)) {
    console.log(`${colors.gray}• Setting up CODING_STANDARDS.md for [${stack.toUpperCase()}]...${colors.reset}`);
    let srcStandards = path.join(TEMPLATE_DIR, 'CODING_STANDARDS.md');
    if (stack !== 'universal') {
      const stackFile = path.join(destAgents, 'skills', 'stacks', `${stack}.md`);
      if (fs.existsSync(stackFile)) {
        srcStandards = stackFile;
      }
    }
    if (fs.existsSync(srcStandards)) {
      fs.copyFileSync(srcStandards, targetStandards);
    }
  } else {
    console.log(`${colors.gray}• Existing project: Preserving your customized CODING_STANDARDS.md...${colors.reset}`);
  }

  // Step 5: Update .gitignore if present or create basic one
  console.log(`${colors.gray}• Checking .gitignore rules...${colors.reset}`);
  const gitignorePath = path.join(TARGET_DIR, '.gitignore');
  let gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  if (!gitignoreContent.includes('.agents/_backup')) {
    gitignoreContent += `\n# Dev-OS temporary backups\n.agents/_backup/\n`;
    fs.writeFileSync(gitignorePath, gitignoreContent.trim() + '\n', 'utf8');
  }

  // Success Output
  console.log(`\n${colors.green}${colors.bold}✅ Dev-OS successfully installed and configured!${colors.reset}\n`);
  console.log(`${colors.bold}Installed Components:${colors.reset}`);
  console.log(`  • ${colors.cyan}.agents/agents/${colors.reset}   -> 9 Specialized AI Personas (Orchestrator, Developer, QA, DBA...)`);
  console.log(`  • ${colors.cyan}.agents/skills/${colors.reset}   -> 49 Reusable AI Engineering Skills`);
  console.log(`  • ${colors.cyan}.agents/scripts/${colors.reset}  -> Mechanical Human-in-the-Loop Commit Gate (commit.sh)`);
  console.log(`  • ${colors.cyan}CODING_STANDARDS.md${colors.reset}-> ${fs.existsSync(targetStandards) ? 'Configured' : 'Preserved'}`);
  console.log(`  • ${colors.cyan}.agents/AGENTS.md${colors.reset}         -> Team Roster & Triage Rules\n`);
  console.log(`${colors.bold}How Future Updates Work:${colors.reset}`);
  console.log(`  Whenever new skills or agent features are released in Dev-OS, simply run:`);
  console.log(`  ${colors.green}npx devos@latest init${colors.reset}`);
  console.log(`  This automatically updates your .agents/ directory with the newest features while preserving your existing project code and custom coding standards!\n`);
  console.log(`${colors.bold}Next Steps:${colors.reset}`);
  console.log(`  1. Open your AI engineering IDE or tool (Claude Code, Antigravity, Cursor, etc.).`);
  console.log(`  2. Prompt the Orchestrator: ${colors.yellow}"Use your grill-me skill to brainstorm our project requirements."${colors.reset}`);
  console.log(`  3. Build autonomously with confidence!\n`);
}

function runList() {
  printHeader();
  console.log(`${colors.bold}Available Dev-OS AI Agents (${path.join(TEMPLATE_DIR, '.agents', 'agents')}):${colors.reset}`);
  const agentsDir = path.join(TEMPLATE_DIR, '.agents', 'agents');
  if (fs.existsSync(agentsDir)) {
    fs.readdirSync(agentsDir).forEach(file => {
      if (file.endsWith('.md')) {
        console.log(`  🤖 ${colors.cyan}${file.replace('.md', '')}${colors.reset}`);
      }
    });
  }

  console.log(`\n${colors.bold}Installed Specialist Skills (${path.join(TEMPLATE_DIR, '.agents', 'skills')}):${colors.reset}`);
  const skillsDir = path.join(TEMPLATE_DIR, '.agents', 'skills');
  if (fs.existsSync(skillsDir)) {
    fs.readdirSync(skillsDir).forEach(file => {
      const skillPath = path.join(skillsDir, file);
      if (fs.statSync(skillPath).isDirectory()) {
        console.log(`  ⚡ ${colors.green}${file}${colors.reset}`);
      }
    });
  }
  console.log();
}

function runDoctor() {
  printHeader();
  console.log(`${colors.bold}Running Dev-OS Diagnostic Check on: ${TARGET_DIR}${colors.reset}\n`);

  const checks = [
    { name: '.agents/ directory exists', path: path.join(TARGET_DIR, '.agents'), type: 'dir' },
    { name: 'Agent personas (.agents/agents/)', path: path.join(TARGET_DIR, '.agents', 'agents'), type: 'dir' },
    { name: 'Specialist skills (.agents/skills/)', path: path.join(TARGET_DIR, '.agents', 'skills'), type: 'dir' },
    { name: 'Commit script (.agents/scripts/commit.sh)', path: path.join(TARGET_DIR, '.agents', 'scripts', 'commit.sh'), type: 'file', exec: true },
    { name: 'Team roster (.agents/AGENTS.md)', path: path.join(TARGET_DIR, '.agents', 'AGENTS.md'), type: 'file' },
    { name: 'Coding standards (CODING_STANDARDS.md)', path: path.join(TARGET_DIR, 'CODING_STANDARDS.md'), type: 'file' },
    { name: 'Documentation (docs/)', path: path.join(TARGET_DIR, 'docs'), type: 'dir' }
  ];

  let passed = 0;
  checks.forEach(check => {
    const exists = fs.existsSync(check.path);
    if (exists) {
      let extra = '';
      if (check.exec) {
        try {
          fs.accessSync(check.path, fs.constants.X_OK);
          extra = ` ${colors.gray}(Executable: OK)${colors.reset}`;
        } catch (e) {
          extra = ` ${colors.red}(Not Executable! Run chmod +x)${colors.reset}`;
        }
      }
      console.log(`  [${colors.green}PASS${colors.reset}] ${check.name}${extra}`);
      passed++;
    } else {
      console.log(`  [${colors.red}FAIL${colors.reset}] ${check.name} ${colors.gray}(Missing)${colors.reset}`);
    }
  });

  console.log(`\nDiagnostic Summary: ${passed}/${checks.length} checks passed.`);
  if (passed === checks.length) {
    console.log(`${colors.green}${colors.bold}✨ Dev-OS is fully installed and operational!${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}⚠️  Some components are missing. Run ${colors.bold}npx devos init${colors.reset}${colors.yellow} to repair your setup.${colors.reset}\n`);
  }
}

// CLI Routing
const command = process.argv[2] || 'help';

switch (command) {
  case 'init':
    runInit();
    break;
  case 'list':
    runList();
    break;
  case 'doctor':
    runDoctor();
    break;
  case 'help':
  case '--help':
  case '-h':
  default:
    printHelp();
    break;
}
