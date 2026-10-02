#!/usr/bin/env node

/**
 * Dev-OS Autonomous SDLC Pipeline Runner (Zero External Dependencies)
 * Owned by the Executive Proxy Agent.
 *
 * Executes the 10-stage multi-agent SDLC pipeline, tracks state in
 * .agents/memory/sdlc-state.json, and enforces mechanical gates between stages.
 *
 * Usage:
 *   $ node scripts/sdlc-runner.js "build me a CRM for African SMEs"
 *   $ node scripts/sdlc-runner.js --status
 *   $ node scripts/sdlc-runner.js --dry-run "my product idea"
 *   $ node scripts/sdlc-runner.js --step inception
 *   $ node scripts/sdlc-runner.js --resume
 *   $ node scripts/sdlc-runner.js --reset
 *   $ node scripts/sdlc-runner.js --list
 *   $ node scripts/sdlc-runner.js --json
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT       = process.cwd();
const MEMORY_DIR = path.join(ROOT, '.agents', 'memory');
const STATE_FILE = path.join(MEMORY_DIR, 'sdlc-state.json');
const DOCS_DIR   = path.join(ROOT, 'docs');

// ── colour helpers ─────────────────────────────────────────────────────────
const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && process.env.TERM !== 'dumb';
const c = {
  reset:   useColor ? '\x1b[0m'  : '',
  bold:    useColor ? '\x1b[1m'  : '',
  dim:     useColor ? '\x1b[2m'  : '',
  cyan:    useColor ? '\x1b[36m' : '',
  green:   useColor ? '\x1b[32m' : '',
  yellow:  useColor ? '\x1b[33m' : '',
  red:     useColor ? '\x1b[31m' : '',
  magenta: useColor ? '\x1b[35m' : '',
  blue:    useColor ? '\x1b[34m' : '',
  gray:    useColor ? '\x1b[90m' : ''
};
const RULE = '─'.repeat(56);

// ── stage registry ─────────────────────────────────────────────────────────
const STAGES = [
  {
    id:          'inception',
    index:       1,
    label:       'Inception',
    agent:       'Architect',
    skill:       'grill-me',
    deliverable: 'docs/PROJECT_REQUIREMENTS.md',
    gate:        null,
    description: 'Architect extrapolates requirements and produces PROJECT_REQUIREMENTS.md via grill-me skill.'
  },
  {
    id:          'design',
    index:       2,
    label:       'Design Gate',
    agent:       'UI Designer',
    skill:       'ui-ux-pro-max / awesome-design-catalog',
    deliverable: 'DESIGN.md',
    gate:        { file: 'docs/PROJECT_REQUIREMENTS.md', label: 'PROJECT_REQUIREMENTS.md' },
    description: 'UI Designer matches a real production design system from the catalog and writes DESIGN.md at project root.'
  },
  {
    id:          'database',
    index:       3,
    label:       'Architecture & Database',
    agent:       'DBA',
    skill:       'supabase / backend-patterns',
    deliverable: 'database/migrations/ + seed fixtures (devos123)',
    gate:        { file: 'DESIGN.md', label: 'DESIGN.md at project root' },
    description: 'DBA designs RLS-enabled schema migrations and realistic seed data. All dev accounts use password devos123.'
  },
  {
    id:          'tasks',
    index:       4,
    label:       'Task Decomposition',
    agent:       'Orchestrator',
    skill:       'task-board',
    deliverable: 'docs/TASK_BOARD.md',
    gate:        null,
    description: 'Orchestrator breaks the feature set into a deterministic DAG in docs/TASK_BOARD.md.'
  },
  {
    id:          'implementation',
    index:       5,
    label:       'Implementation',
    agent:       'Developer',
    skill:       'brainstorming / frontend-ui-engineering / backend-patterns',
    deliverable: 'Source code (staged, not committed)',
    gates: [
      { file: 'DESIGN.md',               label: 'DESIGN.md at project root (Mandatory Design Gate)' },
      { file: 'docs/TASK_BOARD.md',       label: 'docs/TASK_BOARD.md (Task Decomposition Gate)' },
      { dir:  'docs/superpowers/plans',   label: 'Implementation plan in docs/superpowers/plans/ (brainstorming → writing-plans Gate)' }
    ],
    description: 'Developer implements features following DESIGN.md, TASK_BOARD.md, and the approved implementation plan. No raw git commit allowed.'
  },
  {
    id:          'tests',
    index:       6,
    label:       'Test Suite',
    agent:       'Tester',
    skill:       'testing-guide',
    deliverable: 'Unit & integration tests (passing)',
    gate:        null,
    description: 'Tester writes tests from the spec, not the implementation. Covers happy path, edge cases, and failure states.'
  },
  {
    id:          'testing-guide',
    index:       7,
    label:       'Testing Guide',
    agent:       'Tester + QA',
    skill:       'testing-guide',
    deliverable: 'docs/TESTING_GUIDE.md',
    gate:        null,
    description: 'Tester authors an interactive step-by-step testing guide with devos123 as universal test password.'
  },
  {
    id:          'qa',
    index:       8,
    label:       'Quality Assurance',
    agent:       'QA',
    skill:       'qa',
    deliverable: 'QA verdict: APPROVED or CHANGES REQUESTED',
    gate:        null,
    description: 'QA verifies coding standards, no forbidden patterns, types not bypassed, no hardcoded secrets or TODOs.'
  },
  {
    id:          'security',
    index:       9,
    label:       'Security Audit',
    agent:       'Security',
    skill:       'security-review',
    deliverable: 'Security risk report (CRITICAL/HIGH/MEDIUM/LOW/INFO)',
    gate:        null,
    description: 'Security scans for OWASP Top 10, auth/authorization logic, input validation, secret exposure, and CVEs.'
  },
  {
    id:          'humanize',
    index:       10,
    label:       'Humanizer Audit',
    agent:       'Release Manager',
    skill:       'humanizer',
    deliverable: 'Clean docs (zero AI writing tells)',
    gate:        null,
    description: 'Release Manager scrubs all docs in /docs/ through humanize-check.sh to eliminate 25 cataloged AI writing tells.'
  }
];

const STAGE_IDS = STAGES.map(s => s.id);

// ── arg parsing ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const flags = {
    status:  false,
    dryRun:  false,
    resume:  false,
    reset:   false,
    list:    false,
    json:    false,
    quiet:   false,
    help:    false,
    step:    null,
    idea:    []
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--status')            { flags.status  = true; }
    else if (arg === '--dry-run')      { flags.dryRun  = true; }
    else if (arg === '--resume')       { flags.resume  = true; }
    else if (arg === '--reset')        { flags.reset   = true; }
    else if (arg === '--list')         { flags.list    = true; }
    else if (arg === '--json')         { flags.json    = true; }
    else if (arg === '--quiet' || arg === '-q') { flags.quiet = true; }
    else if (arg === '--help' || arg === '-h')  { flags.help  = true; }
    else if (arg === '--step' || arg === '-s') {
      flags.step = argv[i + 1] || null;
      i++;
    } else if (!arg.startsWith('-')) {
      flags.idea.push(arg);
    }
  }

  return flags;
}

// ── state management ───────────────────────────────────────────────────────
function loadState() {
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveState(state) {
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function freshState(idea) {
  return {
    schemaVersion: '1.0.0',
    idea,
    startedAt:     new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
    currentStage:  'inception',
    mode:          'auto',
    stages:        Object.fromEntries(STAGES.map(s => [s.id, {
      status:      'pending',   // pending | active | passed | skipped | failed
      startedAt:   null,
      completedAt: null,
      gateResult:  null,
      notes:       []
    }]))
  };
}

function resetState() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}

// ── gate verification ──────────────────────────────────────────────────────
/**
 * Check whether a stage's gate conditions are satisfied.
 * Each condition is one of:
 *   { file: 'relative/path' }       — exact file must exist
 *   { dir:  'relative/path' }       — directory must exist and contain ≥1 file
 *
 * A stage may have:
 *   gate:  <single condition>       — legacy single gate
 *   gates: [<condition>, ...]       — ALL conditions must pass (AND logic)
 *
 * Returns: { ok: boolean, failures: string[] }
 */
