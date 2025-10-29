# HTTP Security Capability

## ADDED Requirements

### Requirement: Security Headers Configuration

The system SHALL send security headers on all HTTP responses to protect against
common web vulnerabilities including XSS, clickjacking, MIME-type sniffing, and
protocol downgrade attacks.

#### Scenario: Strict-Transport-Security header enforces HTTPS

- **WHEN** any HTTP response is sent from the application
- **THEN** the response SHALL include Strict-Transport-Security header
- **AND** the header SHALL specify "max-age=31536000; includeSubDomains;
  preload"
- **AND** browsers SHALL enforce HTTPS for all requests to the domain for one
  year

#### Scenario: X-Content-Type-Options prevents MIME sniffing

- **WHEN** any HTTP response is sent from the application
- **THEN** the response SHALL include X-Content-Type-Options: nosniff header
- **AND** browsers SHALL respect the Content-Type header and not attempt
  MIME-type sniffing

#### Scenario: X-Frame-Options prevents clickjacking

- **WHEN** any HTTP response is sent from the application
- **THEN** the response SHALL include X-Frame-Options: DENY header
- **AND** browsers SHALL prevent the page from being rendered in a frame,
  iframe, embed, or object

#### Scenario: X-Powered-By header is removed

- **WHEN** any HTTP response is sent from the application
- **THEN** the response SHALL NOT include X-Powered-By header
- **AND** the technology stack SHALL NOT be disclosed to potential attackers

#### Scenario: Referrer-Policy controls information leakage

- **WHEN** any HTTP response is sent from the application
- **THEN** the response SHALL include Referrer-Policy:
  strict-origin-when-cross-origin header
- **AND** browsers SHALL send only origin (not full URL) in referrer for
  cross-origin requests

### Requirement: Content Security Policy (CSP)

The system SHALL implement a Content Security Policy to prevent cross-site
scripting (XSS), data injection attacks, and unauthorized resource loading.

#### Scenario: CSP restricts script sources

- **WHEN** any HTML response is sent from the application
- **THEN** the response SHALL include Content-Security-Policy header
- **AND** the policy SHALL specify "default-src 'self'"
- **AND** the policy SHALL allow scripts only from trusted sources (self,
  Next.js chunks, verified CDNs)
- **AND** browsers SHALL block execution of scripts from unauthorized origins

#### Scenario: CSP prevents framing attacks

- **WHEN** Content-Security-Policy header is sent
- **THEN** the policy SHALL include "frame-ancestors 'none'" directive
- **AND** browsers SHALL prevent the page from being embedded in frames
- **AND** this SHALL provide redundant protection with X-Frame-Options header

#### Scenario: CSP restricts resource loading

- **WHEN** Content-Security-Policy header is sent
- **THEN** the policy SHALL include appropriate directives for:
  - **style-src**: Allow self and inline styles (for Tailwind CSS)
  - **img-src**: Allow self, data URIs, and trusted image CDNs
  - **connect-src**: Allow self and trusted API endpoints (Stripe, Google OAuth)
  - **font-src**: Allow self and trusted font sources
- **AND** browsers SHALL block resources loaded from unauthorized sources

#### Scenario: CSP violations are detected during testing

- **WHEN** CSP is first deployed
- **THEN** the system SHALL use Content-Security-Policy-Report-Only header
- **AND** CSP violations SHALL be reported to browser console
- **AND** developers SHALL review violations and update policy before
  enforcement

#### Scenario: CSP enforces base URI and form actions

- **WHEN** Content-Security-Policy header is sent
- **THEN** the policy SHALL include "base-uri 'self'" to prevent base tag
  injection
- **AND** the policy SHALL include "form-action 'self'" to restrict form
  submission targets
- **AND** browsers SHALL block unauthorized base tags and form submissions

### Requirement: Cache-Control Security

The system SHALL set appropriate cache-control headers to prevent sensitive data
from being cached inappropriately by browsers or intermediary caches.

#### Scenario: Authentication responses are not cached

- **WHEN** an authentication endpoint responds (login, OTP verification,
  session)
- **THEN** the response SHALL include "Cache-Control: no-store, no-cache,
  must-revalidate, private"
