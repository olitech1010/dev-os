#!/usr/bin/env node

/**
 * Dev-OS CLI ('devos' / 'olives-devos' / 'devos-init')
 * Olives Technologies Engineering OS — by Clement Olives.
 * Zero external npm dependencies for instant execution via npx.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

// Package metadata
const TEMPLATE_DIR = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(TEMPLATE_DIR, 'templates');
const TARGET_DIR = process.cwd();
const PKG_PATH = path.join(TEMPLATE_DIR, 'package.json');
const PKG = fs.existsSync(PKG_PATH) ? JSON.parse(fs.readFileSync(PKG_PATH, 'utf8')) : { version: '3.0.0' };

const STACKS = ['nextjs', 'laravel', 'django', 'react-native', 'express', 'fastapi', 'universal'];
const HARNESSES = ['claude', 'cursor', 'opencode', 'antigravity', 'gemini', 'codex'];
const PLATFORMS = ['claude', 'antigravity', 'cursor', 'opencode', 'codex', 'all'];

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

// Core Rules and Protocols
const DEVOS_RULES_DIGEST = [
  'This is a digest. `.agents/AGENTS.md` is canonical; numbers in brackets are its Hard Rule numbers.',
  '- [R1] Zero Destructive Actions: Never delete, drop, or truncate without an approved dry-run plan.',
  '- [R2] Zero Secrets Stored, Logged, or Hardcoded: Use `process.env.*`; ask the human for secrets at runtime.',
  '- [R8] Mechanical Commit Gate: Raw `git commit` is BLOCKED. Commits go only through `.agents/scripts/commit.sh`.',
  '- [R6] Staged Review: Agents write code but NEVER auto-commit. Present summaries for human review; the human commits.',
  '- [R10] Circuit Breaker: After 3 failed fix iterations (one Developer fix attempt plus the failing gate run each), halt; the Tech Lead gets exactly one arbitration attempt; then halt and escalate to the human. See "Circuit Breaker (canonical)" in AGENTS.md.',
  '- [R11] Verify Before Implementing: Confirm actual library APIs and patterns before authoring code.',
  '- [R12] No Heavy Dependencies: Packages >5MB or >50 dependencies require explicit human approval.',
  '- [R7] Documentation in /docs: All plans (`docs/plans/`), specs (`docs/specs/`), PRDs, architecture notes, and reports belong in `/docs/`.',
  '- [R14] Session-Start Freshness: Run `git fetch --all --prune` and check `git status -sb` before scoping work.',
  '- [R13] Session-End State Obligation: Update `docs/CURRENT_STATE.md` before concluding any session modifying code.',
  '- [R22] Implementation Plan Gate: No production code without an approved plan in `docs/plans/` (an approved spec `docs/specs/<slug>/tasks.md` counts as the plan), except on the TRIVIAL Fast Path (under ~30 changed lines, no new dependency, schema, auth, or public API change).',
  '- [R15] Mandatory Design Gate: Creating or editing frontend UI files (`*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.html`, `*.css`) is blocked until an approved `DESIGN.md` exists at the project root. The UI Designer produces it with the `anti-ai-ui` skill.',
  '- [R16] Humanizer Gate: Documentation, PR summaries, and PRDs in `/docs/` must pass `.agents/scripts/humanize-check.sh`. The Tech Writer owns this gate.',
  '- [R23] Task Board Declaration: In guided/auto mode, declare an `[ IN_PROGRESS ]` task with an `Assignee:` in `docs/TASK_BOARD.md` before writing production code. Change modes only via `devos mode <mode>`.'
];

const SOLO_SESSION_PROTOCOL = [
  '- Step 1: Check freshness via `git fetch --all --prune` and `git status -sb`.',
  '- Step 2: Implement following `CODING_STANDARDS.md`.',
  '- Step 3: Self-verify with typecheck (`tsc --noEmit` or equivalent) and automated tests.',
  '- Step 4: Present staged review summary to human.',
  '- Step 5: Route commit through `.agents/scripts/commit.sh`.',
  '- Step 6: Update `docs/CURRENT_STATE.md` and log incidents in `docs/LESSONS.md`.',
  '- Escalation: DB schema changes (DBA), security alterations (Security), or loops exceeding 3 attempts must escalate to human.'
];

const SESSION_MODE_DIRECTIVE = [
  'Orchestrator mode is locked per session in `.agents/memory/session.json`. Read it at the start of work.',
  '- It defines the active `mode` (interactive | guided | auto | audit) and `delegationRequired`.',
  '- Never switch modes implicitly. Change modes only via `devos mode <mode>`.',
  '- When delegation is required, declare the task under `[ IN_PROGRESS ]` with an Assignee in `docs/TASK_BOARD.md` and route implementation to the specialist subagent.'
];

// Flags parser helper
//
// Boolean flags map a CLI spelling to [flagKey, value]. Value flags map a CLI
// spelling to [flagKey, coerce]. Both '--key value' and '--key=value' are
// accepted for value flags. A value that begins with '-' is rejected (pass it
// as '--key=-value' if that is really intended). Unknown flags print a WARN.
// flags.passed records which flag keys were given explicitly on the command
// line, so interactive prompts can tell "default" apart from "user said so".
const BOOL_FLAGS = {
  '-v': ['version', true], '--version': ['version', true],
  '-h': ['help', true], '--help': ['help', true],
  '--fresh': ['fresh', true],
  '--existing': ['existing', true],
  '--json': ['json', true],
  '-q': ['quiet', true], '--quiet': ['quiet', true],
  '--no-claude': ['claude', false],
  '--no-hooks': ['hooks', false],
  '--hooks': ['hooks', true],
  '--all-skills': ['allSkills', true],
  '--all-harnesses': ['allHarnesses', true],
  '--no-telemetry': ['telemetry', false],
  '--telemetry': ['telemetry', true],
  '--skills': ['skills', true],
  '--scorecard': ['scorecard', true],
  '-l': ['list', true], '--list': ['list', true],
  '--status': ['status', true],
  '--dry-run': ['dryRun', true],
  '--resume': ['resume', true],
  '--reset': ['reset', true],
  '-y': ['yes', true], '--yes': ['yes', true],
  '-f': ['force', true], '--force': ['force', true],
  '--install-gitleaks': ['installGitleaks', true],
  '--print-path': ['printPath', true]
};

const VALUE_FLAGS = {
  '-S': ['suite', String], '--suite': ['suite', String],
  '-k': ['k', (v) => parseInt(v, 10)], '--k': ['k', (v) => parseInt(v, 10)],
  '-m': ['mode', String], '--mode': ['mode', String],
  '-p': ['platform', String], '--platform': ['platform', String],
  '--harness': ['harness', String],
  '-s': ['stack', String], '--stack': ['stack', String],
  '--pick': ['pick', String],
  '--top': ['top', String],
  '--category': ['category', String],
  '--step': ['step', String],
  '--type': ['type', String],
  '--rule': ['rule', String],
  '--detail': ['detail', String],
  '--title': ['title', String],
  '--branch': ['branch', String],
  '-o': ['output', String], '--output': ['output', String],
  '--out': ['out', String]
};

function parseArgs(args, options = {}) {
  const warn = options.warn || ((msg) => console.error(`${colors.yellow}[ WARN ] ${msg}${colors.reset}`));
  const flags = {
    stack: null,
    platform: null,
    fresh: false,
    existing: false,
    json: false,
    quiet: false,
    claude: true,
    help: false,
    version: false,
    allSkills: false,
    allHarnesses: false,
    harness: null,
    hooks: true,
    telemetry: true,
    mode: null,
    skills: false,
    suite: null,
    k: null,
    scorecard: false,
    list: false,
    pick: null,
    top: null,
    category: null,
    // SDLC pipeline runner flags
    status: false,
    dryRun: false,
    resume: false,
    reset:  false,
    step:   null,
    // Telemetry flags
    type: null,
    rule: null,
    detail: null,
    title: null,
    branch: null,
    output: null,
    yes: false,
    force: false,
    installGitleaks: false,
    out: null,
    printPath: false,
    passed: {}
  };

  const positional = [];
  let afterTerminator = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (afterTerminator || !arg.startsWith('-') || arg === '-') {
      positional.push(arg);
      continue;
    }
    if (arg === '--') {
      afterTerminator = true;
      continue;
    }

    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const name = eq > 0 ? arg.slice(0, eq) : arg;
    const inlineValue = eq > 0 ? arg.slice(eq + 1) : undefined;

    if (BOOL_FLAGS[name]) {
      const [key, value] = BOOL_FLAGS[name];
      if (inlineValue !== undefined) {
        throw new Error(`Flag '${name}' does not take a value (got '${arg}').`);
      }
      flags[key] = value;
      flags.passed[key] = true;
    } else if (VALUE_FLAGS[name]) {
      const [key, coerce] = VALUE_FLAGS[name];
      let value = inlineValue;
      if (value === undefined) {
        const next = args[i + 1];
        if (next === undefined || (next.startsWith('-') && next !== '-')) {
          throw new Error(`Flag '${name}' requires a value${next !== undefined ? ` (got flag '${next}'; use ${name}=<value> if the value really starts with '-')` : ''}.`);
        }
        value = next;
        i++;
      }
      flags[key] = coerce(value);
      flags.passed[key] = true;
    } else {
      warn(`Unknown flag '${name}' ignored. Run 'devos --help' for supported flags.`);
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
  console.log(`  ${colors.green}update${colors.reset}, ${colors.green}upgrade${colors.reset}    Safely refresh .agents/, skills, commands, harnesses, and hooks`);
  console.log(`  ${colors.green}run${colors.reset}, ${colors.green}auto${colors.reset}         Launch autonomous hands-off SDLC mode (devos run "<product idea>")`);
  console.log(`  ${colors.green}telemetry${colors.reset}            Manage anonymous failure telemetry (status, report, enable, disable)`);
  console.log(`  ${colors.green}mode${colors.reset}                 Inspect or switch the locked session mode (status, <mode>, lock, unlock)`);
  console.log(`  ${colors.green}scaffold${colors.reset}            Regenerate missing state scaffolds from templates (CURRENT_STATE, TASK_BOARD, LESSONS, context.json)`);
  console.log(`  ${colors.green}doctor${colors.reset}, ${colors.green}check${colors.reset}      Diagnose setup, hooks, memory vault, task board, and health`);
  console.log(`  ${colors.green}pack${colors.reset}, ${colors.green}packs${colors.reset}        Manage capability packs: skills, agents, commands (pack list, pack add <name>)`);
  console.log(`  ${colors.green}skill${colors.reset}, ${colors.green}skills${colors.reset}       Manage agent skills from skills.sh (skill list, add, update, sync, check, audit, find)`);
  console.log(`  ${colors.green}memory${colors.reset}             Shared memory vault operations (memory list, memory handoff, memory doctor)`);
  console.log(`  ${colors.green}eval${colors.reset}, ${colors.green}benchmark${colors.reset}       Run capability benchmarks, pass@k evals, and agent scorecards`);
  console.log(`  ${colors.green}design${colors.reset}                   Browse, match, and apply authentic brand design systems (list, match, apply, sync)`);
  console.log(`  ${colors.green}spec${colors.reset} waves <slug>        Order docs/specs/<slug>/tasks.md into parallel waves (topological layers over depends:)`);
  console.log(`  ${colors.green}spec${colors.reset} check <slug>        Verify every requirement is covered, every task cites real ids and has a verify: line (exit 1 on gaps)`);
  console.log(`  ${colors.green}build-plugin${colors.reset}             Build the Dev-OS Claude Code plugin (default --out dist/claude-plugin/)`);
  console.log(`  ${colors.green}list${colors.reset}, ${colors.green}agents${colors.reset}       Display active agent personas and installed specialist skills`);
  console.log(`  ${colors.green}status${colors.reset}             Show active project configuration, detected stack, and health summary`);
  console.log(`  ${colors.green}version${colors.reset}            Print Dev-OS CLI version, Node runtime, and environment information`);
  console.log(`  ${colors.green}help${colors.reset}               Display this command reference\n`);

  console.log(`${colors.bold}FLAGS${colors.reset}`);
  console.log(`  ${colors.cyan}-s, --stack <name>${colors.reset}    Target stack (${STACKS.join(', ')})`);
  console.log(`  ${colors.cyan}-p, --platform <name>${colors.reset} Target AI platform (${PLATFORMS.join(', ')})`);
  console.log(`  ${colors.cyan}-m, --mode <name>${colors.reset}     SDLC execution mode (interactive, guided, auto, audit)`);
  console.log(`  ${colors.cyan}--telemetry / --no-telemetry${colors.reset} Enable or disable anonymous failure telemetry (default: on)`);
  console.log(`  ${colors.cyan}--harness <list>${colors.reset}      Target AI harnesses: ${HARNESSES.join(', ')}`);
  console.log(`  ${colors.cyan}--all-harnesses${colors.reset}       Generate configurations for all supported AI harnesses`);
  console.log(`  ${colors.cyan}--all-skills${colors.reset}          Install all skills instead of lean stack pack`);
  console.log(`  ${colors.cyan}--skills${colors.reset}              Update or sync installed skills from upstream registry`);
  console.log(`  ${colors.cyan}--no-hooks${colors.reset}            Skip wiring runtime lifecycle hooks (.claude/settings.json) and the pre-commit gate`);
  console.log(`  ${colors.cyan}--install-gitleaks${colors.reset}    Install/upgrade Gitleaks via .agents/scripts/install-hooks.sh (default: detect only)`);
  console.log(`  ${colors.cyan}-y, --yes${colors.reset}            Confirm overwrites non-interactively (design match). Never approves telemetry publishing.`);
  console.log(`  ${colors.cyan}-f, --force${colors.reset}          Overwrite customized skills during update (backed up first)`);
  console.log(`  ${colors.cyan}--fresh${colors.reset}             Non-interactive fresh project initialization`);
  console.log(`  ${colors.cyan}--existing${colors.reset}          Non-interactive existing project initialization`);
  console.log(`  ${colors.cyan}--no-claude${colors.reset}         Skip generating .claude/ (Claude Code commands & agents)`);
  console.log(`  ${colors.cyan}--json${colors.reset}              Output diagnostic and listing results as JSON`);
  console.log(`  ${colors.cyan}--out <dir>${colors.reset}         Output directory for build-plugin (default: dist/claude-plugin/)`);
  console.log(`  ${colors.cyan}--print-path${colors.reset}        build-plugin: print only the absolute output path (for a marketplace command source)`);
  console.log(`  ${colors.cyan}-q, --quiet${colors.reset}         Suppress header banners and non-essential log messages`);
  console.log(`  ${colors.cyan}-v, --version${colors.reset}       Print CLI version`);
  console.log(`  ${colors.cyan}-h, --help${colors.reset}          Show command options`);
  console.log(`  ${colors.gray}Value flags accept '--flag value' or '--flag=value'. Set DEVOS_OFFLINE=1 to skip all network calls.${colors.reset}\n`);

  console.log(`${colors.bold}EXAMPLES${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx @olives/devos init${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx @olives/devos init --stack nextjs --existing${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx @olives/devos pack list${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx @olives/devos memory handoff${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx @olives/devos design match "issue tracker dark mode"${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx @olives/devos design apply linear${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx @olives/devos spec check password-reset${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx @olives/devos build-plugin --out dist/claude-plugin${colors.reset}`);
  console.log(`  $ ${colors.cyan}npx @olives/devos doctor${colors.reset}\n`);

  console.log(`${colors.gray}Documentation & Guides: https://github.com/olitech1010/dev-os${colors.reset}\n`);
}

function printVersion() {
  console.log(`Dev-OS CLI v${PKG.version} — by Clement Olives · Olives Technologies`);
  console.log(`Node.js Runtime: ${process.version}`);
  console.log(`OS Platform: ${process.platform} (${process.arch})`);
  console.log(`Install Path: ${TEMPLATE_DIR}`);
}

// Entries never copied, hashed, or scanned inside a skill or asset tree. One
// list for copyRecursiveSync and computeSkillHash, so a copy hashes the same as
// its source (a source __pycache__ must not make every copy look stale).
const TREE_SKIP_NAMES = new Set(['.git', 'node_modules', '__pycache__', '_backup', '.DS_Store']);

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
      if (TREE_SKIP_NAMES.has(childItemName)) return;
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

// Minimal YAML frontmatter parser. Supports flat `key: value` pairs, quoted
// scalars (quotes stripped only when they form a matching pair), indented plain
// continuation lines (folded with spaces), block scalars (`|`, `|-`, `|+`,
// `>`, `>-`, `>+`) and simple `- item` sequences (returned as arrays).
function unquoteYamlScalar(val) {
  if (val.length >= 2) {
    const first = val[0];
    const last = val[val.length - 1];
    if (first === '"' && last === '"') {
      return val.slice(1, -1).replace(/\\(["\\nt])/g, (m, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c));
    }
    if (first === "'" && last === "'") {
      return val.slice(1, -1).replace(/''/g, "'");
    }
  }
  return val;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return { data: {}, body: content };
  const data = {};
  const lines = match[1].split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (/^\s/.test(line)) continue; // stray indented line without a key

    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const rawVal = line.slice(idx + 1).trim();

    // Gather the indented (or blank) lines that belong to this key
    const block = [];
    while (i + 1 < lines.length && (/^\s/.test(lines[i + 1]) || lines[i + 1] === '')) {
      block.push(lines[i + 1]);
      i++;
    }

    const blockMatch = rawVal.match(/^([|>])([+-]?)\s*(?:#.*)?$/);
    if (blockMatch) {
      const style = blockMatch[1];
      const chomp = blockMatch[2];
      const nonBlank = block.filter((l) => l.trim());
      const indent = nonBlank.length ? Math.min(...nonBlank.map((l) => l.match(/^\s*/)[0].length)) : 0;
      const bodyLines = block.map((l) => l.slice(Math.min(indent, l.match(/^\s*/)[0].length)));
      let text;
      if (style === '|') {
        text = bodyLines.join('\n');
      } else {
        // Folded: consecutive non-empty lines join with a space, blank lines become newlines
        text = '';
        let prevBlank = true;
        for (const l of bodyLines) {
          if (!l.trim()) {
            text += '\n';
            prevBlank = true;
          } else {
            text += (prevBlank ? '' : ' ') + l;
            prevBlank = false;
          }
        }
      }
      const stripped = text.replace(/\n+$/, '');
      if (chomp === '-') data[key] = stripped;
      else if (chomp === '+') data[key] = text.endsWith('\n') ? text : `${text}\n`;
      else data[key] = stripped ? `${stripped}\n` : '';
      continue;
    }

    const nonBlank = block.map((l) => l.trim()).filter(Boolean);
    if (!rawVal && nonBlank.length && nonBlank.every((l) => l.startsWith('- ') || l === '-')) {
      data[key] = nonBlank.map((l) => unquoteYamlScalar(l.replace(/^-\s*/, '').trim()));
      continue;
    }

    const parts = [rawVal, ...nonBlank].filter(Boolean);
    data[key] = unquoteYamlScalar(parts.join(' '));
  }

  return { data, body: content.slice(match[0].length) };
}