function checkGate(stage) {
  const conditions = stage.gates
    ? stage.gates
    : stage.gate
      ? [stage.gate]
      : [];

  if (conditions.length === 0) return { ok: true, failures: [] };

  const failures = [];
  for (const cond of conditions) {
    if (cond.file) {
      const target = path.join(ROOT, cond.file);
      if (!fs.existsSync(target)) failures.push(cond.label);
    } else if (cond.dir) {
      const target = path.join(ROOT, cond.dir);
      const hasFiles = fs.existsSync(target) &&
        fs.statSync(target).isDirectory() &&
        fs.readdirSync(target).some(f => !f.startsWith('.'));
      if (!hasFiles) failures.push(cond.label);
    }
  }

  return { ok: failures.length === 0, failures };
}

function checkHumanizerScript() {
  const script = path.join(ROOT, '.agents', 'scripts', 'humanize-check.sh');
  return fs.existsSync(script) && fs.statSync(script).mode & 0o111;
}

// ── display helpers ────────────────────────────────────────────────────────
function stageStatusIcon(status) {
  switch (status) {
    case 'passed':  return `${c.green}✓${c.reset}`;
    case 'active':  return `${c.cyan}▶${c.reset}`;
    case 'failed':  return `${c.red}✗${c.reset}`;
    case 'skipped': return `${c.yellow}○${c.reset}`;
    default:        return `${c.gray}·${c.reset}`;
  }
}

