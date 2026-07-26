/**
 * Dev-OS doctor — diagnose install health.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { colors, printHeader } = require('./colors');
const { configPath } = require('./config');

/**
 * @param {string} targetDir
 * @returns {{ passed: number, total: number, ok: boolean }}
 */
function runDoctor(targetDir) {
  const dir = targetDir || process.cwd();
  printHeader();
  console.log(`${colors.bold}Running Dev-OS Diagnostic Check on: ${dir}${colors.reset}\n`);

  const gitignorePath = path.join(dir, '.gitignore');
  const gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';

  const checks = [
    { name: '.agents/ directory exists', path: path.join(dir, '.agents'), type: 'dir' },
    { name: 'Agent personas (.agents/agents/)', path: path.join(dir, '.agents', 'agents'), type: 'dir' },
    { name: 'Specialist skills (.agents/skills/)', path: path.join(dir, '.agents', 'skills'), type: 'dir' },
    {
      name: 'Commit script (.agents/scripts/commit.sh)',
      path: path.join(dir, '.agents', 'scripts', 'commit.sh'),
      type: 'file',
      exec: true
    },
    { name: 'Team roster (.agents/AGENTS.md)', path: path.join(dir, '.agents', 'AGENTS.md'), type: 'file' },
    { name: 'Project config (.agents/project.json)', path: configPath(dir), type: 'file' },
    { name: 'Coding standards (CODING_STANDARDS.md)', path: path.join(dir, 'CODING_STANDARDS.md'), type: 'file' },
    { name: 'Documentation (docs/)', path: path.join(dir, 'docs'), type: 'dir' },
    {
      name: '.gitignore includes .agents/_backup/',
      type: 'custom',
      pass: gitignore.includes('.agents/_backup')
    },
    {
      name: '.gitignore includes .agents/knowledge/',
      type: 'custom',
      pass: gitignore.includes('.agents/knowledge')
    }
  ];

  let passed = 0;
  checks.forEach((check) => {
    let ok = false;
    let extra = '';
    if (check.type === 'custom') {
      ok = Boolean(check.pass);
    } else {
      ok = fs.existsSync(check.path);
      if (ok && check.exec) {
        try {
          fs.accessSync(check.path, fs.constants.X_OK);
          extra = ` ${colors.gray}(Executable: OK)${colors.reset}`;
        } catch {
          extra = ` ${colors.red}(Not Executable! Run chmod +x)${colors.reset}`;
        }
      }
    }

    if (ok) {
      console.log(`  [${colors.green}PASS${colors.reset}] ${check.name}${extra}`);
      passed++;
    } else {
      console.log(`  [${colors.red}FAIL${colors.reset}] ${check.name} ${colors.gray}(Missing)${colors.reset}`);
    }
  });

  console.log(`\nDiagnostic Summary: ${passed}/${checks.length} checks passed.`);
  const allOk = passed === checks.length;
  if (allOk) {
    console.log(`${colors.green}${colors.bold}Dev-OS is fully installed and operational!${colors.reset}\n`);
  } else {
    console.log(
      `${colors.yellow}Some components are missing. Run ${colors.bold}npx devos init${colors.reset}${colors.yellow} to repair your setup.${colors.reset}\n`
    );
  }

  return { passed, total: checks.length, ok: allOk };
}

module.exports = { runDoctor };