- **AND** the response SHALL include "Pragma: no-cache" for HTTP/1.0
  compatibility
- **AND** browsers and proxies SHALL NOT cache authentication responses

#### Scenario: API responses with sensitive data are not cached

- **WHEN** API endpoints return user-specific or sensitive data (secrets,
  profile, settings)
- **THEN** the response SHALL include "Cache-Control: no-store, no-cache,
  must-revalidate, private"
- **AND** browsers and proxies SHALL NOT cache the response

#### Scenario: Static assets are cached efficiently

- **WHEN** static assets are served (CSS, JS, images with content hashes)
- **THEN** the response SHALL include "Cache-Control: public, max-age=31536000,
  immutable"
- **AND** browsers SHALL cache assets for one year
- **AND** cache busting via content hashes SHALL ensure fresh content when
  updated

#### Scenario: HTML pages have appropriate cache settings

- **WHEN** HTML pages are served
- **THEN** the response SHALL include "Cache-Control: no-cache" or short max-age
- **AND** the response SHALL include "ETag" for conditional requests
- **AND** browsers SHALL revalidate content on each request

### Requirement: Information Disclosure Prevention

The system SHALL prevent information disclosure through comments, error
messages, and response headers that could aid attackers in reconnaissance.

#### Scenario: Suspicious comments removed from production builds

- **WHEN** the application is built for production
- **THEN** source code comments containing TODO, FIXME, HACK, XXX, BUG SHALL be
  removed or sanitized
- **AND** comments referencing sensitive information (passwords, keys, internal
  systems) SHALL be removed
- **AND** minified production bundles SHALL NOT contain developer comments

#### Scenario: Server technology not disclosed in headers

- **WHEN** any HTTP response is sent
- **THEN** the response SHALL NOT include Server header with version details
- **AND** the response SHALL NOT include X-Powered-By header
- **AND** the response SHALL NOT include X-AspNet-Version or similar technology
  disclosure headers

#### Scenario: Error messages do not leak sensitive information

- **WHEN** an error occurs and is returned to the client
- **THEN** the error message SHALL be generic and user-friendly
- **AND** the error message SHALL NOT include stack traces, file paths, or
  internal details
- **AND** detailed error information SHALL be logged server-side only

### Requirement: Header Consistency Across Routes

The system SHALL apply security headers consistently across all routes including
HTML pages, API endpoints, static assets, and error pages.

#### Scenario: Security headers present on API routes

- **WHEN** an API route responds at /api/\*
- **THEN** the response SHALL include all applicable security headers
- **AND** CSP SHALL be adapted for JSON responses if needed
- **AND** cache-control SHALL be appropriate for the data sensitivity

#### Scenario: Security headers present on error pages

- **WHEN** an error page is served (404, 500, etc.)
- **THEN** the response SHALL include all security headers
- **AND** error pages SHALL NOT be framed or cached inappropriately

#### Scenario: Security headers present on static assets

- **WHEN** static assets are served from /assets/, /\_next/, or similar
- **THEN** the response SHALL include X-Content-Type-Options: nosniff
- **AND** the response SHALL include appropriate cache-control headers
- **AND** HSTS header SHALL be present even on static asset responses

### Requirement: Development vs Production Header Configuration

The system SHALL apply different security header configurations for development
and production environments without compromising security in production.

#### Scenario: CSP is relaxed in development for hot reload

- **WHEN** the application runs in development mode (NODE_ENV=development)
- **THEN** CSP MAY allow 'unsafe-eval' for Next.js hot module replacement
- **AND** CSP SHALL log violations without blocking to aid development
- **AND** development-only relaxations SHALL be clearly documented

#### Scenario: CSP is strict in production

- **WHEN** the application runs in production mode (NODE_ENV=production)
- **THEN** CSP SHALL NOT allow 'unsafe-eval' or 'unsafe-inline' except where
  absolutely necessary
- **AND** CSP SHALL enforce blocking mode
- **AND** CSP violations SHALL be logged for security monitoring

#### Scenario: Source maps are disabled in production

- **WHEN** the application is built for production
- **THEN** source maps SHALL NOT be generated or served
- **AND** minified bundles SHALL not include sourceMap references
- **AND** original source code SHALL NOT be accessible to end users