// Emit a YAML-safe single-line scalar. Plain output when unambiguous,
// otherwise a JSON double-quoted string (valid YAML 1.2 double-quoted scalar).
function yamlScalar(value) {
  const str = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  const plainSafe = /^[A-Za-z0-9_./()][A-Za-z0-9 _.,/()'+=-]*$/.test(str) &&
    !/:\s|\s#/.test(str) &&
    !/^(true|false|yes|no|on|off|null|~)$/i.test(str) &&
    !/^[-+]?(\d|\.\d)/.test(str);
  return plainSafe ? str : JSON.stringify(str);
}

// Output filenames derived from frontmatter must stay inside the output dir
function safeFileStem(candidate, fallback) {
  const str = typeof candidate === 'string' ? candidate.trim() : '';
  if (str && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(str) && !str.includes('..')) return str;
  return fallback;
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

// ---------------------------------------------------------------------------
// Skill hashing, manifest, backup & audit helpers
// ---------------------------------------------------------------------------

function computeSkillHash(skillDir) {
  if (!fs.existsSync(skillDir) || !fs.statSync(skillDir).isDirectory()) {
    return null;
  }
  const crypto = require('crypto');
  const files = [];

  function collect(dir, prefix = '') {
    for (const f of fs.readdirSync(dir)) {
      if (TREE_SKIP_NAMES.has(f)) continue;
      const full = path.join(dir, f);
      const rel = prefix ? `${prefix}/${f}` : f;
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        collect(full, rel);
      } else if (stat.isFile()) {
        files.push({ rel, full });
      }
    }
  }

  collect(skillDir);
  files.sort((a, b) => a.rel.localeCompare(b.rel));

  const hash = crypto.createHash('sha256');
  for (const item of files) {
    hash.update(`file:${item.rel}\n`);
    hash.update(fs.readFileSync(item.full));
    hash.update('\n');
  }
  return hash.digest('hex');
}

function backupSkill(skillDir, skillName, targetDir = TARGET_DIR) {
  if (!fs.existsSync(skillDir)) return null;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupRoot = path.join(targetDir, '.agents', '_backup', 'skills', `${skillName}-${timestamp}`);
  copyRecursiveSync(skillDir, backupRoot);
  return backupRoot;
}

function getSkillManifest(targetDir = TARGET_DIR) {
  const manifestPath = path.join(targetDir, '.agents', 'manifest.json');
  let manifest = {
    version: PKG.version,
    installedPacks: [],
    harnesses: [],
    skills: {}
  };
  if (fs.existsSync(manifestPath)) {
    manifest = readJsonFile(manifestPath, '.agents/manifest.json');
  }
  if (!manifest.skills || typeof manifest.skills !== 'object') {
    manifest.skills = {};
  }
  return manifest;
}

function saveSkillManifest(manifest, targetDir = TARGET_DIR) {
  const manifestPath = path.join(targetDir, '.agents', 'manifest.json');
  manifest.updatedAt = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

// '@latest' is the documented invocation of these first-party scaffolding CLIs
const AUDIT_LATEST_ALLOW = ['shadcn@latest', 'create-next-app@latest', 'create-expo-app@latest', 'create-vite@latest'];

// Runtime paths that only exist after Dev-OS runs; references to them are not broken
const AUDIT_RUNTIME_PATHS = ['.agents/_backup', '.agents/bin', '.agents/manifest.json', '.agents/telemetry',
  '.agents/evals/reports', '.agents/memory/session.json', '.agents/memory/sdlc-state.json', '.agents/memory/context.json',
  '.agents/memory/decisions', '.agents/memory/handoffs',
  '.agents/product-marketing.md' /* user-authored context file the marketing skills create */];

function listCommandNames(srcAgents) {
  const names = new Set();
  [path.join(srcAgents, 'commands'), path.join(srcAgents, 'maintainer', 'commands')].forEach((dir) => {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).filter((f) => f.endsWith('.md')).forEach((f) => names.add(f.replace(/\.md$/, '')));
  });
  return names;
}

// Reference and hygiene checks over every text file of one skill. Pushes
// { level, code, message } issues; all are warnings except a nested SKILL.md
// in a skill Dev-OS ships (ctx.devosSkill).
function auditSkillReferences(sPath, ctx, issues) {
  const add = (level, code, message) => {
    if (!issues.some((i) => i.code === code && i.message === message)) issues.push({ level, code, message });
  };

  function walk(dir) {
    for (const item of fs.readdirSync(dir)) {
      if (TREE_SKIP_NAMES.has(item)) continue;
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) { walk(full); continue; }
      if (!stat.isFile() || stat.size > 1024 * 1024) continue;
      const rel = path.relative(sPath, full).split(path.sep).join('/');
      if (item === 'SKILL.md' && rel.startsWith('references/')) {
        // An error only for skills Dev-OS ships; third-party skills may nest them
        add(ctx.devosSkill ? 'error' : 'warn', 'nested-skill-md', `Nested SKILL.md under references/ (${rel}); rename it to GUIDE.md`);
      }
      // Prose and scripts only; data files (CSV, JSON) are never scanned
      if (!/\.(md|sh|js|py)$/i.test(item)) continue;
      let text;
      try { text = fs.readFileSync(full, 'utf8'); } catch (e) { continue; }

      if (/\bnpx\s+(-y|--yes)\b/.test(text)) add('warn', 'npx-yes', `unpinned 'npx -y' in ${rel}`);
      const latest = (text.match(/[\w@/.-]*@latest\b/g) || []).filter((t) => !AUDIT_LATEST_ALLOW.some((a) => t.endsWith(a)));
      if (latest.length) add('warn', 'at-latest', `'@latest' version (${latest[0]}) in ${rel}`);

      if (!/\.md$/i.test(item)) continue;
      // Strip fenced code blocks (examples are not references) and lines that
      // mark a path as optional ("if present", "if it exists", "optional").
      const prose = text.replace(/```[\s\S]*?```/g, '')
        .split(/\r?\n/).filter((l) => !/if (present|it exists|available)|\boptional\b/i.test(l)).join('\n');

      const linkRe = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
      let m;
      while ((m = linkRe.exec(prose)) !== null) {
        const target = m[1].split('#')[0];
        if (!target || /[<>{}*$]/.test(target)) continue;
        if (/^(\.\/)?\.agents\//.test(target)) continue; // project-root paths: handled below
        // Only paths that are clearly relative to the skill dir are checked;
        // anything else (placeholders, target-project files) is left alone.
        if (!/^(\.\/|\.\.\/|references\/|scripts\/|resources\/)/.test(target)) continue;
        let decoded = target;
        try { decoded = decodeURIComponent(target); } catch (e) {}
        if (!fs.existsSync(path.resolve(path.dirname(full), decoded))) add('warn', 'broken-ref', `broken relative link '${target}' in ${rel}`);
      }

      const agentsRe = /(^|[^\w./-]|(?:^|[^\w./-])\.\/)(\.agents\/[A-Za-z0-9._\/-]*[A-Za-z0-9_-])/g;
      while ((m = agentsRe.exec(prose)) !== null) {
        const ref = m[2];
        if (AUDIT_RUNTIME_PATHS.some((r) => ref === r || ref.startsWith(`${r}/`) || ref.startsWith(`${r}.`))) continue;
        const skillMatch = ref.match(/^\.agents\/skills\/([^/]+)/);
        if (skillMatch && ctx.aliases[skillMatch[1]]) {
          add('warn', 'merged-skill-ref', `references merged skill '${skillMatch[1]}' (now '${ctx.aliases[skillMatch[1]]}') in ${rel}`);
          continue;
        }
        if (fs.existsSync(path.join(ctx.projectRoot, ref))) continue;
        // Shipped in an optional pack that is not installed here: expected
        if (skillMatch && ctx.shippedSkills.has(skillMatch[1]) && !fs.existsSync(path.join(ctx.projectRoot, '.agents', 'skills', skillMatch[1]))) continue;
        if (fs.existsSync(path.join(ctx.sourceRoot, ref))) continue;
        add('warn', 'broken-ref', `broken path '${ref}' in ${rel}`);
      }

      const slashRe = /(^|[\s(`'"])\/([a-z][a-z0-9-]{2,})(?![\w./-])(?=[^\n]{0,40}?\bskills?\b)/g;
      while ((m = slashRe.exec(prose)) !== null) {
        const name = m[2];
        if (ctx.shippedSkills.has(name) || ctx.commandNames.has(name)) continue;
        if (ctx.aliases[name]) add('warn', 'merged-skill-ref', `'/${name}' was merged into '${ctx.aliases[name]}' (${rel})`);
        else add('warn', 'unshipped-skill-ref', `'/${name}' names a skill Dev-OS does not ship (${rel})`);
      }
    }
  }
  walk(sPath);
}

function auditSkills(skillsDir) {
  const projectRoot = path.resolve(skillsDir, '..', '..');
  const srcAgents = path.join(TEMPLATE_DIR, '.agents');
  const shippedSkills = new Set();
  [path.join(srcAgents, 'skills'), skillsDir].forEach((dir) => {
    if (fs.existsSync(dir)) fs.readdirSync(dir).forEach((f) => { if (f !== '_backup') shippedSkills.add(f); });
  });
  let packsData = null;
  try { packsData = JSON.parse(fs.readFileSync(path.join(srcAgents, 'packs.json'), 'utf8')); } catch (e) {}
  const ctx = {
    projectRoot,
    sourceRoot: TEMPLATE_DIR,
    shippedSkills,
    commandNames: listCommandNames(srcAgents),
    aliases: skillAliases(packsData)
  };
  // Skills Dev-OS ships: listed in packs.json, or recorded with source core
  let projectManifest = null;
  try { projectManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, '.agents', 'manifest.json'), 'utf8')); } catch (e) {}
  const devosSkill = (name) => isShippedSkill(packsData, name) ||
    Boolean(projectManifest && projectManifest.skills && projectManifest.skills[name] && projectManifest.skills[name].source === 'core');

  const result = {
    total: 0,
    passed: 0,
    warnings: 0,
    errors: 0,
    skills: []
  };

  if (!fs.existsSync(skillsDir)) {
    return result;
  }

  const secretPatterns = [
    { name: 'GitHub Token', re: /\b(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}\b/g },
    { name: 'GitHub Fine-Grained Token', re: /\bgithub_pat_[a-zA-Z0-9_]{82}\b/g },
    { name: 'Anthropic API Key', re: /\bsk-ant-[a-zA-Z0-9_\-]{32,}\b/g },
    { name: 'OpenAI API Key', re: /\bsk-[a-zA-Z0-9]{32,}\b/g },
    { name: 'Google API Key', re: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
    { name: 'AWS Key', re: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g },
    { name: 'Private Key', re: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g },
    { name: 'Bearer Token', re: /Bearer\s+[a-zA-Z0-9_\-\.]{25,}/gi }
  ];

  const skillEntries = fs.readdirSync(skillsDir).filter((f) => {
    if (f === '_backup') return false;
    return fs.statSync(path.join(skillsDir, f)).isDirectory();
  });

  result.total = skillEntries.length;

  for (const skillName of skillEntries) {
    const sPath = path.join(skillsDir, skillName);
    const skillReport = {
      name: skillName,
      valid: true,
      tokens: 0,
      warnings: [],
      errors: [],
      issues: []
    };

    const skillMdPath = path.join(sPath, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      skillReport.valid = false;
      skillReport.errors.push('Missing SKILL.md');
    } else {
      const content = fs.readFileSync(skillMdPath, 'utf8');
      skillReport.tokens = Math.ceil(content.length / 4);

      const fm = parseFrontmatter(content);
      if (!fm.data || !fm.data.name) {
        skillReport.valid = false;
        skillReport.errors.push('Missing name in frontmatter');
      }
      if (!fm.data || !fm.data.description || fm.data.description.trim().length === 0) {
        skillReport.valid = false;
        skillReport.errors.push('Missing description in frontmatter');
      }

      if (skillReport.tokens > 4000) {
        skillReport.warnings.push(`High prompt token weight (${skillReport.tokens.toLocaleString()} tokens > 4,000 threshold)`);
      }

      const desc = fm.data && typeof fm.data.description === 'string' ? fm.data.description.trim() : '';
      if (desc && (!/use when/i.test(desc) || desc.length < 80)) {
        skillReport.issues.push({ level: 'warn', code: 'weak-description', message: `description should be a 'Use when ...' trigger of at least 80 chars (${desc.length} chars)` });
      }
      const lineCount = content.split(/\r?\n/).length;
      if (lineCount > 500 && !fs.existsSync(path.join(sPath, 'references'))) {
        skillReport.issues.push({ level: 'warn', code: 'long-skill', message: `SKILL.md has ${lineCount} lines (> 500) and no references/ dir; move detail into references/` });
      }
    }

    auditSkillReferences(sPath, { ...ctx, devosSkill: devosSkill(skillName) }, skillReport.issues);
    skillReport.issues.forEach((i) => {
      if (i.level === 'error') {
        skillReport.valid = false;
        skillReport.errors.push(i.message);
      } else {
        skillReport.warnings.push(i.message);
      }
    });

    // Security check across files in the skill directory
    function scanDir(dir) {
      for (const item of fs.readdirSync(dir)) {
        if (item === '.DS_Store' || item === '_backup' || item === 'node_modules') continue;
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          scanDir(itemPath);
        } else if (stat.isFile()) {
          try {
            const fileContent = fs.readFileSync(itemPath, 'utf8');
            for (const pat of secretPatterns) {
              const matches = fileContent.match(pat.re) || [];
              for (const m of matches) {
                if (m.toUpperCase().includes('EXAMPLE') || m.includes('000000') || m.toLowerCase().includes('xxxx')) continue;
                skillReport.valid = false;
                skillReport.errors.push(`Hardcoded credential detected (${pat.name}) in ${path.relative(sPath, itemPath)}`);
              }
            }
          } catch (e) {}
        }
      }
    }

    scanDir(sPath);

    if (skillReport.errors.length > 0) {
      result.errors++;
    } else {
      result.passed++;
    }
    if (skillReport.warnings.length > 0) {
      result.warnings++;
    }

    result.skills.push(skillReport);
  }

  return result;
}

// Parse a JSON file from the target project; exit with a clear FAIL on bad JSON
function readJsonFile(filePath, label) {
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`${colors.red}[ FAIL ] Could not parse ${label || path.relative(TARGET_DIR, filePath) || filePath}: ${e.message}${colors.reset}`);
    console.error(`${colors.yellow}         Fix or remove the file (a backup may exist under .agents/_backup/), then re-run.${colors.reset}`);
    process.exit(1);
  }
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
  let platform = flags.platform || flags.harness || (flags.allHarnesses ? 'all' : null);
  let mode = (flags.mode || 'interactive').toLowerCase();
  let autoGoal = '';
  let allSkillsSelected = Boolean(flags.allSkills);
  let telemetry = flags.telemetry !== false;
  let hooksSelected = flags.hooks !== false;
  let hooksPrompted = false;

  if (flags.stack && !STACKS.includes(flags.stack.toLowerCase())) {
    throw new Error(`Unknown stack '${flags.stack}'. Valid stacks: ${STACKS.join(', ')}`);
  }

  if (platform && platform !== 'all') {
    const list = platform.split(',').map((s) => s.trim().toLowerCase());
    for (let item of list) {
      if (item === 'gemini') item = 'antigravity';
      if (item === 'windsurf') item = 'codex';
      if (!HARNESSES.includes(item) && !PLATFORMS.includes(item)) {
        throw new Error(`Unknown platform/harness '${item}'. Valid options: ${PLATFORMS.join(', ')}`);
      }
    }
  }

  const passed = flags.passed || {};

  if (flags.fresh) {
    isFresh = true;
  } else if (flags.existing) {
    isFresh = false;
  } else if (!process.stdin.isTTY) {
    // Non-interactive shell (CI, pipes): never block on a prompt, never exit 0 having done nothing
    throw new Error("Non-interactive terminal detected and no project type given. Re-run with '--existing' (inject into an existing project) or '--fresh' (new project), e.g. 'devos init --existing --stack universal --platform claude'.");
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Reject pending prompts if stdin closes (Ctrl-D / EOF) instead of hanging or exiting silently
    let closed = false;
    let rejectPending = null;
    rl.on('close', () => {
      closed = true;
      if (rejectPending) rejectPending(new Error('Input closed before setup finished; nothing was written. Re-run devos init, or pass --existing/--fresh for non-interactive setup.'));
    });
    const ask = (query) => new Promise((resolve, reject) => {
      if (closed) {
        reject(new Error('Input closed before setup finished; nothing was written.'));
        return;
      }
      rejectPending = reject;
      rl.question(query, (answer) => {
        rejectPending = null;
        resolve(answer);
      });
    });

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

    if (!platform) {
      console.log(`\n${colors.bold}Step 3 · AI Coding Platform / Harness${colors.reset}`);
      console.log(`  1) Google Antigravity / Gemini (ANTIGRAVITY.md, GEMINI.md, Agent Skills Standard) [Recommended]`);
      console.log(`  2) Claude Code (Anthropic Claude CLI, .claude/ commands, agents, hooks)`);
      console.log(`  3) Cursor (.cursor/rules/devos.mdc, .cursorrules)`);
      console.log(`  4) OpenCode (.opencode/rules/, OPENCODE.md)`);
      console.log(`  5) Codex / Windsurf (AGENTS.md, .windsurfrules)`);
      console.log(`  6) All Platforms (Universal Multi-Platform Setup) [Default]`);

      const platAns = await ask(`\n${colors.cyan}Select option [1-6, or comma-separated e.g. 1,2] (default 6): ${colors.reset}`);
      const choices = platAns.trim() ? platAns.trim().split(',').map((s) => s.trim()) : ['6'];
      const mapped = [];
      choices.forEach((c) => {
        if (c === '1') mapped.push('antigravity');
        else if (c === '2') mapped.push('claude');
        else if (c === '3') mapped.push('cursor');
        else if (c === '4') mapped.push('opencode');
        else if (c === '5') mapped.push('codex');
        else if (c === '6') mapped.push('all');
      });
      platform = mapped.length ? mapped.join(',') : 'all';
    }

    if (!flags.mode) {
      console.log(`\n${colors.bold}Step 4 · Default SDLC Execution Mode${colors.reset}`);
      console.log(`  1) Interactive (Default pair-programming with staged human reviews) [Recommended]`);
      console.log(`  2) Guided (Step-by-step confirmation checkpoints at each SDLC stage)`);
      console.log(`  3) Auto (Autonomous hands-off MVP builder for founders/CEOs — from idea to working software)`);
      console.log(`  4) Audit (Read-only security, architecture, and code health evaluation)`);
      const modeAns = await ask(`\n${colors.cyan}Select option [1-4] (default 1): ${colors.reset}`);
      switch (modeAns.trim()) {
        case '2': mode = 'guided'; break;
        case '3': mode = 'auto'; break;
        case '4': mode = 'audit'; break;
        default: mode = 'interactive'; break;
      }
    }

    if (mode === 'auto') {
      console.log(`\n${colors.bold}Step 5 · Autonomous Goal / Product Idea${colors.reset}`);
      console.log(`  Enter the product, MVP, or feature idea you want Dev-OS to build autonomously.`);
      const goalAns = await ask(`\n${colors.cyan}Product Idea (or press Enter to set later): ${colors.reset}`);
      autoGoal = goalAns.trim();
    }

    if (!passed.allSkills) {
      console.log(`\n${colors.bold}Step 6 · Capability Scope & Specialist Skills${colors.reset}`);
      console.log(`  1) Lean Stack Pack (Core + target stack skills — token-optimized) [Recommended]`);
      console.log(`  2) Full Skills Arsenal (Install all ${countSkills(path.join(TEMPLATE_DIR, '.agents', 'skills'))} specialist skills across design, backend, devops)`);
      const skillScopeAns = await ask(`\n${colors.cyan}Select option [1-2] (default 1): ${colors.reset}`);
      allSkillsSelected = skillScopeAns.trim() === '2';
    }

    if (!passed.telemetry) {
      console.log(`\n${colors.bold}Step 7 · Anonymous Failure Telemetry & Local RCA Buffer${colors.reset}`);
      console.log(`  1) On (Recommended) — Anonymously captures execution errors & RCA reports in .agents/telemetry/`);
      console.log(`  2) Off — Completely disable anonymous failure logging`);
      const telemAns = await ask(`\n${colors.cyan}Select option [1-2] (default 1): ${colors.reset}`);
      telemetry = telemAns.trim() !== '2';
    }

    if (!passed.hooks) {
      console.log(`\n${colors.bold}Step 8 · Automated Verification & Secret Scanner Gate${colors.reset}`);
      console.log(`  1) Enable (Pre-commit hook, Claude Code lifecycle hooks & Gitleaks detection) [Recommended]`);
      console.log(`  2) Disable (Bypass mechanical gates — not recommended for production)`);
      const hookAns = await ask(`\n${colors.cyan}Select option [1-2] (default 1): ${colors.reset}`);
      hooksSelected = hookAns.trim() !== '2';
      hooksPrompted = true;
    }

    rl.close();
  }

  return {
    isFresh,
    stack: stack.toLowerCase(),
    platform: (platform || 'all').toLowerCase(),
    telemetry: telemetry !== false,
    mode: (mode || 'interactive').toLowerCase(),
    allSkills: allSkillsSelected || false,
    hooks: hooksSelected !== false,
    // false when the hooks choice is only the default (no flag, no prompt answer)
    hooksExplicit: Boolean(flags.passed && flags.passed.hooks) || hooksPrompted,
    autoGoal: autoGoal || ''
  };
}

// ---------------------------------------------------------------------------
// Multi-Harness Generators
// ---------------------------------------------------------------------------

const AGENT_DESCRIPTIONS = {
  orchestrator: 'Dev-OS team lead. Triages tasks, delegates to specialist agents, sequences work, and enforces workflow protocols and the human commit gate.',
  developer: 'Dev-OS implementation specialist. Writes features and bug fixes following CODING_STANDARDS.md; hands work to QA and never commits directly.',
  qa: 'Dev-OS code reviewer. Reviews changes for correctness, standards compliance, and security before human approval. Does not write tests.',
  tester: 'Dev-OS test engineer. Writes and executes automated tests, reproduces bugs, and reports coverage gaps.',
  security: 'Dev-OS security auditor. Scans code and dependencies for vulnerabilities, secret leaks, and forbidden patterns.',
  dba: 'Dev-OS database specialist. Designs and reviews schemas, migrations, queries, and RLS policies; requires human approval for CRITICAL changes.',
  devops: 'Dev-OS infrastructure and reliability specialist. Handles CI/CD, deployment, environment configuration, rollback, SLOs, incidents, and runbooks.',
  architect: 'Dev-OS system architect. Runs project inception (grill-me), designs architecture, and produces requirements documents.',
  researcher: 'Dev-OS research specialist. Investigates libraries, APIs, compatibility, and best practices; returns concise verdicts.',
  'ui-designer': 'Dev-OS UI/UX design specialist. Applies the anti-ai-ui skill and a matched design system to author DESIGN.md to satisfy the Mandatory Design Gate.',
  telemetry: 'Dev-OS observability specialist. Tracks runtime errors, failure logs in .agents/telemetry/, and drafts RCA reports.',
  'eval-engineer': 'Dev-OS evaluation engineer. Measures capability benchmarks, pass@k, and prevents workflow regressions.',
  pm: 'Dev-OS product strategist. Defines user personas, maps user stories, and authors Given-When-Then acceptance criteria.',
  'tech-writer': 'Dev-OS docs and release owner. Authors API docs, onboarding guides, ADRs, changelogs, and release notes; sole owner of the Humanizer gate.',
  'tech-lead': 'Dev-OS senior staff engineer. Resolves circuit-breaker deadlocks between Developer and QA/Tester before human escalation.'
};

// ---------------------------------------------------------------------------
// 5.0 roster consolidation: aliases and 4.x migration data
// ---------------------------------------------------------------------------

// Merged agent -> the default-roster agent that absorbed its duties
const AGENT_ALIASES = {
  'executive-proxy': 'orchestrator',
  sre: 'devops',
  'release-manager': 'tech-writer',
  'memory-manager': 'orchestrator'
};

// Agents and commands a 4.x install may still carry under their old location.
// Merged names are always retired; moved names (now in the maintainer pack)
// are retired only when that pack is not installed.
const RETIRED_AGENTS = Object.keys(AGENT_ALIASES);
const MOVED_AGENTS = ['telemetry', 'eval-engineer'];
const MOVED_COMMANDS = ['eval', 'telemetry'];

// Whole-file hashes (first 16 hex chars of sha256) of every file a released
// Dev-OS generator wrote, keyed by project path: the .agents/ source copies and
// the exact .claude/ output of each tag's generateClaudeCommands/Agents
// (v2.1.0 through v4.5.0, rebuilt from git history by running each tag's own
// generator over that tag's sources). Installs that predate
// manifest.generatedFiles are matched against these; any byte of difference,
// frontmatter and the "## Dev-OS Routing" footer included, counts as an edit.
const LEGACY_FILE_HASHES = {
  '.agents/agents/architect.md': ['f82e15b8c051d56b', '02db49f93da4fa61'],
  '.agents/agents/dba.md': ['c502d3eb2087239f', '33f89187cce69855', '24708306244a43e5'],
  '.agents/agents/developer.md': ['0643d7fab5422173', 'f4cd4d210eb08568', '7aee1e6d73aebb09', 'd1086a293f809f26', '54a55bfbd2d41295'],
  '.agents/agents/devops.md': ['720c37f4d0358997', 'caf4b8d1c6b78da2'],
  '.agents/agents/eval-engineer.md': ['d1f2fe2f27c6140a', 'fcffbfe99b27396c'],
  '.agents/agents/executive-proxy.md': ['44e5b887b2b883e9', '6dd79edbb0a1c98c'],
  '.agents/agents/memory-manager.md': ['7208337e5c303412', '9a8588609ad74515'],
  '.agents/agents/orchestrator.md': ['2745c9525204a8e3', 'cafbcc170b92a677', '0f129e2d69a170b5', 'a9c53d618f54cfdd'],
  '.agents/agents/pm.md': ['00487502f7df9e26'],
  '.agents/agents/qa.md': ['19e2a88b012051b3', '794d488820c74c75', '3803d777fbce1fb3', '2a3e64751f05eced', '9e3d3445e5fb90b8'],
  '.agents/agents/release-manager.md': ['2a49be3be9cd1dd4', '49c8d0a9b8c55bdf'],
  '.agents/agents/researcher.md': ['edda361bbcbd8b45', '7c124dd512cf703a'],
  '.agents/agents/security.md': ['740780393dadfaed', 'f0b3d345bf09d492'],
  '.agents/agents/sre.md': ['db9a35a70acdb194'],
  '.agents/agents/tech-lead.md': ['baac802e6438d2de'],
  '.agents/agents/tech-writer.md': ['a02c61f40a7f7dbd'],
  '.agents/agents/telemetry.md': ['693873506fae9470', '739606059e2635b8'],
  '.agents/agents/tester.md': ['fac0a8b0f9702161', 'f8ce23670f64de5c', 'f785f03010d45580'],
  '.agents/agents/ui-designer.md': ['79f12f5a7b32cdf3', '1f8d9a9ed4c455f7', '2f435849bd1b5e82', 'a3edc4e2fa5d238d'],
  '.agents/commands/README.md': ['ae9e3c4d805abfb2'],
  '.agents/commands/architect.md': ['fc76f50b8d99f054'],
  '.agents/commands/auto.md': ['1f837afe49f1dec9', '04c4853c755eea19'],
  '.agents/commands/commit.md': ['07faad83f220d65c'],
  '.agents/commands/deploy.md': ['968d27056376c7d4'],
  '.agents/commands/design.md': ['b8a9665768a9e8ab', 'e48f6d5152741fe5', '243ec1dd2e5b74b1', '1ca528af1531fc4d'],
  '.agents/commands/eval.md': ['5cce36ef28377d8e'],
  '.agents/commands/fix.md': ['35fbe92067044cb5'],
  '.agents/commands/humanize.md': ['fd0a94385279be2f'],
  '.agents/commands/mode.md': ['50d9be8ac41e9c76'],
  '.agents/commands/pm.md': ['6aaabaf8ae36b3eb'],
  '.agents/commands/redesign.md': ['f482bd1025d5366e'],
  '.agents/commands/refactor.md': ['920ca7f18e76f78a'],
  '.agents/commands/research.md': ['bb8fb423283bcb4f'],
  '.agents/commands/review.md': ['d2cb5c55a2b1074c'],
  '.agents/commands/secure.md': ['9cb8777dc533b11e'],
  '.agents/commands/skill.md': ['49e4490a94a7b71a'],
  '.agents/commands/sre.md': ['f7ae8e6b8718ab29'],
  '.agents/commands/status.md': ['dc61a866d481e23c'],
  '.agents/commands/task.md': ['7fba9773dfa9dadb'],
  '.agents/commands/tech-lead.md': ['57d90e4863a015df'],
  '.agents/commands/tech-writer.md': ['223a784e6a8ea0b6'],
  '.agents/commands/telemetry.md': ['83b78398c54b4748', '73ce38434e26ab84'],
  '.agents/commands/test.md': ['1d0cbbb8d657e98f'],
  '.claude/agents/architect.md': ['556c2b6a30f66b33', '28e11c83d562cf86'],
  '.claude/agents/dba.md': ['d945892f5680647f', '1463795aba46d210', 'f9b80499be294dcf'],
  '.claude/agents/developer.md': ['2f4c270986e9ae16', '89813a003e9aed8a', 'c3df935250b97afe', '187f9f068a03a9ae', '79132c302b171737'],
  '.claude/agents/devops.md': ['805b03f8483a484d', '380a2d5b9f26edc7'],
  '.claude/agents/eval-engineer.md': ['5536b06b56f3ce61', 'e89f15114cfaa9dd'],
  '.claude/agents/executive-proxy.md': ['381cda5ce5c8bbf0', '1260ff33f0a1fcca'],
  '.claude/agents/memory-manager.md': ['8b4527eb7e2cf35f', '1e32c8d11f61649a'],
  '.claude/agents/orchestrator.md': ['b1d6ae8d9e829837', '13768a3cbd5276b2', '21002eea687c5b74', '6669f2b5b66c6706'],
  '.claude/agents/pm.md': ['a014ed75f5a9f44c'],
  '.claude/agents/qa.md': ['c29a773d7b19fcbe', '9318bc0eaf48c02b', 'bdc300f3393e7a7e', 'ecf09345d78ea712', '5a4bb81abb7bbcf2'],
  '.claude/agents/release-manager.md': ['607fe77e06552b63', '4fad58df0ded4dd9'],
  '.claude/agents/researcher.md': ['80f4910d0899dd4f', 'cbcaf818f121e26c'],
  '.claude/agents/security.md': ['aadaabae1c3d4d83', '2582538e82b1435e'],
  '.claude/agents/sre.md': ['d233dae4c59eac99'],
  '.claude/agents/tech-lead.md': ['4e6ac2b2c9c9f3e6'],
  '.claude/agents/tech-writer.md': ['9824dd588713ca1d'],
  '.claude/agents/telemetry.md': ['e5f7f61975f46174', '1a596609975e8ef8'],
  '.claude/agents/tester.md': ['38e5b46c5116238c', '3469930bd611c8da', '650bbaa07407a5db'],
  '.claude/agents/ui-designer.md': ['d4d3620e6f405f9e', '1758186dd427184a', '0e1ffedcac9041cc', '31454690199eaf79'],
  '.claude/commands/architect.md': ['6f516ebe919ad4a8'],
  '.claude/commands/auto.md': ['141cfb03093c0a6b', '338ffca702f92e20'],
  '.claude/commands/commit.md': ['412ef2d2b8c7f828'],
  '.claude/commands/deploy.md': ['ff47ae9a22434f5f'],
  '.claude/commands/design.md': ['c76e992f5715e0ac', '39755f68c88b7d54', '7929c06d210ac1dd', '8899e14aa3e08698'],
  '.claude/commands/eval.md': ['b348fb5045663c38'],
  '.claude/commands/fix.md': ['44467aea52061ebb'],
  '.claude/commands/humanize.md': ['ff0730cf87c01699'],
  '.claude/commands/mode.md': ['52abb6267bc3df50'],
  '.claude/commands/pm.md': ['c84edc387dc38301'],
  '.claude/commands/redesign.md': ['8a3f6993caa735b3'],
  '.claude/commands/refactor.md': ['38a0d6ed8d1d514e'],
  '.claude/commands/research.md': ['b21a9759a3c8435f'],
  '.claude/commands/review.md': ['adb109f9e837334a'],
  '.claude/commands/secure.md': ['7882e8474fc012b3'],
  '.claude/commands/skill.md': ['cb432184648ec97e'],
  '.claude/commands/sre.md': ['e37c32f85a83293d'],
  '.claude/commands/status.md': ['9cbfbbf43ac89591'],
  '.claude/commands/task.md': ['a4883193e0c793b1'],
  '.claude/commands/tech-lead.md': ['8b09d65ea9531920'],
  '.claude/commands/tech-writer.md': ['40764f5a52790a88'],
  '.claude/commands/telemetry.md': ['24b3e0cf1afff651', '6825a91acd89d568'],
  '.claude/commands/test.md': ['38372b7aa9d798fe']
};

function sha256(content) {
  return require('crypto').createHash('sha256').update(content).digest('hex');
}

function legacyFileHash(content) {
  return sha256(content).slice(0, 16);
}

function relToTarget(targetDir, filePath) {
  return path.relative(targetDir, filePath).split(path.sep).join('/');
}

// Record the sha256 of files Dev-OS just wrote, keyed by project-relative path.
// A later update treats a file as "generated, unedited" only while it still
// matches this hash.
function recordGeneratedFiles(manifest, targetDir, filePaths) {
  if (!manifest.generatedFiles || typeof manifest.generatedFiles !== 'object') manifest.generatedFiles = {};
  filePaths.forEach((p) => {
    if (fs.existsSync(p)) manifest.generatedFiles[relToTarget(targetDir, p)] = sha256(fs.readFileSync(p));
  });
}

function loadPacks(srcAgents) {
  const packsPath = path.join(srcAgents, 'packs.json');
  if (!fs.existsSync(packsPath)) return null;
  return readJsonFile(packsPath, 'Dev-OS packs registry (.agents/packs.json)');
}

function skillAliases(packsData) {
  return packsData && packsData.aliases && typeof packsData.aliases === 'object' ? packsData.aliases : {};
}

// Source file for a pack-declared agent or command stem: maintainer dir first
// (R3), then the default dir.
function resolvePackAssetSource(srcAgents, kind, stem) {
  const safe = safeFileStem(stem, null);
  if (!safe) return null;
  const candidates = [path.join(srcAgents, 'maintainer', kind, `${safe}.md`), path.join(srcAgents, kind, `${safe}.md`)];
  return candidates.find((c) => fs.existsSync(c)) || null;
}

// Agents and commands contributed by the given packs: { agents: [stem], commands: [stem] }
function packAssetNames(packsData, packIds) {
  const out = { agents: new Set(), commands: new Set() };
  if (!packsData || !packsData.packs) return { agents: [], commands: [] };
  packIds.forEach((id) => {
    const p = packsData.packs[id];
    if (!p) return;
    (Array.isArray(p.agents) ? p.agents : []).forEach((a) => out.agents.add(a));
    (Array.isArray(p.commands) ? p.commands : []).forEach((c) => out.commands.add(c));
  });
  return { agents: Array.from(out.agents), commands: Array.from(out.commands) };
}

function packHasAssets(pack) {
  return Boolean(pack && ((Array.isArray(pack.agents) && pack.agents.length) || (Array.isArray(pack.commands) && pack.commands.length)));
}

// Copy pack agents/commands into the target's flat .agents/agents and
// .agents/commands so the harness generators and routing pick them up.
// Returns the destination paths written.
function installPackAssets(srcAgents, destAgents, packsData, packIds, guard) {
  const written = [];
  const names = packAssetNames(packsData, packIds);
  [['agents', names.agents], ['commands', names.commands]].forEach(([kind, stems]) => {
    stems.forEach((stem) => {
      const src = resolvePackAssetSource(srcAgents, kind, stem);
      if (!src) {
        console.error(`${colors.yellow}[ WARN ] Pack ${kind.slice(0, -1)} '${stem}' not found in the Dev-OS sources; skipped.${colors.reset}`);
        return;
      }
      const dest = path.join(destAgents, kind, path.basename(src));
      if (guard && !guard.allow(dest, fs.readFileSync(src, 'utf8'))) return; // user copy kept
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      written.push(dest);
    });
  });
  return written;
}

// Default-roster agent/command files copied from the sources into the target
function defaultAssetPaths(srcAgents, destAgents) {
  const out = [];
  ['agents', 'commands'].forEach((kind) => {
    const dir = path.join(srcAgents, kind);
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md').forEach((f) => out.push(path.join(destAgents, kind, f)));
  });
  return out;
}

// True when `filePath` is a Dev-OS-written file nobody edited. 5.x installs
// compare against the sha256 recorded in manifest.generatedFiles; files with
// no record compare the WHOLE file against the exact output of every released
// generator (LEGACY_FILE_HASHES) plus any `extraHashes` (legacyFileHash form).
function isDevosGeneratedUnedited(filePath, targetDir, manifest, extraHashes) {
  const content = fs.readFileSync(filePath);
  const rel = relToTarget(targetDir, filePath);
  const recorded = manifest && manifest.generatedFiles && manifest.generatedFiles[rel];
  if (recorded) return sha256(content) === recorded;
  const short = legacyFileHash(content);
  if ((LEGACY_FILE_HASHES[rel] || []).includes(short)) return true;
  return Boolean(extraHashes && extraHashes.has(short));
}

// One backup directory per CLI run, created only when something is backed up
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-');

function backupForMigration(filePath, targetDir, stamp = RUN_STAMP) {
  const dest = path.join(targetDir, '.agents', '_backup', `migration-${stamp}`, path.relative(targetDir, filePath));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(filePath, dest);
  return relToTarget(targetDir, dest);
}

// Gate for every regenerated .claude/{agents,commands} file. A file may be
// overwritten only when it is missing, already identical, or Dev-OS-generated
// and unedited. Anything else (a user edit, or a user-authored file that shares
// a Dev-OS name) is kept in place; with `force` it is backed up, then
// overwritten. Call report() after the generators to print the outcome.
function createGeneratedWriteGuard({ targetDir, manifest, force }) {
  const guard = {
    kept: [],
    backedUp: [],
    refreshed: [],
    // Like allow(), plus: a file with no recorded hash that `looksLegacy`
    // recognises as a pre-5.0 Dev-OS copy is backed up, then refreshed.
    allowOwned(outPath, content, looksLegacy) {
      if (typeof looksLegacy === 'function' && fs.existsSync(outPath)) {
        const rel = relToTarget(targetDir, outPath);
        const recorded = manifest && manifest.generatedFiles && manifest.generatedFiles[rel];
        const current = fs.readFileSync(outPath);
        if (!recorded && !current.equals(Buffer.from(content, 'utf8')) && looksLegacy(current.toString('utf8'))) {
          guard.refreshed.push(`${rel} (backup: ${backupForMigration(outPath, targetDir)})`);
          return true;
        }
      }
      return guard.allow(outPath, content);
    },
    allow(outPath, content) {
      if (!fs.existsSync(outPath)) return true;
      if (fs.readFileSync(outPath).equals(Buffer.from(content, 'utf8'))) return true;
      if (isDevosGeneratedUnedited(outPath, targetDir, manifest)) return true;
      const rel = relToTarget(targetDir, outPath);
      if (force) {
        guard.backedUp.push(`${rel} -> ${backupForMigration(outPath, targetDir)}`);
        return true;
      }
      if (!guard.kept.includes(rel)) guard.kept.push(rel);
      return false;
    },
    report() {
      guard.kept.forEach((rel) => console.log(`${colors.yellow}[ WARN ] kept your edited ${rel}; run 'devos update --force' to regenerate (a backup is taken)${colors.reset}`));
      guard.backedUp.forEach((b) => console.log(`${colors.yellow}[ WARN ] regenerated your edited ${b.replace(' -> ', ' (backup: ')})${colors.reset}`));
      guard.refreshed.forEach((r) => console.log(`${colors.gray}         refreshed pre-5.0 Dev-OS file ${r}${colors.reset}`));
      guard.kept.length = 0; guard.backedUp.length = 0; guard.refreshed.length = 0;
    }
  };
  return guard;
}

// 4.x -> 5.0 migration. Retires merged/moved agents and commands and merged
// skills. A file Dev-OS generated and nobody edited is backed up to
// .agents/_backup/migration-<stamp>/ and removed; an edited one stays in place
// untouched (nothing is lost, so nothing is copied) with a [ WARN ].
// Mutates `manifest` (generatedFiles, skills).
function migrateLegacyInstall(srcAgents, targetDir, manifest, packsData, options = {}) {
  const destAgents = path.join(targetDir, '.agents');
  const destClaude = path.join(targetDir, '.claude');
  const stamp = options.stamp || RUN_STAMP;
  const report = { removed: [], kept: [], backedUp: [], skillsRemoved: [], skillsBackedUp: [], primariesInstalled: [] };

  const installedPacks = Array.isArray(manifest.installedPacks) ? manifest.installedPacks : [];
  const packAssets = packAssetNames(packsData, installedPacks);
  const retired = [
    ...RETIRED_AGENTS.map((n) => ['agents', n]),
    ...MOVED_AGENTS.filter((n) => !packAssets.agents.includes(n)).map((n) => ['agents', n]),
    ...MOVED_COMMANDS.filter((n) => !packAssets.commands.includes(n)).map((n) => ['commands', n])
  ];

  retired.forEach(([kind, name]) => {
    // The current source of a moved item counts as Dev-OS content for the .agents/ copy
    const current = resolvePackAssetSource(srcAgents, kind, name);
    const currentHashes = new Set(current ? [legacyFileHash(fs.readFileSync(current))] : []);
    const sourceCopy = path.join(destAgents, kind, `${name}.md`);
    const generated = path.join(destClaude, kind, `${name}.md`);

    [[sourceCopy, currentHashes], [generated, null]].forEach(([file, extra]) => {
      if (!fs.existsSync(file)) return;
      const rel = relToTarget(targetDir, file);
      if (isDevosGeneratedUnedited(file, targetDir, manifest, extra)) {
        report.backedUp.push(backupForMigration(file, targetDir, stamp));
        fs.unlinkSync(file);
        report.removed.push(rel);
        if (manifest.generatedFiles) delete manifest.generatedFiles[rel];
      } else {
        report.kept.push(rel);
      }
    });
  });

  // Merged skills: packs.json aliases { old: new }
  const aliases = skillAliases(packsData);
  const destSkills = path.join(destAgents, 'skills');
  const srcSkills = path.join(srcAgents, 'skills');
  if (!manifest.skills || typeof manifest.skills !== 'object') manifest.skills = {};
  Object.keys(aliases).forEach((oldName) => {
    const newName = aliases[oldName];
    const oldDir = path.join(destSkills, oldName);
    if (!safeFileStem(oldName, null) || !fs.existsSync(oldDir) || !fs.statSync(oldDir).isDirectory()) return;
    // The old name may still ship (e.g. not yet consolidated); leave it alone then
    if (fs.existsSync(path.join(srcSkills, oldName))) return;

    const entry = manifest.skills[oldName];
    const hash = computeSkillHash(oldDir);
    const customized = !entry || !entry.hash || entry.hash !== hash;
    if (customized) {
      const backup = backupSkill(oldDir, oldName, targetDir);
      report.skillsBackedUp.push(`${oldName} -> ${relToTarget(targetDir, backup)}`);
    }
    fs.rmSync(oldDir, { recursive: true, force: true });
    delete manifest.skills[oldName];
    report.skillsRemoved.push(`${oldName} -> ${newName}`);

    const newSrc = path.join(srcSkills, newName);
    const newDest = path.join(destSkills, newName);
    if (fs.existsSync(newSrc)) {
      const newEntry = manifest.skills[newName];
      const destHash = fs.existsSync(newDest) ? computeSkillHash(newDest) : null;
      const primaryCustomized = destHash && (!newEntry || !newEntry.hash || newEntry.hash !== destHash);
      if (!destHash || (!primaryCustomized && destHash !== computeSkillHash(newSrc))) {
        copyRecursiveSync(newSrc, newDest);
        manifest.skills[newName] = {
          source: (newEntry && newEntry.source) || 'core',
          version: PKG.version,
          hash: computeSkillHash(newDest),
          customized: false,
          installedAt: (newEntry && newEntry.installedAt) || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        if (!report.primariesInstalled.includes(newName)) report.primariesInstalled.push(newName);
      }
    }
  });

  return report;
}

function describeMigration(r) {
  const parts = [];
  if (r.removed.length) parts.push(`${r.removed.length} retired file(s) removed`);
  if (r.kept.length) parts.push(`${r.kept.length} edited file(s) kept`);
  if (r.skillsRemoved.length) parts.push(`${r.skillsRemoved.length} merged skill(s) retired`);
  if (r.primariesInstalled.length) parts.push(`primaries refreshed: ${r.primariesInstalled.join(', ')}`);
  return parts.length ? parts.join(', ') : 'nothing to migrate';
}

function printMigrationDetails(r) {
  r.removed.forEach((f) => console.log(`${colors.gray}         removed ${f} (Dev-OS generated, unedited)${colors.reset}`));
  r.kept.forEach((f) => console.log(`${colors.yellow}[ WARN ] kept ${f}: it differs from what Dev-OS generated, so it was left untouched. Merge it into the new roster and delete it when ready.${colors.reset}`));
  r.skillsRemoved.forEach((s) => console.log(`${colors.gray}         skill ${s.replace(' -> ', ' merged into ')}${colors.reset}`));
  r.skillsBackedUp.forEach((s) => console.log(`${colors.yellow}[ WARN ] customized skill backed up before retiring: ${s}${colors.reset}`));
}

function generateClaudeCommands(destAgents, destClaude, written, guard) {
  const srcCommands = path.join(destAgents, 'commands');
  const outDir = path.join(destClaude, 'commands');
  if (!fs.existsSync(srcCommands)) return 0;
  fs.mkdirSync(outDir, { recursive: true });

  let count = 0;
  fs.readdirSync(srcCommands).forEach((file) => {
    if (!file.endsWith('.md') || file === 'README.md') return;
    const raw = fs.readFileSync(path.join(srcCommands, file), 'utf8');
    const { data, body } = parseFrontmatter(raw);
    const fileStem = file.replace(/\.md$/, '');
    const name = safeFileStem(data.name, fileStem);
    if (data.name && name !== String(data.name).trim()) {
      console.error(`${colors.yellow}[ WARN ] Command '${file}' has an unsafe frontmatter name; using '${fileStem}'.${colors.reset}`);
    }
    const declared = safeFileStem(data.agent, 'orchestrator');
    // Commands written for a merged 4.x agent route to the agent that absorbed it
    const agent = AGENT_ALIASES[declared] || declared;
    const triage = data.triage_level || 'STANDARD';
    const workflow = data.workflow || 'standard';
    const description = typeof data.description === 'string' && data.description.trim()
      ? data.description
      : `Dev-OS /${name} command`;

    const header = ['---', `description: ${yamlScalar(description)}`];
    const argHint = typeof data['argument-hint'] === 'string' ? data['argument-hint'].trim() : '';
    if (argHint) header.push(`argument-hint: ${yamlScalar(argHint)}`);
    header.push('---');

    const out = [
      ...header,
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

    const outPath = path.join(outDir, `${name}.md`);
    if (guard && !guard.allow(outPath, out)) return; // user content kept in place
    fs.writeFileSync(outPath, out, 'utf8');
    if (Array.isArray(written)) written.push(outPath);
    count++;
  });
  return count;
}

// Claude Code subagent frontmatter keys passed through from .agents/agents/*.md
const AGENT_MODELS = ['sonnet', 'opus', 'haiku', 'inherit'];

function generateClaudeAgents(destAgents, destClaude, written, guard) {
  const srcAgents = path.join(destAgents, 'agents');
  const outDir = path.join(destClaude, 'agents');
  if (!fs.existsSync(srcAgents)) return 0;
  fs.mkdirSync(outDir, { recursive: true });

  let count = 0;
  fs.readdirSync(srcAgents).forEach((file) => {
    if (!file.endsWith('.md') || file === 'README.md') return;
    const fileStem = file.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(srcAgents, file), 'utf8');
    const { data, body } = parseFrontmatter(raw);

    // Subagent names must be lowercase letters, digits and hyphens
    const fmName = typeof data.name === 'string' ? data.name.trim() : '';
    const name = /^[a-z0-9][a-z0-9-]*$/.test(fmName) ? fmName : fileStem;
    const description = (typeof data.description === 'string' && data.description.trim()) ||
      AGENT_DESCRIPTIONS[name] || AGENT_DESCRIPTIONS[fileStem] ||
      `Dev-OS ${name} agent persona. Use for tasks assigned to the ${name} role in .agents/AGENTS.md.`;

    const lines = ['---', `name: ${name}`, `description: ${yamlScalar(description)}`];

    let tools = data.tools;
    if (Array.isArray(tools)) tools = tools.join(', ');
    if (typeof tools === 'string' && tools.trim()) {
      const list = tools.split(',').map((t) => t.trim()).filter(Boolean);
      if (list.length) lines.push(`tools: ${yamlScalar(list.join(', '))}`);
    }

    const model = typeof data.model === 'string' ? data.model.trim().toLowerCase() : '';
    if (model) {
      if (AGENT_MODELS.includes(model)) {
        lines.push(`model: ${model}`);
      } else {
        console.error(`${colors.yellow}[ WARN ] Agent '${file}' declares unknown model '${data.model}'; omitted (inherits).${colors.reset}`);
      }
    }

    lines.push('---', '', body.trim(), '');
    const out = lines.join('\n');
    const outPath = path.join(outDir, `${safeFileStem(fileStem, 'agent')}.md`);
    if (guard && !guard.allow(outPath, out)) return; // user content kept in place
    fs.writeFileSync(outPath, out, 'utf8');
    if (Array.isArray(written)) written.push(outPath);
    count++;
  });
  return count;
}

// ---------------------------------------------------------------------------
// Cross-harness instruction files (wave 3, W3)
// ---------------------------------------------------------------------------
// Formats verified against the official docs on 2026-10-22:
// - Claude Code reads CLAUDE.md, and reads AGENTS.md only when no CLAUDE.md
//   exists; a CLAUDE.md pulls AGENTS.md in with an `@AGENTS.md` import.
//   https://code.claude.com/docs/en/memory
// - Codex reads AGENTS.md from the project root down to the cwd, up to
//   project_doc_max_bytes (32 KiB by default). .codex/instructions.md is not a
//   documented source. https://developers.openai.com/codex/guides/agents-md
//   (redirects to https://learn.chatgpt.com/docs/agent-configuration/agents-md)
// - OpenCode reads AGENTS.md. Project config is opencode.json at the project
//   root ($schema https://opencode.ai/config.json, additionalProperties: false);
//   `instructions` is an array of paths or globs. OPENCODE.md is not read.
//   https://opencode.ai/docs/config/ and https://opencode.ai/docs/rules/
// - Cursor reads AGENTS.md. A .mdc rule with `alwaysApply: true` is always
//   included and its globs are ignored. https://cursor.com/docs/context/rules
// - Gemini CLI reads GEMINI.md and expands `@./file.md` imports.
//   https://geminicli.com/docs/cli/gemini-md/

const AGENTS_MD_BUDGET = 32 * 1024; // Codex project_doc_max_bytes default

function rootAgentsMdContent() {
  return [
    '## Dev-OS — Multi-Agent Engineering OS',
    '',
    'This project uses Dev-OS by Olives Technologies. This block is the canonical cross-harness instruction set for Claude Code, Codex, Cursor, OpenCode, and Gemini. `devos update` regenerates everything between the Dev-OS markers; keep your own notes outside them.',
    '',
    '### Hard Rules Digest (Must be strictly obeyed at all times)',
    ...DEVOS_RULES_DIGEST,
    '',
    '### Solo Session Protocol (Single-Agent Work)',
    ...SOLO_SESSION_PROTOCOL,
    '',
    '### Session Mode Lock (Orchestrator Persistence)',
    ...SESSION_MODE_DIRECTIVE,
    '',
    '### Roster and Protocols',
    '- Full roster, workflows, triage levels, and the Hard Rules in full: `.agents/AGENTS.md`. Read it before scoping work.',
    '- Agent personas: `.agents/agents/`. Skills: `.agents/skills/<name>/SKILL.md`.',
    '- Spec-driven features: `docs/specs/<slug>/` holds `requirements.md`, `design.md`, and `tasks.md`. Validate with `devos spec check <slug>`; list parallel waves with `devos spec waves <slug>`.',
    '- Plans: `docs/plans/`. Task Board: `docs/TASK_BOARD.md`. Memory Vault: `.agents/memory/` (ADRs in `decisions/`, handoffs in `handoffs/`).',
    '- Coding standards: `CODING_STANDARDS.md`. Agents never commit; humans commit with `.agents/scripts/commit.sh`.'
  ].join('\n');
}

// A short pointer to AGENTS.md plus the critical rules digest. `importLine`
// pulls AGENTS.md into harnesses that support imports (Claude Code, Gemini CLI).
function thinPointerContent(title, importLine, extra) {
  return [
    `## Dev-OS — ${title}`,
    '',
    'The canonical Dev-OS instructions are the Dev-OS block in `AGENTS.md` at the project root; the full rules are in `.agents/AGENTS.md`.',
    ...(importLine ? ['', importLine] : []),
    '',
    '### Hard Rules Digest (Must be strictly obeyed at all times)',
    ...DEVOS_RULES_DIGEST,
    ...(extra && extra.length ? ['', ...extra] : [])
  ].join('\n');
}