function printBanner() {
  console.log(`\n${c.bold}Dev-OS Autonomous SDLC Pipeline Runner${c.reset}`);
  console.log(`${c.gray}${RULE}${c.reset}`);
  console.log(`${c.dim}Executive Proxy Agent · 10-Stage Multi-Agent Pipeline${c.reset}\n`);
}

function printHelp() {
  printBanner();
  console.log(`${c.bold}Usage:${c.reset}`);
  console.log(`  devos run "<product idea>"      Start a new autonomous SDLC run`);
  console.log(`  devos run --resume              Resume an interrupted run`);
  console.log(`  devos run --status              Show current pipeline state`);
  console.log(`  devos run --step <stage>        Print delegation prompt for a single stage`);
  console.log(`  devos run --dry-run "<idea>"    Preview the pipeline without writing state`);
  console.log(`  devos run --list                List all 10 stages`);
  console.log(`  devos run --reset               Clear pipeline state (start fresh)`);
  console.log(`  devos run --json                Output state as JSON`);
  console.log('');
  console.log(`${c.bold}Stage IDs:${c.reset}  ${STAGE_IDS.join('  ')}\n`);
}

function printStageList() {
  if (!process.argv.includes('--quiet')) printBanner();
  console.log(`${c.bold}10-Stage SDLC Pipeline:${c.reset}\n`);
  STAGES.forEach(s => {
    console.log(`  ${c.cyan}${String(s.index).padStart(2)}.${c.reset} ${c.bold}${s.label}${c.reset}`);
    console.log(`      ${c.gray}Agent:${c.reset}       ${s.agent}`);
    console.log(`      ${c.gray}Skill:${c.reset}       ${s.skill}`);
    console.log(`      ${c.gray}Deliverable:${c.reset} ${s.deliverable}`);
    const allConds = s.gates || (s.gate ? [s.gate] : []);
    if (allConds.length === 1) {
      console.log(`      ${c.yellow}Gate:${c.reset}        Requires ${allConds[0].label}`);
    } else if (allConds.length > 1) {
      console.log(`      ${c.yellow}Gates${c.reset}        (all required):`);
      allConds.forEach((g, i) => console.log(`        ${i + 1}. ${g.label}`));
    }
    console.log('');
  });
}

function printStatus(state, flags) {
  if (flags.json) {
    console.log(JSON.stringify(state, null, 2));
    return;
  }
  if (!flags.quiet) printBanner();

  const idea = state.idea || '(no idea set)';
  console.log(`${c.bold}Product Idea:${c.reset}  ${c.cyan}"${idea}"${c.reset}`);
  console.log(`${c.bold}Started:${c.reset}       ${new Date(state.startedAt).toLocaleString()}`);
  console.log(`${c.bold}Last Updated:${c.reset}  ${new Date(state.updatedAt).toLocaleString()}`);
  console.log(`${c.bold}Current Stage:${c.reset} ${state.currentStage}\n`);

  console.log(`${c.bold}Pipeline:${c.reset}`);
  STAGES.forEach(s => {
    const st = state.stages[s.id];
    const icon = stageStatusIcon(st.status);
    const label = st.status === 'active' ? `${c.cyan}${s.label}${c.reset}` : s.label;
    let extra = '';
    if (st.status === 'passed' && st.completedAt) {
      extra = ` ${c.dim}(${new Date(st.completedAt).toLocaleTimeString()})${c.reset}`;
    } else if (st.status === 'failed' && st.gateResult) {
      extra = ` ${c.red}— gate failed: ${st.gateResult}${c.reset}`;
    }
    console.log(`  ${icon}  ${String(s.index).padStart(2)}. ${label}${extra}`);
  });
  console.log('');
}

