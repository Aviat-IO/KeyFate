# Add OWASP ZAP Security Scanning to CI/CD

## Why

Currently, security vulnerabilities can only be detected through manual testing
or production incidents. Automated security scanning in CI/CD will catch common
vulnerabilities (OWASP Top 10) before they reach production, reducing security
risks and ensuring consistent security validation across all deployments.

## What Changes

- Add OWASP ZAP GitHub Actions workflow for automated security scanning
- Configure baseline scan for pull requests (passive, non-intrusive)
- Configure full scan for staging deployments (active testing)
- Integrate ZAP scan reports as GitHub workflow artifacts
- Add security scan status checks to PR approval process
- Document ZAP scan results interpretation and remediation

## Impact

- **Affected specs:** New capability `security-testing`
- **Affected code:**
  - `.github/workflows/` - New `security-scan.yml` workflow
  - `.zap/` - ZAP configuration and rules (new directory)
  - `docs/` - Security testing documentation (optional)
- **Breaking changes:** None
- **Dependencies:** GitHub Actions runners, staging environment URL
- **Timeline:** 1-2 days for implementation and testing
