# Dependency Security

This capability ensures application dependencies are kept up-to-date to address
known security vulnerabilities.

## MODIFIED Requirements

### Requirement: Next.js Framework Version

The application MUST use Next.js version 15.4.2 or higher to mitigate:

- SNYK-JS-NEXT-9508709 (Critical): Improper Authorization
- SNYK-JS-NEXT-12299318 (High): Server-side Request Forgery (SSRF)
- SNYK-JS-NEXT-12301496 (Medium): Use of Cache Containing Sensitive Information
- SNYK-JS-NEXT-10176058 (Medium): Race Condition
- SNYK-JS-NEXT-8602067 (Medium): Allocation of Resources Without Limits or
  Throttling
- SNYK-JS-NEXT-12265451 (Low): Missing Source Correlation of Multiple
  Independent Data
- SNYK-JS-NEXT-10259370 (Low): Missing Origin Validation in WebSockets

#### Scenario: Upgrading Next.js to patch vulnerabilities

**Given** the application uses Next.js 15.0.3\
**When** security scan identifies 7 vulnerabilities\
**Then** upgrade to Next.js 15.4.2\
**And** all identified vulnerabilities are resolved\
**And** application functionality remains intact

#### Scenario: Verifying Next.js security patch

**Given** Next.js has been upgraded to 15.4.2\
**When** running Snyk security scan\
**Then** no Next.js vulnerabilities are reported\
**And** authentication flows work correctly\
**And** server actions and API routes function properly

### Requirement: Email Service Dependency Security

The application MUST use nodemailer version 7.0.7 or higher to mitigate:

- SNYK-JS-NODEMAILER-13378253 (Medium): Interpretation Conflict

#### Scenario: Upgrading nodemailer to patch interpretation conflict

**Given** the application uses nodemailer 7.0.6\
**When** security scan identifies interpretation conflict vulnerability\
**Then** upgrade to nodemailer 7.0.7\
**And** vulnerability is resolved\
**And** email sending functionality works correctly

#### Scenario: Validating email functionality after upgrade

**Given** nodemailer has been upgraded to 7.0.7\
**When** sending verification emails\
**Then** emails are delivered successfully\
**And** email templates render correctly\
**And** SMTP connection is stable

### Requirement: Infrastructure Dependency Awareness

The team MUST maintain awareness of vulnerabilities in infrastructure
dependencies that are not part of the production application runtime.

#### Scenario: Identifying infrastructure-only vulnerabilities

**Given** Snyk scan includes Terraform cache directories\
**When** vulnerabilities are found in `.terragrunt-cache` dependencies\
**Then** document these as infrastructure-only issues\
**And** distinguish from production application vulnerabilities\
**And** track upstream module updates

#### Scenario: Infrastructure cache cleanup

**Given** Terraform modules contain outdated cached dependencies\
**When** security scan reports infrastructure vulnerabilities\
**Then** clean Terragrunt cache directories periodically\
**And** re-scan to verify removal of cache-based vulnerabilities\
**And** document cleanup procedure for maintenance

## ADDED Requirements

### Requirement: Dependency Security Testing

All dependency upgrades for security purposes MUST be validated through
automated and manual testing.

#### Scenario: Running automated test suite after security upgrade

**Given** critical dependencies have been upgraded\
**When** running the full test suite\
**Then** all tests pass successfully\
**And** TypeScript compilation succeeds\
**And** linting passes without errors

#### Scenario: Manual validation of critical paths

**Given** Next.js and nodemailer have been upgraded\
**When** testing authentication flows\
**Then** Google OAuth login works correctly\
**And** session management functions properly\
**When** testing email functionality\
**Then** registration emails are sent\
**And** reminder emails are delivered\
**And** secret disclosure emails work correctly

### Requirement: Security Remediation Documentation

Security vulnerability remediation MUST be documented for audit and compliance
purposes.

#### Scenario: Documenting resolved vulnerabilities

**Given** security vulnerabilities have been remediated\
**When** creating commit message\
**Then** include vulnerability identifiers (Snyk IDs)\
**And** specify versions upgraded (from → to)\
**And** reference security impact (critical/high/medium/low)

#### Scenario: Tracking infrastructure vulnerabilities

**Given** vulnerabilities exist in infrastructure cache dependencies\
**When** these cannot be immediately resolved\
**Then** document in security tracking system\
**And** note distinction from production dependencies\
**And** monitor for upstream module updates