// ── single-stage delegation prompt ────────────────────────────────────────
function printStagePrompt(stageId, idea) {
  const stage = STAGES.find(s => s.id === stageId);
  if (!stage) {
    console.error(`${c.red}[ FAIL ]${c.reset} Unknown stage: "${stageId}". Valid stages: ${STAGE_IDS.join(', ')}`);
    process.exit(1);
  }

  console.log(`\n${c.bold}Stage ${stage.index}: ${stage.label}${c.reset}`);
  console.log(`${c.gray}${RULE}${c.reset}`);
  console.log(`${c.bold}Assigned Agent:${c.reset}  ${stage.agent}`);
  console.log(`${c.bold}Skill:${c.reset}           ${stage.skill}`);
  console.log(`${c.bold}Deliverable:${c.reset}     ${stage.deliverable}`);
  const hasConds = stage.gates || stage.gate;
  if (hasConds) {
    const gateResult = checkGate(stage);
    if (gateResult.ok) {
      console.log(`${c.bold}Gate Check:${c.reset}      ${c.green}PASS${c.reset} — all conditions satisfied`);
    } else {
      gateResult.failures.forEach(f => {
        console.log(`${c.bold}Gate Check:${c.reset}      ${c.red}BLOCKED${c.reset} — ${f}`);
      });
    }
  }
  console.log('');
  console.log(`${c.bold}Delegation Prompt:${c.reset}`);
  console.log(`${c.dim}─────────────────────────────────────────────────────${c.reset}`);

  const ideaStr = idea || '<your product idea>';

  const prompts = {
    inception: `You are the Architect Agent. Using the grill-me skill, extrapolate requirements for the following product and produce docs/PROJECT_REQUIREMENTS.md:\n\n"${ideaStr}"\n\nBe exhaustive. Cover functional requirements, non-functional requirements, data models, user roles, edge cases, and compliance constraints. Output docs/PROJECT_REQUIREMENTS.md.`,
    design: `You are the UI Designer Agent. Read docs/PROJECT_REQUIREMENTS.md, then use the awesome-design-catalog (devos design match) and ui-ux-pro-max skill to select the best matching real-world design system for this product and write DESIGN.md at the project root. The design system must be sourced from the catalog — not generated. Output DESIGN.md.`,
    database: `You are the DBA Agent. Read docs/PROJECT_REQUIREMENTS.md and DESIGN.md, then design a complete database schema. Write RLS-enabled migrations in database/migrations/ and realistic seed fixtures. All dev/test user accounts must use the password devos123. Output migration files and seed data.`,
    tasks: `You are the Orchestrator Agent. Read docs/PROJECT_REQUIREMENTS.md and design a deterministic DAG of implementation tasks. Write docs/TASK_BOARD.md with tasks sequenced by dependency. Each task must have an assigned agent, triage level, and gate requirements.\n\nOnce TASK_BOARD.md is written, trigger the brainstorming skill with the Developer to produce an implementation plan in docs/superpowers/plans/YYYY-MM-DD-<topic>-implementation.md before any code is written. This plan is a hard gate for Stage 5.`,
    implementation: `You are the Developer Agent. Before writing any code:\n1. Confirm DESIGN.md exists at the project root (Mandatory Design Gate).\n2. Read docs/TASK_BOARD.md to understand the task DAG.\n3. Read the approved implementation plan in docs/superpowers/plans/ (produced by the brainstorming → writing-plans workflow).\nThen implement features task by task following CODING_STANDARDS.md and DESIGN.md tokens. Never commit directly — present a staged summary for human review. Do not bypass the QA gate.`,
    tests: `You are the Tester Agent. Read the feature spec in docs/PROJECT_REQUIREMENTS.md. Write unit and integration tests covering happy path, edge cases, and failure states. Run the suite and report results. Do not fix application code — report failures to the Developer.`,
    'testing-guide': `You are the Tester Agent working with QA. Produce an interactive docs/TESTING_GUIDE.md that a non-technical founder can follow step by step to verify the entire application. All dev accounts must use password devos123. Seed data must be realistic.`,
    qa: `You are the QA Agent. Review all code produced by the Developer. Check against CODING_STANDARDS.md, confirm no forbidden patterns, verify TypeScript types are not bypassed, confirm no hardcoded secrets or TODOs without issues, and verify all tests pass. Return APPROVED or CHANGES REQUESTED with numbered items.`,
    security: `You are the Security Agent. Scan all application code and configuration for: OWASP Top 10 vulnerabilities, authentication and authorization logic, input validation gaps, exposed secrets or credentials, known CVEs in dependencies, SQL injection/XSS/CSRF vectors, file upload handling, and rate-limiting. Return a risk report with severity levels: CRITICAL, HIGH, MEDIUM, LOW, INFO.`,
    humanize: `You are the Release Manager Agent. Run .agents/scripts/humanize-check.sh on every markdown file in /docs/. For any file that fails, rewrite the flagged sections to eliminate all 25 AI writing tells (not-X-but-Y constructions, one-line closers, forced triads, inflated claims, robotic openers, etc.) without changing the technical content.`
  };

  console.log(prompts[stage.id] || stage.description);
  console.log(`${c.dim}─────────────────────────────────────────────────────${c.reset}\n`);
}

