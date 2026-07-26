/**
 * Dev-OS init — detect → confirm → install agents → project.json → opt-in patches.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { colors, printHeader } = require('./colors');
const { detectProject } = require('./detect');
const { getStacks, getStack, docsForLibrary } = require('./registry');
const { writeProjectConfig } = require('./config');
const { copyRecursiveSync, ensureGitignore, mergePackageScripts } = require('./fs-utils');

/**
 * @param {readline.Interface} rl
 * @param {string} query
 */
function question(rl, query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

/**
 * @param {import('./detect').DetectionResult} detection
 * @param {boolean} interactive
 * @param {{ stack?: string, isFresh?: boolean, libraries?: string[], applyPatches?: boolean }} [overrides]
 */
async function confirmSetup(detection, interactive, overrides) {
  const stacks = getStacks();
  let isFresh = overrides && typeof overrides.isFresh === 'boolean' ? overrides.isFresh : detection.empty;
  let stackId = (overrides && overrides.stack) || detection.stack;
  let libraries = (overrides && overrides.libraries) || detection.libraries.slice();
  let applyPatches = overrides && typeof overrides.applyPatches === 'boolean' ? overrides.applyPatches : false;

  if (!interactive) {
    const stack = getStack(stackId) || getStack('universal');
    return {
      isFresh,
      stackId: stack.id,
      runtime: detection.runtime,
      libraries,
      commands: detection.commands,
      docsSources: detection.docsSources,
      depth: stack.depth,
      platform: stack.platform,
      applyPatches
    };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(`\n${colors.bold}Detected project:${colors.reset}`);
  console.log(`  Platform : ${detection.platform}`);
  console.log(`  Stack    : ${detection.stack}${detection.matchedStacks.length > 1 ? ` (also matched: ${detection.matchedStacks.join(', ')})` : ''}`);
  console.log(`  Runtime  : ${detection.runtime}`);
  console.log(`  Libraries: ${libraries.length ? libraries.join(', ') : '(none)'}`);
  console.log(`  Lint     : ${detection.commands.lint}`);
  console.log(`  Test     : ${detection.commands.test}  ${colors.gray}(Tester)${colors.reset}`);
  console.log(`  QA       : ${detection.commands.qa}  ${colors.gray}(QA agent)${colors.reset}`);
  console.log(`  Empty    : ${detection.empty ? 'yes' : 'no'}`);

  console.log(`\n${colors.bold}Step 1: Fresh or Existing project?${colors.reset}`);
  console.log(`  1) Fresh Project (docs + standards)`);
  console.log(`  2) Existing Project (preserve custom standards/docs)`);
  const projAns = await question(
    rl,
    `\n${colors.cyan}Enter choice [1-2] (default ${isFresh ? '1' : '2'}): ${colors.reset}`
  );
  if (projAns.trim() === '1') isFresh = true;
  else if (projAns.trim() === '2') isFresh = false;

  console.log(`\n${colors.bold}Step 2: Confirm technology stack${colors.reset}`);
  stacks.forEach((s, i) => {
    const mark = s.id === stackId ? ' *' : '';
    console.log(`  ${i + 1}) [${s.depth}] ${s.label}${mark}`);
  });
  const stackAns = await question(
    rl,
    `\n${colors.cyan}Enter choice [1-${stacks.length}] (default detected ${stackId}): ${colors.reset}`
  );
  const idx = parseInt(stackAns.trim(), 10);
  if (!Number.isNaN(idx) && idx >= 1 && idx <= stacks.length) {
    stackId = stacks[idx - 1].id;
  }

  const libAns = await question(
    rl,
    `\n${colors.cyan}Libraries (comma-separated, Enter to keep): ${colors.reset}`
  );
  if (libAns.trim()) {
    libraries = libAns
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const patchAns = await question(
    rl,
    `\n${colors.cyan}Opt-in: merge missing package.json test/qa scripts if absent? [y/N]: ${colors.reset}`
  );
  applyPatches = /^y(es)?$/i.test(patchAns.trim());

  rl.close();

  const stack = getStack(stackId) || getStack('universal');
  const docsSources = [];
  const seen = new Set();
  for (const src of stack.docsSources || []) {
    docsSources.push({ ...src });
    seen.add(src.id);
  }
  for (const lib of libraries) {
    const src = docsForLibrary(lib);
    if (src && !seen.has(src.id)) {
      docsSources.push(src);
      seen.add(src.id);
    } else if (!src && !seen.has(lib)) {
      // Placeholder: Researcher must resolve official docs URL on first use
      docsSources.push({
        id: lib.replace(/[^a-zA-Z0-9._-]/g, '_'),
        url: '',
        version: 'latest'
      });
      seen.add(lib);
    }
  }

  let commands = { ...detection.commands };
  if (stack.commands) {
    commands = {
      lint: detection.commands.lint || stack.commands.lint,
      test: detection.commands.test || stack.commands.test,
      qa: detection.commands.qa || stack.commands.qa || stack.commands.lint
    };
  }

  return {
    isFresh,
    stackId: stack.id,
    runtime: detection.runtime,
    libraries,
    commands,
    docsSources,
    depth: stack.depth,
    platform: stack.platform,
    applyPatches
  };
}

/**
 * @param {{ templateDir: string, targetDir: string, interactive?: boolean, overrides?: object }} options
 */
async function runInit(options) {
  const templateDir = options.templateDir;
  const targetDir = options.targetDir;
  const interactive = options.interactive !== false;

  printHeader();

  if (templateDir === targetDir) {
    console.log(
      `${colors.yellow}Notice: You are running init inside the Dev-OS source repository itself.${colors.reset}\n`
    );
  }

  const detection = detectProject(targetDir);
  const setup = await confirmSetup(detection, interactive, options.overrides || {});

  console.log(
    `\n${colors.cyan}Setting up Dev-OS (${setup.isFresh ? 'Fresh Project' : 'Existing Project'}) with [${setup.stackId.toUpperCase()}] / runtime=${setup.runtime}...${colors.reset}\n`
  );

  console.log(`${colors.gray}• Installing agent roster and skills into .agents/...${colors.reset}`);
  const srcAgents = path.join(templateDir, '.agents');
  const destAgents = path.join(targetDir, '.agents');
  copyRecursiveSync(srcAgents, destAgents);

  console.log(`${colors.gray}• Configuring human-in-the-loop commit script permissions...${colors.reset}`);
  const commitScriptPath = path.join(destAgents, 'scripts', 'commit.sh');
  if (fs.existsSync(commitScriptPath)) {
    try {
      fs.chmodSync(commitScriptPath, '755');
    } catch (e) {
      console.log(`${colors.yellow}  Warning: Could not set chmod 755 on commit.sh: ${e.message}${colors.reset}`);
    }
  }

  if (setup.isFresh || !fs.existsSync(path.join(targetDir, 'docs'))) {
    console.log(`${colors.gray}• Installing project documentation into docs/...${colors.reset}`);
    copyRecursiveSync(path.join(templateDir, 'docs'), path.join(targetDir, 'docs'));
  } else {
    console.log(`${colors.gray}• Existing project: Preserving your custom docs/ directory...${colors.reset}`);
  }

  const targetStandards = path.join(targetDir, 'CODING_STANDARDS.md');
  if (setup.isFresh || !fs.existsSync(targetStandards)) {
    console.log(`${colors.gray}• Setting up CODING_STANDARDS.md for [${setup.stackId.toUpperCase()}]...${colors.reset}`);
    let srcStandards = path.join(templateDir, 'CODING_STANDARDS.md');
    const stack = getStack(setup.stackId);
    if (stack && stack.standardsFile) {
      const stackFile = path.join(destAgents, 'skills', 'stacks', stack.standardsFile);
      if (fs.existsSync(stackFile)) srcStandards = stackFile;
    }
    if (fs.existsSync(srcStandards)) {
      fs.copyFileSync(srcStandards, targetStandards);
    }
  } else {
    console.log(`${colors.gray}• Existing project: Preserving your customized CODING_STANDARDS.md...${colors.reset}`);
  }

  console.log(`${colors.gray}• Writing .agents/project.json...${colors.reset}`);
  writeProjectConfig(targetDir, {
    platform: setup.platform,
    stack: setup.stackId,
    runtime: setup.runtime,
    libraries: setup.libraries,
    commands: setup.commands,
    docsSources: setup.docsSources,
    depth: setup.depth
  });

  console.log(`${colors.gray}• Checking .gitignore rules...${colors.reset}`);
  ensureGitignore(targetDir, ['.agents/_backup/', '.agents/knowledge/']);

  if (setup.applyPatches) {
    console.log(`${colors.gray}• Opt-in host patches: merging missing package.json scripts...${colors.reset}`);
    const pkgPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const toAdd = {};
      // Only add a test script when we have a safe, runtime-native default; never invent lint/qa tooling.
      if (setup.runtime === 'bun') {
        toAdd.test = 'bun test';
      }
      const result = mergePackageScripts(targetDir, toAdd);
      if (result.added.length) {
        console.log(`  ${colors.green}Added scripts: ${result.added.join(', ')}${colors.reset}`);
      }
      if (result.skipped.length) {
        console.log(`  ${colors.gray}Preserved existing scripts: ${result.skipped.join(', ')}${colors.reset}`);
      }
      if (!result.added.length && !result.skipped.length) {
        console.log(`  ${colors.gray}No scripts to add for this runtime.${colors.reset}`);
      }
    } else {
      console.log(`  ${colors.gray}No package.json — skipped script merge.${colors.reset}`);
    }
  }

  console.log(`\n${colors.green}${colors.bold}Dev-OS successfully installed and configured!${colors.reset}\n`);
  console.log(`${colors.bold}Installed Components:${colors.reset}`);
  console.log(`  • ${colors.cyan}.agents/agents/${colors.reset}   -> Specialized AI Personas`);
  console.log(`  • ${colors.cyan}.agents/skills/${colors.reset}   -> Reusable AI Engineering Skills`);
  console.log(`  • ${colors.cyan}.agents/project.json${colors.reset} -> Stack=${setup.stackId}, Runtime=${setup.runtime}`);
  console.log(`  • ${colors.cyan}.agents/scripts/${colors.reset}  -> Human-in-the-Loop Commit Gate`);
  console.log(`  • ${colors.cyan}CODING_STANDARDS.md${colors.reset} -> Configured for ${setup.stackId}\n`);
  console.log(`${colors.bold}Docs knowledge:${colors.reset}`);
  console.log(`  Run ${colors.green}devos sync-docs${colors.reset} to cache official docs into .agents/knowledge/\n`);
  console.log(`${colors.bold}How Future Updates Work:${colors.reset}`);
  console.log(`  ${colors.green}npx devos@latest init${colors.reset} refreshes .agents/ while preserving project code & custom standards.\n`);
  console.log(`${colors.bold}Next Steps:${colors.reset}`);
  console.log(
    `  1. Open your AI engineering IDE (Claude Code, Cursor, etc.).`
  );
  console.log(
    `  2. Prompt the Orchestrator: ${colors.yellow}"Use your grill-me skill to brainstorm our project requirements."${colors.reset}`
  );
  console.log(`  3. Build autonomously with confidence!\n`);

  return setup;
}

module.exports = { runInit, confirmSetup };
