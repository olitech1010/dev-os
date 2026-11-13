#!/usr/bin/env node
'use strict';

/**
 * Dev-OS cross-platform hook launcher.
 *
 * Every harness config calls this instead of naming a shell itself. Before it
 * existed, Claude Code was wired to run `.agents/hooks/<script>.sh` directly
 * (a shebang is a kernel feature that cmd.exe does not honour) and every other
 * harness got `sh -c '...'` (no `sh` on PATH, and POSIX quoting cmd.exe does not
 * parse). Both fail on Windows on EVERY tool call, and because Cursor's
 * preToolUse is failClosed and Antigravity requires an explicit decision, a hook
 * that cannot start denies the call. The gate meant to stop destructive commands
 * stopped all work instead.
 *
 * Node is the one runtime guaranteed present: a machine that can run `devos` can
 * run this. It finds a POSIX shell, hands it the script, and proxies stdin,
 * stdout, stderr and the exit code untouched. Finding no shell at all is a
 * deliberate exit 0 (see failOpen below).
 *
 * Usage: node run.js <script.sh> <harness-format>
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Git for Windows installs bash at these paths and ships with git, so a Windows
// machine that can clone a repository almost always has one of them.
function gitBashCandidates(env) {
  const roots = [env.ProgramFiles, env['ProgramFiles(x86)'], env.ProgramW6432,
    'C:\\Program Files', 'C:\\Program Files (x86)'].filter(Boolean);
  const out = [];
  roots.forEach((r) => {
    out.push(path.win32.join(r, 'Git', 'bin', 'bash.exe'));
    out.push(path.win32.join(r, 'Git', 'usr', 'bin', 'bash.exe'));
  });
  out.push('C:\\msys64\\usr\\bin\\bash.exe');
  return out;
}

/**
 * Pure over (platform, env, exists) so Windows resolution is testable anywhere.
 * Returns an absolute shell path, or null when the machine has no POSIX shell.
 */
function resolveHookShell(platform, env, exists) {
  const e = env || {};
  const has = exists || ((p) => { try { return fs.statSync(p).isFile(); } catch (err) { return false; } });
  const win = platform === 'win32';
  const join = win ? path.win32.join : path.posix.join;

  if (e.DEVOS_SHELL && has(e.DEVOS_SHELL)) return e.DEVOS_SHELL;

  const dirs = String(e.PATH || e.Path || '').split(win ? ';' : ':').filter(Boolean);
  const exts = win ? ['.exe', ''] : [''];
  for (const name of ['bash', 'sh']) {
    for (const dir of dirs) {
      for (const ext of exts) {
        const candidate = join(dir, name + ext);
        if (has(candidate)) return candidate;
      }
    }
  }

  if (win) {
    for (const candidate of gitBashCandidates(e)) {
      if (has(candidate)) return candidate;
    }
  }
  return null;
}

// Git Bash and MSYS want /c/dev/app, not C:\dev\app.
function toShellPath(p, platform) {
  if (platform !== 'win32') return p;
  const drive = /^([A-Za-z]):[\\/]/.exec(p);
  const forward = String(p).replace(/\\/g, '/');
  return drive ? '/' + drive[1].toLowerCase() + forward.slice(2) : forward;
}

// Walk up for the directory that holds .agents/hooks/. Avoids spawning git just
// to learn where we are, which would be a second process on every tool call.
function findProjectRoot(start, env) {
  const seed = (env && env.CLAUDE_PROJECT_DIR) || start;
  let dir = path.resolve(seed);
  for (let i = 0; i < 40; i++) {
    if (fs.existsSync(path.join(dir, '.agents', 'hooks'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return path.resolve(start);
}

function shellQuote(p) {
  return "'" + String(p).replace(/'/g, "'\\''") + "'";
}

// Exit 0, never 2. A gate that cannot run must not deny every tool call: that is
// how Dev-OS gets uninstalled rather than fixed. The line below is the only
// signal, and `devos doctor` reports the same condition.
function failOpen(message) {
  process.stderr.write('[ WARN ] Dev-OS hook gates are INACTIVE: ' + message + '\n');
  process.exit(0);
}

function main(argv, env, platform) {
  const args = argv.filter((a) => a !== '--plugin');
  const pluginMode = argv.length !== args.length;
  const script = args[0];
  const format = args[1] || 'claude';
  if (!script) failOpen('no hook script was named.');

  const root = findProjectRoot(process.cwd(), env);
  // The hook scripts always sit beside this file: .agents/hooks/ in a project
  // install, hooks/ in the plugin. Resolving from __dirname rather than from the
  // project root means a drifted cwd cannot lose them.
  const scriptPath = path.join(__dirname, script);
  if (!fs.existsSync(scriptPath)) {
    // An uninstalled or half-updated Dev-OS must not block the session.
    failOpen('hook script not found: ' + scriptPath);
  }

  const shell = resolveHookShell(platform, env);
  if (!shell) {
    failOpen('no POSIX shell found on this machine. Install Git for Windows (it ships bash), '
      + 'or set DEVOS_SHELL to a bash executable. Run `devos doctor` for details.');
  }

  const res = spawnSync(shell, ['-c', 'exec ' + shellQuote(toShellPath(scriptPath, platform))], {
    stdio: 'inherit',
    env: Object.assign({}, env, {
      DEVOS_HOOK_FORMAT: format,
      DEVOS_PROJECT_ROOT: root,
      DEVOS_PLUGIN_MODE: pluginMode ? '1' : (env.DEVOS_PLUGIN_MODE || ''),
      CLAUDE_PROJECT_DIR: env.CLAUDE_PROJECT_DIR || root
    })
  });

  if (res.error) failOpen('could not start ' + shell + ': ' + res.error.message);
  // A signalled child has a null status; treat it as "no decision", not a denial.
  process.exit(typeof res.status === 'number' ? res.status : 0);
}

if (require.main === module) {
  main(process.argv.slice(2), process.env, process.platform);
}

module.exports = { resolveHookShell, toShellPath, findProjectRoot, gitBashCandidates };