// ── dry-run preview ────────────────────────────────────────────────────────
function printDryRun(idea, flags) {
  if (!flags.quiet) printBanner();
  console.log(`${c.yellow}[ DRY-RUN ]${c.reset} No state will be written.\n`);
  console.log(`${c.bold}Product Idea:${c.reset}  ${c.cyan}"${idea || '(none provided)'}"${c.reset}\n`);
  console.log(`${c.bold}Pipeline Preview:${c.reset}`);

  STAGES.forEach(s => {
    const hasConds = s.gates || s.gate;
    const gateStr = hasConds
      ? (() => {
          const r = checkGate(s);
          if (r.ok) return `${c.green}gate OK${c.reset}`;
          return `${c.red}gate BLOCKED — ${r.failures.join('; ')}${c.reset}`;
        })()
      : `${c.gray}no gate${c.reset}`;

    console.log(`  ${c.cyan}${String(s.index).padStart(2)}.${c.reset} ${c.bold}${s.label}${c.reset} ${c.dim}[${s.agent}]${c.reset} · ${gateStr}`);
    console.log(`      → ${s.deliverable}`);
  });

  const allGatesOk = STAGES.filter(s => s.gate || s.gates).every(s => checkGate(s).ok);
  const humanizer  = checkHumanizerScript();

  console.log('');
  console.log(`${c.bold}Pre-flight Checks:${c.reset}`);
  console.log(`  Humanizer scanner      ${humanizer ? `${c.green}✓ installed${c.reset}` : `${c.red}✗ missing${c.reset}`}`);
  console.log(`  .agents/memory/ writable ${fs.existsSync(MEMORY_DIR) ? `${c.green}✓${c.reset}` : `${c.yellow}will be created${c.reset}`}`);
  console.log('');

  if (allGatesOk) {
    console.log(`${c.green}[ OK ]${c.reset} All gates would pass. Run without --dry-run to begin.\n`);
  } else {
    console.log(`${c.yellow}[ WARN ]${c.reset} Some gates would block. Complete earlier stages first.\n`);
  }
}

