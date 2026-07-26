/**
 * Terminal colors for Dev-OS CLI.
 */

'use strict';

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

function printHeader() {
  console.log(`${colors.cyan}${colors.bold}`);
  console.log('========================================================');
  console.log('            Olives Technologies Dev-OS             ');
  console.log('      Autonomous Multi-Agent Engineering Environment     ');
  console.log('========================================================');
  console.log(`${colors.reset}`);
}

module.exports = { colors, printHeader };
