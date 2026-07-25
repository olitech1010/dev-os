# Dev-OS Step-by-Step Tutorial & Glossary

Welcome to the **Dev-OS Tutorial**! If you are new to agentic development environments, multi-agent frameworks, or LLM orchestration, this guide will explain everything from the ground up in plain English.

---

## Part 1: Key Terms & Concepts Explained

Before we build, let us understand the terminology used across Dev-OS:

### 1. What is an "Agent"?
In traditional software, a script follows exact rules (e.g., `if X then Y`). An **Agent** is an AI model equipped with a **Persona (System Prompt)**, a set of **Tools** (like running bash commands or reading files), and the autonomy to make decisions to achieve a goal.

In Dev-OS, we do not use one giant "do-everything" agent. We use a **Team of Specialists**, just like a real software company:
- **Orchestrator:** The Engineering Manager. Decides who does what and sequences work.
- **Architect:** The System Designer. Questions your vague ideas and writes clear requirements.
- **Developer:** The Coder. Follows coding standards and writes the actual features or bug fixes.
- **Researcher:** The Scout. Looks up documentation, checks library versions, and investigates bugs.
- **QA Agent (Quality Assurance):** The Gatekeeper. Runs linters and tests, then checks code for architectural flaws.
- **DBA Agent (Database Administrator):** The Data Expert. Handles Supabase schemas, Row Level Security (RLS), and migrations safely.
- **DevOps & Security Agents:** Handle CI/CD, deployment plans, and vulnerability scanning.

### 2. What is a "Skill"?
A **Skill** is a folder inside `.agents/skills/` containing reusable instructions, scripts, or templates that teach an agent how to perform a specialized task. For example:
- **`grill-me`:** A skill that teaches the Architect how to interview you to uncover hidden project requirements.
- **`git-ops`:** A skill that teaches agents how to branch, format commit messages, and ask for human approval.

### 3. What is the "Human-in-the-Loop Commit Gate"?
AI models are powerful, but they can occasionally hallucinate, loop infinitely, or misunderstand requirements. To protect your project, Dev-OS enforces a strict mechanical rule: **No agent can commit code to git without your explicit permission.** 
Instead of using `git commit`, agents must call `./.agents/scripts/commit.sh`, which physically halts the terminal and prompts you to type `approve`.

### 4. What are "Triage Levels"?
To prevent wasting time and tokens on simple tasks, the Orchestrator categorizes every request into one of three buckets:
- **`TRIVIAL`:** Small fixes (e.g., a typo in text, a CSS color change). The Orchestrator fixes and commits it directly.
- **`STANDARD`:** Building a new feature or fixing a complex bug. Follows the full team pipeline (`Developer -> QA -> Human`).
- **`CRITICAL`:** Database migrations, RLS policies, or infrastructure changes. Mandates the involvement of the DBA or Security agent and requires a dry-run plan before execution.

---

## Part 2: Step-by-Step Installation & Setup

You can install Dev-OS into any fresh or existing project using any of the following methods:

### Method A: Global NPM / NPX
Run the automated installer in your target project directory:
```bash
npx devos init
```
*(Or install globally: `npm install -g devos` and run `devos init`)*

### Method B: Directly from GitHub
```bash
npx github:olitech1010/dev-os init
```

### Method C: Local Cloning & Linking (Fallback / Offline)
If `npx` or global installation fails due to permission or network constraints:
```bash
# 1. Clone the Dev-OS repository
git clone https://github.com/olitech1010/dev-os.git
cd dev-os

# 2. Register the CLI globally on your machine
npm link

# 3. Navigate to your project folder and run the installer
cd /path/to/your-target-project
devos init
```

---

## Part 3: Step-by-Step Tutorial — Building a Feature

Let us walk through what happens when you use Dev-OS to build a new feature (for example, adding a "User Profile" page).

### Step 1: You give a task to the Orchestrator
You type your request:
> *"Orchestrator, we need to add a User Profile page where users can update their bio and avatar."*

### Step 2: Triage & Task Contracts
1. The Orchestrator analyzes the request and marks it as **`STANDARD`** (since it requires new UI and backend logic).
2. The Orchestrator breaks the work into subtasks using **Task Contracts**. For example:
   - *Task 1 to Researcher:* "Find out what Supabase storage bucket we use for avatars."
   - *Task 2 to Developer:* "Create the UI component `UserProfile.tsx` using Tailwind CSS."

### Step 3: The Developer Writes the Code
The **Developer Agent** receives Task 2. It:
1. Reads your coding standards (`CODING_STANDARDS.md`).
2. Creates `UserProfile.tsx`.
3. Runs tests locally to make sure it compiles.
4. Passes the completed code to the **QA Agent**.

### Step 4: Two-Phase Quality Assurance (QA)
The **QA Agent** receives the Developer's code and performs two strict checks:
1. **Automated Check:** It runs `npm run lint` and `npm run test`.
   - *What if it fails?* If there is a TypeScript error, QA rejects the code immediately back to the Developer with error logs.
2. **Manual Logic Review:** Once automated tests pass, QA checks for architectural rules (e.g., "Are functions under 50 lines? Is error handling present?").
   - Once everything is ready, QA requests human sign-off.

### Step 5: You (The Human) Approve the Commit
The Developer stages the files and executes the secure commit script:
```bash
./.agents/scripts/commit.sh
```
The terminal pauses and asks you:
```
Human Approval Token (type 'approve' to proceed):
```
You review the changes, type `approve`, press Enter, and the commit is safely saved to git using Conventional Commits format (`feat(user): add user profile bio and avatar component`).

---

## Part 4: Documentation Navigation

- [Getting Started Guide](file:///Users/user/development/dev-os/docs/GETTING_STARTED.md)
- [System Architecture](file:///Users/user/development/dev-os/docs/ARCHITECTURE.md)
- [Root README](file:///Users/user/development/dev-os/README.md)