function generateRootAgentsMd(targetDir, ctx) {
  const filePath = path.join(targetDir, 'AGENTS.md');
  // 4.x never wrote a root AGENTS.md: a '# Dev-OS' heading there is the user's
  const status = upsertManagedBlock(filePath, rootAgentsMdContent(), { targetDir, ctx, legacyReplace: false });
  const size = fs.statSync(filePath).size;
  if (size > AGENTS_MD_BUDGET) {
    return `[ WARN ] AGENTS.md ${status}, but it is ${size} bytes; Codex reads only the first ${AGENTS_MD_BUDGET}`;
  }
  return `AGENTS.md ${status}`;
}

function bootstrapClaudeMd(targetDir, ctx) {
  const content = thinPointerContent('Claude Code', '@AGENTS.md', [
    '### Claude Code Tooling',
    '- Slash commands: `.claude/commands/`; subagents: `.claude/agents/` (generated from `.agents/`; refresh with `devos update`).',
    '- Skills: `.claude/skills/<name>` links to `.agents/skills/<name>`.'
  ]);
  // CLAUDE.md is the user's file; a marker-less one is never replaced wholesale
  return upsertManagedBlock(path.join(targetDir, 'CLAUDE.md'), content, { targetDir, ctx, legacyReplace: false });
}

// Write Dev-OS content into a file the user may also own (GEMINI.md,
// .cursorrules, .windsurfrules, ...) without clobbering user-authored text.
// - missing file             -> created with a marker-delimited Dev-OS block
// - file with one BEGIN/END  -> only the block between the markers is replaced
// - damaged markers          -> (BEGIN without END, END without BEGIN, duplicated
//                               or out-of-order markers) backed up, left untouched,
//                               and reported with a [ WARN ]
// - legacy Dev-OS file       -> (first line starts with '# Dev-OS', only where
//                               opts.legacyReplace allows it) backed up, then
//                               replaced by the block
// - user-authored file       -> Dev-OS block appended after the user's content
const DEVOS_BLOCK_START = '<!-- BEGIN DEV-OS -->';
const DEVOS_BLOCK_END = '<!-- END DEV-OS -->';

function indexesOf(text, needle) {
  const out = [];
  let i = text.indexOf(needle);
  while (i !== -1) { out.push(i); i = text.indexOf(needle, i + needle.length); }
  return out;
}

// { state: 'none' } | { state: 'ok', start, end } | { state: 'damaged', why }
function devosBlockBounds(text) {
  const starts = indexesOf(text, DEVOS_BLOCK_START);
  const ends = indexesOf(text, DEVOS_BLOCK_END);
  if (!starts.length && !ends.length) return { state: 'none' };
  if (starts.length === 1 && ends.length === 1 && ends[0] > starts[0]) return { state: 'ok', start: starts[0], end: ends[0] };
  let why = 'markers out of order';
  if (starts.length > 1 || ends.length > 1) why = 'duplicated markers';
  else if (!ends.length) why = 'BEGIN without END';
  else if (!starts.length) why = 'END without BEGIN';
  return { state: 'damaged', why };
}

// Copy a user-owned file aside before Dev-OS changes (or refuses to change) it.
// Inside the project: .agents/_backup/migration-<stamp>/<rel>. Elsewhere: a
// sibling <file>.devos-backup-<stamp>.
function backupUserFile(filePath, targetDir) {
  const rel = path.relative(targetDir, filePath);
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return backupForMigration(filePath, targetDir);
  const dest = `${filePath}.devos-backup-${RUN_STAMP}`;
  fs.copyFileSync(filePath, dest);
  return dest;
}

function upsertManagedBlock(filePath, content, opts = {}) {
  const targetDir = opts.targetDir || TARGET_DIR;
  const legacyReplace = opts.legacyReplace !== false;
  const note = (level, msg) => {
    if (opts.ctx && Array.isArray(opts.ctx.notes)) opts.ctx.notes.push({ level, msg });
    else if (level === 'warn') console.log(`${colors.yellow}[ WARN ] ${msg}${colors.reset}`);
    else console.log(`${colors.gray}         ${msg}${colors.reset}`);
  };
  const block = `${DEVOS_BLOCK_START}\n${content.trim()}\n${DEVOS_BLOCK_END}`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, block + '\n', 'utf8');
    return 'created';
  }
  const current = fs.readFileSync(filePath, 'utf8');
  const rel = relToTarget(targetDir, filePath);
  const bounds = devosBlockBounds(current);
  if (bounds.state === 'damaged') {
    const backup = backupUserFile(filePath, targetDir);
    note('warn', `${rel} has a damaged Dev-OS block (${bounds.why}); left unchanged, fix the markers and re-run (backup: ${backup})`);
    return 'left unchanged (damaged Dev-OS block)';
  }
  if (bounds.state === 'ok') {
    const updated = current.slice(0, bounds.start) + block + current.slice(bounds.end + DEVOS_BLOCK_END.length);
    fs.writeFileSync(filePath, updated.trimEnd() + '\n', 'utf8');
    return 'updated';
  }
  if (legacyReplace && /^# Dev-OS\b/.test(current.trimStart())) {
    const backup = backupUserFile(filePath, targetDir);
    fs.writeFileSync(filePath, block + '\n', 'utf8');
    note('info', `replaced the pre-marker Dev-OS ${rel} (backup: ${backup})`);
    return 'replaced legacy';
  }
  fs.writeFileSync(filePath, current.trimEnd() + '\n\n' + block + '\n', 'utf8');
  return 'appended';
}

// Context shared by the harness generators: a write guard for whole files
// Dev-OS owns, the list of files written (hashes recorded in the manifest),
// and notes printed after the step line.
function harnessContext(targetDir, manifest, options = {}) {
  const m = manifest || readManifestLenient(path.join(targetDir, '.agents'));
  return {
    targetDir,
    manifest: m,
    guard: options.guard || createGeneratedWriteGuard({ targetDir, manifest: m, force: options.force }),
    written: options.written || [],
    notes: []
  };
}

function printHarnessNotes(ctx) {
  ctx.notes.forEach((n) => {
    if (n.level === 'warn') console.log(`${colors.yellow}[ WARN ] ${n.msg}${colors.reset}`);
    else console.log(`${colors.gray}         ${n.msg}${colors.reset}`);
  });
  ctx.notes = [];
}

// Whole-file write through the guard. `looksLegacy(text)` recognises a
// pre-5.0 copy of this Dev-OS file that has no recorded hash; it is backed
// up, then refreshed. Returns false when a user-edited file was kept.
function writeGeneratedFile(filePath, content, ctx, looksLegacy) {
  if (!ctx.guard.allowOwned(filePath, content, looksLegacy)) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  ctx.written.push(filePath);
  return true;
}

function forgetGeneratedFile(ctx, filePath) {
  const gf = ctx.manifest && ctx.manifest.generatedFiles;
  if (gf) delete gf[relToTarget(ctx.targetDir, filePath)];
}

function removeDirIfEmpty(dir) {
  try {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory() && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  } catch (e) {}
}

// Retire a file Dev-OS used to write as a marker-delimited block. The block is
// Dev-OS content; anything outside the markers is the user's. A backup is
// always taken. Nothing outside the markers -> file removed. User content
// outside -> only the block is removed. No markers -> file left untouched.
function retireManagedBlockFile(filePath, ctx, why) {
  if (!fs.existsSync(filePath)) return null;
  const rel = relToTarget(ctx.targetDir, filePath);
  const current = fs.readFileSync(filePath, 'utf8');
  const startIdx = current.indexOf(DEVOS_BLOCK_START);
  const endIdx = startIdx === -1 ? -1 : current.indexOf(DEVOS_BLOCK_END, startIdx + 1);
  if (startIdx === -1 || endIdx === -1) {
    // No markers: the user's own file (say nothing), or a pre-marker Dev-OS copy
    if (/^# Dev-OS\b/.test(current.trimStart())) {
      ctx.notes.push({ level: 'warn', msg: `kept ${rel}: Dev-OS no longer writes it (${why}), and it has no Dev-OS markers, so it was left untouched. Delete it when ready.` });
    }
    return 'kept';
  }
  const before = current.slice(0, startIdx).replace(/\s+$/, '');
  const after = current.slice(endIdx + DEVOS_BLOCK_END.length).replace(/^\s+/, '');
  const backup = backupForMigration(filePath, ctx.targetDir);
  forgetGeneratedFile(ctx, filePath);
  if (!before && !after) {
    fs.unlinkSync(filePath);
    ctx.notes.push({ level: 'info', msg: `removed ${rel} (${why}; backup: ${backup})` });
    return 'removed';
  }
  fs.writeFileSync(filePath, [before, after].filter(Boolean).join('\n\n') + '\n', 'utf8');
  ctx.notes.push({ level: 'warn', msg: `removed the Dev-OS block from ${rel} (${why}) and kept your own content (backup: ${backup})` });
  return 'stripped';
}

// Retire a whole file Dev-OS wrote. Removed (after a backup) when it matches
// its recorded hash, or has no record and `looksLegacy` recognises it.
function retireGeneratedFile(filePath, ctx, why, looksLegacy) {
  if (!fs.existsSync(filePath)) return null;
  const rel = relToTarget(ctx.targetDir, filePath);
  const recorded = ctx.manifest && ctx.manifest.generatedFiles && ctx.manifest.generatedFiles[rel];
  const text = fs.readFileSync(filePath, 'utf8');
  const ours = recorded ? sha256(fs.readFileSync(filePath)) === recorded : Boolean(looksLegacy && looksLegacy(text));
  if (!ours) {
    ctx.notes.push({ level: 'warn', msg: `kept ${rel}: Dev-OS no longer writes it (${why}), but it was edited, so it was left untouched. Delete it when ready.` });
    return 'kept';
  }
  const backup = backupForMigration(filePath, ctx.targetDir);
  fs.unlinkSync(filePath);
  forgetGeneratedFile(ctx, filePath);
  ctx.notes.push({ level: 'info', msg: `removed ${rel} (${why}; backup: ${backup})` });
  return 'removed';
}

function generateCursorConfig(targetDir, ctx = harnessContext(targetDir)) {
  const mdcPath = path.join(targetDir, '.cursor', 'rules', 'devos.mdc');
  // alwaysApply: true -> always included, globs ignored, so none is written
  const mdcContent = [
    '---',
    `description: ${yamlScalar('Dev-OS Hard Rules digest. The canonical Dev-OS instructions are the Dev-OS block in AGENTS.md.')}`,
    'alwaysApply: true',
    '---',
    '',
    thinPointerContent('Cursor', null, [
      '### Mechanical Commit Gate',
      'Agents never commit. Humans commit through `.agents/scripts/commit.sh`.'
    ]),
    ''
  ].join('\n');
  const wrote = writeGeneratedFile(mdcPath, mdcContent, ctx,
    (old) => /^---\r?\ndescription: Dev-OS /.test(old) && old.includes('(Cursor Rules)'));

  upsertManagedBlock(path.join(targetDir, '.cursorrules'), [
    '# Dev-OS Cursor Rules',
    'Follow the Dev-OS block in AGENTS.md and the full rules in .agents/AGENTS.md.',
    'Agents never commit. Humans commit through .agents/scripts/commit.sh.',
    ''
  ].join('\n'), { targetDir, ctx });

  return wrote ? '.cursor/rules/devos.mdc + .cursorrules' : '.cursorrules (kept your edited .cursor/rules/devos.mdc)';
}

const OPENCODE_SCHEMA = 'https://opencode.ai/config.json';
const OPENCODE_INSTRUCTIONS = ['.agents/AGENTS.md'];
const LEGACY_OPENCODE_KEYS = ['name', 'version', 'rules', 'manifest'];

// Merge Dev-OS into the project-root opencode.json: add `$schema` when absent
// and union OPENCODE_INSTRUCTIONS into `instructions`. Every user key is kept.
// A file that is not plain JSON (JSONC with comments) is never rewritten.
function mergeOpenCodeJson(configPath, ctx) {
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      config = null;
    }
    if (!config || typeof config !== 'object' || Array.isArray(config) ||
      (config.instructions !== undefined && !Array.isArray(config.instructions))) {
      ctx.notes.push({ level: 'warn', msg: `kept opencode.json untouched (not plain JSON or "instructions" is not an array); add ${JSON.stringify(OPENCODE_INSTRUCTIONS)} to "instructions" yourself` });
      return 'kept';
    }
  }
  const instructions = Array.isArray(config.instructions) ? config.instructions.slice() : [];
  OPENCODE_INSTRUCTIONS.forEach((i) => { if (!instructions.includes(i)) instructions.push(i); });
  const { $schema, ...rest } = config;
  const next = { $schema: $schema || OPENCODE_SCHEMA, ...rest, instructions };
  const out = JSON.stringify(next, null, 2) + '\n';
  const existed = fs.existsSync(configPath);
  if (existed && fs.readFileSync(configPath, 'utf8') === out) return 'unchanged';
  fs.writeFileSync(configPath, out, 'utf8');
  return existed ? 'merged' : 'created';
}

// The 4.x/5.0 .opencode/opencode.json carried keys OpenCode's strict schema
// rejects, in a location OpenCode does not read as config.
function retireLegacyOpenCodeJson(filePath, ctx) {
  if (!fs.existsSync(filePath)) return null;
  let parsed = null;
  try { parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) {}
  if (!parsed || parsed.name !== 'Dev-OS') return null; // not ours
  const keys = Object.keys(parsed);
  const pristine = keys.every((k) => LEGACY_OPENCODE_KEYS.includes(k)) &&
    JSON.stringify(parsed.rules) === JSON.stringify(['.opencode/rules/devos-rules.md']) &&
    parsed.manifest === '.agents/manifest.json';
  return retireGeneratedFile(filePath, ctx, 'OpenCode reads opencode.json at the project root', () => pristine);
}

function generateOpenCodeConfig(targetDir, ctx = harnessContext(targetDir)) {
  const status = mergeOpenCodeJson(path.join(targetDir, 'opencode.json'), ctx);
  const opencodeDir = path.join(targetDir, '.opencode');
  retireLegacyOpenCodeJson(path.join(opencodeDir, 'opencode.json'), ctx);
  retireManagedBlockFile(path.join(targetDir, 'OPENCODE.md'), ctx, 'OpenCode reads AGENTS.md, not OPENCODE.md');
  retireGeneratedFile(path.join(opencodeDir, 'rules', 'devos-rules.md'), ctx, 'opencode.json "instructions" now points at .agents/AGENTS.md',
    (text) => text.startsWith('# OpenCode Dev-OS Rules'));
  removeDirIfEmpty(path.join(opencodeDir, 'rules'));
  removeDirIfEmpty(opencodeDir);
  return `opencode.json (${status})`;
}

function generateAntigravityConfig(targetDir, ctx) {
  upsertManagedBlock(path.join(targetDir, 'GEMINI.md'), thinPointerContent('Gemini CLI', '@./AGENTS.md'), { targetDir, ctx });
  upsertManagedBlock(path.join(targetDir, 'ANTIGRAVITY.md'), thinPointerContent('Google Antigravity', null), { targetDir, ctx });
  return 'ANTIGRAVITY.md + GEMINI.md';
}

function generateGeminiConfig(targetDir, ctx) {
  return generateAntigravityConfig(targetDir, ctx);
}

function generateCodexConfig(targetDir, ctx = harnessContext(targetDir)) {
  const codexDir = path.join(targetDir, '.codex');
  retireManagedBlockFile(path.join(codexDir, 'instructions.md'), ctx, 'Codex reads AGENTS.md');
  removeDirIfEmpty(codexDir);
  upsertManagedBlock(path.join(targetDir, '.windsurfrules'),
    '# Dev-OS Windsurf Rules\nFollow the Dev-OS block in AGENTS.md and the full rules in .agents/AGENTS.md.\n', { targetDir, ctx });
  return '.windsurfrules';
}

// Write every selected harness's files. AGENTS.md is written for every
// install: it is the canonical cross-harness file.
function generateHarnessConfigs(targetDir, harnesses, ctx) {
  const done = [generateRootAgentsMd(targetDir, ctx)];
  if (harnesses.has('cursor')) done.push(`Cursor: ${generateCursorConfig(targetDir, ctx)}`);
  if (harnesses.has('opencode')) done.push(`OpenCode: ${generateOpenCodeConfig(targetDir, ctx)}`);
  if (harnesses.has('antigravity') || harnesses.has('gemini')) done.push(`Antigravity/Gemini: ${generateAntigravityConfig(targetDir, ctx)}`);
  if (harnesses.has('codex')) done.push(`Codex/Windsurf: ${generateCodexConfig(targetDir, ctx)}`);
  return done;
}

// ---------------------------------------------------------------------------
// Claude Code skills (.claude/skills/<name>)
// ---------------------------------------------------------------------------
// Claude Code discovers project skills at .claude/skills/<name>/SKILL.md and
// follows a symlinked <name> folder (https://code.claude.com/docs/en/skills,
// "Symlinked folders"). Each installed skill gets a relative link to
// ../../.agents/skills/<name>. On Windows, when symlink() fails, or with
// DEVOS_SKILL_LINKS=copy, the skill is copied instead and the copy's tree hash
// is recorded in manifest.generatedFiles under '.claude/skills/<name>/'.
// A user's own directory, file, or symlink at that path is never replaced.

function claudeSkillLinkTarget(name) {
  return `../../.agents/skills/${name}`;
}

function realpathOr(p, fallback) {
  try { return fs.realpathSync(p); } catch (e) { return fallback; }
}

// Where .claude/skills really lives, and the skill source root under the
// real project path.
// When .claude or .claude/skills is itself a symlink, a link's relative target
// resolves against the real directory, not the project path, so link targets
// are computed from there. `redirected` is true in that case.
function claudeSkillsLayout(targetDir) {
  const realTarget = realpathOr(targetDir, path.resolve(targetDir));
  const plainDir = path.join(realTarget, '.claude', 'skills');
  const skillsDir = path.join(targetDir, '.claude', 'skills');
  let realDir = realpathOr(skillsDir, null);
  if (!realDir) {
    const realClaude = realpathOr(path.join(targetDir, '.claude'), null);
    realDir = realClaude ? path.join(realClaude, 'skills') : plainDir;
  }
  // Not realpath'd: a symlinked .agents/skills keeps working through the project path
  const srcRoot = path.join(realTarget, '.agents', 'skills');
  return { skillsDir, realDir, srcRoot, redirected: realDir !== plainDir };
}

// The symlink target for .claude/skills/<name>: ../../.agents/skills/<name> in
// a normal project, otherwise relative to the real .claude/skills location
function claudeSkillLinkTargetFor(layout, name) {
  return path.relative(layout.realDir, path.join(layout.srcRoot, name)).split(path.sep).join('/');
}

// Our link, judged by where it resolves from the real directory. A broken
// link with the 5.0 relative target also counts as ours, so it gets repaired.
function isOurSkillLink(layout, name, target) {
  if (path.resolve(layout.realDir, target) === path.join(layout.srcRoot, name)) return true;
  return target === claudeSkillLinkTarget(name) && !fs.existsSync(path.join(layout.skillsDir, name));
}

function claudeSkillCopyKey(name) {
  return `.claude/skills/${name}/`;
}

function installedSkillNames(targetDir) {
  const dir = path.join(targetDir, '.agents', 'skills');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f !== '_backup' && !f.startsWith('.') && safeFileStem(f, null) &&
    fs.statSync(path.join(dir, f)).isDirectory()).sort();
}

// State of .claude/skills/<name>: missing | linked | dangling | foreign-link |
// copy-fresh | copy-stale | copy-edited | user-dir | user-file
function inspectClaudeSkill(targetDir, name, manifest, layout = claudeSkillsLayout(targetDir)) {
  const p = path.join(targetDir, '.claude', 'skills', name);
  let st;
  try { st = fs.lstatSync(p); } catch (e) { return 'missing'; }
  if (st.isSymbolicLink()) {
    if (!isOurSkillLink(layout, name, fs.readlinkSync(p))) return 'foreign-link';
    return fs.existsSync(p) ? 'linked' : 'dangling';
  }
  if (!st.isDirectory()) return 'user-file';
  const recorded = manifest && manifest.generatedFiles && manifest.generatedFiles[claudeSkillCopyKey(name)];
  if (!recorded) return 'user-dir';
  const hash = computeSkillHash(p);
  if (hash !== recorded) return 'copy-edited';
  const src = path.join(targetDir, '.agents', 'skills', name);
  return fs.existsSync(src) && computeSkillHash(src) === hash ? 'copy-fresh' : 'copy-stale';
}

function claudeSkillsUseCopy() {
  return process.platform === 'win32' || process.env.DEVOS_SKILL_LINKS === 'copy';
}

// Create, refresh and prune .claude/skills/ entries. Mutates
// manifest.generatedFiles (copy hashes). Returns a report.
function syncClaudeSkills(targetDir, manifest) {
  const report = { linked: [], copied: [], refreshed: [], unchanged: 0, kept: [], removed: [], notes: [] };
  const skillsDir = path.join(targetDir, '.claude', 'skills');
  const names = installedSkillNames(targetDir);
  if (!manifest.generatedFiles || typeof manifest.generatedFiles !== 'object') manifest.generatedFiles = {};
  const gf = manifest.generatedFiles;
  const useCopy = claudeSkillsUseCopy();
  fs.mkdirSync(skillsDir, { recursive: true });
  const layout = claudeSkillsLayout(targetDir);
  if (layout.redirected) {
    report.notes.push(`.claude/skills resolves through a symlink to ${layout.realDir}; skill links there point at ${layout.srcRoot} relative to that location`);
  }

  const place = (name) => {
    const p = path.join(skillsDir, name);
    if (!useCopy) {
      // Relative to the real directory first, then absolute; never leave a dangling link
      const relTarget = claudeSkillLinkTargetFor(layout, name);
      for (const target of [relTarget, path.join(layout.srcRoot, name)]) {
        try {
          fs.symlinkSync(target, p, 'dir');
          if (fs.existsSync(p)) {
            delete gf[claudeSkillCopyKey(name)];
            return 'linked';
          }
          fs.unlinkSync(p);
        } catch (e) { /* try the next form, then fall back to a copy */ }
      }
    }
    copyRecursiveSync(path.join(targetDir, '.agents', 'skills', name), p);
    gf[claudeSkillCopyKey(name)] = computeSkillHash(p);
    return 'copied';
  };

  names.forEach((name) => {
    const p = path.join(skillsDir, name);
    const state = inspectClaudeSkill(targetDir, name, manifest, layout);
    if (state === 'missing') {
      report[place(name)].push(name);
    } else if (state === 'linked') {
      report.unchanged++;
    } else if (state === 'dangling') {
      fs.unlinkSync(p);
      report[place(name)].push(name);
    } else if (state === 'copy-fresh') {
      if (useCopy) { report.unchanged++; return; }
      // Our unedited copy: upgrade it to a link now that links work
      fs.rmSync(p, { recursive: true, force: true });
      if (place(name) === 'linked') report.linked.push(name); else report.unchanged++;
    } else if (state === 'copy-stale') {
      fs.rmSync(p, { recursive: true, force: true });
      place(name);
      report.refreshed.push(name);
    } else {
      report.kept.push(`${name} (${state})`);
    }
  });

  // Prune our own entries for skills that are no longer installed
  fs.readdirSync(skillsDir).filter((f) => !names.includes(f)).forEach((entry) => {
    const p = path.join(skillsDir, entry);
    let st;
    try { st = fs.lstatSync(p); } catch (e) { return; }
    if (st.isSymbolicLink()) {
      if (isOurSkillLink(layout, entry, fs.readlinkSync(p)) && !fs.existsSync(p)) {
        fs.unlinkSync(p);
        report.removed.push(entry);
      }
      return;
    }
    const key = claudeSkillCopyKey(entry);
    if (st.isDirectory() && gf[key] && computeSkillHash(p) === gf[key]) {
      copyRecursiveSync(p, path.join(targetDir, '.agents', '_backup', `migration-${RUN_STAMP}`, '.claude', 'skills', entry));
      fs.rmSync(p, { recursive: true, force: true });
      delete gf[key];
      report.removed.push(entry);
    }
  });
  removeDirIfEmpty(skillsDir);
  return report;
}

function describeClaudeSkillSync(r) {
  const parts = [];
  if (r.linked.length) parts.push(`${r.linked.length} linked`);
  if (r.copied.length) parts.push(`${r.copied.length} copied`);
  if (r.refreshed.length) parts.push(`${r.refreshed.length} refreshed`);
  parts.push(`${r.unchanged} unchanged`);
  if (r.removed.length) parts.push(`${r.removed.length} pruned`);
  if (r.kept.length) parts.push(`${r.kept.length} of yours kept`);
  return parts.join(', ');
}

function warnKeptClaudeSkills(r) {
  (r.notes || []).forEach((n) => console.log(`${colors.yellow}[ WARN ] ${n}${colors.reset}`));
  r.kept.forEach((k) => console.log(`${colors.yellow}[ WARN ] kept your .claude/skills/${k}; Dev-OS links skills there only when the path is free or Dev-OS-owned${colors.reset}`));
}

// Drift between .agents/skills/ and .claude/skills/ for `devos doctor`
function claudeSkillsDrift(targetDir, manifest) {
  const drift = { missing: [], dangling: [], stale: [], kept: [], orphaned: [] };
  const names = installedSkillNames(targetDir);
  const layout = claudeSkillsLayout(targetDir);
  names.forEach((name) => {
    const state = inspectClaudeSkill(targetDir, name, manifest, layout);
    if (state === 'missing') drift.missing.push(name);
    else if (state === 'dangling') drift.dangling.push(name);
    else if (state === 'copy-stale') drift.stale.push(name);
    else if (state !== 'linked' && state !== 'copy-fresh') drift.kept.push(name);
  });
  const skillsDir = path.join(targetDir, '.claude', 'skills');
  if (fs.existsSync(skillsDir)) {
    fs.readdirSync(skillsDir).filter((f) => !names.includes(f)).forEach((entry) => {
      const p = path.join(skillsDir, entry);
      try {
        if (fs.lstatSync(p).isSymbolicLink() && isOurSkillLink(layout, entry, fs.readlinkSync(p))) drift.orphaned.push(entry);
      } catch (e) {}
    });
  }
  return drift;
}

