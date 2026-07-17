# Dev-OS 2.0: Architecture & Tutorial Guide

Welcome to Dev-OS 2.0! This document is designed to help everyone—from non-technical stakeholders to junior developers—understand exactly what Dev-OS is, how it works under the hood, and why we upgraded from our original version (V1) to a programmatic architecture (V2) using **LangGraph**.

---

## 1. The Basics: What is an "Agent"?

If you've used ChatGPT or Claude, you know that AI can answer questions and write code. But an **Agent** takes this a step further. 

An agent is an AI that has:
1. **A Persona (System Prompt):** Instructions defining its role (e.g., "You are a strict code reviewer").
2. **Tools:** The ability to take action (e.g., read a file, run a bash command, search the web).
3. **Autonomy:** The ability to think in a loop (e.g., "I ran this code, it failed with an error, so I will rewrite it and try again").

**Dev-OS** is an "Operating System" for these agents. Instead of having one AI do everything, Dev-OS acts like a real engineering team. We have a Developer agent who writes code, a Reviewer agent who checks it, and an Orchestrator agent who manages the project. 

---

## 2. The Transition: From V1 to V2

### How V1 Worked (Markdown & Prompts)
In Dev-OS V1, the entire system was driven by text files (Markdown). We had a file called `AGENTS.md` that said: *"Developer, you must send your code to the Reviewer before committing."*
When you ran an AI tool (like Claude Code or an IDE plugin), the AI would read that text and *try* to follow the rules.

**The Problem with V1:** 
AI models are notoriously bad at strictly following rules over long conversations. They get "lazy" or forgetful. In V1, the Developer agent might decide to skip the Reviewer and commit code directly, or the system might get stuck in an infinite loop of errors. There was no physical barrier preventing the AI from misbehaving.

### How V2 Works (Programmatic State Machine)
In Dev-OS V2, we stopped relying on the AI's "promise" to follow the rules. Instead, we built a physical, programmatic engine using **Python** to enforce the workflow. 

Think of V1 as a traffic sign that says "Stop". Think of V2 as a physical boom barrier across the road. The AI physically *cannot* bypass the Reviewer or the Human because the Python code controls the flow of execution.

---

## 3. What is LangGraph?

To build this "boom barrier", we use a library called **LangGraph**. 
LangGraph treats AI workflows like a board game. To understand it, you only need to know three terms:

1. **State (The Board):** This is a shared memory that gets passed around. It contains the history of the conversation, the current code, and variables like `error_count`.
2. **Nodes (The Players):** These are Python functions that represent our agents (Orchestrator, Developer, Reviewer, Human). A node receives the State, does some thinking (using the LLM), updates the State, and passes it on.
3. **Edges (The Rules):** These are the paths between the nodes. They decide who goes next. 

### The Dev-OS LangGraph Architecture
Our graph looks like this:

```text
[Orchestrator] ---> [Developer] ---> [Reviewer]
                                         │
                                         ├── If "CHANGES REQUESTED" ──> (Back to Developer)
                                         │
                                         └── If "APPROVED" ───────────> [Human Checkpoint]
```

Because LangGraph controls the **Edges**, the Developer agent cannot magically jump to the Human Checkpoint. It *must* pass through the Reviewer node. If the Reviewer outputs "CHANGES REQUESTED", LangGraph grabs the State and forcefully hands it back to the Developer.

---

## 4. Under the Hood: The Code Architecture

If you look in the `core/orchestrator/` folder, you will see how we built this.

### `state.py` (The Memory)
This file defines what data is passed between agents. 
```python
class DevOSState(TypedDict):
    messages: list          # The conversation history
    task_description: str   # What the user wants to build
    reviewer_verdict: str   # "APPROVED" or "CHANGES REQUESTED"
    human_approved: bool    # Did the human say yes?
```

### `nodes.py` (The Agents)
This file contains the logic for each agent. 
- It reads the markdown files from our `.agents/agents/` folder (so we still get the benefit of our carefully crafted personas from V1).
- It injects those personas into Google's Gemini AI.
- For the **Reviewer Node**, the Python code actually reads the AI's output. If the AI says the word "APPROVED", the code sets `reviewer_verdict = "APPROVED"`.

### `graph.py` (The Routing)
This file connects the nodes. It contains the "Edge" logic.
```python
def route_reviewer(state):
    if state["reviewer_verdict"] == "APPROVED":
        return "human"
    return "developer"
```
This single function is the heart of V2. It is the physical barrier that prevents bad code from reaching production.

### `dev-os-cli.py` (The Terminal Command)
This is the command-line interface. A developer can type `python dev-os-cli.py --task "Build a login page"` into their terminal, and the Python engine will start the LangGraph board game.

---

## 5. Step-by-Step Tutorial: Running a Task

Here is exactly what happens when you ask Dev-OS V2 to build a feature:

**Step 1: The Request**
You type your task into the CLI. The Python engine creates a brand new `DevOSState` and puts your task description inside it.

**Step 2: The Orchestrator Node**
The engine hands the State to the Orchestrator. The Orchestrator looks at the task, breaks it down into subtasks, and adds its plan to the `messages` list in the State.

**Step 3: The Developer Node**
The engine hands the State to the Developer. The Developer reads the Orchestrator's plan, writes the code to fulfill the task, and adds the code changes to the State.

**Step 4: The Reviewer Node (The Gatekeeper)**
The engine hands the State to the Reviewer. The Reviewer reads the Developer's code and compares it against `CODING_STANDARDS.md`. 
- If the code is messy, the Reviewer outputs "CHANGES REQUESTED" along with feedback. The **Edge** routing sees this, and forcefully loops the game back to **Step 3**.
- If the code is perfect, the Reviewer outputs "APPROVED". The **Edge** routing sees this, and moves the game to **Step 5**.

**Step 5: The Human Checkpoint**
The Python script literally pauses and prints to your terminal:
`"Do you approve these changes for commit? (y/n)"`
The system waits for a human to type "y". Only then does the graph reach the `END` state, allowing the code to be merged.

---

## Summary for Laypeople

In V1, we put a bunch of very smart AI robots in a room and gave them a rulebook, hoping they would follow it. Sometimes they ignored the rulebook and broke things.

In V2, we built an assembly line. The AI robots are bolted to their stations. The Developer robot cannot put the product in the shipping box; it *must* hand it to the Quality Assurance (Reviewer) robot. If the QA robot finds a flaw, the conveyor belt automatically moves the product backward. This makes Dev-OS predictable, reliable, and safe for enterprise software development.
