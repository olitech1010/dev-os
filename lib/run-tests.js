/**
 * Suite runners for agent roles.
 * - `devos test` → Tester agent → commands.test
 * - `devos qa`   → QA agent     → commands.qa
 */

'use strict';

const { spawnSync } = require('child_process');
const { readProjectConfig } = require('./config');
const { colors } = require('./colors');

/** @typedef {'test'|'qa'} SuiteRole */

const DEFAULTS = {
  test: 'bun test',
  qa: 'npm run lint'
};

/**
 * @param {string} targetDir
 * @param {SuiteRole} role
 * @returns {string}
 */
function resolveSuiteCommand(targetDir, role) {
  const config = readProjectConfig(targetDir);
  if (config && config.commands && config.commands[role]) {
    return config.commands[role];
  }
  return DEFAULTS[role] || DEFAULTS.test;
}

/**
 * @param {string} targetDir
 * @param {SuiteRole} role
 * @returns {number} exit code
 */
function runSuite(targetDir, role) {
  const dir = targetDir || process.cwd();
  const label = role === 'qa' ? 'QA checks' : 'tests';
  const command = resolveSuiteCommand(dir, role);
  console.log(
    `${colors.bold}Running ${label} (${role}):${colors.reset} ${colors.green}${command}${colors.reset}\n`
  );
  const result = spawnSync(command, {
    shell: true,
    stdio: 'inherit',
    cwd: dir
  });
  if (result.error) {
    console.error(
      `${colors.red}Failed to run "${command}": ${result.error.message}${colors.reset}`
    );
    return 1;
  }
  return result.status === null ? 1 : result.status;
}

/** @deprecated use resolveSuiteCommand(dir, 'test') */
function resolveTestCommand(targetDir) {
  return resolveSuiteCommand(targetDir, 'test');
}

/** @deprecated use runSuite(dir, 'test') */
function runTests(targetDir) {
  return runSuite(targetDir, 'test');
}

module.exports = {
  resolveSuiteCommand,
  runSuite,
  resolveTestCommand,
  runTests
};
