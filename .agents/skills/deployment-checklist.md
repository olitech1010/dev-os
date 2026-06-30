---
name: deployment-checklist
description: Pre-deployment verification checklist to be run by the DevOps agent before every production deployment.
---

# Deployment Checklist

> Run this checklist before every production deployment. No exceptions.
> The DevOps agent must verify each item and present this completed checklist for human approval.

---

## Pre-Deployment (Before Anything Runs)

### Code Quality
- [ ] All CI checks passing (lint, typecheck, tests, build)
- [ ] Security scan completed — no CRITICAL or HIGH findings
- [ ] Code review approved (at least one human reviewer)
- [ ] No `console.log`, `print()`, or `dd()` in code going to production
- [ ] No hardcoded secrets or environment values
- [ ] `.env.example` updated with any new variables

### Database
- [ ] All migrations tested against a staging database first
- [ ] Migration is reversible, or a rollback plan is documented
- [ ] No destructive migration runs without a database backup taken immediately before
- [ ] Query performance checked for any new queries on large tables (EXPLAIN ANALYZE)

### Dependencies
- [ ] No packages with known critical CVEs
- [ ] No packages installed that aren't in `package.json` / `requirements.txt` / `composer.json`
- [ ] Lock file committed (`package-lock.json`, `composer.lock`, `poetry.lock`)

### Environment
- [ ] All required environment variables set in production environment
- [ ] No development-only config bleeding into production (DEBUG=False, etc.)
- [ ] Third-party API keys are production keys (not dev/test keys)
- [ ] CORS configuration correct for production domain
- [ ] Rate limiting configured on auth and sensitive endpoints

---

## Deployment Execution

### Staging First
- [ ] Deployed to staging environment
- [ ] Smoke test on staging: [list your key user flows here]
- [ ] No unexpected errors in staging logs for 10+ minutes

### Production
- [ ] Deployment window communicated if downtime expected
- [ ] Database backup taken immediately before migration (if applicable)
- [ ] Deployment executed
- [ ] Migration applied and verified

---

## Post-Deployment Verification

### Immediate (first 5 minutes)
- [ ] Application loads without errors
- [ ] Authentication flow works (login, logout)
- [ ] Core feature smoke test passes
- [ ] No spike in error rate in logs/monitoring

### First 30 Minutes
- [ ] Monitor error logs for anomalies
- [ ] Check performance metrics (response times, memory, CPU)
- [ ] Verify background jobs are processing (if applicable)
- [ ] Test any user-facing features that changed in this deployment

---

## Rollback Procedure

**If something goes wrong:**

1. **Assess severity.** Is this affecting all users or a subset? Is data at risk?
2. **Communicate.** Notify relevant stakeholders immediately.
3. **Execute rollback.** Each deployment should have a documented rollback command ready before deployment begins.
4. **Verify.** Confirm rollback was successful.
5. **Post-mortem.** Document what happened and why within 24 hours.

```bash
# Example rollback commands (fill in for your platform)

# Vercel — instant rollback to previous deployment
vercel rollback [deployment-url]

# Railway
railway rollback

# Docker — roll back to previous image tag
docker pull your-image:previous-tag
docker-compose up -d

# Database migration rollback (Laravel)
php artisan migrate:rollback

# Database migration rollback (Django)
python manage.py migrate app_name 0005  # previous migration number
```

---

## Deployment Sign-off

Before executing:

```
Deployment: [version / feature name]
Prepared by: [agent or person]
Checklist completed: [ ]
Human approval: [ ] Confirmed by: ________
Deployment time: ________
```

**This deployment does not proceed without a human completing the sign-off above.**

