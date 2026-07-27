# Getting Started with Olives Dev-OS

This guide explains how to initialize Dev-OS in a new or existing repository using the standard **Olives Dev-OS CLI** (`devos` / `olives-devos`) and start collaborating with your multi-agent engineering team.

---

## 1. Installation Options

### Option A: Global NPM / NPX (Recommended)
Run the automated installer in your target project root:
```bash
npx devos init
```
*(Or install globally: `npm install -g devos` and run `devos init`)*

### Option B: Non-Interactive Flag Execution
For automated environments, CI scripts, or quick setup:
```bash
npx devos init --stack nextjs --existing
```

### Option C: Direct GitHub Installation
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
  -s, --stack <name>  Specify target stack (nextjs, laravel, django, react-native, universal)
  --fresh             Non-interactive fresh project initialization
  --existing          Non-interactive existing project initialization
  --json              Output diagnostic and listing results as JSON
  -q, --quiet         Suppress header banners and non-essential log messages
  -v, --version       Print CLI version
  -h, --help          Show command options
```

---

## 3. Development Workflow & Task Triage

When you assign a task to the **Orchestrator Agent**, it automatically triages your request:

1. **TRIVIAL Tasks (Typos, small config changes, minor CSS):**
   - Executed directly by the Orchestrator without spawning subagents to save time and tokens.
2. **STANDARD Tasks (New features, standard bug fixes):**
   - Orchestrator delegates to the **Developer Agent**.
   - Developer implements code and passes it to the **QA Agent**.
   - QA Agent runs automated checks (`npm run lint`, `pytest`). If they pass, QA checks against `CODING_STANDARDS.md` and requests human approval.
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

- [System Architecture](file:///Users/user/development/dev-os/docs/ARCHITECTURE.md)
- [Step-by-Step Tutorial & Glossary](file:///Users/user/development/dev-os/docs/TUTORIAL.md)
- [Root README](file:///Users/user/development/dev-os/README.md)
