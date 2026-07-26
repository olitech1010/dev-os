#!/usr/bin/env node

/**
 * Olives Technologies Dev-OS CLI ('devos')
 * Zero runtime npm dependencies — works with any Node-compatible runtime.
 */

'use strict';

const path = require('path');
const { colors, printHeader } = require('../lib/colors');
const { runInit } = require('../lib/init');
const { runDoctor } = require('../lib/doctor');
const { syncDocs } = require('../lib/sync-docs');
const { getStacks } = require('../lib/registry');
const fs = require('fs');

const TEMPLATE_DIR = path.resolve(__dirname, '..');
const TARGET_DIR = process.cwd();

function printHelp() {
  printHeader();
  console.log(`Usage: ${colors.bold}devos <command> [options]${colors.reset}\n`);
  console.log('Commands:');
  console.log(`  ${colors.green}init${colors.reset}        Initialize or update Dev-OS in the current project`);
  console.log(`  ${colors.green}sync-docs${colors.reset}   Fetch allowlisted docs into .agents/knowledge/`);
  console.log(`  ${colors.green}list${colors.reset}        List agents, skills, and catalog stacks`);
  console.log(`  ${colors.green}doctor${colors.reset}      Diagnose current project's Dev-OS setup`);
  console.log(`  ${colors.green}help${colors.reset}        Show this help message\n`);
  console.log('Examples:');
  console.log(`  $ npx devos init`);
  console.log(`  $ npx devos sync-docs`);
  console.log(`  $ npx devos doctor\n`);
}

function runList() {
  printHeader();
  console.log(`${colors.bold}Available Dev-OS AI Agents:${colors.reset}`);
  const agentsDir = path.join(TEMPLATE_DIR, '.agents', 'agents');
  if (fs.existsSync(agentsDir)) {
    fs.readdirSync(agentsDir).forEach((file) => {
      if (file.endsWith('.md')) {
        console.log(`  * ${colors.cyan}${file.replace('.md', '')}${colors.reset}`);
      }
    });
  }

  console.log(`\n${colors.bold}Catalog stacks:${colors.reset}`);
  getStacks().forEach((s) => {
    console.log(`  * ${colors.magenta}${s.id}${colors.reset} [${s.platform}/${s.depth}] — ${s.label}`);
  });

  console.log(`\n${colors.bold}Installed Specialist Skills:${colors.reset}`);
  const skillsDir = path.join(TEMPLATE_DIR, '.agents', 'skills');
  if (fs.existsSync(skillsDir)) {
    fs.readdirSync(skillsDir).forEach((file) => {
      const skillPath = path.join(skillsDir, file);
      if (fs.statSync(skillPath).isDirectory()) {
        console.log(`  * ${colors.green}${file}${colors.reset}`);
      }
    });
  }
  console.log();
}

async function main() {
  const command = process.argv[2] || 'help';
  const nonInteractive = process.argv.includes('--yes') || process.argv.includes('-y');

  switch (command) {
    case 'init':
      await runInit({
        templateDir: TEMPLATE_DIR,
        targetDir: TARGET_DIR,
        interactive: !nonInteractive,
        overrides: nonInteractive ? { applyPatches: false } : undefined
      });
      break;
    case 'sync-docs':
      printHeader();
      console.log(`${colors.bold}Syncing docs knowledge cache...${colors.reset}\n`);
      await syncDocs(TARGET_DIR);
      console.log();
      break;
    case 'list':
      runList();
      break;
    case 'doctor':
      runDoctor(TARGET_DIR);
      break;
    case 'help':
    case '--help':
    case '-h':
    default:
      printHelp();
      break;
  }
}

main().catch((err) => {
  console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
  process.exit(1);
});
