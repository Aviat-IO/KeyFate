# Settings UI Specification

## ADDED Requirements

### Requirement: Settings Section with Sidebar Navigation
The system SHALL provide a settings section at `/settings` with sidebar navigation to access different settings pages.

#### Scenario: User navigates to settings
- **WHEN** an authenticated user clicks "Settings" in the navbar
- **THEN** the system navigates to `/settings/general` (default page)
- **AND** displays a sidebar with navigation items: General, Audit (Pro only), Subscription

#### Scenario: User navigates between settings pages
- **WHEN** a user clicks a sidebar navigation item
- **THEN** the system navigates to the corresponding page without full page reload
- **AND** highlights the active navigation item in the sidebar

#### Scenario: Sidebar shows Pro-only items
- **WHEN** a Pro user views the settings sidebar
- **THEN** the system displays "Audit" navigation item
- **WHEN** a Free user views the settings sidebar
- **THEN** the system does NOT display "Audit" navigation item

### Requirement: General Settings Page
The system SHALL display user profile information on the `/settings/general` page.

#### Scenario: Display user information
- **WHEN** a user navigates to `/settings/general`
- **THEN** the system displays the user's name, email, and join date (account creation date)
- **AND** formats the join date as a human-readable string (e.g., "Joined January 15, 2024")

#### Scenario: Missing user information
- **WHEN** a user has no name set
- **THEN** the system displays email as the primary identifier
- **AND** shows "Name not set" or similar placeholder

### Requirement: Settings Menu in Navbar
The system SHALL add a "Settings" menu item to the navbar dropdown for authenticated users.

#### Scenario: Authenticated user sees Settings menu item
- **WHEN** an authenticated user opens the navbar menu
- **THEN** the system displays a "Settings" menu item
- **WHEN** the user clicks "Settings"
- **THEN** the system navigates to `/settings/general`

#### Scenario: Unauthenticated user does not see Settings
- **WHEN** an unauthenticated user views the navbar
- **THEN** the system does NOT display "Settings" in the menu

### Requirement: Audit Logs Page Location
The system SHALL move the audit logs page from `/audit-logs` to `/settings/audit` while maintaining backward compatibility.

#### Scenario: Pro user navigates to new audit URL
- **WHEN** a Pro user navigates to `/settings/audit`
- **THEN** the system displays the audit logs page with full functionality

#### Scenario: Redirect from legacy audit URL
- **WHEN** a user navigates to `/audit-logs` (old URL)
- **THEN** the system redirects to `/settings/audit`
- **AND** preserves any query parameters

#### Scenario: Free user cannot access audit page
- **WHEN** a Free user attempts to navigate to `/settings/audit`
- **THEN** the system displays an upgrade prompt or access denied message
- **AND** does NOT display audit logs
