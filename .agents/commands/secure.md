---
name: secure
description: Run security scan on current changes
agent: security
triage_level: STANDARD
workflow: direct
---

Perform a security scan on the specified target.

Check for:
- OWASP Top 10 patterns
- Authentication and authorization logic flaws
- Input validation and sanitisation gaps
- Secrets and credentials exposure
- Dependency vulnerabilities (known CVEs)
- SQL injection, XSS, CSRF vectors
- File upload handling issues
- Rate limiting and abuse vectors

Target: $ARGUMENTS

Return a risk report with severity levels: CRITICAL, HIGH, MEDIUM, LOW, INFO.
