# Getting Started with Olives Dev-OS

This guide explains how to initialize Dev-OS in a new or existing repository using the standard **Olives Dev-OS CLI** (`devos` / `olives-devos`) and start collaborating with your multi-agent engineering team.

---

## 1. Installation Options

> **Note on the package name:** The npm registry package is **`@olitech010/dev-os`** (scoped, because the name `devos` on npm belongs to an unrelated package and npm blocks unscoped look-alike names — do not install `devos`). Once installed, the CLI binaries are `devos`, `olives-devos`, and `devos-init`.

### Option A: Global NPM / NPX (Recommended)
Run the automated installer in your target project root:
```bash
npx @olitech010/dev-os init
```
*(Or install globally: `npm install -g @olitech010/dev-os`. After a global install, the command is simply `devos` — the bin name — so you run `devos init`. With `npx` you use the package name `dev-os`.)*

### Option B: Non-Interactive Flag Execution
For automated environments, CI scripts, or quick setup:
```bash
npx @olitech010/dev-os init --stack nextjs --existing
```

### Option C: Direct GitHub Installation
Run the latest version straight from GitHub without going through the npm registry:
```bash
npx github:olitech1010/dev-os init
```

### Option D: Local Cloning & Linking (Fallback / Offline)
If global or `npx` execution fails or is blocked by network policy:
```bash
# Clone the Dev-OS repository
git clone https://github.com/olitech1010/dev-os.git
cd dev-os

# Symlink the CLI globally on your system
npm link

# Go to your project folder and initialize
cd /path/to/your-target-project
devos init
```

---

## 2. CLI Command & Diagnostic Reference

The Olives Dev-OS CLI provides a full suite of commands modeled after industry standard developer tools (Claude Code, Gemini CLI, gh, Vercel):

```bash
$ devos --help

USAGE
  $ devos <command> [flags]

CORE COMMANDS
  init, setup      Initialize or update Dev-OS multi-agent environment in target project
  doctor, check    Diagnose project setup, permissions, commit script, and health
  list, agents     Display active agent personas and installed specialist skills
  status           Show active project configuration, detected stack, and health summary
  version          Print Dev-OS CLI version, Node runtime, and environment information
  help             Display this command reference

FLAGS
  -s, --stack <name>  Specify target stack (nextjs, laravel, django, react-native, express, fastapi, universal)
  --fresh             Non-interactive fresh project initialization
  --existing          Non-interactive existing project initialization
  --no-claude         Skip generating .claude/ integration files and CLAUDE.md
  --json              Output diagnostic and listing results as JSON
  -q, --quiet         Suppress header banners and non-essential log messages
  -v, --version       Print CLI version
  -h, --help          Show command options
```

### What `init` Does

Beyond copying the `.agents/` system into your project, `devos init`:

- **Generates Claude Code integration files.** It compiles the `.agents/` sources into `.claude/commands/` (native slash commands) and `.claude/agents/` (native subagents), and bootstraps a project `CLAUDE.md`. Pass `--no-claude` to skip this step.
- **Backs up before overwriting.** If a `.agents/` directory already exists, it is backed up to `.agents/_backup/<timestamp>/` before the new files are written, so re-running `init` never destroys local customizations.
- **Makes scripts executable.** Both `commit.sh` and `install-hooks.sh` are chmod'd during init.

### Doctor and CI

`devos doctor` exits with a non-zero status code when any required check fails, making it safe to use as a CI gate:

```bash
devos doctor || exit 1
```

It also runs warn-level checks (reported as `[ WARN ]`, without failing the run) for the pre-commit hook installation and the presence of the `.claude/` integration directory.

---

## 3. Development Workflow & Task Triage

When you assign a task to the **Orchestrator Agent**, it automatically triages your request:

1. **TRIVIAL Tasks (Typos, small config changes, minor CSS):**
   - Delegated to the **Developer Agent** like any other change. Even trivial edits go through the full Developer -> QA -> Human approval chain. The Orchestrator NEVER writes production code or commits directly — there is no fast path that bypasses review.
2. **STANDARD Tasks (New features, standard bug fixes):**
   - Orchestrator delegates to the **Developer Agent**.
   - When the Developer finishes, the work enters the **parallel quality gate**: the **QA Agent**, **Tester Agent**, and **Security Agent** run in PARALLEL.
   - QA reviews the code against `CODING_STANDARDS.md` (it does not write tests); the Tester owns test creation and execution; Security scans for vulnerabilities. Only when all three pass is human approval requested.
3. **CRITICAL Tasks (Database schemas, Supabase RLS, infrastructure):**
   - Involves the **DBA Agent**, **Security Agent**, or **DevOps Agent**.
   - Destructive actions (`DROP`, `TRUNCATE`, deployments) require a mandatory dry-run plan and explicit human sign-off.

---

## 4. Approving Commits (The Scripted Checkpoint)

In Dev-OS, agents are mechanically forbidden from running raw `git commit` commands in the terminal. When code is ready:
1. The agent calls `./.agents/scripts/commit.sh`.
2. Execution pauses and prompts you in the terminal:
   ```
   Human Approval Token (type 'approve' to proceed):
   ```
3. Type `approve` and press Enter.
4. The script formats the commit using Conventional Commits and saves your progress securely.

---

## 5. Related Documentation

- [System Architecture](ARCHITECTURE.md)
- [Step-by-Step Tutorial & Glossary](TUTORIAL.md)
- [Root README](../README.md)
