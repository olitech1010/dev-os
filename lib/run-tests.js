/**
 * `devos test` — run the project's test suite.
 * Uses `.agents/project.json` → commands.test when present; falls back to `bun test`.
 */

'use strict';

const { spawnSync } = require('child_process');
const { readProjectConfig } = require('./config');
const { colors } = require('./colors');

/**
 * @param {string} targetDir
 * @returns {string}
 */
function resolveTestCommand(targetDir) {
  const config = readProjectConfig(targetDir);
  if (config && config.commands && config.commands.test) {
    return config.commands.test;
  }
  return 'bun test';
}

/**
 * @param {string} targetDir
 * @returns {number} exit code
 */
function runTests(targetDir) {
  const dir = targetDir || process.cwd();
  const command = resolveTestCommand(dir);
  console.log(`${colors.bold}Running tests:${colors.reset} ${colors.green}${command}${colors.reset}\n`);
  const result = spawnSync(command, {
    shell: true,
    stdio: 'inherit',
    cwd: dir
  });
  if (result.error) {
    console.error(`${colors.red}Failed to run "${command}": ${result.error.message}${colors.reset}`);
    return 1;
  }
  return result.status === null ? 1 : result.status;
}

module.exports = { resolveTestCommand, runTests };
