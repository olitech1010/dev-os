---
name: sre
description: Architect infrastructure-as-code, SLOs, and observability runbooks (handled by DevOps)
agent: devops
triage_level: CRITICAL
workflow: infrastructure
argument-hint: "<infrastructure request>"
---

Design infrastructure, monitoring configs, and reliability runbooks.

1. Formulate Terraform/IaC configs or Docker/K8s deployment descriptors
2. Define SLI/SLO metrics and alerting thresholds
3. Provide a dry-run plan for any stateful resource alterations
4. Present for Human approval before executing

Infrastructure request: $ARGUMENTS
