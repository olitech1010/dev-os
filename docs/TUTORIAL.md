# Dev-OS Step-by-Step Tutorial & Glossary

Welcome to the **Dev-OS Tutorial**! If you are new to agentic development environments, multi-agent frameworks, or LangGraph/LLM orchestration, this guide will explain everything from the ground up in plain English.

---

## Part 1: Key Terms & Concepts Explained

Before we build, let's understand the terminology used across Dev-OS:

### 1. What is an "Agent"?
In traditional software, a script follows exact rules (e.g., `if X then Y`). An **Agent** is an AI model equipped with a **Persona (System Prompt)**, a set of **Tools** (like running bash commands or reading files), and the autonomy to make decisions to achieve a goal.

In Dev-OS, we don't use one giant "do-everything" agent. We use a **Team of Specialists**, just like a real software company:
- 👑 **Orchestrator:** The Engineering Manager. Decides who does what and sequences work.
- 🏗️ **Architect:** The System Designer. Questions your vague ideas and writes clear requirements.
- 💻 **Developer:** The Coder. Follows coding standards and writes the actual features or bug fixes.
- 🔬 **Researcher:** The Scout. Looks up documentation, checks library versions, and investigates bugs.
- 🛡️ **QA Agent (Quality Assurance):** The Gatekeeper. Runs linters and tests, then checks code for architectural flaws.
- 🗄️ **DBA Agent (Database Administrator):** The Data Expert. Handles Supabase schemas, Row Level Security (RLS), and migrations safely.
- 🚀 **DevOps & Security Agents:** Handle CI/CD, deployment plans, and vulnerability scanning.

### 2. What is a "Skill"?
A **Skill** is a folder inside `.agents/skills/` containing reusable instructions, scripts, or templates that teach an agent how to perform a specialized task. For example:
- **`grill-me`:** A skill that teaches the Architect how to interview you to uncover hidden project requirements.
- **`git-ops`:** A skill that teaches agents how to branch, format commit messages, and ask for human approval.

### 3. What is the "Human-in-the-Loop Commit Gate"?
AI models are powerful, but they can occasionally hallucinate, loop infinitely, or misunderstand requirements. To protect your project, Dev-OS enforces a strict mechanical rule: **No agent can commit code to git without your explicit permission.** 
Instead of using `git commit`, agents must call `./.agents/scripts/commit.sh`, which physically halts the terminal and prompts you to type `approve`.

### 4. What are "Triage Levels"?
To prevent wasting time and tokens on simple tasks, the Orchestrator categorizes every request into one of three buckets:
- **`TRIVIAL`:** Small fixes (e.g., a typo in text, a CSS color change). The Orchestrator fixes and commits it directly!
- **`STANDARD`:** Building a new feature or fixing a complex bug. Follows the full team pipeline (`Developer -> QA -> Human`).
- **`CRITICAL`:** Database migrations, RLS policies, or infrastructure changes. Mandates the involvement of the DBA or Security agent and requires a dry-run plan before execution.

---

## Part 2: Step-by-Step Tutorial — Building a Feature

Let's walk through what happens when you use Dev-OS to build a new feature (for example, adding a "User Profile" page).

### Step 1: You give a task to the Orchestrator
You type your request:
> *"Orchestrator, we need to add a User Profile page where users can update their bio and avatar."*

### Step 2: Triage & Task Contracts
1. The Orchestrator analyzes the request and marks it as **`STANDARD`** (since it requires new UI and backend logic).
2. The Orchestrator breaks the work into manageable subtasks using **Task Contracts**. For example:
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
   - *What if it fails?* If there is a TypeScript error, QA rejects the code immediately back to the Developer with the error logs.
2. **Manual Logic Review:** Once automated tests pass, QA checks for architectural rules (e.g., "Are functions under 50 lines? Is error handling present?").
   - Once everything is perfect, QA says: *"The code passes automated checks and meets standards. Human, do you approve?"*

### Step 5: You (The Human) Approve the Commit
Now it's your turn! The Developer stages the files and executes our secure commit script:
```bash
./.agents/scripts/commit.sh
```
The terminal pauses and asks you:
```
Human Approval Token (type 'approve' to proceed):
```
You review the changes, type `approve`, press Enter, and the commit is safely saved to git using Conventional Commits format (`feat(user): add user profile bio and avatar component`)!

---

## Part 3: Best Practices for Using Dev-OS

1. **Always start with the Orchestrator:** Do not try to micromanage subagents directly unless you have a specific reason. Give your high-level goals to the Orchestrator and let it delegate.
2. **Use the "Grill-Me" Skill for big ideas:** If you have a vague idea for a whole app, tell the Architect: *"Use your grill-me skill to help me scope out a new project."*
3. **Never bypass `commit.sh`:** If you are manually working alongside agents, respect the checkpoint script to keep your commit history clean and standardized.
4. **Keep your standards updated:** If you want agents to use a new library or coding style, add it to `CODING_STANDARDS.md` or `.agents/skills/stacks/`. The agents read these files every time they work!