// ── pipeline initialisation ────────────────────────────────────────────────
function initPipeline(idea, flags) {
  if (!flags.quiet) printBanner();

  const existing = loadState();
  if (existing && !flags.reset) {
    console.log(`${c.yellow}[ WARN ]${c.reset} An existing SDLC run was found for:`);
    console.log(`  "${existing.idea}"`);
    console.log(`  Current stage: ${existing.currentStage}`);
    console.log('');
    console.log(`Use ${c.cyan}devos run --resume${c.reset} to continue it, or ${c.cyan}devos run --reset${c.reset} then re-run to start fresh.`);
    console.log('');
    process.exit(0);
  }

  const state = freshState(idea || 'MVP Build');
  saveState(state);

  console.log(`${c.green}[ OK ]${c.reset} Autonomous SDLC pipeline initialised.\n`);
  console.log(`${c.bold}Product:${c.reset}  "${state.idea}"`);
  console.log(`${c.bold}State:${c.reset}    ${STATE_FILE.replace(ROOT + '/', '')}\n`);

  console.log(`${c.bold}Your pipeline is ready. Run each stage by giving your AI assistant the delegation prompt:${c.reset}`);
  console.log('');

  STAGES.forEach(s => {
    const gateResult = checkGate(s);
    const blocked = (s.gate || s.gates) && !gateResult.ok;
    const icon = blocked ? `${c.red}✗${c.reset}` : `${c.cyan}▶${c.reset}`;
    console.log(`  ${icon}  ${String(s.index).padStart(2)}. ${s.label} ${c.gray}[${s.agent}]${c.reset}`);
  });

  console.log('');
  console.log(`Run ${c.cyan}devos run --step inception${c.reset} to get the delegation prompt for Stage 1.`);
  console.log(`Run ${c.cyan}devos run --status${c.reset} at any time to check progress.`);
  console.log('');
}

// ── resume ─────────────────────────────────────────────────────────────────
function resumePipeline(flags) {
  const state = loadState();
  if (!state) {
    console.error(`${c.red}[ FAIL ]${c.reset} No pipeline state found. Start a new run with:\n  devos run "<your product idea>"\n`);
    process.exit(1);
  }

  printStatus(state, flags);

  const current = STAGES.find(s => s.id === state.currentStage);
  if (!current) {
    console.log(`${c.green}[ DONE ]${c.reset} All stages complete.\n`);
    return;
  }

  const gateResult = checkGate(current);
  if (!gateResult.ok) {
    console.log(`${c.red}[ BLOCKED ]${c.reset} Stage "${current.label}" gate not satisfied.`);
    gateResult.failures.forEach(f => console.log(`  Required: ${f}`));
    console.log(`  Complete the previous stage first, then re-run.\n`);
    process.exit(1);
  }

  console.log(`${c.bold}Next stage to execute:${c.reset} ${current.label}\n`);
  printStagePrompt(current.id, state.idea);
}

// ── mark stage complete (used by agent hooks in future) ────────────────────
function advanceStage(stageId, state) {
  const idx = STAGE_IDS.indexOf(stageId);
  if (idx === -1) return state;

  state.stages[stageId].status      = 'passed';
  state.stages[stageId].completedAt = new Date().toISOString();

  const next = STAGES[idx + 1];
  state.currentStage = next ? next.id : 'done';
  state.updatedAt    = new Date().toISOString();
  return state;
}

// ── JSON output ────────────────────────────────────────────────────────────
function outputJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

// ── main ───────────────────────────────────────────────────────────────────
function main() {
  const argv  = process.argv.slice(2);
  const flags = parseArgs(argv);
  const idea  = flags.idea.join(' ').trim();

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  if (flags.list) {
    printStageList();
    process.exit(0);
  }

  if (flags.reset) {
    resetState();
    console.log(`${c.green}[ OK ]${c.reset} Pipeline state cleared.\n`);
    process.exit(0);
  }

  if (flags.status) {
    const state = loadState();
    if (!state) {
      if (flags.json) {
        outputJson({ error: 'No pipeline state found.' });
      } else {
        console.log(`${c.yellow}[ INFO ]${c.reset} No active pipeline. Start one with:\n  devos run "<your product idea>"\n`);
      }
      process.exit(0);
    }
    printStatus(state, flags);
    process.exit(0);
  }

  if (flags.dryRun) {
    printDryRun(idea, flags);
    process.exit(0);
  }

  if (flags.step) {
    const state = loadState();
    printStagePrompt(flags.step, state ? state.idea : idea);
    process.exit(0);
  }

  if (flags.resume) {
    resumePipeline(flags);
    process.exit(0);
  }

  // Default: initialise (or reinitialise) pipeline for a new idea
  initPipeline(idea, flags);
}

main();
