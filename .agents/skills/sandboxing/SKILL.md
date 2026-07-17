---
name: sandboxing
description: Agent-Computer Interface (ACI) instructions for executing code safely inside the Dev-OS Docker Sandbox.
---

# Sandboxing Rules (Agent-Computer Interface)

In Dev-OS 2.0, you are **strictly forbidden** from running arbitrary code execution, testing, or build commands directly on the host machine. 

To prevent accidental destruction of the host environment, all commands related to code execution (e.g., `npm run test`, `python script.py`, `php artisan serve`) MUST be executed inside the isolated Docker sandbox.

## 1. Verifying the Sandbox is Running

Before running commands, verify that the `dev-os-sandbox` container is running:
```bash
docker ps | grep dev-os-sandbox
```
If it is not running, start it from the `docker/` directory:
```bash
cd docker && docker-compose up -d
```

## 2. Executing Commands inside the Sandbox

To run a command safely, wrap it in `docker exec`:
```bash
docker exec -it dev-os-sandbox <command>
```

For example, to run tests:
```bash
docker exec -it dev-os-sandbox npm test
```
To run a Python script:
```bash
docker exec -it dev-os-sandbox python3 my_script.py
```

## 3. Host-Level Commands (Exceptions)

You are allowed to run the following commands on the host machine without sandboxing:
- Git commands (`git status`, `git commit`, `git push`)
- Read-only file inspection commands (`grep`, `ls`)
- Dev-OS specific orchestration commands (`python dev-os-cli.py ...`)

Everything else (compiling, running, installing dependencies) must happen via the Sandbox.

## 4. Installing Dependencies

When you need to install new dependencies, do it inside the sandbox, which has the volume mapped so your host files will automatically update:
```bash
docker exec -it dev-os-sandbox npm install <package>
```
```bash
docker exec -it dev-os-sandbox pip install <package>
```