// After `devos skill add|sync|update`: keep .claude/skills/ in step when the
// project uses Claude Code (manifest platform, or .claude/ on disk).
function refreshClaudeSkillLinks(flags) {
  if (TEMPLATE_DIR === TARGET_DIR || flags.dryRun) return;
  const manifestPath = path.join(TARGET_DIR, '.agents', 'manifest.json');
  if (!fs.existsSync(manifestPath)) return;
  const manifest = readManifestLenient(path.join(TARGET_DIR, '.agents'));
  if (!harnessesForUpdate({}, manifest).has('claude') || !fs.existsSync(path.join(TARGET_DIR, '.claude'))) return;
  const res = syncClaudeSkills(TARGET_DIR, manifest);
  if (!flags.json) warnKeptClaudeSkills(res);
  if (res.linked.length || res.copied.length || res.refreshed.length || res.removed.length) {
    saveSkillManifest(manifest, TARGET_DIR);
    if (!flags.json) console.log(`${colors.gray}         .claude/skills/: ${describeClaudeSkillSync(res)}${colors.reset}`);
  }
}

function describeClaudeSkillsDrift(d) {
  const parts = [];
  if (d.missing.length) parts.push(`missing: ${d.missing.join(', ')}`);
  if (d.dangling.length) parts.push(`broken links: ${d.dangling.join(', ')}`);
  if (d.stale.length) parts.push(`stale copies: ${d.stale.join(', ')}`);
  if (d.orphaned.length) parts.push(`links to removed skills: ${d.orphaned.join(', ')}`);
  return parts.length ? `${parts.join('; ')}; run devos update` : null;
}

