# Maintainer Pack

Agents and commands for people who develop Dev-OS itself. They are not part of the default install; `devos pack add maintainer` installs them (see the `maintainer` entry in `../packs.json`).

- `agents/telemetry.md`: read-only RCA over `.agents/telemetry/events.jsonl`. Local event logging is done by the core `telemetry` skill and hooks, which every install keeps.
- `agents/eval-engineer.md`: capability eval suites, pass@k, and scorecards (skill `eval-harness`).
- `commands/telemetry.md` (`/telemetry`) and `commands/eval.md` (`/eval`) target these agents.

Same file format as `.agents/agents/` and `.agents/commands/`; edit these sources, never generated `.claude/` output.
