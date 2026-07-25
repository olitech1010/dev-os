# Getting Started with Dev-OS

This guide explains how to initialize Dev-OS in a new or existing repository and start collaborating with your multi-agent engineering team.

---

## 1. Installation Options

### Option A: Global NPM / NPX (Recommended)
Run the automated installer in your target project root:
```bash
npx devos init
```
*(Or install globally: `npm install -g devos` and run `devos init`)*

### Option B: Direct GitHub Installation
```bash
npx github:olitech1010/dev-os init
```

### Option C: Local Cloning & Linking (Fallback / Offline)
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

## 2. Interactive Setup Prompts

When you run the installer, it will ask two simple questions:
1. **Fresh vs. Existing Project:**
   - **Fresh Project:** Initializes a clean workspace with standard documentation and templates.
   - **Existing Project:** Injects `.agents/` team files into your codebase while preserving your existing application code, custom `CODING_STANDARDS.md`, and project documentation.
2. **Tech Stack Selection:**
   - Choose your stack (Next.js, Laravel, Django, React Native, or Universal) to configure standard coding rules.

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