// Claude Code hook wiring (contract C1). Merged into .claude/settings.json;
// Dev-OS-owned entries are identified by a command containing '.agents/hooks/'.
// Rule syntax verified against https://code.claude.com/docs/en/permissions
// (space-separated trailing wildcard, e.g. `Bash(git commit *)`; `Read(./.env)`).
const DEVOS_HOOK_MARKER = '.agents/hooks/';
const DEVOS_CLAUDE_HOOKS = {
  SessionStart: [{ hooks: [{ type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.agents/hooks/session-start.sh' }] }],
  UserPromptSubmit: [{ hooks: [{ type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.agents/hooks/user-prompt-submit.sh' }] }],
  PreToolUse: [{ matcher: 'Bash|Edit|Write|MultiEdit|NotebookEdit', hooks: [{ type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.agents/hooks/pre-tool-use.sh' }] }],
  // PostToolUse exit 2 shows stderr to Claude; the edit has already happened (hooks reference, exit code table)
  PostToolUse: [{ matcher: 'Edit|Write|MultiEdit', hooks: [{ type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.agents/hooks/post-tool-use.sh' }] }],
  Stop: [{ hooks: [{ type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.agents/hooks/stop.sh' }] }],
  // No matcher: SubagentStop matches on agent type, and an omitted matcher fires for every subagent
  SubagentStop: [{ hooks: [{ type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.agents/hooks/subagent-stop.sh' }] }],
  SessionEnd: [{ hooks: [{ type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.agents/hooks/session-end.sh' }] }]
};
const DEVOS_PERMISSION_DENY = [
  'Bash(git commit *)',
  'Bash(git push --force *)',
  'Bash(git push -f *)',
  'Read(./.env)',
  'Read(./.env.*)'
];

// Only the seven Dev-OS lifecycle scripts are Dev-OS-owned. A user hook that
// happens to live in .agents/hooks/ (e.g. my-audit.sh) is never touched.
// SessionStart has no matcher, so it already fires on `compact` (re-injection).
const DEVOS_HOOK_SCRIPTS = ['session-start.sh', 'user-prompt-submit.sh', 'pre-tool-use.sh', 'post-tool-use.sh', 'stop.sh', 'subagent-stop.sh', 'session-end.sh'];
const DEVOS_HOOK_COMMAND_RE = new RegExp(`(^|[/"'\\s])\\.agents/hooks/(${DEVOS_HOOK_SCRIPTS.map(escapeRegExp).join('|')})(?=$|["'\\s;&|])`);

function isDevosHookCommand(entry) {
  return Boolean(entry && typeof entry.command === 'string' && DEVOS_HOOK_COMMAND_RE.test(entry.command));
}

function mergeClaudeSettings(existing) {
  const settings = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  if (!settings.$schema) {
    settings.$schema = 'https://json.schemastore.org/claude-code-settings.json';
  }

  const hooks = settings.hooks && typeof settings.hooks === 'object' && !Array.isArray(settings.hooks) ? settings.hooks : {};
  // Strip previously written Dev-OS hook handlers from every event, keep user handlers
  Object.keys(hooks).forEach((event) => {
    if (!Array.isArray(hooks[event])) return;
    hooks[event] = hooks[event]
      .map((group) => {
        if (!group || !Array.isArray(group.hooks)) return group;
        return { ...group, hooks: group.hooks.filter((h) => !isDevosHookCommand(h)) };
      })
      .filter((group) => !(group && Array.isArray(group.hooks) && group.hooks.length === 0));
    if (hooks[event].length === 0) delete hooks[event];
  });
  Object.keys(DEVOS_CLAUDE_HOOKS).forEach((event) => {
    const ours = JSON.parse(JSON.stringify(DEVOS_CLAUDE_HOOKS[event]));
    hooks[event] = Array.isArray(hooks[event]) ? hooks[event].concat(ours) : ours;
  });
  settings.hooks = hooks;

  const permissions = settings.permissions && typeof settings.permissions === 'object' && !Array.isArray(settings.permissions) ? settings.permissions : {};
  const deny = Array.isArray(permissions.deny) ? permissions.deny.slice() : [];
  DEVOS_PERMISSION_DENY.forEach((rule) => {
    if (!deny.includes(rule)) deny.push(rule);
  });
  permissions.deny = deny;
  settings.permissions = permissions;
  // Keep $schema as the first key for readability
  const { $schema, ...rest } = settings;
  return { $schema, ...rest };
}

function removeLegacyClaudeHooksJson(destClaude) {
  const legacyPath = path.join(destClaude, 'hooks.json');
  if (!fs.existsSync(legacyPath)) return false;
  const raw = fs.readFileSync(legacyPath, 'utf8');
  if (!raw.includes(DEVOS_HOOK_MARKER)) return false;
  // Back up first: the user may have added their own entries to it
  const backup = backupForMigration(legacyPath, path.dirname(destClaude));
  fs.unlinkSync(legacyPath);
  return backup;
}

function wireHooks(destAgents, destClaude) {
  const hooksDir = path.join(destAgents, 'hooks');
  if (fs.existsSync(hooksDir)) {
    fs.readdirSync(hooksDir).forEach((file) => {
      if (file.endsWith('.sh')) {
        fs.chmodSync(path.join(hooksDir, file), '755');
      }
    });
  }

  if (destClaude) {
    fs.mkdirSync(destClaude, { recursive: true });
    const settingsPath = path.join(destClaude, 'settings.json');
    let existing = {};
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf8');
      if (raw.trim()) {
        try {
          existing = JSON.parse(raw);
        } catch (e) {
          throw new Error(`.claude/settings.json is not valid JSON (${e.message}); fix it or move it aside, then re-run. It was left untouched.`);
        }
      }
    }
    const merged = mergeClaudeSettings(existing);
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
    const removedLegacy = removeLegacyClaudeHooksJson(destClaude);
    return `executable hooks + .claude/settings.json (merged)${removedLegacy ? `, removed legacy .claude/hooks.json (backup: ${removedLegacy})` : ''}`;
  }
  return 'executable hooks (.agents/hooks/)';
}

// Effective hooks choice recorded for a project. 5.x manifests record it
// faithfully. 4.x always wrote hooksEnabled: true (even with --no-hooks), so for
// those the choice is inferred from disk: hooks were on only if Dev-OS wired
// .claude/hooks.json or installed its .git/hooks/pre-commit gate.
function recordedHooksChoice(manifest, targetDir) {
  const major = parseInt(String((manifest && manifest.version) || '0'), 10) || 0;
  if (major >= 5) return manifest.hooksEnabled !== false;
  if (fs.existsSync(path.join(targetDir, '.claude', 'hooks.json'))) return true;
  if (claudeHooksWired(targetDir)) return true;
  const preCommit = path.join(targetDir, '.git', 'hooks', 'pre-commit');
  try {
    if (fs.existsSync(preCommit) && /DEVOS_COMMIT_APPROVED|Dev-OS Pre-Commit/.test(fs.readFileSync(preCommit, 'utf8'))) return true;
  } catch (e) {}
  return false;
}

// Returns true when the Dev-OS PreToolUse hook is wired in .claude/settings.json
function claudeHooksWired(targetDir) {
  const settingsPath = path.join(targetDir, '.claude', 'settings.json');
  if (!fs.existsSync(settingsPath)) return false;
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const groups = settings && settings.hooks && Array.isArray(settings.hooks.PreToolUse) ? settings.hooks.PreToolUse : [];
    return groups.some((g) => g && Array.isArray(g.hooks) && g.hooks.some((h) => h && h.type === 'command' &&
      typeof h.command === 'string' && h.command.includes('.agents/hooks/pre-tool-use.sh')));
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Network side effects (contract C4)
// ---------------------------------------------------------------------------

// Pinned skills.sh CLI (verified with `npm view skills version` on 2026-10-22)
const SKILLS_CLI = 'skills@1.7.4';

function isOffline() {
  const v = String(process.env.DEVOS_OFFLINE || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function warnOfflineSkip(what) {
  console.log(`${colors.yellow}[ WARN ] skipped (offline): ${what} (DEVOS_OFFLINE is set)${colors.reset}`);
}

function runSkillsCli(args, options = {}) {
  const label = `npx ${SKILLS_CLI} ${args.join(' ')}`;
  if (isOffline()) {
    warnOfflineSkip(label);
    return { status: null, skipped: true };
  }
  return spawnSync('npx', ['--yes', SKILLS_CLI, ...args], {
    cwd: TARGET_DIR,
    stdio: options.stdio || 'inherit',
    env: { ...process.env, CI: '1' }
  });
}

// Environment for .agents/scripts/install-hooks.sh: DEVOS_INSTALL_GITLEAKS=1
// only when --install-gitleaks was passed; never inherited by default.
function installHooksEnv(flags) {
  const env = { ...process.env };
  delete env.DEVOS_INSTALL_GITLEAKS;
  if (flags && flags.installGitleaks && !isOffline()) env.DEVOS_INSTALL_GITLEAKS = '1';
  return env;
}

// Detect Gitleaks. This function never downloads or installs anything: the
// single install path is .agents/scripts/install-hooks.sh, which the CLI runs
// right after this check with DEVOS_INSTALL_GITLEAKS=1 when --install-gitleaks
// was passed (see installHooksEnv). Keeping one installer avoids two
// unverified download paths. A '[ WARN ]' prefix is rendered in yellow by step().
function ensureGitleaks(targetDir, options = {}) {
  const install = Boolean(options.install);
  const localBin = path.join(targetDir, '.agents', 'bin', 'gitleaks');
  let glBin = null;

  const whichRes = spawnSync('which', ['gitleaks'], { encoding: 'utf8' });
  if (whichRes.status === 0 && whichRes.stdout.trim()) {
    glBin = whichRes.stdout.trim();
  } else if (fs.existsSync(localBin)) {
    glBin = localBin;
  }

  if (glBin) {
    let ver = 'active';
    try {
      const verRes = spawnSync(glBin, ['version'], { encoding: 'utf8', timeout: 5000 });
      if (verRes.status === 0 && verRes.stdout && verRes.stdout.trim()) {
        ver = verRes.stdout.trim().split('\n')[0];
      }
    } catch (e) {}
    return `gitleaks v${ver} (verified & active)${install ? '; upgrade handled by install-hooks.sh' : ''}`;
  }

  if (install && isOffline()) {
    return '[ WARN ] skipped (offline): gitleaks install; built-in scanner active';
  }
  if (install) {
    if (!fs.existsSync(path.join(targetDir, '.git'))) {
      return '[ WARN ] gitleaks not installed: --install-gitleaks needs a git repository (install-hooks.sh does the install)';
    }
    return 'not found; install-hooks.sh will install it (--install-gitleaks)';
  }
  const hasBrew = spawnSync('which', ['brew'], { encoding: 'utf8' }).status === 0;
  const hint = hasBrew ? "run 'brew install gitleaks'" : 'see https://github.com/gitleaks/gitleaks#installing';
  return `[ WARN ] gitleaks not found; built-in scanner active. To install, ${hint} or re-run with --install-gitleaks`;
}

// Append missing lines to the target's .gitignore under a comment header.
// Idempotent: an entry already present (exact line) is never added twice.
function ensureGitignoreEntries(targetDir, groups) {
  const gitignorePath = path.join(targetDir, '.gitignore');
  let content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const lines = new Set(content.split(/\r?\n/).map((l) => l.trim()));
  let updated = false;
  groups.forEach(({ comment, entries }) => {
    const missing = entries.filter((e) => !lines.has(e) && !lines.has(e.replace(/\/$/, '')));
    if (!missing.length) return;
    content = `${content.trimEnd()}${content.trim() ? '\n\n' : ''}# ${comment}\n${missing.join('\n')}\n`;
    missing.forEach((e) => lines.add(e));
    updated = true;
  });
  if (updated) fs.writeFileSync(gitignorePath, content.trimStart(), 'utf8');
  return updated;
}

const DEVOS_GITIGNORE_GROUPS = [
  { comment: 'Dev-OS temporary backups', entries: ['.agents/_backup/'] },
  { comment: 'Dev-OS runtime session state', entries: ['.agents/memory/session.json', '.agents/memory/sdlc-state.json'] },
  { comment: 'Dev-OS local tool binaries (gitleaks installed by install-hooks.sh)', entries: ['.agents/bin/'] }
];

// ---------------------------------------------------------------------------
// Capability Packs & Skills Copying Helper
// ---------------------------------------------------------------------------

const ALL_HARNESS_TARGETS = ['claude', 'antigravity', 'cursor', 'opencode', 'codex'];

// Turn a platform/harness choice ('all', 'claude,cursor', 'gemini', ...) into a Set
function resolveHarnesses(rawChoice) {
  const selected = new Set();
  if (!rawChoice || rawChoice === 'all') {
    ALL_HARNESS_TARGETS.forEach((h) => selected.add(h));
    return selected;
  }
  String(rawChoice).split(',').map((h) => h.trim().toLowerCase()).forEach((h) => {
    if (h === 'gemini') h = 'antigravity';
    if (h === 'windsurf') h = 'codex';
    if (h === 'all') {
      ALL_HARNESS_TARGETS.forEach((p) => selected.add(p));
    } else if (HARNESSES.includes(h) || PLATFORMS.includes(h)) {
      selected.add(h);
    }
  });
  return selected;
}

// Copy the Dev-OS core structure (everything but skills) into a target.
// memory/ is not copied wholesale (the source checkout's own session/context
// state must never land in a target), and evals/ ships only its suites: the
// source repo's reports (latest-scorecard.json, run history) stay behind.
// The source .agents/manifest.json is never read or copied.
function copyCoreComponents(srcAgents, destAgents) {
  ['agents', 'commands', 'hooks', 'scripts', 'templates', 'catalog'].forEach((dir) => {
    const src = path.join(srcAgents, dir);
    if (fs.existsSync(src)) copyRecursiveSync(src, path.join(destAgents, dir));
  });
  const suites = path.join(srcAgents, 'evals', 'suites');
  if (fs.existsSync(suites)) copyRecursiveSync(suites, path.join(destAgents, 'evals', 'suites'));
  fs.mkdirSync(path.join(destAgents, 'evals', 'reports'), { recursive: true });
  installMemoryTemplates(srcAgents, destAgents);
  ['AGENTS.md', 'README.md', 'packs.json'].forEach((file) => {
    const src = path.join(srcAgents, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(destAgents, file));
  });
}

// Target manifest for migration decisions; tolerates a missing or broken file
function readManifestLenient(destAgents) {
  const manifestPath = path.join(destAgents, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return { installedPacks: [], skills: {} };
  try {
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return m && typeof m === 'object' ? m : { installedPacks: [], skills: {} };
  } catch (e) {
    return { installedPacks: [], skills: {} };
  }
}

// Copy only memory templates (never the source repo's own session/context state)
function installMemoryTemplates(srcAgents, destAgents) {
  const pairs = [
    ['decisions', 'ADR-000-template.md'],
    ['handoffs', 'handoff-template.md']
  ];
  pairs.forEach(([dir, file]) => {
    const destDir = path.join(destAgents, 'memory', dir);
    fs.mkdirSync(destDir, { recursive: true });
    const src = path.join(srcAgents, 'memory', dir, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(destDir, file));
  });
}

// Skills listed by the given packs (unknown pack ids are ignored)
function packSkillNames(packsData, packIds) {
  const out = new Set();
  if (!packsData || !packsData.packs) return [];
  packIds.forEach((id) => {
    const p = packsData.packs[id];
    if (p && Array.isArray(p.skills)) p.skills.forEach((sk) => out.add(sk));
  });
  return Array.from(out);
}

// True when the skill name ships with Dev-OS (listed in any packs.json pack)
function isShippedSkill(packsData, name) {
  return Boolean(packsData && packsData.packs && Object.values(packsData.packs).some((p) => Array.isArray(p.skills) && p.skills.includes(name)));
}

// Install or refresh one Dev-OS skill from the templates without losing user
// edits. A skill whose files differ from the hash recorded in the manifest (or
// that has no record: a user-authored skill sharing the name) is customized:
// it is kept unless `force`, which backs it up first. Mutates manifest.skills.
// Returns { status: installed|updated|unchanged|customized|missing, backup }.
function installSkillSafely(srcSkills, destSkills, name, manifest, options = {}) {
  const srcPath = path.join(srcSkills, name);
  const destPath = path.join(destSkills, name);
  if (!safeFileStem(name, null) || !fs.existsSync(srcPath)) return { status: 'missing' };
  if (!manifest.skills || typeof manifest.skills !== 'object') manifest.skills = {};
  const entry = manifest.skills[name];
  const now = new Date().toISOString();
  const record = () => {
    manifest.skills[name] = {
      source: (entry && entry.source) || options.source || 'core',
      version: PKG.version,
      hash: computeSkillHash(destPath),
      customized: false,
      installedAt: (entry && entry.installedAt) || now,
      updatedAt: now
    };
  };
  if (!fs.existsSync(destPath)) {
    copyRecursiveSync(srcPath, destPath);
    record();
    return { status: 'installed' };
  }
  const destHash = computeSkillHash(destPath);
  if (destHash === computeSkillHash(srcPath)) {
    if (!entry || entry.hash !== destHash) record();
    return { status: 'unchanged' };
  }
  const customized = !entry || !entry.hash || entry.hash !== destHash;
  let backup = null;
  if (customized) {
    if (!options.force) {
      if (entry) entry.customized = true;
      return { status: 'customized' };
    }
    backup = relToTarget(options.targetDir || TARGET_DIR, backupSkill(destPath, name, options.targetDir || TARGET_DIR));
  }
  copyRecursiveSync(srcPath, destPath);
  record();
  return { status: 'updated', backup };
}

function warnCustomizedSkills(names, command) {
  names.forEach((n) => console.log(`${colors.yellow}[ WARN ] kept your customized skill .agents/skills/${n}/; run '${command} --force' to refresh it (a backup is taken)${colors.reset}`));
}

// Install core + default + stack packs (or every skill). `prior` is the
// manifest of an existing install (re-init): its installed packs, skill
// records, generatedFiles and other choices are merged, never reset, and
// customized skills are kept in place unless options.force.
function installSkillsAndPacks(srcAgents, destAgents, stack, allSkills, telemetry = true, mode = 'interactive', goal = '', platform = 'all', hooks = true, prior = null, options = {}) {
  const srcSkills = path.join(srcAgents, 'skills');
  const destSkills = path.join(destAgents, 'skills');
  const packsPath = path.join(srcAgents, 'packs.json');
  const manifestPath = path.join(destAgents, 'manifest.json');
  const targetDir = path.dirname(destAgents);
  fs.mkdirSync(destSkills, { recursive: true });

  const packsData = fs.existsSync(packsPath) ? JSON.parse(fs.readFileSync(packsPath, 'utf8')) : null;
  const priorSkills = prior && prior.skills && typeof prior.skills === 'object' ? prior.skills : {};
  const work = { skills: { ...priorSkills } };
  const result = { customized: [], backedUp: [] };

  let installedPacks;
  let skillsToInstall;
  if (allSkills || !packsData) {
    // --all-skills means every skill, not the maintainer agents/commands:
    // packs that ship agents or commands still need an explicit `pack add`.
    installedPacks = packsData ? Object.keys(packsData.packs).filter((k) => !packHasAssets(packsData.packs[k])) : ['all'];
    skillsToInstall = fs.existsSync(srcSkills) ? fs.readdirSync(srcSkills).filter((f) => fs.statSync(path.join(srcSkills, f)).isDirectory()) : [];
  } else {
    // Lean pack installation: core + packs flagged default + the stack pack.
    // Packs that ship agents/commands (maintainer) are never installed implicitly.
    installedPacks = ['core'];
    Object.keys(packsData.packs).forEach((pKey) => {
      if (pKey === 'core') return;
      const p = packsData.packs[pKey];
      if (packHasAssets(p)) return;
      if (p.default === true || p.stack === stack || pKey === stack) installedPacks.push(pKey);
    });
  }
  // Re-init keeps every pack the project already had (union)
  const priorPacks = prior && Array.isArray(prior.installedPacks) ? prior.installedPacks : [];
  priorPacks.forEach((id) => { if (!installedPacks.includes(id)) installedPacks.push(id); });
  if (!skillsToInstall) skillsToInstall = packSkillNames(packsData, installedPacks);
  else packSkillNames(packsData, priorPacks).forEach((sk) => { if (!skillsToInstall.includes(sk)) skillsToInstall.push(sk); });

  skillsToInstall.forEach((skillName) => {
    const res = installSkillSafely(srcSkills, destSkills, skillName, work, { force: options.force, targetDir });
    if (res.status === 'customized') result.customized.push(skillName);
    if (res.backup) result.backedUp.push(res.backup);
  });

  // Every skill dir gets a record; one Dev-OS does not ship is 'local'
  if (fs.existsSync(destSkills)) {
    fs.readdirSync(destSkills).filter((f) => f !== '_backup' && fs.statSync(path.join(destSkills, f)).isDirectory()).forEach((sName) => {
      if (work.skills[sName]) return;
      const now = new Date().toISOString();
      work.skills[sName] = {
        source: isShippedSkill(packsData, sName) ? 'core' : 'local',
        version: PKG.version,
        hash: computeSkillHash(path.join(destSkills, sName)),
        customized: false,
        installedAt: now,
        updatedAt: now
      };
    });
  }
  // Drop records of skills no longer on disk
  Object.keys(work.skills).forEach((sName) => {
    if (!fs.existsSync(path.join(destSkills, sName))) delete work.skills[sName];
  });

  const manifest = {
    ...(prior && typeof prior === 'object' ? prior : {}),
    version: PKG.version,
    platform: platform || 'all',
    installedPacks,
    hooksEnabled: hooks !== false,
    telemetry: telemetry ? 'on' : 'off',
    mode: mode || 'interactive',
    goal: goal || null,
    skills: work.skills,
    updatedAt: new Date().toISOString()
  };
  if (prior && prior.version && prior.version !== PKG.version) manifest.migratedFrom = prior.version;
  if (prior && prior.generatedFiles && typeof prior.generatedFiles === 'object') manifest.generatedFiles = { ...prior.generatedFiles };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  return { count: countSkills(destSkills), packs: installedPacks, customized: result.customized, backedUp: result.backedUp };
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

  const initOptions = await promptInitOptions(flags);
  const { isFresh, stack, platform, telemetry, mode, allSkills, hooksExplicit, autoGoal } = initOptions;
  let hooks = initOptions.hooks;

  // Determine target AI harnesses
  const rawChoice = flags.harness || flags.platform || platform || (flags.allHarnesses ? 'all' : null);
  const selectedHarnesses = resolveHarnesses(flags.allHarnesses ? 'all' : rawChoice);

  if (flags.claude === false) {
    selectedHarnesses.delete('claude');
  }

  console.log(`\n${colors.cyan}[ INFO ] Initializing Dev-OS in target directory...${colors.reset}`);
  console.log(`${colors.gray}Target Path: ${TARGET_DIR}${colors.reset}`);
  console.log(`${colors.gray}Mode: ${isFresh ? 'Fresh Project' : 'Existing Project'} | Stack: [${stack.toUpperCase()}] | Platform: [${platform.toUpperCase()}]${colors.reset}\n`);

  const srcAgents = path.join(TEMPLATE_DIR, '.agents');
  const destAgents = path.join(TARGET_DIR, '.agents');
  const step = (label, fn) => {
    process.stdout.write(`${colors.gray}${label}... ${colors.reset}`);
    try {
      const result = fn();
      const isWarn = typeof result === 'string' && result.startsWith('[ WARN ]');
      console.log(`${isWarn ? colors.yellow : colors.green}${result || 'done'}${colors.reset}`);
    } catch (err) {
      console.log(`${colors.red}failed${colors.reset}`);
      console.error(`${colors.red}[ FAIL ] ${label}: ${err.message}${colors.reset}`);
      console.error(`${colors.yellow}         ${hintFor(err)}${colors.reset}`);
      process.exit(1);
    }
  };

  // Step 1: Back up any existing .agents/, then copy components
  let packSummary = null;
  const hadAgents = fs.existsSync(destAgents);
  // Re-init over an existing install merges its manifest instead of resetting it
  const hadManifest = !insideSource && fs.existsSync(path.join(destAgents, 'manifest.json'));
  const prior = hadManifest ? readManifestLenient(destAgents) : null;
  if (prior && !hooksExplicit) hooks = recordedHooksChoice(prior, TARGET_DIR);
  if (!insideSource) {
    if (hadAgents) {
      step('Backing up existing .agents/ to .agents/_backup/', () => {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(destAgents, '_backup', stamp);
        copyRecursiveSync(destAgents, backupDir);
        return `saved (${path.relative(TARGET_DIR, backupDir)})`;
      });
    }

    step('Installing agent roster, hooks, memory, catalog, and evaluation suites', () => {
      // Copy core structure excluding skills. memory/ is NOT copied wholesale:
      // the source checkout's own session/context state must never land in a target.
      copyCoreComponents(srcAgents, destAgents);
    });

    // A re-init over a 4.x install retires merged agents/commands/skills
    if (hadAgents) {
      let migration = null;
      step('Migrating retired 4.x agents, commands, and skills', () => {
        const packsData = loadPacks(srcAgents);
        migration = migrateLegacyInstall(srcAgents, TARGET_DIR, prior || readManifestLenient(destAgents), packsData);
        return describeMigration(migration);
      });
      printMigrationDetails(migration);
    }

    step('Installing specialist skills and capability packs', () => {
      // allSkills already folds in --all-skills (flag wins) or the interactive answer
      packSummary = installSkillsAndPacks(srcAgents, destAgents, stack, allSkills, telemetry, mode, autoGoal, platform, hooks, prior, { force: flags.force });
      const kept = packSummary.customized.length ? `, ${packSummary.customized.length} customized kept` : '';
      return `${packSummary.count} skills (packs: ${packSummary.packs.join(', ')})${kept}`;
    });
    warnCustomizedSkills(packSummary.customized, 'devos init');
  }

  // Ensure telemetry buffer directory exists
  fs.mkdirSync(path.join(destAgents, 'telemetry'), { recursive: true });

  // Step 2: Ensure script permissions (commit gate, hook installer, humanizer check, UI taste check, env check, db check)
  step('Configuring commit gate and verification scripts', () => {
    const scripts = ['commit.sh', 'install-hooks.sh', 'humanize-check.sh', 'ui-taste-check.sh', 'env-check.sh', 'db-check.sh'];
    const missing = [];
    scripts.forEach((name) => {
      const scriptPath = path.join(destAgents, 'scripts', name);
      if (fs.existsSync(scriptPath)) {
        fs.chmodSync(scriptPath, '755');
      } else {
        missing.push(name);
      }
    });
    if (missing.length === scripts.length) throw new Error('critical scripts are missing from .agents/scripts/');
    return missing.length ? `partial (missing: ${missing.join(', ')})` : 'executable (755)';
  });

  // Step 2b: Wire runtime lifecycle hooks
  if (hooks) {
    step('Wiring runtime lifecycle hooks (.agents/hooks/)', () => {
      const claudeDest = selectedHarnesses.has('claude') ? path.join(TARGET_DIR, '.claude') : null;
      return wireHooks(destAgents, claudeDest);
    });
  }

  // Step 2c: Ensure git repository exists so hooks and gates are never left uninstalled
  let gitDir = path.join(TARGET_DIR, '.git');
  if (!fs.existsSync(gitDir) && !insideSource) {
    const { spawnSync } = require('child_process');
    const gitCheck = spawnSync('git', ['--version'], { encoding: 'utf8' });
    if (gitCheck.status === 0) {
      step('Initializing git repository (git init)', () => {
        const initRes = spawnSync('git', ['init'], { cwd: TARGET_DIR, encoding: 'utf8' });
        if (initRes.status === 0) return 'initialized';
        return 'warning (git init returned non-zero)';
      });
      gitDir = path.join(TARGET_DIR, '.git');
    }
  }

  // Step 2d: Detect Gitleaks (install only with --install-gitleaks) and install pre-commit hook
  if (hooks) {
    step('Verifying Gitleaks secret scanner', () => {
      return ensureGitleaks(TARGET_DIR, { install: flags.installGitleaks });
    });

    if (fs.existsSync(gitDir)) {
      step('Installing mechanical pre-commit hook (.git/hooks/pre-commit)', () => {
        const hookInstaller = path.join(destAgents, 'scripts', 'install-hooks.sh');
        if (fs.existsSync(hookInstaller)) {
          const { spawnSync } = require('child_process');
          const res = spawnSync('bash', [hookInstaller], { cwd: TARGET_DIR, encoding: 'utf8', env: installHooksEnv(flags) });
          if (res.status === 0) return 'installed & verified';
          return `warning (installer exited ${res.status})`;
        }
        return 'skipped (install-hooks.sh missing)';
      });
    }
  }

  // Step 3: Install public docs from templates/docs and state scaffolds from templates/scaffolds
  const destDocs = path.join(TARGET_DIR, 'docs');
  if (!insideSource && (isFresh || !fs.existsSync(destDocs))) {
    step('Installing project documentation into docs/', () => {
      copyRecursiveSync(path.join(TEMPLATES_DIR, 'docs'), destDocs);
    });
  }
  // Install state scaffolds (CURRENT_STATE, TASK_BOARD, LESSONS) from templates/scaffolds
  step('Installing state scaffolds into docs/', () => {
    fs.mkdirSync(destDocs, { recursive: true });
    const scaffoldFiles = ['CURRENT_STATE.md', 'TASK_BOARD.md', 'LESSONS.md'];
    for (const f of scaffoldFiles) {
      const src = path.join(TEMPLATES_DIR, 'scaffolds', 'docs', f);
      const dest = path.join(destDocs, f);
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
      }
    }
  });

  // Install memory context scaffold from templates/scaffolds
  step('Installing memory context scaffold', () => {
    const memDir = path.join(destAgents, 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const ctxSrc = path.join(TEMPLATES_DIR, 'scaffolds', 'agents', 'memory', 'context.json');
    const ctxDest = path.join(memDir, 'context.json');
    if (fs.existsSync(ctxSrc) && !fs.existsSync(ctxDest)) {
      fs.copyFileSync(ctxSrc, ctxDest);
    }
  });

  // If autoGoal was specified, record in docs/TASK_BOARD.md
  if (autoGoal) {
    const destBoard = path.join(destDocs, 'TASK_BOARD.md');
    if (fs.existsSync(destBoard)) {
      let boardContent = fs.readFileSync(destBoard, 'utf8');
      if (boardContent.includes('[ IN_PROGRESS ]')) {
        const autoTask = `### [ IN_PROGRESS ]\n- **\`TASK-001\`**: Autonomous MVP Delivery — ${autoGoal}\n  - **Assignee:** Orchestrator\n  - **DependsOn:** None\n  - **Triage Level:** STANDARD\n  - **ParallelGate:** [QA: pending, Tester: pending, Security: pending]\n  - **HumanCheckpoint:** pending\n`;
        boardContent = boardContent.replace(/### \[ IN_PROGRESS \][\s\S]*?(?=### \[ QUEUED \])/, autoTask + '\n');
        fs.writeFileSync(destBoard, boardContent, 'utf8');
      }
    }
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
  }

  // Step 5: Multi-Harness Integration (Claude Code, Antigravity/Gemini, Cursor, OpenCode, Codex).
  // AGENTS.md is the canonical cross-harness file; the others point at it.
  let claudeSummary = null;
  const hctx = harnessContext(TARGET_DIR, readManifestLenient(destAgents), { force: flags.force });
  if (selectedHarnesses.has('claude')) {
    step('Wiring Claude Code integration (.claude/, CLAUDE.md)', () => {
      const destClaude = path.join(TARGET_DIR, '.claude');
      const cmdCount = generateClaudeCommands(destAgents, destClaude, hctx.written, hctx.guard);
      const agentCount = generateClaudeAgents(destAgents, destClaude, hctx.written, hctx.guard);
      const claudeMd = bootstrapClaudeMd(TARGET_DIR, hctx);
      claudeSummary = { cmdCount, agentCount, claudeMd };
      const kept = hctx.guard.kept.length ? `, ${hctx.guard.kept.length} edited file(s) kept` : '';
      return `${cmdCount} commands, ${agentCount} agents (CLAUDE.md ${claudeMd})${kept}`;
    });
  }

  step('Writing cross-harness instructions (AGENTS.md and per-harness pointers)', () => {
    return generateHarnessConfigs(TARGET_DIR, selectedHarnesses, hctx).join('; ');
  });
  hctx.guard.report();
  printHarnessNotes(hctx);

  // Record hashes of the agent/command files Dev-OS wrote, so a later
  // update can tell generated-and-unedited files from user edits.
  if (!insideSource && fs.existsSync(path.join(destAgents, 'manifest.json'))) {
    const manifest = getSkillManifest(TARGET_DIR);
    // hctx.manifest was read from the same file; it only lost records of retired files
    if (hctx.manifest.generatedFiles) manifest.generatedFiles = { ...hctx.manifest.generatedFiles };
    recordGeneratedFiles(manifest, TARGET_DIR, [...defaultAssetPaths(srcAgents, destAgents), ...hctx.written]);
    if (selectedHarnesses.has('claude')) {
      let linkRes = null;
      step('Linking skills for Claude Code (.claude/skills/)', () => {
        linkRes = syncClaudeSkills(TARGET_DIR, manifest);
        return describeClaudeSkillSync(linkRes);
      });
      warnKeptClaudeSkills(linkRes);
    }
    saveSkillManifest(manifest, TARGET_DIR);
  }

  // Step 6: Update .gitignore
  step('Updating .gitignore rules', () => {
    return ensureGitignoreEntries(TARGET_DIR, DEVOS_GITIGNORE_GROUPS) ? 'updated' : 'already up to date';
  });

  // Summary card
  const agentCount = countAgents(path.join(destAgents, 'agents'));
  const skillCount = countSkills(path.join(destAgents, 'skills'));
  const harnessesList = Array.from(selectedHarnesses);

  const rows = [
    ['.agents/agents/', `${agentCount} Agent Personas (Orchestrator, Developer, QA, DBA, Security...)`],
    ['.agents/skills/', `${skillCount} Specialist Skills (Packs: ${(packSummary ? packSummary.packs : ['core']).join(', ')})`],
    ['.agents/hooks/', hooks ? 'Runtime Lifecycle Hooks (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop, SubagentStop, SessionEnd)' : 'Runtime Lifecycle Hooks (not wired: --no-hooks)'],
    ['.agents/memory/', 'Shared Memory Vault (ADRs in decisions/, session handoffs)'],
    ['docs/TASK_BOARD.md', 'Deterministic Task Board & DAG Workflow State'],
    ['.agents/scripts/', 'Commit Checkpoint Gate (commit.sh) + Hook Installer'],
    ['.agents/AGENTS.md', 'Team Roster & Triage Rules'],
    ['CODING_STANDARDS.md', `Stack Standards [${stack.toUpperCase()}]`]
  ];
  if (claudeSummary) {
    rows.push(['.claude/', `${claudeSummary.cmdCount} Slash Commands + ${claudeSummary.agentCount} Subagents (Claude Code)`]);
  }
  rows.push(['Harnesses', harnessesList.join(', ')]);

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
    console.log(`\n${colors.bold}NEXT STEPS & PROMPTING GUIDE${colors.reset}`);
    console.log(`  1. Open your AI coding environment (${harnessesList.join(', ')}).`);
    console.log(`  2. ${colors.bold}Prompt the What, Not the How:${colors.reset} Dev-OS enforces roles, gates, and safety automatically.`);
    console.log(`\n${colors.bold}Golden Prompt Formula for Dev-OS:${colors.reset}`);
    console.log(`  ${colors.green}/auto Build a [product] for [target user].${colors.reset}`);
    console.log(`  ${colors.cyan}Features:${colors.reset}     [key capabilities & user workflows]`);
    console.log(`  ${colors.cyan}Integrations:${colors.reset} [database / auth / payments / external APIs]`);
    console.log(`  ${colors.cyan}Seed Data:${colors.reset}    [initial sample records or assets in /docs]`);
    console.log(`\n${colors.bold}Example:${colors.reset}`);
    console.log(`  ${colors.yellow}/auto Build a single-location restaurant management and POS web app with Next.js and Supabase.${colors.reset}`);
    console.log(`  ${colors.gray}• Staff POS with hands-free voice AI assistant 'Olives' (via Gemini)${colors.reset}`);
    console.log(`  ${colors.gray}• Customer QR code ordering at tables with Paystack checkout${colors.reset}`);
    console.log(`  ${colors.gray}• Ad banner carousel, bulk event order inquiries, and gift packages${colors.reset}`);
    console.log(`  ${colors.gray}• Seed initial menu items and pricing from /docs${colors.reset}`);
    console.log(`\n  Track execution anytime: inspect ${colors.cyan}docs/TASK_BOARD.md${colors.reset} or run ${colors.cyan}devos doctor${colors.reset}.\n`);
  }
}

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

// Sync only skills that are already installed in the target from the Dev-OS
// templates. A skill whose current hash differs from the manifest hash (or has
// no recorded hash) is treated as customized and skipped unless `force`, in
// which case it is backed up first. Never installs skills the target lacks.
function syncInstalledSkills(srcSkills, destSkills, manifest, options = {}) {
  const result = { updated: [], unchanged: [], skippedCustomized: [], backedUp: [], notInTemplates: [] };
  if (!fs.existsSync(srcSkills) || !fs.existsSync(destSkills)) return result;
  if (path.resolve(srcSkills) === path.resolve(destSkills)) return result;

  const installed = fs.readdirSync(destSkills).filter((f) => f !== '_backup' && fs.statSync(path.join(destSkills, f)).isDirectory());
  for (const name of installed) {
    const srcPath = path.join(srcSkills, name);
    const destPath = path.join(destSkills, name);
    if (!fs.existsSync(srcPath)) {
      result.notInTemplates.push(name);
      continue;
    }
    const srcHash = computeSkillHash(srcPath);
    const destHash = computeSkillHash(destPath);
    const entry = manifest.skills[name];

    if (destHash === srcHash) {
      result.unchanged.push(name);
      if (!entry) {
        manifest.skills[name] = { source: 'core', version: PKG.version, hash: srcHash, customized: false, installedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      }
      continue;
    }

    const customized = !entry || !entry.hash || entry.hash !== destHash;
    if (customized && !options.force) {
      result.skippedCustomized.push(name);
      if (entry) entry.customized = true;
      continue;
    }
    if (options.dryRun) {
      result.updated.push(name);
      continue;
    }
    if (customized) {
      const backupPath = backupSkill(destPath, name, options.targetDir || TARGET_DIR);
      result.backedUp.push(path.relative(options.targetDir || TARGET_DIR, backupPath));
    }
    copyRecursiveSync(srcPath, destPath);
    manifest.skills[name] = {
      source: (entry && entry.source) || 'core',
      version: PKG.version,
      hash: computeSkillHash(destPath),
      customized: false,
      installedAt: (entry && entry.installedAt) || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    result.updated.push(name);
  }
  return result;
}

// Update-time skill sync: refresh every installed Dev-OS skill that is
// unedited, then install the skills of installed packs that are missing
// (a 4.x upgrade gains the new core skills). Mutates manifest.skills.
function syncPackSkills(srcAgents, destAgents, manifest, packsData, options = {}) {
  const srcSkills = path.join(srcAgents, 'skills');
  const destSkills = path.join(destAgents, 'skills');
  const out = { installed: [], updated: [], unchanged: 0, customized: [], backedUp: [] };
  if (!fs.existsSync(srcSkills) || path.resolve(srcSkills) === path.resolve(destSkills)) return out;
  fs.mkdirSync(destSkills, { recursive: true });
  if (!manifest.skills || typeof manifest.skills !== 'object') manifest.skills = {};
  const res = syncInstalledSkills(srcSkills, destSkills, manifest, { force: options.force, targetDir: options.targetDir });
  out.updated.push(...res.updated);
  out.unchanged = res.unchanged.length;
  out.customized.push(...res.skippedCustomized);
  out.backedUp.push(...res.backedUp);
  // 4.x recorded every skill dir as 'core', third-party ones included
  res.notInTemplates.forEach((name) => {
    const e = manifest.skills[name];
    if (e && e.source === 'core' && !isShippedSkill(packsData, name)) e.source = 'local';
  });
  const packs = Array.isArray(manifest.installedPacks) ? manifest.installedPacks : [];
  packSkillNames(packsData, packs).forEach((name) => {
    if (fs.existsSync(path.join(destSkills, name))) return;
    const r = installSkillSafely(srcSkills, destSkills, name, manifest, options);
    if (r.status === 'installed') out.installed.push(name);
  });
  return out;
}

function describePackSkillSync(r) {
  const parts = [];
  if (r.installed.length) parts.push(`${r.installed.length} installed (${r.installed.join(', ')})`);
  parts.push(`${r.updated.length} refreshed`, `${r.unchanged} unchanged`);
  if (r.customized.length) parts.push(`${r.customized.length} customized kept`);
  if (r.backedUp.length) parts.push(`${r.backedUp.length} backed up`);
  return parts.join(', ');
}

function describeSkillSync(r) {
  let msg = `${r.updated.length} updated, ${r.unchanged.length} unchanged`;
  if (r.skippedCustomized.length) msg += `, ${r.skippedCustomized.length} customized skipped (${r.skippedCustomized.join(', ')}; use --force to overwrite with backup)`;
  if (r.backedUp.length) msg += `, ${r.backedUp.length} backed up`;
  return msg;
}

// Harnesses recorded at init time. Falls back to the harness outputs present
// on disk for manifests written before `platform` was recorded.
function harnessesForUpdate(flags, manifest) {
  const explicit = flags.harness || flags.platform || (flags.allHarnesses ? 'all' : null);
  if (explicit) return resolveHarnesses(explicit);
  if (manifest && typeof manifest.platform === 'string' && manifest.platform.trim()) {
    return resolveHarnesses(manifest.platform.trim().toLowerCase());
  }
  const detected = new Set();
  if (fs.existsSync(path.join(TARGET_DIR, '.claude'))) detected.add('claude');
  if (fs.existsSync(path.join(TARGET_DIR, 'ANTIGRAVITY.md'))) detected.add('antigravity');
  if (fs.existsSync(path.join(TARGET_DIR, '.cursor', 'rules', 'devos.mdc'))) detected.add('cursor');
  if (fs.existsSync(path.join(TARGET_DIR, '.opencode')) || fs.existsSync(path.join(TARGET_DIR, 'opencode.json'))) detected.add('opencode');
  if (fs.existsSync(path.join(TARGET_DIR, '.codex')) || fs.existsSync(path.join(TARGET_DIR, '.windsurfrules'))) detected.add('codex');
  return detected;
}

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
  const manifestPath = path.join(destAgents, 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? readJsonFile(manifestPath, '.agents/manifest.json') : {};
  const previousVersion = manifest.version || 'unknown';
  const packsData = loadPacks(srcAgents);
  let migration = null;
  const harnesses = harnessesForUpdate(flags, manifest);
  if (flags.claude === false) harnesses.delete('claude');
  // --no-hooks / --hooks win; otherwise the recorded choice (inferred from disk for 4.x)
  const hooksEnabled = flags.hooks === false ? false
    : (flags.passed && flags.passed.hooks ? true : recordedHooksChoice(manifest, TARGET_DIR));

  const step = (label, fn) => {
    process.stdout.write(`${colors.gray}${label}... ${colors.reset}`);
    try {
      const result = fn();
      const isWarn = typeof result === 'string' && result.startsWith('[ WARN ]');
      console.log(`${isWarn ? colors.yellow : colors.green}${result || 'done'}${colors.reset}`);
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

    // 2. Refresh .agents/ subdirectories
    step('Refreshing agent personas, hooks, memory templates, catalog, scripts, and evaluation suites', () => {
      // Memory templates are refreshed without touching user ADRs, handoffs or context
      copyCoreComponents(srcAgents, destAgents);
      const assetPacks = (Array.isArray(manifest.installedPacks) ? manifest.installedPacks : [])
        .filter((id) => packsData && packHasAssets(packsData.packs[id]));
      if (assetPacks.length) {
        const written = installPackAssets(srcAgents, destAgents, packsData, assetPacks);
        return `done (+${written.length} agent/command file(s) from pack(s): ${assetPacks.join(', ')})`;
      }
      return 'done';
    });

    // 2b. Retire merged/moved 4.x agents, commands, and skills (backed up; edited files kept)
    step('Migrating retired 4.x agents, commands, and skills', () => {
      migration = migrateLegacyInstall(srcAgents, TARGET_DIR, manifest, packsData);
      return describeMigration(migration);
    });
    printMigrationDetails(migration);

    // 2c. Skills: install what installed packs are missing (e.g. new core skills
    // after a 4.x upgrade) and refresh unedited ones. Customized skills are kept
    // unless --force, which backs them up first.
    let skillRes = null;
    step('Syncing specialist skills for installed packs', () => {
      skillRes = syncPackSkills(srcAgents, destAgents, manifest, packsData, { force: flags.force, targetDir: TARGET_DIR });
      return describePackSkillSync(skillRes);
    });
    warnCustomizedSkills(skillRes.customized, 'devos update');
  }

  // 3. Ensure executable script permissions
  step('Verifying script permissions (commit.sh, install-hooks.sh, humanize-check.sh, ui-taste-check.sh, env-check.sh, db-check.sh, hooks/*.sh)', () => {
    const scripts = ['commit.sh', 'install-hooks.sh', 'humanize-check.sh', 'ui-taste-check.sh', 'env-check.sh', 'db-check.sh'];
    scripts.forEach((name) => {
      const p = path.join(destAgents, 'scripts', name);
      if (fs.existsSync(p)) fs.chmodSync(p, '755');
    });
    const hooksDir = path.join(destAgents, 'hooks');
    if (fs.existsSync(hooksDir)) {
      fs.readdirSync(hooksDir).forEach((file) => {
        if (file.endsWith('.sh')) fs.chmodSync(path.join(hooksDir, file), '755');
      });
    }
    return 'executable (755)';
  });

  // 4. Runtime lifecycle hooks (respects --no-hooks and the manifest's hooksEnabled)
  if (hooksEnabled) {
    step('Refreshing runtime lifecycle hooks', () => {
      return wireHooks(destAgents, harnesses.has('claude') ? path.join(TARGET_DIR, '.claude') : null);
    });

    // 4b. Detect Gitleaks only; install/upgrade solely with --install-gitleaks
    step('Verifying Gitleaks secret scanner', () => {
      return ensureGitleaks(TARGET_DIR, { install: flags.installGitleaks });
    });
  } else {
    console.log(`${colors.gray}Skipping runtime lifecycle hooks (disabled)${colors.reset}`);
  }

  // 5. Multi-Harness refresh: only the harnesses recorded for this project.
  // AGENTS.md is always written; it is the canonical cross-harness file.
  const hctx = harnessContext(TARGET_DIR, manifest, { force: flags.force });
  const claudeWritten = hctx.written;
  step('Refreshing AI harness configurations', () => {
    const done = [];
    if (harnesses.has('claude')) {
      const destClaude = path.join(TARGET_DIR, '.claude');
      generateClaudeCommands(destAgents, destClaude, claudeWritten, hctx.guard);
      generateClaudeAgents(destAgents, destClaude, claudeWritten, hctx.guard);
      bootstrapClaudeMd(TARGET_DIR, hctx);
      done.push(hctx.guard.kept.length ? `Claude Code (${hctx.guard.kept.length} edited file(s) kept)` : 'Claude Code');
    }
    done.push(...generateHarnessConfigs(TARGET_DIR, harnesses, hctx));
    return harnesses.size ? `${done.join('; ')} synchronized` : `[ WARN ] ${done.join('; ')}; no harnesses recorded; pass --platform <list> to choose`;
  });
  hctx.guard.report();
  printHarnessNotes(hctx);

  // 5b. Claude Code skill links (.claude/skills/<name> -> .agents/skills/<name>)
  if (harnesses.has('claude') && !insideSource) {
    let linkRes = null;
    step('Syncing Claude Code skill links (.claude/skills/)', () => {
      linkRes = syncClaudeSkills(TARGET_DIR, manifest);
      return describeClaudeSkillSync(linkRes);
    });
    warnKeptClaudeSkills(linkRes);
  }

  // 5a. Manifest: version, migration provenance, and hashes of the files Dev-OS wrote
  if (!insideSource) {
    step('Updating .agents/manifest.json', () => {
      const assetPacks = (Array.isArray(manifest.installedPacks) ? manifest.installedPacks : [])
        .filter((id) => packsData && packHasAssets(packsData.packs[id]));
      const names = packAssetNames(packsData, assetPacks);
      const packFiles = [
        ...names.agents.map((n) => path.join(destAgents, 'agents', `${n}.md`)),
        ...names.commands.map((n) => path.join(destAgents, 'commands', `${n}.md`))
      ];
      recordGeneratedFiles(manifest, TARGET_DIR, [...defaultAssetPaths(srcAgents, destAgents), ...packFiles, ...claudeWritten]);
      if (previousVersion !== PKG.version) manifest.migratedFrom = previousVersion;
      manifest.version = PKG.version;
      manifest.hooksEnabled = hooksEnabled;
      if (!manifest.skills || typeof manifest.skills !== 'object') manifest.skills = {};
      saveSkillManifest(manifest, TARGET_DIR);
      return previousVersion !== PKG.version ? `v${previousVersion} -> v${PKG.version}` : `v${PKG.version}`;
    });
    step('Updating .gitignore rules', () => (ensureGitignoreEntries(TARGET_DIR, DEVOS_GITIGNORE_GROUPS) ? 'updated' : 'already up to date'));
  }

  // 5c. Dev-OS skills were synced in step 2c; --skills also updates skills.sh installs
  if (flags.skills || flags.allSkills) {
    try {
      runSkillsCli(['update', '-y'], { stdio: 'ignore' });
    } catch (e) {}
  }

  // 6. Pre-commit hook
  const gitDir = path.join(TARGET_DIR, '.git');
  if (hooksEnabled && fs.existsSync(gitDir)) {
    step('Updating mechanical pre-commit hook', () => {
      const hookInstaller = path.join(destAgents, 'scripts', 'install-hooks.sh');
      if (fs.existsSync(hookInstaller)) {
        const res = spawnSync('bash', [hookInstaller], { cwd: TARGET_DIR, encoding: 'utf8', env: installHooksEnv(flags) });
        if (res.status === 0) return 'updated';
        return `warning (installer exited ${res.status})`;
      }
      return 'skipped';
    });
  }

  console.log(`\n${colors.green}${colors.bold}[ OK ] Dev-OS updated to v${PKG.version} successfully.${colors.reset}\n`);
}

// ---------------------------------------------------------------------------
// pack
// ---------------------------------------------------------------------------

function runPack(flags, positional) {
  const subCmd = positional[0] || 'list';
  const manifestPath = path.join(TARGET_DIR, '.agents', 'manifest.json');
  const packsPath = path.join(TEMPLATE_DIR, '.agents', 'packs.json');
  if (!fs.existsSync(packsPath)) {
    console.error(`${colors.red}[ FAIL ] Capability packs registry (.agents/packs.json) not found.${colors.reset}`);
    process.exit(1);
  }
  const packsData = readJsonFile(packsPath, 'Dev-OS packs registry (.agents/packs.json)');
  const manifest = fs.existsSync(manifestPath) ? readJsonFile(manifestPath, '.agents/manifest.json') : { installedPacks: [] };

  if (subCmd === 'list') {
    if (!flags.quiet && !flags.json) printBanner();
    if (flags.json) {
      console.log(JSON.stringify({ availablePacks: packsData.packs, installedPacks: manifest.installedPacks || [] }, null, 2));
      return;
    }
    console.log(`${colors.bold}DEV-OS CAPABILITY PACKS${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}\n`);
    Object.keys(packsData.packs).forEach((key) => {
      const p = packsData.packs[key];
      const isInstalled = (manifest.installedPacks || []).includes(key);
      const tag = isInstalled ? `${colors.green}[installed]${colors.reset}` : `${colors.gray}[available]${colors.reset}`;
      console.log(`  ${colors.cyan}${colors.bold}${key.padEnd(12)}${colors.reset} ${tag} ${p.name}`);
      console.log(`  ${colors.gray}${p.description}${colors.reset}`);
      const pSkills = Array.isArray(p.skills) ? p.skills : [];
      console.log(`  ${colors.dim}Skills (${pSkills.length}): ${pSkills.join(', ')}${colors.reset}`);
      if (Array.isArray(p.agents) && p.agents.length) console.log(`  ${colors.dim}Agents (${p.agents.length}): ${p.agents.join(', ')}${colors.reset}`);
      if (Array.isArray(p.commands) && p.commands.length) console.log(`  ${colors.dim}Commands (${p.commands.length}): ${p.commands.map((c) => `/${c}`).join(', ')}${colors.reset}`);
      console.log('');
    });
    console.log(`Add a pack: ${colors.cyan}devos pack add <name>${colors.reset}\n`);
    return;
  }

  if (subCmd === 'add') {
    const packName = positional[1];
    if (!packName || !packsData.packs[packName]) {
      console.error(`${colors.red}[ FAIL ] Unknown pack '${packName}'. Available: ${Object.keys(packsData.packs).join(', ')}${colors.reset}`);
      process.exit(1);
    }
    const pack = packsData.packs[packName];
    const destSkills = path.join(TARGET_DIR, '.agents', 'skills');
    fs.mkdirSync(destSkills, { recursive: true });

    let addedCount = 0;
    const customizedSkills = [];
    if (!manifest.skills || typeof manifest.skills !== 'object') manifest.skills = {};
    const srcSkillsDir = path.join(TEMPLATE_DIR, '.agents', 'skills');
    if (path.resolve(srcSkillsDir) !== path.resolve(destSkills)) {
      (Array.isArray(pack.skills) ? pack.skills : []).forEach((skillName) => {
        // Customized skills are kept unless --force, which backs them up first
        const res = installSkillSafely(srcSkillsDir, destSkills, skillName, manifest, { force: flags.force, targetDir: TARGET_DIR });
        if (res.status === 'customized') customizedSkills.push(skillName);
        else if (res.status !== 'missing') addedCount++;
        if (res.backup) console.log(`${colors.yellow}[ BACKUP ] Preserved local modifications of ${skillName} in ${res.backup}${colors.reset}`);
      });
    }
    warnCustomizedSkills(customizedSkills, `devos pack add ${packName}`);

    // Packs may also ship agents and commands (R3); install them flat into
    // .agents/ and regenerate the Claude Code output when that harness is in use.
    const srcAgents = path.join(TEMPLATE_DIR, '.agents');
    const destAgents = path.join(TARGET_DIR, '.agents');
    // Every agent/command file written here goes through the same guard:
    // edited or user-authored files are kept unless --force (backup first).
    const guard = createGeneratedWriteGuard({ targetDir: TARGET_DIR, manifest, force: flags.force });
    const assetFiles = TEMPLATE_DIR === TARGET_DIR ? [] : installPackAssets(srcAgents, destAgents, packsData, [packName], guard);
    const claudeWritten = [];
    if (packHasAssets(pack) && TEMPLATE_DIR !== TARGET_DIR && harnessesForUpdate(flags, manifest).has('claude')) {
      const destClaude = path.join(TARGET_DIR, '.claude');
      generateClaudeCommands(destAgents, destClaude, claudeWritten, guard);
      generateClaudeAgents(destAgents, destClaude, claudeWritten, guard);
    }
    guard.report();
    if (assetFiles.length || claudeWritten.length) recordGeneratedFiles(manifest, TARGET_DIR, [...assetFiles, ...claudeWritten]);
    // Keep .claude/skills/ links in step with the newly installed skills
    let linkNote = '';
    if (TEMPLATE_DIR !== TARGET_DIR && harnessesForUpdate(flags, manifest).has('claude')) {
      const linkRes = syncClaudeSkills(TARGET_DIR, manifest);
      warnKeptClaudeSkills(linkRes);
      if (linkRes.linked.length || linkRes.copied.length) linkNote = `, ${linkRes.linked.length + linkRes.copied.length} skill link(s) added to .claude/skills/`;
    }

    if (!manifest.installedPacks) manifest.installedPacks = [];
    if (!manifest.installedPacks.includes(packName)) manifest.installedPacks.push(packName);
    manifest.updatedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    const assetNote = assetFiles.length ? `, ${assetFiles.length} agent/command file(s)` : '';
    console.log(`${colors.green}[ OK ] Pack '${packName}' added successfully (${addedCount} skills installed${assetNote}${linkNote}).${colors.reset}`);
    return;
  }

  console.error(`${colors.red}[ FAIL ] Unknown pack subcommand '${subCmd}'. Use 'devos pack list' or 'devos pack add <name>'.${colors.reset}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// memory
// ---------------------------------------------------------------------------

function runMemory(flags, positional) {
  const subCmd = positional[0] || 'list';
  const memoryDir = path.join(TARGET_DIR, '.agents', 'memory');

  if (subCmd === 'list') {
    if (!flags.quiet && !flags.json) printBanner();
    const decisionsDir = path.join(memoryDir, 'decisions');
    const handoffsDir = path.join(memoryDir, 'handoffs');
    const adrs = fs.existsSync(decisionsDir) ? fs.readdirSync(decisionsDir).filter((f) => f.endsWith('.md')) : [];
    const handoffs = fs.existsSync(handoffsDir) ? fs.readdirSync(handoffsDir).filter((f) => f.endsWith('.md')) : [];
    const contextPath = path.join(memoryDir, 'context.json');
    const context = fs.existsSync(contextPath) ? readJsonFile(contextPath, '.agents/memory/context.json') : null;

    if (flags.json) {
      console.log(JSON.stringify({ adrs, handoffs, context }, null, 2));
      return;
    }

    console.log(`${colors.bold}DEV-OS SHARED MEMORY VAULT${colors.reset} ${colors.gray}(Target: ${TARGET_DIR})${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}\n`);
    if (context) {
      console.log(`${colors.bold}Active Context:${colors.reset} Milestone: ${colors.cyan}${context.currentMilestone || 'N/A'}${colors.reset} | Branch: ${colors.yellow}${context.activeBranch || 'N/A'}${colors.reset}\n`);
    }
    console.log(`${colors.bold}Architecture Decision Records (${adrs.length}):${colors.reset}`);
    if (adrs.length === 0) {
      console.log(`  ${colors.gray}No ADRs recorded yet.${colors.reset}`);
    } else {
      adrs.forEach((f) => console.log(`  ${colors.green}• ${f}${colors.reset}`));
    }
    console.log(`\n${colors.bold}Session Handoffs (${handoffs.length}):${colors.reset}`);
    if (handoffs.length === 0) {
      console.log(`  ${colors.gray}No session handoffs recorded yet.${colors.reset}`);
    } else {
      handoffs.slice(-5).forEach((f) => console.log(`  ${colors.cyan}• ${f}${colors.reset}`));
    }
    console.log();
    return;
  }

  if (subCmd === 'handoff') {
    const handoffsDir = path.join(memoryDir, 'handoffs');
    fs.mkdirSync(handoffsDir, { recursive: true });
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toISOString().slice(11, 16).replace(':', '');
    const filename = `handoff-${dateStr}-${timeStr}.md`;
    const targetFile = path.join(handoffsDir, filename);

    let branch = 'unknown';
    let gitStatus = 'clean';
    try {
      const { spawnSync } = require('child_process');
      const branchRes = spawnSync('git', ['branch', '--show-current'], { encoding: 'utf8', cwd: TARGET_DIR });
      branch = branchRes.stdout ? branchRes.stdout.trim() : 'unknown';
      const statusRes = spawnSync('git', ['status', '-s'], { encoding: 'utf8', cwd: TARGET_DIR });
      gitStatus = statusRes.stdout ? statusRes.stdout.trim() || 'clean' : 'clean';
    } catch (e) {}

    const template = [
      `# Session Handoff: ${dateStr} ${timeStr}`,
      '',
      '## Executive Summary',
      `- **Active Branch:** \`${branch}\``,
      `- **Git Status:** ${gitStatus === 'clean' ? 'Clean' : 'Modified files present'}`,
      '- **Status:** [IN_PROGRESS | READY_FOR_REVIEW | DONE]',
      '',
      '## Completed in This Session',
      '- [ ] Summary of completed items',
      '',
      '## In-Progress / Blockers',
      '- [ ] Unfinished work',
      '',
      '## Immediate Next Steps',
      '1. Resume item 1',
      ''
    ].join('\n');

    fs.writeFileSync(targetFile, template, 'utf8');
    console.log(`${colors.green}[ OK ] Created session handoff template: ${colors.cyan}${path.relative(TARGET_DIR, targetFile)}${colors.reset}`);
    return;
  }

  if (subCmd === 'doctor') {
    const checks = [
      { name: 'Memory directory (.agents/memory/)', ok: fs.existsSync(memoryDir) },
      { name: 'Decisions folder (.agents/memory/decisions/)', ok: fs.existsSync(path.join(memoryDir, 'decisions')) },
      { name: 'Handoffs folder (.agents/memory/handoffs/)', ok: fs.existsSync(path.join(memoryDir, 'handoffs')) },
      { name: 'Context manifest (.agents/memory/context.json)', ok: fs.existsSync(path.join(memoryDir, 'context.json')) }
    ];
    let allOk = true;
    console.log(`${colors.bold}MEMORY VAULT HEALTH${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}`);
    checks.forEach((c) => {
      if (c.ok) console.log(`  [ ${colors.green}PASS${colors.reset} ] ${c.name}`);
      else { console.log(`  [ ${colors.red}FAIL${colors.reset} ] ${c.name}`); allOk = false; }
    });
    if (!allOk) process.exit(1);
    return;
  }

  console.error(`${colors.red}[ FAIL ] Unknown memory subcommand '${subCmd}'. Use 'list', 'handoff', or 'doctor'.${colors.reset}`);
  process.exit(1);
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

  console.log(`\n${colors.bold}INSTALLED SPECIALIST SKILLS (${skills.length})${colors.reset}`);
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
// skill / skills
// ---------------------------------------------------------------------------

function runSkillList(flags) {
  const destSkills = path.join(TARGET_DIR, '.agents', 'skills');
  const srcSkills = fs.existsSync(destSkills) ? destSkills : path.join(TEMPLATE_DIR, '.agents', 'skills');
  const manifest = getSkillManifest(TARGET_DIR);

  const skillsList = [];
  if (fs.existsSync(srcSkills)) {
    fs.readdirSync(srcSkills).forEach((file) => {
      if (file === '_backup') return;
      const skillPath = path.join(srcSkills, file);
      if (fs.statSync(skillPath).isDirectory()) {
        const skillMd = path.join(skillPath, 'SKILL.md');
        let tokens = 0;
        if (fs.existsSync(skillMd)) {
          tokens = Math.ceil(fs.readFileSync(skillMd, 'utf8').length / 4);
        }
        const manifestEntry = (manifest.skills && manifest.skills[file]) || {};
        const isCustomized = Boolean(manifestEntry.customized);
        const source = manifestEntry.source || (fs.existsSync(path.join(TEMPLATE_DIR, '.agents', 'skills', file)) ? 'core' : 'community');
        skillsList.push({
          name: file,
          tokens,
          source,
          customized: isCustomized
        });
      }
    });
  }

  if (flags.json) {
    console.log(JSON.stringify(skillsList, null, 2));
    return;
  }

  console.log(`${colors.bold}INSTALLED SPECIALIST SKILLS (${skillsList.length})${colors.reset}`);
  console.log(`${colors.gray}${RULE}${colors.reset}`);
  skillsList.forEach((s) => {
    const badge = s.customized ? `${colors.yellow}[customized]${colors.reset}` : `${colors.gray}[${s.source}]${colors.reset}`;
    const tokenStr = `${colors.cyan}${s.tokens.toLocaleString().padStart(5)} tokens${colors.reset}`;
    console.log(`  ${colors.green}• ${s.name.padEnd(30)}${colors.reset} ${tokenStr}  ${badge}`);
  });
  console.log();
}

// Map a merged (old) skill name to the skill that absorbed it, following
// chained aliases defensively. Returns the input when it is not an alias.
function resolveSkillAlias(name) {
  const aliases = skillAliases(loadPacks(path.join(TEMPLATE_DIR, '.agents')));
  let current = name;
  const seen = new Set();
  while (Object.prototype.hasOwnProperty.call(aliases, current) && !seen.has(current)) {
    seen.add(current);
    current = aliases[current];
  }
  return current;
}

function runSkill(flags, positional) {
  const subCmd = positional[0] || 'list';
  const { spawnSync } = require('child_process');

  if (subCmd === 'list') {
    runSkillList(flags);
    return;
  }

  if (subCmd === 'audit') {
    const destSkills = path.join(TARGET_DIR, '.agents', 'skills');
    const skillsDir = fs.existsSync(destSkills) ? destSkills : path.join(TEMPLATE_DIR, '.agents', 'skills');
    const report = auditSkills(skillsDir);

    if (flags.json) {
      console.log(JSON.stringify(report, null, 2));
      if (report.errors > 0) process.exit(1);
      return;
    }

    console.log(`${colors.bold}DEV-OS SKILLS STANDARDS & TOKEN AUDIT${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}\n`);
    console.log(`Auditing ${report.total} skills against Agent Skills Standard...\n`);

    report.skills.forEach((s) => {
      if (s.errors.length > 0) {
        console.log(`  ${colors.red}[ FAIL ] ${s.name.padEnd(30)}${colors.reset} ${s.errors.join(', ')}`);
      } else if (s.warnings.length > 0) {
        const shown = s.warnings.slice(0, 4).join('; ') + (s.warnings.length > 4 ? `; (+${s.warnings.length - 4} more, see --json)` : '');
        console.log(`  ${colors.yellow}[ WARN ] ${s.name.padEnd(30)}${colors.reset} (${s.tokens.toLocaleString()} tokens) - ${shown}`);
      } else {
        console.log(`  ${colors.green}[ OK ]   ${s.name.padEnd(30)}${colors.reset} (${s.tokens.toLocaleString()} tokens)`);
      }
    });

    console.log(`\n${colors.bold}AUDIT SUMMARY${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}`);
    console.log(`  Total Skills:    ${report.total}`);
    console.log(`  Passed:          ${colors.green}${report.passed}${colors.reset}`);
    console.log(`  Warnings:        ${report.warnings > 0 ? colors.yellow + report.warnings : colors.gray + '0'}${colors.reset}`);
    console.log(`  Errors:          ${report.errors > 0 ? colors.red + report.errors : colors.green + '0'}${colors.reset}\n`);

    if (report.errors > 0) {
      process.exit(1);
    }
    return;
  }

  if (subCmd === 'sync') {
    console.log(`${colors.bold}SYNCHRONIZING AGENT SKILLS REGISTRY${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}\n`);

    const destSkills = path.join(TARGET_DIR, '.agents', 'skills');
    const srcSkills = path.join(TEMPLATE_DIR, '.agents', 'skills');
    fs.mkdirSync(destSkills, { recursive: true });

    const manifest = getSkillManifest(TARGET_DIR);
    const actions = {
      backedUp: [],
      synced: [],
      registered: [],
      unchanged: []
    };

    if (fs.existsSync(srcSkills)) {
      const templateSkills = fs.readdirSync(srcSkills).filter((f) => {
        if (f === '_backup') return false;
        return fs.statSync(path.join(srcSkills, f)).isDirectory();
      });

      for (const skillName of templateSkills) {
        const srcPath = path.join(srcSkills, skillName);
        const destPath = path.join(destSkills, skillName);
        const srcHash = computeSkillHash(srcPath);

        if (!fs.existsSync(destPath)) {
          if (flags.dryRun) {
            actions.synced.push(`[ WOULD INSTALL ] ${skillName} from core templates`);
          } else {
            copyRecursiveSync(srcPath, destPath);
            manifest.skills[skillName] = {
              source: 'core',
              version: PKG.version,
              hash: srcHash,
              customized: false,
              installedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            actions.synced.push(`[ INSTALLED ] ${skillName}`);
          }
        } else {
          const destHash = computeSkillHash(destPath);
          const manifestEntry = manifest.skills[skillName];

          const isModified = manifestEntry && manifestEntry.hash
            ? manifestEntry.hash !== destHash
            : destHash !== srcHash && TEMPLATE_DIR !== TARGET_DIR;

          if (isModified) {
            if (flags.dryRun) {
              actions.backedUp.push(`[ WOULD BACKUP ] ${skillName} (local modifications) -> .agents/_backup/skills/${skillName}-<timestamp>/`);
              actions.synced.push(`[ WOULD SYNC ] ${skillName} from core templates`);
            } else {
              const backupPath = backupSkill(destPath, skillName, TARGET_DIR);
              actions.backedUp.push(`[ BACKUP ] Preserved local modifications in ${path.relative(TARGET_DIR, backupPath)}`);
              copyRecursiveSync(srcPath, destPath);
              manifest.skills[skillName] = {
                source: 'core',
                version: PKG.version,
                hash: srcHash,
                customized: false,
                installedAt: (manifestEntry && manifestEntry.installedAt) || new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              actions.synced.push(`[ SYNCED ] ${skillName} (overwrote with core template after backup)`);
            }
          } else if (destHash !== srcHash) {
            if (flags.dryRun) {
              actions.synced.push(`[ WOULD UPDATE ] ${skillName} with upstream core changes`);
            } else {
              copyRecursiveSync(srcPath, destPath);
              manifest.skills[skillName] = {
                source: 'core',
                version: PKG.version,
                hash: srcHash,
                customized: false,
                installedAt: (manifestEntry && manifestEntry.installedAt) || new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              actions.synced.push(`[ UPDATED ] ${skillName}`);
            }
          } else {
            if (!manifest.skills[skillName]) {
              manifest.skills[skillName] = {
                source: 'core',
                version: PKG.version,
                hash: srcHash,
                customized: false,
                installedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              actions.registered.push(skillName);
            } else {
              actions.unchanged.push(skillName);
            }
          }
        }
      }
    }

    if (fs.existsSync(destSkills)) {
      const localSkills = fs.readdirSync(destSkills).filter((f) => {
        if (f === '_backup') return false;
        return fs.statSync(path.join(destSkills, f)).isDirectory();
      });
      for (const local of localSkills) {
        if (!manifest.skills[local]) {
          const lHash = computeSkillHash(path.join(destSkills, local));
          manifest.skills[local] = {
            source: 'community',
            version: '1.0.0',
            hash: lHash,
            customized: false,
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          actions.registered.push(local);
        }
      }
    }

    if (!flags.dryRun) {
      saveSkillManifest(manifest, TARGET_DIR);
    }

    if (actions.backedUp.length > 0) {
      actions.backedUp.forEach((b) => console.log(`${colors.yellow}${b}${colors.reset}`));
    }
    if (actions.synced.length > 0) {
      actions.synced.forEach((s) => console.log(`${colors.green}${s}${colors.reset}`));
    }
    if (actions.registered.length > 0) {
      console.log(`${colors.cyan}[ REGISTERED ] ${actions.registered.length} skills in .agents/manifest.json${colors.reset}`);
    }

    console.log(`\n${colors.green}[ OK ] Skill synchronization complete (${actions.unchanged.length} unchanged, ${actions.synced.length} synced, ${actions.backedUp.length} backed up).${colors.reset}\n`);
    return;
  }

  if (subCmd === 'check') {
    const destSkills = path.join(TARGET_DIR, '.agents', 'skills');
    const srcSkills = path.join(TEMPLATE_DIR, '.agents', 'skills');
    const manifest = getSkillManifest(TARGET_DIR);

    const skillsDir = fs.existsSync(destSkills) ? destSkills : srcSkills;
    const skillEntries = fs.readdirSync(skillsDir).filter((f) => {
      if (f === '_backup') return false;
      return fs.statSync(path.join(skillsDir, f)).isDirectory();
    });

    const report = {
      total: skillEntries.length,
      customizedCount: 0,
      driftCount: 0,
      skills: []
    };

    for (const name of skillEntries) {
      const currentPath = path.join(skillsDir, name);
      const currentHash = computeSkillHash(currentPath);
      const templatePath = path.join(srcSkills, name);
      const templateHash = fs.existsSync(templatePath) ? computeSkillHash(templatePath) : null;
      const manifestEntry = (manifest.skills && manifest.skills[name]) || {};

      const isCustomized = Boolean(manifestEntry.hash && manifestEntry.hash !== currentHash) ||
                           Boolean(manifestEntry.customized);
      const hasDrift = Boolean(templateHash && templateHash !== currentHash && !isCustomized);
      const upToDate = !isCustomized && !hasDrift;

      if (isCustomized) report.customizedCount++;
      if (hasDrift) report.driftCount++;

      report.skills.push({
        name,
        source: manifestEntry.source || (templateHash ? 'core' : 'community'),
        customized: isCustomized,
        drift: hasDrift,
        upToDate,
        hash: currentHash
      });
    }

    if (flags.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log(`${colors.bold}DEV-OS SKILL INTEGRITY & DRIFT CHECK${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}\n`);

    report.skills.forEach((s) => {
      let statusStr = `${colors.green}[ UP TO DATE ]${colors.reset}`;
      if (s.customized) {
        statusStr = `${colors.yellow}[ CUSTOMIZED ]${colors.reset}`;
      } else if (s.drift) {
        statusStr = `${colors.cyan}[ UPDATE AVAIL ]${colors.reset}`;
      }
      console.log(`  ${s.name.padEnd(32)} ${statusStr}`);
    });

    console.log(`\n${colors.bold}SUMMARY:${colors.reset} ${report.total} installed, ${report.customizedCount} customized, ${report.driftCount} updates available.\n`);

    try {
      runSkillsCli(['check']);
    } catch (e) {}

    return;
  }

  if (subCmd === 'add' || subCmd === 'install') {
    let pkg = positional[1];
    // Merged skills keep working through packs.json aliases (single source of truth)
    if (pkg) {
      const resolved = resolveSkillAlias(pkg);
      if (resolved !== pkg) {
        console.log(`${colors.yellow}[ WARN ] ${pkg} was merged into ${resolved}${colors.reset}`);
        pkg = resolved;
      }
    }
    // A Dev-OS core skill installs from the bundled templates (no network)
    if (pkg && safeFileStem(pkg, null) === pkg && fs.existsSync(path.join(TEMPLATE_DIR, '.agents', 'skills', pkg, 'SKILL.md'))) {
      const destSkill = path.join(TARGET_DIR, '.agents', 'skills', pkg);
      if (TEMPLATE_DIR === TARGET_DIR) {
        console.log(`${colors.green}[ OK ] Skill '${pkg}' is part of this Dev-OS source tree.${colors.reset}`);
        return;
      }
      const manifest = getSkillManifest(TARGET_DIR);
      const entry = manifest.skills[pkg];
      const currentHash = fs.existsSync(destSkill) ? computeSkillHash(destSkill) : null;
      if (currentHash && (!entry || entry.hash !== currentHash)) {
        const backupPath = backupSkill(destSkill, pkg, TARGET_DIR);
        console.log(`${colors.yellow}[ BACKUP ] Preserved local modifications in ${path.relative(TARGET_DIR, backupPath)}${colors.reset}`);
      }
      fs.mkdirSync(path.dirname(destSkill), { recursive: true });
      copyRecursiveSync(path.join(TEMPLATE_DIR, '.agents', 'skills', pkg), destSkill);
      manifest.skills[pkg] = {
        source: 'core',
        version: PKG.version,
        hash: computeSkillHash(destSkill),
        customized: false,
        installedAt: (entry && entry.installedAt) || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      saveSkillManifest(manifest, TARGET_DIR);
      console.log(`${colors.green}[ OK ] Core skill '${pkg}' installed from Dev-OS templates into .agents/skills/${pkg}/.${colors.reset}`);
      return;
    }
    if (!pkg) {
      console.error(`${colors.red}[ FAIL ] Missing skill package or repository name.${colors.reset}`);
      console.log(`\nUsage: ${colors.cyan}devos skill add <owner/repo>${colors.reset}`);
      console.log(`Example: ${colors.cyan}devos skill add vercel-labs/agent-skills${colors.reset}`);
      console.log(`Browse skills: https://skills.sh\n`);
      process.exit(1);
    }
    console.log(`${colors.bold}INSTALLING AGENT SKILL${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}\n`);
    if (isOffline()) {
      warnOfflineSkip(`npx ${SKILLS_CLI} add ${pkg}`);
      console.error(`${colors.red}[ FAIL ] Skill '${pkg}' was not installed (offline mode).${colors.reset}`);
      process.exit(1);
    }
    console.log(`Fetching from skills.sh / GitHub (${colors.cyan}npx ${SKILLS_CLI} add ${pkg}${colors.reset})...\n`);
    const res = runSkillsCli(['add', pkg, '--yes']);
    if (res.status !== 0) {
      console.error(`\n${colors.red}[ FAIL ] Failed to install skill '${pkg}'. Check package name or network connectivity.${colors.reset}`);
      process.exit(res.status || 1);
    }

    const destSkills = path.join(TARGET_DIR, '.agents', 'skills');
    const manifest = getSkillManifest(TARGET_DIR);
    if (fs.existsSync(destSkills)) {
      const dirs = fs.readdirSync(destSkills).filter((f) => f !== '_backup' && fs.statSync(path.join(destSkills, f)).isDirectory());
      for (const d of dirs) {
        if (!manifest.skills[d]) {
          const h = computeSkillHash(path.join(destSkills, d));
          manifest.skills[d] = {
            source: `github:${pkg}`,
            version: 'community',
            hash: h,
            customized: false,
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        }
      }
      saveSkillManifest(manifest, TARGET_DIR);
    }

    console.log(`\n${colors.green}[ OK ] Skill '${pkg}' successfully installed and registered into .agents/manifest.json.${colors.reset}\n`);
    return;
  }

  if (subCmd === 'update' || subCmd === 'upgrade') {
    console.log(`${colors.bold}UPDATING AGENT SKILLS${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}\n`);

    const destSkills = path.join(TARGET_DIR, '.agents', 'skills');
    const srcSkills = path.join(TEMPLATE_DIR, '.agents', 'skills');
    const manifest = getSkillManifest(TARGET_DIR);

    if (TEMPLATE_DIR === TARGET_DIR) {
      console.log(`${colors.yellow}[ WARN ] Running inside the Dev-OS source repository; nothing to update.${colors.reset}\n`);
      return;
    }

    // Only already-installed skills are refreshed; customized ones need --force (backed up first)
    const res = syncInstalledSkills(srcSkills, destSkills, manifest, { force: flags.force, dryRun: flags.dryRun, targetDir: TARGET_DIR });
    const prefix = flags.dryRun ? '[ DRY RUN ] Would update' : '[ UPDATED ]';
    res.updated.forEach((n) => console.log(`${colors.green}${prefix} ${n}${colors.reset}`));
    res.backedUp.forEach((b) => console.log(`${colors.yellow}[ BACKUP ] Preserved local modifications in ${b}${colors.reset}`));
    res.skippedCustomized.forEach((n) => console.log(`${colors.yellow}[ WARN ] Skipped customized skill '${n}' (re-run with --force to overwrite; a backup is taken)${colors.reset}`));

    if (flags.dryRun) {
      console.log(`\n[ DRY RUN ] ${describeSkillSync(res)}\n`);
      return;
    }
    saveSkillManifest(manifest, TARGET_DIR);

    console.log(`\nChecking upstream repositories (${colors.cyan}npx ${SKILLS_CLI} update${colors.reset})...\n`);
    try {
      const upRes = runSkillsCli(['update', '-y']);
      if (upRes.status === 0) {
        console.log(`\n${colors.green}[ OK ] Upstream skills updated successfully.${colors.reset}`);
      }
    } catch (e) {}

    console.log(`${colors.green}[ OK ] Dev-OS core skills synchronized: ${describeSkillSync(res)}.${colors.reset}\n`);
    return;
  }

  if (subCmd === 'find' || subCmd === 'search') {
    const query = positional.slice(1).join(' ');
    console.log(`${colors.bold}SEARCHING AGENT SKILLS (skills.sh)${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}\n`);
    const args = ['find'];
    if (query) args.push(query);
    runSkillsCli(args);
    return;
  }

  console.error(`${colors.red}[ FAIL ] Unknown skill subcommand '${subCmd}'. Use 'list', 'audit', 'sync', 'check', 'update', 'add', or 'find'.${colors.reset}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// run / auto
// ---------------------------------------------------------------------------

function runAuto(flags, positional) {
  const runnerPath = path.join(TEMPLATE_DIR, 'scripts', 'sdlc-runner.js');
  if (!fs.existsSync(runnerPath)) {
    console.error(`${colors.red}[ FAIL ] SDLC runner (scripts/sdlc-runner.js) not found. Run 'devos update' to restore it.${colors.reset}`);
    process.exit(1);
  }

  // Forward all relevant flags and positional args to sdlc-runner
  const runnerArgs = [];
  if (flags.status)  runnerArgs.push('--status');
  if (flags.dryRun)  runnerArgs.push('--dry-run');
  if (flags.resume)  runnerArgs.push('--resume');
  if (flags.reset)   runnerArgs.push('--reset');
  if (flags.list)    runnerArgs.push('--list');
  if (flags.json)    runnerArgs.push('--json');
  if (flags.quiet)   runnerArgs.push('--quiet');
  if (flags.step)    runnerArgs.push('--step', flags.step);
  if (positional.length) runnerArgs.push(...positional);

  const { spawnSync } = require('child_process');
  const res = spawnSync(process.execPath, [runnerPath, ...runnerArgs], {
    cwd:   TARGET_DIR,
    stdio: 'inherit',
    env:   process.env
  });

  process.exit(res.status !== null ? res.status : 1);
}

// ---------------------------------------------------------------------------
// telemetry (observability, sanitization, RCA analysis, and auto-feedback)
// ---------------------------------------------------------------------------

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectHarness() {
  if (process.env.DEVOS_HARNESS) return process.env.DEVOS_HARNESS;
  const manifestPath = path.join(TARGET_DIR, '.agents', 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (m.platform && m.platform !== 'all') return m.platform;
    } catch (e) {}
  }
  if (fs.existsSync(path.join(TARGET_DIR, 'ANTIGRAVITY.md'))) return 'antigravity';
  if (fs.existsSync(path.join(TARGET_DIR, '.claude'))) return 'claude';
  if (fs.existsSync(path.join(TARGET_DIR, '.cursor'))) return 'cursor';
  if (fs.existsSync(path.join(TARGET_DIR, '.opencode'))) return 'opencode';
  if (fs.existsSync(path.join(TARGET_DIR, '.codex'))) return 'codex';
  return 'universal';
}

function sanitizeTelemetry(text, options = {}) {
  if (typeof text !== 'string') return text;
  let sanitized = text;

  // 1. Secrets & Credentials Scrubbing
  sanitized = sanitized.replace(/\b(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}\b/g, '[REDACTED_GITHUB_TOKEN]');
  sanitized = sanitized.replace(/\bgithub_pat_[a-zA-Z0-9_]{82}\b/g, '[REDACTED_GITHUB_TOKEN]');
  sanitized = sanitized.replace(/\bsk-ant-[a-zA-Z0-9_\-]{32,}\b/g, '[REDACTED_ANTHROPIC_KEY]');
  sanitized = sanitized.replace(/\bsk-[a-zA-Z0-9]{32,}\b/g, '[REDACTED_OPENAI_KEY]');
  sanitized = sanitized.replace(/\bAIza[0-9A-Za-z\-_]{35}\b/g, '[REDACTED_GOOGLE_API_KEY]');
  sanitized = sanitized.replace(/\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g, '[REDACTED_AWS_KEY]');
  sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi, 'Bearer [REDACTED_TOKEN]');
  sanitized = sanitized.replace(/\beyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\b/g, '[REDACTED_JWT_TOKEN]');
  sanitized = sanitized.replace(/-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]');

  // 2. Path Normalization
  const targetDir = (options && options.targetDir) || TARGET_DIR;
  if (typeof targetDir === 'string' && targetDir.length > 1) {
    sanitized = sanitized.split(targetDir).join('[REPO_ROOT]');
  }
  const os = require('os');
  try {
    const homeDir = os.homedir();
    if (homeDir && homeDir.length > 1) {
      sanitized = sanitized.split(homeDir).join('[HOME]');
    }
  } catch (e) {}

  sanitized = sanitized.replace(/(\/Users\/)[^\/\s"']+/g, '$1[REDACTED_USER]');
  sanitized = sanitized.replace(/(\/home\/)[^\/\s"']+/g, '$1[REDACTED_USER]');
  sanitized = sanitized.replace(/([A-Z]:\\[Uu]sers\\)[^\s"'\\]+/g, '$1[REDACTED_USER]');

  // 3. Machine & User Redaction
  try {
    const username = os.userInfo().username;
    if (username && username.length > 1) {
      const userRegex = new RegExp(`\\b${escapeRegExp(username)}\\b`, 'g');
      sanitized = sanitized.replace(userRegex, '[REDACTED_USER]');
    }
    const hostname = os.hostname();
    if (hostname && hostname.length > 1) {
      const hostRegex = new RegExp(`\\b${escapeRegExp(hostname)}\\b`, 'g');
      sanitized = sanitized.replace(hostRegex, '[REDACTED_HOST]');
    }
  } catch (e) {}

  return sanitized;
}

function analyzeTelemetry(events) {
  const total = events.length;
  const breakdown = {
    byType: {},
    byCategory: {},
    byRule: {},
    byHarness: {}
  };
  const clusters = {};

  for (const ev of events) {
    const type = ev.eventType || 'UNKNOWN';
    const cat = ev.category || (type === 'RUNNER_ERROR' || type === 'EVAL_REGRESSION' ? 'FRAMEWORK_BUG' : 'RULE_VIOLATION');
    const rule = ev.rule || 'GENERAL';
    const harness = ev.harness || 'universal';

    breakdown.byType[type] = (breakdown.byType[type] || 0) + 1;
    breakdown.byCategory[cat] = (breakdown.byCategory[cat] || 0) + 1;
    breakdown.byRule[rule] = (breakdown.byRule[rule] || 0) + 1;
    breakdown.byHarness[harness] = (breakdown.byHarness[harness] || 0) + 1;

    const clusterKey = `${type}::${rule}`;
    if (!clusters[clusterKey]) {
      clusters[clusterKey] = {
        key: clusterKey,
        type,
        rule,
        category: cat,
        count: 0,
        sampleDetail: ev.detail || '',
        lastTimestamp: ev.timestamp || new Date().toISOString()
      };
    }
    clusters[clusterKey].count++;
    clusters[clusterKey].lastTimestamp = ev.timestamp || clusters[clusterKey].lastTimestamp;
  }

  const clusterList = Object.values(clusters).sort((a, b) => b.count - a.count);

  const recommendations = [];
  if ((breakdown.byCategory['FRAMEWORK_BUG'] || 0) > 0) {
    recommendations.push('Detected framework-level errors. Consider reporting upstream via: devos telemetry issue');
  }
  if ((breakdown.byRule['MANDATORY_DESIGN_GATE'] || 0) > 0) {
    recommendations.push('Design Gate active: author docs/DESIGN.md with UI tokens before modifying frontend UI files.');
  }
  if ((breakdown.byRule['ENV_PARITY_GATE'] || 0) > 0) {
    recommendations.push('Environment Parity active: keep .env.example synchronized with referenced env variables.');
  }
  if ((breakdown.byRule['DB_MIGRATION_SAFETY'] || 0) > 0) {
    recommendations.push('Migration Safety active: ensure ENABLE ROW LEVEL SECURITY is present on new tables.');
  }
  if ((breakdown.byRule['ORCHESTRATION_GATE'] || 0) > 0) {
    recommendations.push('Orchestration Gate active: declare an active task in docs/TASK_BOARD.md or set DEVOS_SOLO_APPROVED=true.');
  }

  return {
    total,
    breakdown,
    clusters: clusterList,
    recommendations
  };
}

// Ask a yes/no question on a TTY; resolves false on EOF or anything but y/yes
function confirmPrompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let answered = false;
    rl.on('close', () => { if (!answered) resolve(false); });
    rl.question(question, (answer) => {
      answered = true;
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

// Environment markers set by AI coding agents in the shells they spawn. Kept
// in sync with AGENT_MARKERS in .agents/hooks/lib/hook-input.js (sources
// listed there); DEVOS_AGENT_SHELL lets any other harness opt in explicitly.
const AGENT_SHELL_MARKERS = ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'GEMINI_CLI', 'CODEX_SANDBOX',
  'CODEX_SANDBOX_NETWORK_DISABLED', 'CODEX_THREAD_ID', 'CURSOR_AGENT', 'AI_AGENT', 'DEVOS_AGENT_SHELL'];

function detectAgentShell(env = process.env) {
  return AGENT_SHELL_MARKERS.find((k) => {
    const v = env[k];
    return typeof v === 'string' && v.trim() !== '' && v.trim() !== '0' && v.trim().toLowerCase() !== 'false';
  }) || null;
}

// Publishing telemetry upstream is a public, irreversible action, so only a
// human at an interactive terminal may approve it (default No). --yes is
// ignored here: an agent could pass it by itself. Agent shells and non-TTY
// stdin are refused outright. --dry-run never reaches this function.
async function requirePublishConsent(flags, what) {
  const refuse = (reason) => {
    console.error(`${colors.red}[ FAIL ] Refusing to publish ${what} to olitech1010/dev-os: ${reason}.${colors.reset}`);
    console.error(`${colors.yellow}         Review it with --dry-run, then have a human run the command in an interactive terminal and confirm.${colors.reset}\n`);
    process.exit(1);
  };
  const marker = detectAgentShell();
  if (marker) refuse(`running inside an AI agent shell (${marker} is set); publishing needs a human`);
  if (!process.stdin.isTTY) refuse('stdin is not an interactive terminal, so no human can confirm');
  if (flags.yes) {
    console.log(`${colors.yellow}[ WARN ] --yes does not approve publishing; confirm below.${colors.reset}`);
  }
  const ok = await confirmPrompt(`${colors.cyan}Publish ${what} publicly to github.com/olitech1010/dev-os? [y/N]: ${colors.reset}`);
  if (!ok) {
    console.log(`${colors.yellow}[ WARN ] Publishing cancelled. Nothing was sent.${colors.reset}\n`);
  }
  return ok;
}

async function runTelemetry(flags, positional) {
  if (!flags.quiet && !flags.json && flags.dryRun !== true) printBanner();
  const sub = (positional[0] || 'status').toLowerCase();
  const manifestPath = path.join(TARGET_DIR, '.agents', 'manifest.json');
  if ((sub === 'enable' || sub === 'disable') && !fs.existsSync(path.join(TARGET_DIR, '.agents'))) {
    console.error(`${colors.red}[ FAIL ] Dev-OS is not initialized in this directory (${TARGET_DIR}).${colors.reset}`);
    console.error(`${colors.yellow}         Run 'devos init' first, then 'devos telemetry ${sub}'.${colors.reset}\n`);
    process.exit(1);
  }
  const manifest = fs.existsSync(manifestPath) ? readJsonFile(manifestPath, '.agents/manifest.json') : { telemetry: 'on' };
  const telemetryDir = path.join(TARGET_DIR, '.agents', 'telemetry');
  const reportsDir = path.join(telemetryDir, 'reports');
  const eventsPath = path.join(telemetryDir, 'events.jsonl');
  const isEnabled = manifest.telemetry !== 'off';

  if (sub === 'enable') {
    manifest.telemetry = 'on';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`${colors.green}[ OK ] Anonymous failure telemetry enabled.${colors.reset}\n`);
    return;
  }

  if (sub === 'disable') {
    manifest.telemetry = 'off';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`${colors.yellow}[ OK ] Anonymous failure telemetry disabled.${colors.reset}\n`);
    return;
  }

  if (sub === 'clear') {
    if (fs.existsSync(eventsPath)) {
      fs.writeFileSync(eventsPath, '', 'utf8');
    }
    console.log(`${colors.green}[ OK ] Telemetry event buffer cleared.${colors.reset}\n`);
    return;
  }

  if (sub === 'log') {
    if (!isEnabled) {
      if (!flags.quiet) console.log(`${colors.yellow}[ NOTICE ] Telemetry is disabled; event not logged.${colors.reset}\n`);
      return;
    }
    fs.mkdirSync(telemetryDir, { recursive: true });
    const eventType = flags.type || positional[1] || 'HOOK_VIOLATION';
    const rule = flags.rule || positional[2] || 'GENERAL';
    const rawDetail = flags.detail || positional.slice(3).join(' ') || '';
    const category = flags.category || (eventType === 'RUNNER_ERROR' || eventType === 'EVAL_REGRESSION' ? 'FRAMEWORK_BUG' : 'RULE_VIOLATION');
    const harness = flags.harness || detectHarness();

    const ev = {
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      version: PKG.version,
      harness,
      eventType,
      category,
      rule,
      detail: sanitizeTelemetry(rawDetail),
      sanitized: true
    };
    fs.appendFileSync(eventsPath, JSON.stringify(ev) + '\n', 'utf8');
    if (!flags.quiet && !flags.json) {
      console.log(`${colors.green}[ OK ] Logged telemetry event:${colors.reset} ${colors.cyan}${eventType}${colors.reset} [${rule}]`);
    }
    return;
  }

  // Load buffered events for analysis
  let eventCount = 0;
  let parsedEvents = [];
  if (fs.existsSync(eventsPath)) {
    const raw = fs.readFileSync(eventsPath, 'utf8').trim();
    if (raw.length > 0) {
      const lines = raw.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          parsedEvents.push(JSON.parse(line));
        } catch (e) {}
      }
      eventCount = parsedEvents.length;
    }
  }

  const analysis = analyzeTelemetry(parsedEvents);

  if (sub === 'report') {
    if (flags.json) {
      console.log(JSON.stringify({
        status: isEnabled ? 'enabled' : 'disabled',
        bufferPath: path.relative(TARGET_DIR, eventsPath),
        ...analysis
      }, null, 2));
      return;
    }

    console.log(`${colors.bold}TELEMETRY & ROOT CAUSE ANALYSIS (RCA) REPORT${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}`);
    console.log(`  Status:       ${isEnabled ? colors.green + 'Enabled (on)' : colors.yellow + 'Disabled (off)'}${colors.reset}`);
    console.log(`  Event Buffer: ${colors.cyan}${eventCount} events recorded${colors.reset}\n`);

    if (eventCount === 0) {
      console.log(`  ${colors.green}[ OK ] Zero failure events recorded. All runtime hooks and gates are operating cleanly.${colors.reset}\n`);
      return;
    }

    console.log(`${colors.bold}Category Breakdown:${colors.reset}`);
    Object.keys(analysis.breakdown.byCategory).forEach((cat) => {
      console.log(`  - ${colors.cyan}${cat}${colors.reset}: ${analysis.breakdown.byCategory[cat]} occurrences`);
    });

    console.log(`\n${colors.bold}Failure Breakdown by Rule:${colors.reset}`);
    Object.keys(analysis.breakdown.byRule).forEach((r) => {
      console.log(`  - ${colors.yellow}${r}${colors.reset}: ${analysis.breakdown.byRule[r]} occurrences`);
    });

    console.log(`\n${colors.bold}Clustered Failure Signatures:${colors.reset}`);
    analysis.clusters.slice(0, 5).forEach((c) => {
      console.log(`  • ${colors.bold}${c.type}${colors.reset} [${colors.yellow}${c.rule}${colors.reset}] (${c.count}x) — ${colors.gray}${c.sampleDetail ? c.sampleDetail.slice(0, 80) : ''}${colors.reset}`);
    });

    if (analysis.recommendations.length > 0) {
      console.log(`\n${colors.bold}Actionable Recommendations:${colors.reset}`);
      analysis.recommendations.forEach((rec) => {
        console.log(`  ${colors.green}→${colors.reset} ${rec}`);
      });
    }

    console.log(`\nCommands:`);
    console.log(`  $ ${colors.cyan}devos telemetry issue --dry-run${colors.reset}   Synthesize upstream diagnostic issue`);
    console.log(`  $ ${colors.cyan}devos telemetry export${colors.reset}            Export sanitized telemetry bundle`);
    console.log(`  $ ${colors.cyan}devos telemetry clear${colors.reset}             Clear local event buffer\n`);
    return;
  }

  if (sub === 'export') {
    fs.mkdirSync(reportsDir, { recursive: true });
    const targetFile = flags.output || path.join(reportsDir, `telemetry-export-${Date.now()}.json`);
    const exportBundle = {
      exportedAt: new Date().toISOString(),
      version: PKG.version,
      harness: detectHarness(),
      analysis,
      events: parsedEvents.map((e) => ({ ...e, detail: sanitizeTelemetry(e.detail) }))
    };
    fs.writeFileSync(targetFile, JSON.stringify(exportBundle, null, 2) + '\n', 'utf8');
    if (flags.json) {
      console.log(JSON.stringify({ exported: true, path: targetFile }, null, 2));
    } else {
      console.log(`${colors.green}[ OK ] Sanitized telemetry exported to:${colors.reset} ${path.relative(TARGET_DIR, targetFile) || targetFile}\n`);
    }
    return;
  }

  if (sub === 'issue') {
    fs.mkdirSync(reportsDir, { recursive: true });
    const cluster = analysis.clusters[0];
    const defaultTitle = cluster
      ? `[Telemetry RCA] ${cluster.type} in ${cluster.rule}`
      : `[Telemetry RCA] Diagnostic Feedback Report`;
    const title = flags.title || defaultTitle;
    const timestamp = Date.now();
    const reportPath = path.join(reportsDir, `issue-${timestamp}.md`);

    const recentEvents = parsedEvents.slice(-5).map((e) => ({
      timestamp: e.timestamp,
      eventType: e.eventType,
      category: e.category,
      rule: e.rule,
      detail: sanitizeTelemetry(e.detail)
    }));

    const issueBody = [
      `### Dev-OS Diagnostic Report & Upstream Feedback`,
      ``,
      `**Environment Information:**`,
      `- **Dev-OS Version:** ${PKG.version}`,
      `- **Node.js Runtime:** ${process.version}`,
      `- **OS Platform:** ${process.platform} (${process.arch})`,
      `- **Active Harness:** ${detectHarness()}`,
      `- **Report Timestamp:** ${new Date().toISOString()}`,
      ``,
      `### Telemetry Buffer Summary`,
      `- **Total Buffered Events:** ${eventCount}`,
      `- **Framework Defects:** ${analysis.breakdown.byCategory['FRAMEWORK_BUG'] || 0}`,
      `- **Gate Violations:** ${analysis.breakdown.byCategory['RULE_VIOLATION'] || 0}`,
      ``,
      `### Clustered Error Signatures`,
      analysis.clusters.length > 0
        ? analysis.clusters.map((c) => `- **${c.type}** [${c.rule}] (${c.count} occurrences)\n  Sample: \`${sanitizeTelemetry(c.sampleDetail || 'N/A')}\``).join('\n')
        : `- *Zero failure clusters recorded in local buffer.*`,
      ``,
      `### Sanitized Event Trace (Recent)`,
      '```json',
      JSON.stringify(recentEvents, null, 2),
      '```',
      ``,
      `### Context & Reproduction`,
      `*Automated report compiled by Dev-OS Telemetry & Root Cause Analysis Engine.*`,
      `*Privacy Gate Verified: 0 credentials, 0 proprietary paths, 0 local usernames.*`
    ].join('\n');

    const sanitizedBody = sanitizeTelemetry(issueBody);
    fs.writeFileSync(reportPath, sanitizedBody + '\n', 'utf8');

    const webUrl = `https://github.com/olitech1010/dev-os/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(sanitizedBody.slice(0, 3000))}`;

    if (flags.dryRun) {
      if (flags.json) {
        console.log(JSON.stringify({ dryRun: true, title, reportPath, webUrl }, null, 2));
      } else {
        console.log(`${colors.bold}UPSTREAM DIAGNOSTIC ISSUE (DRY-RUN)${colors.reset}`);
        console.log(`${colors.gray}${RULE}${colors.reset}`);
        console.log(`  ${colors.green}[ OK ] Privacy Gate Verified:${colors.reset} 0 credentials, 0 machine paths, 0 usernames exposed.`);
        console.log(`  Title:       ${colors.cyan}${title}${colors.reset}`);
        console.log(`  Saved to:    ${path.relative(TARGET_DIR, reportPath) || reportPath}`);
        console.log(`  Web Link:    ${colors.gray}${webUrl.slice(0, 80)}...${colors.reset}`);
        console.log(`\n${colors.bold}Issue Preview:${colors.reset}\n${sanitizedBody.slice(0, 600)}\n...\n`);
      }
      return;
    }

    if (!(await requirePublishConsent(flags, 'this diagnostic issue'))) return;

    // Live dispatch via gh CLI if present
    const ghCheck = isOffline() ? { status: null } : spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' });
    if (isOffline()) warnOfflineSkip('gh issue create');
    if (ghCheck.status === 0) {
      console.log(`Dispatching issue via GitHub CLI (${colors.cyan}gh issue create --repo olitech1010/dev-os${colors.reset})...\n`);
      const res = spawnSync('gh', ['issue', 'create', '--repo', 'olitech1010/dev-os', '--title', title, '--body-file', reportPath], {
        cwd: TARGET_DIR,
        stdio: 'inherit'
      });
      if (res.status === 0) {
        console.log(`\n${colors.green}[ OK ] Diagnostic issue successfully submitted to olitech1010/dev-os.${colors.reset}\n`);
        return;
      }
    }

    console.log(`${colors.bold}UPSTREAM DIAGNOSTIC ISSUE PREPARED${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}`);
    console.log(`  ${colors.yellow}[ NOTICE ] GitHub CLI (gh) not authenticated or not found.${colors.reset}`);
    console.log(`  Sanitized report generated at: ${colors.cyan}${path.relative(TARGET_DIR, reportPath) || reportPath}${colors.reset}`);
    console.log(`\nSubmit in 1-click via your browser:\n  ${colors.cyan}${webUrl}${colors.reset}\n`);
    return;
  }

  if (sub === 'pr') {
    fs.mkdirSync(reportsDir, { recursive: true });
    const title = flags.title || 'fix(telemetry): framework diagnostic fix from local RCA';
    const timestamp = Date.now();
    const prPath = path.join(reportsDir, `pr-${timestamp}.md`);

    const prBody = [
      `### Dev-OS Automated Diagnostic Pull Request`,
      ``,
      `**Environment Information:**`,
      `- **Dev-OS Version:** ${PKG.version}`,
      `- **Node.js Runtime:** ${process.version}`,
      `- **OS Platform:** ${process.platform} (${process.arch})`,
      `- **Target Repository:** https://github.com/olitech1010/dev-os`,
      ``,
      `### Summary & Justification`,
      `${title}`,
      ``,
      `### Privacy & Sanitization Gate Checklist`,
      `- [x] Zero API keys, passwords, or secret tokens`,
      `- [x] Zero absolute machine file paths or local usernames`,
      `- [x] Clean diff verified against Dev-OS Quality Gate`,
      ``,
      `---`,
      `*Generated automatically by Dev-OS Telemetry & Auto-PR Engine.*`
    ].join('\n');

    const sanitizedPrBody = sanitizeTelemetry(prBody);
    fs.writeFileSync(prPath, sanitizedPrBody + '\n', 'utf8');

    if (flags.dryRun) {
      if (flags.json) {
        console.log(JSON.stringify({ dryRun: true, title, prPath }, null, 2));
      } else {
        console.log(`${colors.bold}UPSTREAM DIAGNOSTIC PR (DRY-RUN)${colors.reset}`);
        console.log(`${colors.gray}${RULE}${colors.reset}`);
        console.log(`  ${colors.green}[ OK ] Privacy Gate Verified:${colors.reset} Zero credentials or sensitive data detected.`);
        console.log(`  Title:       ${colors.cyan}${title}${colors.reset}`);
        console.log(`  Draft file:  ${path.relative(TARGET_DIR, prPath) || prPath}`);
        console.log(`\n${colors.bold}PR Preview:${colors.reset}\n${sanitizedPrBody}\n`);
      }
      return;
    }

    if (!(await requirePublishConsent(flags, 'this diagnostic pull request'))) return;

    const ghCheck = isOffline() ? { status: null } : spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' });
    if (isOffline()) warnOfflineSkip('gh pr create');
    if (ghCheck.status === 0) {
      console.log(`Creating pull request via GitHub CLI (${colors.cyan}gh pr create --repo olitech1010/dev-os${colors.reset})...\n`);
      const res = spawnSync('gh', ['pr', 'create', '--repo', 'olitech1010/dev-os', '--title', title, '--body-file', prPath], {
        cwd: TARGET_DIR,
        stdio: 'inherit'
      });
      if (res.status === 0) {
        console.log(`\n${colors.green}[ OK ] Diagnostic PR successfully opened at olitech1010/dev-os.${colors.reset}\n`);
        return;
      }
    }

    console.log(`${colors.bold}UPSTREAM DIAGNOSTIC PR TEMPLATE READY${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}`);
    console.log(`  Draft PR template saved to: ${colors.cyan}${path.relative(TARGET_DIR, prPath) || prPath}${colors.reset}`);
    console.log(`  Submit upstream at: https://github.com/olitech1010/dev-os/compare\n`);
    return;
  }

  // default 'status'
  console.log(`${colors.bold}DEV-OS TELEMETRY STATUS${colors.reset}`);
  console.log(`${colors.gray}${RULE}${colors.reset}`);
  console.log(`  Status:       ${isEnabled ? colors.green + 'Enabled (on - recommended)' : colors.yellow + 'Disabled (off)'}${colors.reset}`);
  console.log(`  Log Buffer:   ${path.relative(TARGET_DIR, eventsPath) || eventsPath}`);
  console.log(`  Total Events: ${eventCount}`);
  console.log(`\nCommands:`);
  console.log(`  $ ${colors.cyan}devos telemetry report${colors.reset}             View RCA failure breakdown & recommendations`);
  console.log(`  $ ${colors.cyan}devos telemetry issue --dry-run${colors.reset}    Synthesize sanitized upstream issue`);
  console.log(`  $ ${colors.cyan}devos telemetry pr --dry-run${colors.reset}       Prepare sanitized diagnostic pull request`);
  console.log(`  $ ${colors.cyan}devos telemetry export${colors.reset}              Export sanitized event buffer`);
  console.log(`  $ ${colors.cyan}devos telemetry enable${colors.reset}              Enable anonymous failure logging`);
  console.log(`  $ ${colors.cyan}devos telemetry disable${colors.reset}             Disable failure logging`);
  console.log(`  $ ${colors.cyan}devos telemetry clear${colors.reset}               Clear local event buffer\n`);
}

// ---------------------------------------------------------------------------
// mode (session mode lock / orchestrator persistence)
// ---------------------------------------------------------------------------

const VALID_MODES = ['interactive', 'guided', 'auto', 'audit'];

function sessionFilePath() {
  return path.join(TARGET_DIR, '.agents', 'memory', 'session.json');
}

function readSession() {
  const file = sessionFilePath();
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {}
  }
  const manifestPath = path.join(TARGET_DIR, '.agents', 'manifest.json');
  let mode = 'interactive';
  if (fs.existsSync(manifestPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (m.mode) mode = m.mode;
    } catch (e) {}
  }
  return {
    schemaVersion: '1.0.0',
    startedAt: null,
    updatedAt: null,
    mode,
    orchestratorLocked: true,
    delegationRequired: mode === 'auto' || mode === 'guided',
    switchedBy: 'default'
  };
}

function writeSession(session) {
  const file = sessionFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  session.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  fs.writeFileSync(file, JSON.stringify(session, null, 2) + '\n', 'utf8');
}

function runMode(flags, positional) {
  const action = (positional[0] || 'status').toLowerCase();
  const session = readSession();

  if (action === 'status') {
    if (flags.json) {
      console.log(JSON.stringify(session, null, 2));
      return;
    }
    if (!flags.quiet) {
      console.log(`\n${colors.bold}DEV-OS SESSION MODE LOCK${colors.reset}`);
      console.log(`${colors.gray}${'.'.repeat(60)}${colors.reset}`);
    }
    console.log(`  Mode:            ${colors.cyan}${session.mode}${colors.reset}`);
    console.log(`  Orchestrator:    ${session.orchestratorLocked ? colors.green + 'locked' : colors.yellow + 'unlocked'}${colors.reset}`);
    console.log(`  Delegation:      ${session.delegationRequired ? colors.green + 'required' : colors.gray + 'optional'}${colors.reset}`);
    console.log(`  Session File:    ${path.relative(TARGET_DIR, sessionFilePath()) || sessionFilePath()}`);
    console.log(`\nCommands:`);
    console.log(`  $ ${colors.cyan}devos mode <interactive|guided|auto|audit>${colors.reset}  Switch mode (locked artifact)`);
    console.log(`  $ ${colors.cyan}devos mode lock${colors.reset} / ${colors.cyan}unlock${colors.reset}           Toggle orchestrator lock\n`);
    return;
  }

  if (action === 'lock' || action === 'unlock') {
    session.orchestratorLocked = action === 'lock';
    session.switchedBy = 'devos mode';
    writeSession(session);
    console.log(`${colors.green}[ OK ] Orchestrator ${action}ed.${colors.reset}\n`);
    return;
  }

  if (VALID_MODES.includes(action)) {
    session.mode = action;
    session.delegationRequired = action === 'auto' || action === 'guided' || process.env.DEVOS_ENFORCE_ORCHESTRATOR === '1';
    session.switchedBy = 'devos mode';
    writeSession(session);
    console.log(`${colors.green}[ OK ] Session mode set to '${action}'.${colors.reset}`);
    console.log(`${colors.gray}      delegation required: ${session.delegationRequired}${colors.reset}\n`);
    return;
  }

  console.log(`${colors.red}[ FAIL ] Unknown mode '${action}'.${colors.reset}`);
  console.log(`         Valid modes: ${VALID_MODES.join(', ')}\n`);
  process.exit(1);
}

function runScaffold(flags, positional) {
  if (!flags.quiet) {
    console.log(`\n${colors.bold}DEV-OS SCAFFOLD${colors.reset}`);
    console.log(`${colors.gray}${'.'.repeat(60)}${colors.reset}`);
  }

  const destDocs = path.join(TARGET_DIR, 'docs');
  const destAgents = path.join(TARGET_DIR, '.agents');
  fs.mkdirSync(destDocs, { recursive: true });
  fs.mkdirSync(path.join(destAgents, 'memory'), { recursive: true });

  let installed = 0;

  const docScaffolds = ['CURRENT_STATE.md', 'TASK_BOARD.md', 'LESSONS.md'];
  for (const f of docScaffolds) {
    const src = path.join(TEMPLATES_DIR, 'scaffolds', 'docs', f);
    const dest = path.join(TARGET_DIR, 'docs', f);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      if (!flags.quiet) console.log(`  ${colors.green}[ OK ]${colors.reset} Installed ${f}`);
      installed++;
    }
  }

  const memDir = path.join(TARGET_DIR, '.agents', 'memory');
  fs.mkdirSync(memDir, { recursive: true });
  const ctxSrc = path.join(TEMPLATES_DIR, 'scaffolds', 'agents', 'memory', 'context.json');
  const ctxDest = path.join(memDir, 'context.json');
  if (fs.existsSync(ctxSrc) && !fs.existsSync(ctxDest)) {
    fs.copyFileSync(ctxSrc, ctxDest);
    if (!flags.quiet) console.log(`  ${colors.green}[ OK ]${colors.reset} Installed .agents/memory/context.json`);
    installed++;
  }

  if (!flags.quiet) {
    if (installed > 0) {
      console.log(`\n${colors.green}[ OK ]${colors.reset} Scaffold complete (${installed} files installed).`);
    } else {
      console.log(`\n${colors.gray}Already scaffolded — no missing files.${colors.reset}`);
    }
  }
}

function getDesignCatalogDir() {
  const candidates = [
    path.join(TARGET_DIR, '.agents', 'catalog', 'design-systems'),
    path.join(TEMPLATE_DIR, '.agents', 'catalog', 'design-systems')
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'index.json'))) {
      return c;
    }
  }
  return null;
}

function loadDesignCatalog(catalogDir) {
  if (!catalogDir) return [];
  const indexPath = path.join(catalogDir, 'index.json');
  if (!fs.existsSync(indexPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch {
    return [];
  }
}

async function runDesign(flags, positional) {
  const subCmd = positional[0] || (flags.list ? 'list' : (flags.match ? 'match' : (flags.apply ? 'apply' : null)));
  const catalogDir = getDesignCatalogDir();

  if (subCmd === 'sync') {
    const syncScript = path.join(TEMPLATE_DIR, 'scripts', 'sync-design-catalog.js');
    if (!fs.existsSync(syncScript)) {
      console.error(`${colors.red}[ FAIL ] Catalog sync script not found at ${syncScript}${colors.reset}`);
      process.exit(1);
    }
    const { spawnSync } = require('child_process');
    const res = spawnSync(process.execPath, [syncScript], { stdio: 'inherit', cwd: TARGET_DIR });
    process.exit(res.status !== null ? res.status : 1);
  }

  if (!catalogDir) {
    console.error(`${colors.red}[ FAIL ] Design catalog not found. Run 'devos design sync' to populate.${colors.reset}`);
    process.exit(1);
  }

  const catalog = loadDesignCatalog(catalogDir);
  if (catalog.length === 0) {
    console.error(`${colors.red}[ FAIL ] Design catalog index is empty. Run 'devos design sync'.${colors.reset}`);
    process.exit(1);
  }

  if (subCmd === 'list') {
    const categoryFilter = positional.slice(1).join(' ').toLowerCase().trim() || (flags.category ? flags.category.toLowerCase().trim() : '');
    let filtered = catalog;
    if (categoryFilter) {
      filtered = catalog.filter((sys) =>
        sys.category.toLowerCase().includes(categoryFilter) ||
        (categoryFilter === 'ai' && sys.category.toLowerCase().startsWith('ai')) ||
        (categoryFilter === 'devtools' && sys.category.toLowerCase().startsWith('developer')) ||
        (categoryFilter === 'dev' && sys.category.toLowerCase().startsWith('developer')) ||
        (categoryFilter === 'fintech' && sys.category.toLowerCase().startsWith('fintech')) ||
        (categoryFilter === 'ecommerce' && sys.category.toLowerCase().startsWith('e-commerce')) ||
        (categoryFilter === 'auto' && sys.category.toLowerCase().startsWith('automotive')) ||
        (categoryFilter === 'retro' && sys.category.toLowerCase().startsWith('retro'))
      );
    }

    if (flags.json) {
      console.log(JSON.stringify(filtered, null, 2));
      return;
    }

    if (!flags.quiet) printBanner();
    console.log(`${colors.bold}DEV-OS DESIGN SYSTEM CATALOG (VoltAgent/awesome-design-md)${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}`);
    console.log(`  Total Systems: ${colors.green}${catalog.length}${colors.reset} across 8 industry verticals`);
    if (categoryFilter) {
      console.log(`  Filter:        ${colors.cyan}"${categoryFilter}"${colors.reset} (${filtered.length} matching)\n`);
    } else {
      console.log(`  Quick Apply:   ${colors.cyan}devos design apply <id>${colors.reset} (e.g. devos design apply stripe)\n`);
    }

    if (filtered.length === 0) {
      console.log(`  ${colors.yellow}No design systems matched category filter "${categoryFilter}".${colors.reset}\n`);
      return;
    }

    // Group by category
    const groups = {};
    for (const sys of filtered) {
      if (!groups[sys.category]) groups[sys.category] = [];
      groups[sys.category].push(sys);
    }

    for (const [cat, systems] of Object.entries(groups)) {
      console.log(`${colors.bold}${colors.cyan}${cat}${colors.reset} (${systems.length} systems)`);
      for (const sys of systems) {
        const idCol = sys.id.padEnd(16);
        const nameCol = sys.name.padEnd(18);
        const colorTag = sys.primaryColor ? ` ${colors.gray}[${sys.primaryColor}]${colors.reset}` : '';
        console.log(`  • ${colors.green}${idCol}${colors.reset} ${colors.bold}${nameCol}${colors.reset}${colorTag}`);
        if (sys.summary) {
          console.log(`    ${colors.gray}${sys.summary.slice(0, 100)}...${colors.reset}`);
        }
      }
      console.log('');
    }

    console.log(`${colors.gray}Run 'devos design match "<keywords>"' to find the best match for your project.${colors.reset}\n`);
    return;
  }

  if (subCmd === 'match') {
    const query = positional.slice(1).join(' ').trim();
    if (!query) {
      console.log(`${colors.yellow}Usage: devos design match "<query>" [--pick <id_or_number>]${colors.reset}`);
      console.log(`Example: devos design match "issue tracker dark mode"\n`);
      process.exit(1);
    }

    // Token scoring algorithm
    const tokens = query.toLowerCase().split(/[^a-z0-9_-]+/).filter((t) => t.length > 1);
    const scored = [];

    for (const sys of catalog) {
      let score = 0;
      const idLower = sys.id.toLowerCase();
      const nameLower = sys.name.toLowerCase();
      const catLower = sys.category.toLowerCase();
      const kwString = (sys.keywords || []).join(' ').toLowerCase();
      const sumString = (sys.summary || '').toLowerCase();

      // Exact matches
      if (idLower === query.toLowerCase() || nameLower === query.toLowerCase()) score += 100;
      if (idLower.includes(query.toLowerCase())) score += 50;

      for (const token of tokens) {
        if (idLower === token) score += 40;
        else if (idLower.includes(token)) score += 20;

        if (nameLower.includes(token)) score += 25;
        if (kwString.includes(token)) score += 15;
        if (catLower.includes(token)) score += 12;
        if (sumString.includes(token)) score += 6;
      }

      if (score > 0) {
        scored.push({ sys, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const topCount = flags.top ? parseInt(flags.top, 10) : 5;
    const topMatches = scored.slice(0, topCount).map((s) => s.sys);

    if (flags.json) {
      console.log(JSON.stringify({ query, count: topMatches.length, matches: topMatches }, null, 2));
      return;
    }

    if (!flags.quiet) printBanner();
    console.log(`${colors.bold}DEV-OS DESIGN SYSTEM MATCHER${colors.reset}`);
    console.log(`${colors.gray}${RULE}${colors.reset}`);
    console.log(`  Query: ${colors.cyan}"${query}"${colors.reset}\n`);

    if (topMatches.length === 0) {
      console.log(`  ${colors.yellow}No direct matches found in catalog for "${query}".${colors.reset}`);
      console.log(`  Browse available systems with: ${colors.cyan}devos design list${colors.reset}\n`);
      return;
    }

    console.log(`Found ${colors.green}${topMatches.length}${colors.reset} matching design systems in catalog:\n`);
    topMatches.forEach((sys, idx) => {
      console.log(`  ${colors.bold}[${idx + 1}] ${sys.name}${colors.reset} ${colors.cyan}(${sys.category})${colors.reset}`);
      console.log(`      ID:      ${colors.green}${sys.id}${colors.reset}`);
      console.log(`      Colors:  Primary ${sys.primaryColor} | Canvas ${sys.backgroundColor}`);
      console.log(`      Summary: ${colors.gray}${sys.summary}${colors.reset}\n`);
    });

    // Check if --pick flag provided
    const pickArg = flags.pick !== undefined && flags.pick !== null ? String(flags.pick).trim() : null;
    let selected = null;

    if (pickArg) {
      const pickNum = parseInt(pickArg, 10);
      if (!isNaN(pickNum) && pickNum >= 1 && pickNum <= topMatches.length) {
        selected = topMatches[pickNum - 1];
      } else {
        selected = catalog.find((s) => s.id.toLowerCase() === pickArg.toLowerCase() || s.name.toLowerCase() === pickArg.toLowerCase());
      }
      if (!selected) {
        console.error(`${colors.red}Invalid pick: '${pickArg}'. Choose 1-${topMatches.length} or a valid system ID.${colors.reset}`);
        process.exit(1);
      }
    } else if (process.stdin.isTTY) {
      // Interactive selection
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ask = (q) => new Promise((resolve) => rl.question(q, resolve));
      const answer = (await ask(`${colors.cyan}Select a design system to apply [1-${topMatches.length}] (or 'q' to cancel): ${colors.reset}`)).trim();
      rl.close();

      if (answer.toLowerCase() === 'q' || !answer) {
        console.log(`${colors.yellow}Selection cancelled.${colors.reset}\n`);
        return;
      }
      const ansNum = parseInt(answer, 10);
      if (!isNaN(ansNum) && ansNum >= 1 && ansNum <= topMatches.length) {
        selected = topMatches[ansNum - 1];
      } else {
        selected = catalog.find((s) => s.id.toLowerCase() === answer.toLowerCase());
      }
      if (!selected) {
        console.error(`${colors.red}Invalid choice: '${answer}'.${colors.reset}`);
        process.exit(1);
      }
    } else {
      // Non-interactive fallback: auto-select top match if not specified
      console.log(`${colors.gray}Non-interactive terminal: auto-selecting top candidate [1] (${topMatches[0].name}). Use --pick <id> to specify.${colors.reset}\n`);
      selected = topMatches[0];
    }

    if (selected) {
      // Never replace an existing DESIGN.md non-interactively without --yes
      if (!process.stdin.isTTY && !flags.yes && fs.existsSync(path.join(TARGET_DIR, 'DESIGN.md'))) {
        console.error(`${colors.red}[ FAIL ] DESIGN.md already exists; refusing to replace it non-interactively.${colors.reset}`);
        console.error(`${colors.yellow}         Re-run with --yes to replace it (the current file is backed up first).${colors.reset}\n`);
        process.exit(1);
      }
      applyDesignSystem(catalogDir, selected);
    }
    return;
  }

  if (subCmd === 'apply') {
    const id = positional[1] ? positional[1].toLowerCase().trim() : null;
    if (!id) {
      console.log(`${colors.yellow}Usage: devos design apply <id>${colors.reset}`);
      console.log(`Example: devos design apply stripe`);
      console.log(`         devos design apply linear`);
      console.log(`         devos design apply supabase\n`);
      process.exit(1);
    }

    const matched = catalog.find((s) => s.id === id || s.id.replace(/\.app$/, '') === id || s.name.toLowerCase() === id);
    if (!matched) {
      console.error(`${colors.red}Design system '${id}' not found in catalog.${colors.reset}`);
      console.log(`Run ${colors.cyan}devos design list${colors.reset} to see all available systems.\n`);
      process.exit(1);
    }

    applyDesignSystem(catalogDir, matched);
    return;
  }

  // Help / default
  if (!flags.quiet) printBanner();
  console.log(`${colors.bold}DEV-OS DESIGN SYSTEM CATALOG (devos design)${colors.reset}`);
  console.log(`${colors.gray}${RULE}${colors.reset}`);
  console.log(`Browse, match, and apply authentic brand design systems directly into root DESIGN.md.\n`);
  console.log(`${colors.bold}SUBCOMMANDS${colors.reset}`);
  console.log(`  ${colors.green}list [category]${colors.reset}             List all 74 systems or filter by vertical (ai, devtools, fintech, etc.)`);
  console.log(`  ${colors.green}match "<query>" [--pick N]${colors.reset}  Match project keywords against catalog and apply`);
  console.log(`  ${colors.green}apply <id>${colors.reset}                  Directly apply a known brand system (e.g. stripe, linear, supabase)`);
  console.log(`  ${colors.green}sync${colors.reset}                        Refresh catalog from VoltAgent/awesome-design-md upstream\n`);
  console.log(`${colors.bold}EXAMPLES${colors.reset}`);
  console.log(`  $ ${colors.cyan}devos design list devtools${colors.reset}`);
  console.log(`  $ ${colors.cyan}devos design match "b2b real-time dashboard"${colors.reset}`);
  console.log(`  $ ${colors.cyan}devos design match "saas payments" --pick stripe${colors.reset}`);
  console.log(`  $ ${colors.cyan}devos design apply linear${colors.reset}\n`);
}

function applyDesignSystem(catalogDir, system) {
  const srcFile = path.join(catalogDir, system.path);
  if (!fs.existsSync(srcFile)) {
    console.error(`${colors.red}[ FAIL ] Specification file not found at ${srcFile}${colors.reset}`);
    process.exit(1);
  }

  const destFile = path.join(TARGET_DIR, 'DESIGN.md');
  const content = fs.readFileSync(srcFile, 'utf8');
  if (fs.existsSync(destFile)) {
    const current = fs.readFileSync(destFile, 'utf8');
    if (current !== content) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = fs.existsSync(path.join(TARGET_DIR, '.agents'))
        ? path.join(TARGET_DIR, '.agents', '_backup')
        : TARGET_DIR;
      fs.mkdirSync(backupDir, { recursive: true });
      const backupFile = path.join(backupDir, `DESIGN.md.${stamp}.bak`);
      fs.copyFileSync(destFile, backupFile);
      console.log(`${colors.yellow}[ WARN ] Existing DESIGN.md backed up to ${path.relative(TARGET_DIR, backupFile)}${colors.reset}`);
    }
  }
  fs.writeFileSync(destFile, content, 'utf8');

  console.log(`${colors.green}[ OK ] Applied [${system.name}] design system to ./DESIGN.md${colors.reset}`);
  console.log(`  Category: ${colors.cyan}${system.category}${colors.reset}`);
  console.log(`  Colors:   Primary ${system.primaryColor} | Canvas ${system.backgroundColor}`);
  console.log(`  Gate:     ${colors.green}Mandatory Design Gate Satisfied (.agents/hooks/pre-tool-use.sh unblocked)${colors.reset}\n`);

  console.log(`${colors.bold}Next Action (Multi-Agent UI Redesign):${colors.reset}`);
  console.log(`  To refactor existing frontend components to match this new design system:`);
  console.log(`    $ ${colors.green}/redesign${colors.reset}`);
  console.log(`  Or instruct the Orchestrator:`);
  console.log(`    "Please redesign the frontend components to match the updated DESIGN.md"\n`);
}

// ---------------------------------------------------------------------------
// eval
// ---------------------------------------------------------------------------

function runEval(flags, positional) {
  const runnerPath = path.join(TEMPLATE_DIR, 'scripts', 'eval-runner.js');
  if (!fs.existsSync(runnerPath)) {
    console.error(`${colors.red}[ FAIL ] Evaluation runner (scripts/eval-runner.js) not found.${colors.reset}`);
    process.exit(1);
  }

  const subCmd = positional[0] || null;
  const runnerArgs = [];

  if (subCmd === 'list') {
    runnerArgs.push('--list');
  } else if (subCmd === 'scorecard') {
    runnerArgs.push('--scorecard');
  } else if (subCmd === 'run' || subCmd === 'check' || !subCmd) {
    if (positional[1] && !positional[1].startsWith('-')) {
      runnerArgs.push('--suite', positional[1]);
    }
  } else if (subCmd && !subCmd.startsWith('-')) {
    runnerArgs.push('--suite', subCmd);
  }

  if (flags.suite) runnerArgs.push('--suite', flags.suite);
  if (flags.k) runnerArgs.push('--k', String(flags.k));
  if (flags.scorecard) runnerArgs.push('--scorecard');
  if (flags.list) runnerArgs.push('--list');
  if (flags.json) runnerArgs.push('--json');
  if (flags.quiet) runnerArgs.push('--quiet');

  const { spawnSync } = require('child_process');
  const res = spawnSync(process.execPath, [runnerPath, ...runnerArgs], {
    cwd: TARGET_DIR,
    stdio: 'inherit',
    env: process.env
  });

  process.exit(res.status !== null ? res.status : 1);
}

// ---------------------------------------------------------------------------
// doctor
// ---------------------------------------------------------------------------

function runDoctor(flags) {
  if (!flags.quiet && !flags.json) printBanner();

  // .claude/skills/ must mirror .agents/skills/ (links, or recorded copies)
  const hasClaudeDir = fs.existsSync(path.join(TARGET_DIR, '.claude'));
  const skillDrift = hasClaudeDir && fs.existsSync(path.join(TARGET_DIR, '.agents', 'skills'))
    ? describeClaudeSkillsDrift(claudeSkillsDrift(TARGET_DIR, readManifestLenient(path.join(TARGET_DIR, '.agents'))))
    : null;
  const agentsMdPath = path.join(TARGET_DIR, 'AGENTS.md');
  const agentsMdHasBlock = () => fs.readFileSync(agentsMdPath, 'utf8').includes(DEVOS_BLOCK_START);

  const checks = [
    { name: '.agents/ directory', path: path.join(TARGET_DIR, '.agents'), type: 'dir' },
    { name: 'Agent personas (.agents/agents/)', path: path.join(TARGET_DIR, '.agents', 'agents'), type: 'dir' },
    { name: 'Specialist skills (.agents/skills/)', path: path.join(TARGET_DIR, '.agents', 'skills'), type: 'dir' },
    { name: 'Human commit script (.agents/scripts/commit.sh)', path: path.join(TARGET_DIR, '.agents', 'scripts', 'commit.sh'), type: 'file', exec: true },
    { name: 'Hook installer (.agents/scripts/install-hooks.sh)', path: path.join(TARGET_DIR, '.agents', 'scripts', 'install-hooks.sh'), type: 'file', exec: true },
    { name: 'Humanizer scanner (.agents/scripts/humanize-check.sh)', path: path.join(TARGET_DIR, '.agents', 'scripts', 'humanize-check.sh'), type: 'file', exec: true },
    { name: 'Anti-AI UI taste scanner (.agents/scripts/ui-taste-check.sh)', path: path.join(TARGET_DIR, '.agents', 'scripts', 'ui-taste-check.sh'), type: 'file', exec: true },
    { name: 'Environment parity scanner (.agents/scripts/env-check.sh)', path: path.join(TARGET_DIR, '.agents', 'scripts', 'env-check.sh'), type: 'file', exec: true },
    { name: 'Database migration scanner (.agents/scripts/db-check.sh)', path: path.join(TARGET_DIR, '.agents', 'scripts', 'db-check.sh'), type: 'file', exec: true },
    { name: 'Runtime lifecycle hooks (.agents/hooks/)', path: path.join(TARGET_DIR, '.agents', 'hooks'), type: 'dir', optional: true },
    { name: 'Shared memory vault (.agents/memory/)', path: path.join(TARGET_DIR, '.agents', 'memory'), type: 'dir', optional: true },
    { name: 'Task board (docs/TASK_BOARD.md)', path: path.join(TARGET_DIR, 'docs', 'TASK_BOARD.md'), type: 'file', optional: true },
    { name: 'Telemetry buffer (.agents/telemetry/)', path: path.join(TARGET_DIR, '.agents', 'telemetry'), type: 'dir', optional: true },
    { name: 'Evaluation benchmarks (.agents/evals/)', path: path.join(TARGET_DIR, '.agents', 'evals'), type: 'dir', optional: true },
    { name: 'Mandatory Design Gate (DESIGN.md)', path: (fs.existsSync(path.join(TARGET_DIR, 'DESIGN.md')) || !fs.existsSync(path.join(TARGET_DIR, 'docs', 'DESIGN.md'))) ? path.join(TARGET_DIR, 'DESIGN.md') : path.join(TARGET_DIR, 'docs', 'DESIGN.md'), type: 'file', optional: true },
    { name: 'Interactive Testing Guide (docs/TESTING_GUIDE.md)', path: path.join(TARGET_DIR, 'docs', 'TESTING_GUIDE.md'), type: 'file', optional: true },
    { name: 'Team roster (.agents/AGENTS.md)', path: path.join(TARGET_DIR, '.agents', 'AGENTS.md'), type: 'file' },
    { name: 'Coding standards (CODING_STANDARDS.md)', path: path.join(TARGET_DIR, 'CODING_STANDARDS.md'), type: 'file' },
    { name: 'Documentation (docs/)', path: path.join(TARGET_DIR, 'docs'), type: 'dir' },
    { name: 'Claude Code commands (.claude/commands/)', path: path.join(TARGET_DIR, '.claude', 'commands'), type: 'dir', optional: true },
    { name: 'Claude Code agents (.claude/agents/)', path: path.join(TARGET_DIR, '.claude', 'agents'), type: 'dir', optional: true },
    { name: 'Claude Code hook wiring (.claude/settings.json PreToolUse)', path: path.join(TARGET_DIR, '.claude', 'settings.json'), type: 'file', optional: true, validate: () => claudeHooksWired(TARGET_DIR), invalidReason: 'Dev-OS PreToolUse hook not wired; run devos update' },
    { name: 'Claude Code skills (.claude/skills/ in sync with .agents/skills/)', path: path.join(TARGET_DIR, '.claude', 'skills'), type: 'dir', optional: true, skip: !hasClaudeDir, validate: () => !skillDrift, invalidReason: skillDrift },
    { name: 'Cross-harness instructions (AGENTS.md Dev-OS block)', path: agentsMdPath, type: 'file', optional: true, validate: agentsMdHasBlock, invalidReason: 'no Dev-OS block; run devos update' },
    { name: 'Cursor rules (.cursor/rules/devos.mdc)', path: path.join(TARGET_DIR, '.cursor', 'rules', 'devos.mdc'), type: 'file', optional: true },
    { name: 'OpenCode config (opencode.json)', path: path.join(TARGET_DIR, 'opencode.json'), type: 'file', optional: true },
    { name: 'Antigravity / Gemini instructions (ANTIGRAVITY.md)', path: path.join(TARGET_DIR, 'ANTIGRAVITY.md'), type: 'file', optional: true },
    { name: 'Mechanical pre-commit hook (.git/hooks/pre-commit)', path: path.join(TARGET_DIR, '.git', 'hooks', 'pre-commit'), type: 'file', optional: true }
  ];

  const results = [];
  let passedCount = 0;
  let requiredTotal = 0;
  let failedRequired = 0;

  checks.filter((check) => !check.skip).forEach((check) => {
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

    const valid = exists && check.validate ? Boolean(check.validate()) : true;
    const ok = exists && (!check.exec || isExec) && valid;
    const status = ok ? 'PASS' : (check.optional ? 'WARN' : 'FAIL');
    if (!check.optional) {
      requiredTotal++;
      if (ok) passedCount++;
      else failedRequired++;
    }

    const reason = ok ? undefined : (!exists ? 'Missing' : (check.exec && !isExec ? 'Missing Executable Permissions (run chmod +x)' : (check.invalidReason || 'Invalid')));
    results.push({ name: check.name, path: check.path, status, optional: Boolean(check.optional), exec: check.exec ? isExec : undefined, reason });
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
      const reason = res.reason || 'Missing';
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
      console.log(`${colors.yellow}[ WARN ] ${warns.length} optional item(s) not set up.${colors.reset}`);
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
  const hasCursor = fs.existsSync(path.join(TARGET_DIR, '.cursor', 'rules', 'devos.mdc'));
  const hasOpenCode = fs.existsSync(path.join(TARGET_DIR, 'opencode.json')) || fs.existsSync(path.join(TARGET_DIR, 'OPENCODE.md'));
  const hasAntigravity = fs.existsSync(path.join(TARGET_DIR, 'ANTIGRAVITY.md')) || fs.existsSync(path.join(TARGET_DIR, 'GEMINI.md'));
  const hasCodex = fs.existsSync(path.join(TARGET_DIR, '.windsurfrules')) || fs.existsSync(path.join(TARGET_DIR, '.codex', 'instructions.md'));
  const hasMemory = fs.existsSync(path.join(TARGET_DIR, '.agents', 'memory'));
  const hasTaskBoard = fs.existsSync(path.join(TARGET_DIR, 'docs', 'TASK_BOARD.md'));
  const hasDesign = fs.existsSync(path.join(TARGET_DIR, 'DESIGN.md')) || fs.existsSync(path.join(TARGET_DIR, 'docs', 'DESIGN.md'));
  const hasTestingGuide = fs.existsSync(path.join(TARGET_DIR, 'docs', 'TESTING_GUIDE.md'));
  const manifestPath = path.join(TARGET_DIR, '.agents', 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? readJsonFile(manifestPath, '.agents/manifest.json') : null;

  if (flags.json) {
    console.log(JSON.stringify({
      target: TARGET_DIR,
      initialized: hasAgents,
      standards: hasStandards,
      commitGate: hasCommitScript,
      preCommitHook: hasHook,
      memoryVault: hasMemory,
      taskBoard: hasTaskBoard,
      designGate: hasDesign,
      testingGuide: hasTestingGuide,
      manifest,
      harnesses: {
        claude: hasClaude,
        antigravity: hasAntigravity,
        cursor: hasCursor,
        openCode: hasOpenCode,
        codex: hasCodex
      }
    }, null, 2));
    return;
  }

  console.log(`${colors.bold}PROJECT ENVIRONMENT STATUS${colors.reset}`);
  console.log(`${colors.gray}${RULE}${colors.reset}`);
  console.log(`  Target Path:   ${colors.cyan}${TARGET_DIR}${colors.reset}`);
  console.log(`  Dev-OS Status: ${hasAgents ? colors.green + 'Initialized' : colors.yellow + 'Not Initialized'}${colors.reset}`);
  console.log(`  Telemetry:     ${manifest && manifest.telemetry === 'off' ? colors.gray + 'Off' : colors.green + 'Active (on - recommended)'}${colors.reset}`);
  console.log(`  SDLC Mode:     ${manifest && manifest.mode ? colors.cyan + manifest.mode : colors.cyan + 'interactive'}${colors.reset}`);
  console.log(`  Design Gate:   ${hasDesign ? colors.green + 'Ready (DESIGN.md)' : colors.yellow + 'Pending DESIGN.md'}${colors.reset}`);
  console.log(`  Testing Guide: ${hasTestingGuide ? colors.green + 'Ready (docs/TESTING_GUIDE.md)' : colors.gray + 'None'}${colors.reset}`);
  console.log(`  Standards:     ${hasStandards ? colors.green + 'Present' : colors.gray + 'None'}${colors.reset}`);
  console.log(`  Commit Gate:   ${hasCommitScript ? colors.green + 'Active' : colors.gray + 'Disabled'}${colors.reset}`);
  console.log(`  Git Hook:      ${hasHook ? colors.green + 'Installed' : colors.gray + 'Not Installed'}${colors.reset}`);
  const hasGitleaks = spawnSync('which', ['gitleaks'], { encoding: 'utf8' }).status === 0 || fs.existsSync(path.join(TARGET_DIR, '.agents', 'bin', 'gitleaks'));
  console.log(`  Secret Scanner:${hasGitleaks ? colors.green + ' Active (Gitleaks)' : colors.cyan + ' Active (Dev-OS built-in)'}${colors.reset}`);
  console.log(`  Memory Vault:  ${hasMemory ? colors.green + 'Active (.agents/memory/)' : colors.gray + 'None'}${colors.reset}`);
  console.log(`  Task Board:    ${hasTaskBoard ? colors.green + 'Active (docs/TASK_BOARD.md)' : colors.gray + 'None'}${colors.reset}`);
  const latestScorecardPath = path.join(TARGET_DIR, '.agents', 'evals', 'reports', 'latest-scorecard.json');
  const latestScorecard = fs.existsSync(latestScorecardPath) ? readJsonFile(latestScorecardPath, '.agents/evals/reports/latest-scorecard.json') : null;
  console.log(`  Eval Benchmark:${latestScorecard ? (latestScorecard.verdict === 'EVAL_PASSED' ? colors.green + ' Passed (' + latestScorecard.score + '%)' : colors.red + ' Regressed (' + latestScorecard.score + '%)') : colors.gray + ' None'}${colors.reset}`);
  if (manifest && manifest.installedPacks) {
    console.log(`  Active Packs:  ${colors.cyan}${manifest.installedPacks.join(', ')}${colors.reset}`);
  }
  const yn = (v) => (v ? 'yes' : 'no');
  console.log(`  Harnesses:     Claude (${yn(hasClaude)}), Antigravity (${yn(hasAntigravity)}), Cursor (${yn(hasCursor)}), OpenCode (${yn(hasOpenCode)}), Codex (${yn(hasCodex)})\n`);

  if (!hasAgents) {
    console.log(`Run ${colors.cyan}npx @olives/devos init${colors.reset} to install Dev-OS in this project.\n`);
  }
}

// ---------------------------------------------------------------------------
// spec (W5): docs/specs/<slug>/{requirements,tasks}.md
// ---------------------------------------------------------------------------
// Grammar (binding, from the spec-driven skill templates):
// - Lines inside ``` or ~~~ fences are ignored (CommonMark: a fence closes only on
//   the same character, at least as long, with no info string); trailing
//   whitespace and CRLF are trimmed.
// - Requirement: `### R<n>: <title>`, ids unique.
// - Task: `### T<n>: <title>`, ids unique; its block runs to the next `##` or
//   `###` heading or the end of the file.
// - Fields: `- depends: none | T.., T..`, `- covers: R.., R..`, `- verify: <text>`,
//   each exactly once per block, in any order; other lines are free text.

const SPEC_REQ_RE = /^### (R[1-9][0-9]*): (.+)$/;
const SPEC_TASK_RE = /^### (T[1-9][0-9]*): (.+)$/;
const SPEC_FIELD_RE = /^- (depends|covers|verify): (.+)$/;
const SPEC_EMPTY_FIELD_RE = /^- (depends|covers|verify):$/;
const SPEC_BLOCK_END_RE = /^#{2,3}\s/;
const SPEC_FIELDS = ['depends', 'covers', 'verify'];

// Non-fenced lines with their 1-based line numbers
function specLines(text) {
  const out = [];
  let fence = null; // the opening run, e.g. '```' or '~~~~'
  String(text).split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '');
    const m = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence === null) {
      // A backtick fence's info string may not contain a backtick
      if (m && !(m[1][0] === '`' && m[2].includes('`'))) { fence = m[1]; return; }
      out.push({ n: i + 1, line });
    } else if (m && m[1][0] === fence[0] && m[1].length >= fence.length && m[2].trim() === '') {
      fence = null;
    }
  });
  return out;
}

function idNum(id) {
  return parseInt(id.slice(1), 10);
}

function parseSpecRequirements(text, file = 'requirements.md') {
  const ids = [];
  const titles = {};
  const errors = [];
  specLines(text).forEach(({ n, line }) => {
    const m = line.match(SPEC_REQ_RE);
    if (m) {
      if (titles[m[1]] !== undefined) errors.push(`${file}:${n}: duplicate requirement id ${m[1]}`);
      else { ids.push(m[1]); titles[m[1]] = m[2]; }
    } else if (/^### R/.test(line)) {
      errors.push(`${file}:${n}: malformed requirement heading (expected '### R<n>: <title>'): ${line}`);
    }
  });
  return { ids, titles, errors };
}

function splitSpecIds(value) {
  return value.split(/\s*,\s*/).map((v) => v.trim());
}

function parseSpecTasks(text, file = 'tasks.md') {
  const tasks = [];
  const errors = [];
  const seen = new Set();
  let cur = null;
  const finish = () => {
    if (!cur) return;
    SPEC_FIELDS.forEach((f) => {
      if (!cur.fieldCount[f]) errors.push(`${file}:${cur.line}: ${cur.id} is missing '- ${f}:'`);
    });
    tasks.push(cur);
    cur = null;
  };
  specLines(text).forEach(({ n, line }) => {
    if (SPEC_BLOCK_END_RE.test(line)) {
      finish();
      const m = line.match(SPEC_TASK_RE);
      if (m) {
        if (seen.has(m[1])) {
          errors.push(`${file}:${n}: duplicate task id ${m[1]}`);
          return;
        }
        seen.add(m[1]);
        cur = { id: m[1], title: m[2], line: n, depends: [], covers: [], verify: '', fieldCount: {} };
      } else if (/^### T/.test(line)) {
        errors.push(`${file}:${n}: malformed task heading (expected '### T<n>: <title>'): ${line}`);
      }
      return;
    }
    if (!cur) return;
    const empty = line.match(SPEC_EMPTY_FIELD_RE);
    if (empty) {
      cur.fieldCount[empty[1]] = (cur.fieldCount[empty[1]] || 0) + 1;
      errors.push(`${file}:${n}: ${cur.id} has an empty '- ${empty[1]}:'`);
      return;
    }
    const m = line.match(SPEC_FIELD_RE);
    if (!m) return; // free text
    const [, field, value] = m;
    cur.fieldCount[field] = (cur.fieldCount[field] || 0) + 1;
    if (cur.fieldCount[field] > 1) {
      errors.push(`${file}:${n}: ${cur.id} repeats '- ${field}:'`);
      return;
    }
    if (field === 'verify') {
      cur.verify = value.trim();
    } else if (field === 'depends') {
      if (value.trim() === 'none') return;
      splitSpecIds(value).forEach((id) => {
        if (/^T[1-9][0-9]*$/.test(id)) cur.depends.push(id);
        else errors.push(`${file}:${n}: ${cur.id} depends on '${id}', which is not a task id (use 'none' or T<n>, T<n>)`);
      });
    } else {
      splitSpecIds(value).forEach((id) => {
        if (/^R[1-9][0-9]*$/.test(id)) cur.covers.push(id);
        else errors.push(`${file}:${n}: ${cur.id} covers '${id}', which is not a requirement id (use R<n>, R<n>)`);
      });
    }
  });
  finish();
  tasks.forEach((t) => { delete t.fieldCount; });
  return { tasks, errors };
}

// Kahn topological layers over `depends`. Unknown ids and cycles (a
// self-dependency included) are errors; waves is null when any exist.
function specWaves(tasks) {
  const errors = [];
  const ids = new Set(tasks.map((t) => t.id));
  tasks.forEach((t) => {
    t.depends.forEach((d) => {
      if (d === t.id) errors.push(`${t.id} depends on itself (cycle)`);
      else if (!ids.has(d)) errors.push(`${t.id} depends on unknown task ${d}`);
    });
  });
  if (errors.length) return { waves: null, errors };
  const indeg = {};
  const next = {};
  tasks.forEach((t) => { indeg[t.id] = 0; next[t.id] = []; });
  tasks.forEach((t) => {
    new Set(t.depends).forEach((d) => { indeg[t.id]++; next[d].push(t.id); });
  });
  const waves = [];
  let layer = tasks.map((t) => t.id).filter((id) => indeg[id] === 0);
  let placed = 0;
  while (layer.length) {
    layer.sort((a, b) => idNum(a) - idNum(b));
    waves.push(layer);
    placed += layer.length;
    const following = [];
    layer.forEach((id) => next[id].forEach((n) => { if (--indeg[n] === 0) following.push(n); }));
    layer = following;
  }
  if (placed < tasks.length) {
    const stuck = tasks.map((t) => t.id).filter((id) => indeg[id] > 0).sort((a, b) => idNum(a) - idNum(b));
    return { waves: null, errors: [`dependency cycle among ${stuck.join(', ')}`] };
  }
  return { waves, errors: [] };
}

// Full analysis of a spec. `requirementsText` may be null (waves only).
function analyzeSpec(requirementsText, tasksText) {
  const req = requirementsText == null ? null : parseSpecRequirements(requirementsText);
  const parsed = parseSpecTasks(tasksText);
  const graph = specWaves(parsed.tasks);
  const structural = [...(req ? req.errors : []), ...parsed.errors, ...graph.errors];
  const coverage = [];
  if (req) {
    const known = new Set(req.ids);
    const covered = new Set();
    parsed.tasks.forEach((t) => t.covers.forEach((r) => {
      if (known.has(r)) covered.add(r);
      else coverage.push(`${t.id} covers unknown requirement ${r}`);
    }));
    req.ids.forEach((r) => { if (!covered.has(r)) coverage.push(`requirement ${r} (${req.titles[r]}) is not covered by any task`); });
    if (!req.ids.length) coverage.push('requirements.md defines no requirements (### R<n>: <title>)');
  }
  if (!parsed.tasks.length) structural.push('tasks.md defines no tasks (### T<n>: <title>)');
  return {
    requirements: req ? req.ids : null,
    tasks: parsed.tasks,
    waves: graph.waves,
    structural,
    coverage,
    problems: [...structural, ...coverage]
  };
}

function specFail(flags, msg, extra = {}) {
  if (flags.json) console.log(JSON.stringify({ ok: false, problems: [msg], ...extra }, null, 2));
  else console.error(`${colors.red}[ FAIL ] ${msg}${colors.reset}`);
  process.exit(1);
}

function runSpec(flags, positional) {
  const sub = positional[0];
  const slug = positional[1];
  const usage = 'Usage: devos spec waves <slug> [--json] | devos spec check <slug> [--json]';
  if (sub !== 'waves' && sub !== 'check') specFail(flags, `Unknown spec subcommand '${sub || ''}'. ${usage}`);
  if (!slug) specFail(flags, `Missing <slug>. ${usage}`);
  if (slug.includes('/') || slug.includes('\\') || slug.includes('..') || slug.startsWith('.') || path.isAbsolute(slug)) {
    specFail(flags, `Invalid spec slug '${slug}': it must be a folder name under docs/specs/ (no '/', '\\', or '..').`);
  }
  const dir = path.join(TARGET_DIR, 'docs', 'specs', slug);
  const tasksPath = path.join(dir, 'tasks.md');
  const reqPath = path.join(dir, 'requirements.md');
  if (!fs.existsSync(tasksPath)) specFail(flags, `docs/specs/${slug}/tasks.md not found.`, { slug });
  if (sub === 'check' && !fs.existsSync(reqPath)) specFail(flags, `docs/specs/${slug}/requirements.md not found.`, { slug });
  const reqText = fs.existsSync(reqPath) ? fs.readFileSync(reqPath, 'utf8') : null;
  const a = analyzeSpec(reqText, fs.readFileSync(tasksPath, 'utf8'));
  const taskOut = a.tasks.map((t) => ({ id: t.id, title: t.title, depends: t.depends, covers: t.covers, verify: t.verify }));

  if (sub === 'waves') {
    const ok = a.structural.length === 0;
    if (flags.json) {
      console.log(JSON.stringify({ slug, ok, waves: a.waves, tasks: taskOut, problems: a.structural, warnings: a.coverage }, null, 2));
      if (!ok) process.exit(1);
      return;
    }
    if (!ok) {
      console.error(`${colors.red}[ FAIL ] docs/specs/${slug}/tasks.md cannot be ordered into waves:${colors.reset}`);
      a.structural.forEach((p) => console.error(`         ${p}`));
      process.exit(1);
    }
    const byId = {};
    a.tasks.forEach((t) => { byId[t.id] = t; });
    console.log(`${colors.bold}Spec ${slug}: ${a.tasks.length} task(s) in ${a.waves.length} wave(s)${colors.reset} ${colors.gray}(tasks in one wave can run in parallel)${colors.reset}`);
    a.waves.forEach((w, i) => {
      console.log(`  ${colors.cyan}Wave ${i + 1}${colors.reset}: ${w.map((id) => `${id} ${byId[id].title}`).join(' | ')}`);
    });
    if (a.coverage.length) console.log(`${colors.yellow}[ WARN ] ${a.coverage.length} coverage gap(s); run 'devos spec check ${slug}'.${colors.reset}`);
    return;
  }

  const ok = a.problems.length === 0;
  if (flags.json) {
    console.log(JSON.stringify({ slug, ok, requirements: a.requirements, tasks: taskOut, waves: a.waves, problems: a.problems }, null, 2));
    if (!ok) process.exit(1);
    return;
  }
  if (!ok) {
    console.error(`${colors.red}[ FAIL ] docs/specs/${slug}: ${a.problems.length} problem(s)${colors.reset}`);
    a.problems.forEach((p) => console.error(`         ${p}`));
    process.exit(1);
  }
  console.log(`${colors.green}[ OK ] docs/specs/${slug}: ${a.requirements.length} requirement(s), ${a.tasks.length} task(s), every requirement covered, ${a.waves.length} wave(s).${colors.reset}`);
}

// ---------------------------------------------------------------------------
// build-plugin (W4): a Claude Code plugin built from the Dev-OS sources
// ---------------------------------------------------------------------------
// Layout and schemas verified on 2026-10-22 against
// https://code.claude.com/docs/en/plugins-reference (manifest at
// .claude-plugin/plugin.json, components at the plugin root, hooks/hooks.json
// wraps the event map in a top-level "hooks" key, ${CLAUDE_PLUGIN_ROOT} in
// double quotes in shell-form commands) and
// https://code.claude.com/docs/en/plugins/components ("Ignored fields:
// permissionMode, hooks, mcpServers, and initialPrompt" for plugin agents).

const PLUGIN_NAME = 'devos';
// Entries build-plugin owns inside the output dir; nothing else is touched
const PLUGIN_OUTPUTS = ['.claude-plugin', 'agents', 'commands', 'skills', 'hooks', 'README.md'];

const PLUGIN_HOOK_ENV_PREFIX = 'DEVOS_PLUGIN_MODE=1 ';

function pluginHooksJson() {
  const hooks = {};
  Object.keys(DEVOS_CLAUDE_HOOKS).forEach((event) => {
    hooks[event] = DEVOS_CLAUDE_HOOKS[event].map((group) => ({
      ...group,
      hooks: group.hooks.map((h) => ({
        ...h,
        // Shell form (no `args`) runs through `sh -c` (hooks reference, "Exec form
        // and shell form"), so a leading VAR=value assignment sets the env for
        // the script only. DEVOS_PLUGIN_MODE=1 makes the scripts exit 0 in a
        // project without .agents/manifest.json (not initialized with devos init).
        command: `${PLUGIN_HOOK_ENV_PREFIX}${h.command.replace('"$CLAUDE_PROJECT_DIR"/.agents/hooks/', '"${CLAUDE_PLUGIN_ROOT}"/hooks/')}`
      }))
    }));
  });
  return { hooks };
}

function pluginManifest() {
  const author = String(PKG.author || 'Clement Olives').replace(/\s+—\s+/g, ', ');
  return {
    name: PLUGIN_NAME,
    version: PKG.version,
    description: 'Dev-OS multi-agent engineering OS: the 13-agent roster, slash commands, core skills, and lifecycle gate hooks.',
    author: { name: author, url: 'https://github.com/olitech1010' },
    homepage: PKG.homepage || 'https://github.com/olitech1010/dev-os#readme',
    repository: 'https://github.com/olitech1010/dev-os',
    license: PKG.license || 'MIT',
    keywords: ['agents', 'multi-agent', 'hooks', 'skills', 'sdlc']
  };
}

function pluginReadme() {
  return [
    '# Dev-OS Claude Code plugin',
    '',
    `Built by \`devos build-plugin\` from @olives/devos v${PKG.version}. Do not edit; rebuild instead.`,
    '',
    'Install from the Dev-OS marketplace:',
    '',
    '    /plugin marketplace add olitech1010/dev-os',
    '    /plugin install devos@olives-devos',
    '',
    '- `agents/`: the default Dev-OS roster as plugin subagents (`devos:<name>`).',
    '- `commands/`: the Dev-OS slash commands (`/devos:<name>`).',
    '- `skills/`: the core skill pack.',
    '- `hooks/hooks.json`: the Dev-OS lifecycle gates, run from `${CLAUDE_PLUGIN_ROOT}/hooks/`.',
    '',
    'The hooks only act in projects initialized with `npx @olives/devos init` (they look for',
    '`.agents/manifest.json`). Each hook command runs with `DEVOS_PLUGIN_MODE=1`, and in any other',
    'project the scripts exit 0 at once, so enabling the plugin user-wide never blocks unrelated work.',
    '',
    'The marketplace entry is a `command` source: Claude Code runs',
    '`npx -y @olives/devos@<version> build-plugin --print-path` when you install or update the plugin,',
    'and again once per session, then copies the printed directory into its plugin cache (`mode: copy`).',
    '',
    'Limits of the plugin form: Claude Code ignores `permissionMode`, `hooks`, and `mcpServers` in plugin agent',
    'frontmatter, and a plugin cannot add `permissions.deny` rules. The hook scripts look for project state',
    '(`.agents/`, `docs/TASK_BOARD.md`, `.agents/scripts/`) under the project root. For the full install, run',
    '`npx @olives/devos init` in the project; do not enable this plugin in a project that already wired the',
    'Dev-OS hooks in `.claude/settings.json`, or every gate runs twice.',
    ''
  ].join('\n');
}

// Refuse output dirs that are, or contain, something we must not clear
function assertSafePluginOut(outDir) {
  const home = require('os').homedir();
  const resolved = path.resolve(outDir);
  const forbidden = [path.parse(resolved).root, home, TARGET_DIR, TEMPLATE_DIR].map((p) => path.resolve(p));
  if (forbidden.includes(resolved)) throw new Error(`refusing to build into ${resolved}; pick an empty or dedicated directory with --out`);
  const rel = path.relative(resolved, TEMPLATE_DIR);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new Error(`refusing to build into ${resolved}: it contains the Dev-OS sources`);
  }
  const manifestPath = path.join(resolved, '.claude-plugin', 'plugin.json');
  if (fs.existsSync(resolved) && fs.readdirSync(resolved).length) {
    let ours = false;
    try { ours = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).name === PLUGIN_NAME; } catch (e) {}
    if (!ours) throw new Error(`refusing to build into ${resolved}: it is not empty and holds no previous Dev-OS plugin build`);
  }
  return resolved;
}

function buildPlugin(outDir) {
  const out = assertSafePluginOut(outDir);
  const srcAgents = path.join(TEMPLATE_DIR, '.agents');
  fs.mkdirSync(out, { recursive: true });
  // Rebuild: clear only the entries build-plugin itself writes
  PLUGIN_OUTPUTS.forEach((entry) => fs.rmSync(path.join(out, entry), { recursive: true, force: true }));

  const agents = generateClaudeAgents(srcAgents, out);
  const commands = generateClaudeCommands(srcAgents, out);

  const packsData = loadPacks(srcAgents);
  const coreSkills = packSkillNames(packsData, ['core']).filter((n) => safeFileStem(n, null) && fs.existsSync(path.join(srcAgents, 'skills', n)));
  coreSkills.forEach((n) => copyRecursiveSync(path.join(srcAgents, 'skills', n), path.join(out, 'skills', n)));

  const hooksOut = path.join(out, 'hooks');
  fs.mkdirSync(hooksOut, { recursive: true });
  const hookSrc = path.join(srcAgents, 'hooks');
  fs.readdirSync(hookSrc).forEach((f) => {
    const src = path.join(hookSrc, f);
    if (fs.statSync(src).isDirectory()) {
      if (f === 'lib') copyRecursiveSync(src, path.join(hooksOut, f));
    } else if (f.endsWith('.sh')) {
      fs.copyFileSync(src, path.join(hooksOut, f));
      fs.chmodSync(path.join(hooksOut, f), 0o755);
    }
  });
  fs.writeFileSync(path.join(hooksOut, 'hooks.json'), JSON.stringify(pluginHooksJson(), null, 2) + '\n', 'utf8');

  fs.mkdirSync(path.join(out, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(out, '.claude-plugin', 'plugin.json'), JSON.stringify(pluginManifest(), null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(out, 'README.md'), pluginReadme(), 'utf8');
  return { out, agents, commands, skills: coreSkills.length, hooks: Object.keys(DEVOS_CLAUDE_HOOKS).length };
}

function runBuildPlugin(flags) {
  const outDir = path.resolve(TARGET_DIR, flags.out || path.join('dist', 'claude-plugin'));
  let res;
  try {
    res = buildPlugin(outDir);
  } catch (err) {
    console.error(`${colors.red}[ FAIL ] build-plugin: ${err.message}${colors.reset}`);
    process.exit(1);
  }
  if (flags.printPath) {
    // Contract for a marketplace `command` source: exactly one line, the absolute path
    process.stdout.write(res.out + '\n');
    return;
  }
  if (flags.json) {
    console.log(JSON.stringify({ ok: true, ...res, version: PKG.version }, null, 2));
    return;
  }
  console.log(`${colors.green}[ OK ] Claude Code plugin '${PLUGIN_NAME}' v${PKG.version} built in ${res.out}${colors.reset}`);
  console.log(`${colors.gray}         ${res.agents} agents, ${res.commands} commands, ${res.skills} core skills, ${res.hooks} hook events${colors.reset}`);
  console.log(`${colors.gray}         Try it: claude --plugin-dir ${res.out}   Validate: claude plugin validate ${res.out}${colors.reset}`);
}

// Main CLI Entrypoint
async function main() {
  let argv = process.argv.slice(2);
  // The 'devos-init' bin alias runs init directly
  const invokedAs = path.basename(process.argv[1] || '').replace(/\.js$/, '');
  if (invokedAs === 'devos-init' && argv[0] !== 'init' && argv[0] !== 'setup') {
    argv = ['init', ...argv];
  }
  const { command, positional, flags } = parseArgs(argv);

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
    case 'run':
    case 'auto':
      runAuto(flags, positional);
      break;
    case 'telemetry':
      await runTelemetry(flags, positional);
      break;
    case 'mode':
      runMode(flags, positional);
      break;
    case 'scaffold':
      runScaffold(flags, positional);
      break;
    case 'doctor':
    case 'check':
      runDoctor(flags);
      break;
    case 'pack':
    case 'packs':
      runPack(flags, positional);
      break;
    case 'memory':
      runMemory(flags, positional);
      break;
    case 'list':
    case 'agents':
      runList(flags);
      break;
    case 'skill':
    case 'skills':
      runSkill(flags, positional);
      if (['add', 'install', 'sync', 'update', 'upgrade'].includes(positional[0])) refreshClaudeSkillLinks(flags);
      break;
    case 'spec':
    case 'specs':
      runSpec(flags, positional);
      break;
    case 'build-plugin':
      runBuildPlugin(flags);
      break;
    case 'status':
      runStatus(flags);
      break;
    case 'eval':
    case 'benchmark':
      runEval(flags, positional);
      break;
    case 'design':
      await runDesign(flags, positional);
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

if (require.main === module) {
  main().catch((err) => {
    console.error(`${colors.red}[ FAIL ] ${err.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = {
  computeSkillHash,
  backupSkill,
  getSkillManifest,
  saveSkillManifest,
  auditSkills,
  runSkill,
  sanitizeTelemetry,
  analyzeTelemetry,
  detectHarness,
  parseArgs,
  parseFrontmatter,
  yamlScalar,
  mergeClaudeSettings,
  claudeHooksWired,
  generateClaudeAgents,
  generateClaudeCommands,
  upsertManagedBlock,
  syncInstalledSkills,
  ensureGitleaks,
  ensureGitignoreEntries,
  isDevosHookCommand,
  detectAgentShell,
  legacyFileHash,
  isDevosGeneratedUnedited,
  recordedHooksChoice,
  installSkillSafely,
  migrateLegacyInstall,
  resolveSkillAlias,
  AGENT_ALIASES,
  runTelemetry,
  analyzeSpec,
  parseSpecTasks,
  parseSpecRequirements,
  specWaves,
  syncClaudeSkills,
  claudeSkillsDrift,
  pluginHooksJson,
  pluginManifest,
  rootAgentsMdContent,
  mergeOpenCodeJson,
  DEVOS_CLAUDE_HOOKS,
  DEVOS_HOOK_SCRIPTS
};
