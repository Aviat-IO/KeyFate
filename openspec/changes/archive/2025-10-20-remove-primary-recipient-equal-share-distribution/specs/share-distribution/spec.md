# Share Distribution - Equal Share Model

## ADDED Requirements

### Requirement: Share distribution SHALL implement equal share model with user-managed distribution

All recipients SHALL receive the same cryptographic share (share #1) which the USER distributes separately. Shares never touch KeyFate servers after initial creation, maintaining zero-knowledge architecture.

#### Scenario: Splitting secret into shares client-side

**GIVEN** a user creates a secret with content "my-sensitive-data"  
**WHEN** the secret is submitted  
**THEN** the client-side SHALL:
- Split secret using SSS with configured total_shares and threshold
- Designate share #0 for server storage (AES-256 encrypted)
- Designate share #1 for USER distribution to all recipients
- Store shares #1-N in localStorage (2 hour expiry) for user to manage
- Send only share #0 to server (encrypted)
- NEVER send shares #1-N to server

#### Scenario: Server storing insufficient shares for reconstruction

**GIVEN** a secret is created with threshold=3, total_shares=5  
**WHEN** the server receives share #0  
**THEN** the server SHALL:
- Store share #0 encrypted with AES-256-GCM
- NOT store share #1 (user will distribute to recipients)
- NOT store shares #2-N (user-managed backups)
- Ensure server alone has only 1 share (insufficient to reconstruct)
- NOT track which share recipients receive (user's responsibility)

#### Scenario: User distributing share to recipients

**GIVEN** a user creates secret with 3 recipients  
**WHEN** viewing share instructions page  
**THEN** the system SHALL:
- Display share #1 prominently with label "For ALL recipients"
- Show critical warning: "YOU must send this to each recipient separately"
- List recipients with suggested distribution methods
- Provide copy/download functionality
- Emphasize shares never touch KeyFate servers
- Require user acknowledgment checkbox before continuing

#### Scenario: Triggering secret and sending share #0 disclosure

**GIVEN** a secret with 4 recipients and threshold=3 triggers  
**WHEN** the cron job processes the disclosure  
**THEN** the system SHALL:
- Send disclosure email to all 4 recipients with share #0
- Email contains: share #0 (hex-encoded), secret title, reconstruction instructions
- Remind recipients they need share #1 (received from user previously)
- Include step-by-step reconstruction guide
- Log each disclosure sent with timestamp and recipientId
- Mark secret as triggered after all disclosures sent

#### Scenario: Recipient receiving disclosure email

**GIVEN** a secret triggers with 3 recipients  
**WHEN** Alice receives the disclosure email  
**THEN** the email SHALL:
- Contain share #0 (server share) in plaintext hex format
- Remind: "You should have Share 1 from [user name]"
- Provide reconstruction instructions using SSS
- Explain threshold requirement (e.g., "need 2 shares total")
- Include web interface link for easy reconstruction
- Be fully automated - no manual contact needed

### Requirement: Share reconstruction SHALL require server share plus user-managed shares

Secret reconstruction SHALL require the server share (released after trigger verification) plus sufficient user-managed shares to meet the threshold.

#### Scenario: Reconstructing secret with threshold=2

**GIVEN** a secret has threshold=2, total_shares=3  
**WHEN** Alice receives disclosure email and has share #1  
**THEN** Alice SHALL:
- Have share #0 (from KeyFate email)
- Have share #1 (received from user previously)
- Use web interface or local tool to combine shares
- Input: share #0 and share #1
- SSS.combine([share0, share1]) successfully reconstructs secret
- View plaintext secret content
- No manual verification or identity check needed (automated disclosure)

#### Scenario: Preventing reconstruction with only recipient shares

**GIVEN** a secret has 3 recipients, all with share #1  
**WHEN** two recipients (Alice and Bob) collaborate before trigger  
**THEN** the attempted reconstruction SHALL:
- FAIL because both have identical share #1
- Require at least one additional unique share (server #0 or backup shares)
- Prevent bypassing KeyFate's dead man's switch
- Demonstrate collusion resistance

#### Scenario: Reconstructing with backup shares

**GIVEN** a secret has threshold=3, total_shares=4  
**WHEN** user provides shares #0 (server), #1 (recipient), and #2 (backup)  
**THEN** the system SHALL:
- Validate that 3 unique shares are provided
- Verify share integrity (hex decoding succeeds)
- Reconstruct secret using SSS.combine([share0, share1, share2])
- Return plaintext secret to user

### Requirement: Share instructions page SHALL clearly communicate equal distribution model

The share instructions page SHALL educate users about the equal share distribution and its security implications.

#### Scenario: Viewing share instructions for multi-recipient secret

**GIVEN** a user creates a secret with 3 recipients, 4 total shares, threshold 2  
**WHEN** redirected to share instructions page  
**THEN** the page SHALL display:
- **CRITICAL WARNING:** "YOU must distribute Share 1 to each recipient separately"
- Info: "When triggered, KeyFate will automatically send Share 0 to all recipients"
- Emphasis: "Recipients need BOTH shares to reconstruct the secret"
- Share #1 card labeled "For ALL recipients (Alice, Bob, Carol)"
- List of recipients with suggested secure distribution methods
- Share #2 card labeled "Backup share (store securely offline)"
- Share #3 card labeled "Backup share (store securely offline)"
- Security note: "Recipients cannot reconstruct by collaborating (all have same share)"
- Required checkboxes: "I have distributed Share 1 to all recipients"

#### Scenario: Understanding threshold requirements

**GIVEN** share instructions page displays threshold=3, total_shares=4  
**WHEN** user reads the guidance  
**THEN** the page SHALL explain:
- "You need any 3 shares to reconstruct your secret"
- "KeyFate has share #0 (encrypted, released after trigger)"
- "All recipients will receive share #1"
- "You have shares #2 and #3 as backups"
- "Example: Share #0 + Share #1 + Share #2 = secret reconstructed"

#### Scenario: Storing shares securely

**GIVEN** a user views their shares on instructions page  
**WHEN** they prepare to store shares  
**THEN** the page SHALL provide:
- Download button for each share (JSON format)
- Copy to clipboard functionality
- Checkbox: "I have stored my shares securely offline"
- Warning: "Shares expire from browser in 2 hours"
- Recommendations: password manager, paper backup, encrypted USB

### Requirement: Cron job SHALL send share #0 disclosures reliably with partial failure tolerance

The disclosure cron job SHALL send share #0 to all recipients with graceful degradation if individual emails fail.

#### Scenario: Successful share disclosure to all recipients

**GIVEN** a secret with 5 recipients triggers  
**WHEN** the cron job processes the secret  
**THEN** the system SHALL:
- Iterate over all 5 recipients
- Send disclosure email with share #0 to each recipient
- Include reconstruction instructions in each email
- Log each successful send with timestamp
- Mark job as complete only after all 5 emails sent
- Update secret status to "triggered"

#### Scenario: Partial disclosure delivery failure

**GIVEN** a secret with 4 recipients triggers, email #2 fails  
**WHEN** the cron job processes the secret  
**THEN** the system SHALL:
- Successfully send share #0 to recipients #1, #3, #4
- Log error for recipient #2 with failure reason
- NOT fail entire job
- Mark job as "partial_success"
- Queue retry for recipient #2 only
- Continue processing other secrets

#### Scenario: Logging share disclosure for audit

**GIVEN** a secret triggers and disclosures are sent  
**WHEN** querying distribution logs  
**THEN** the system SHALL provide:
- Timestamp of each disclosure sent
- RecipientId for each disclosure
- Email delivery status (sent, failed, pending)
- Disclosure type (server_share_disclosure)
- Confirmation that share #0 was included
- Error messages for failed deliveries

### Requirement: Share validation SHALL prevent invalid or incomplete reconstructions

The system SHALL validate share integrity and completeness before attempting secret reconstruction.

#### Scenario: Validating share format before reconstruction

**GIVEN** a user submits shares for reconstruction  
**WHEN** shares are processed  
**THEN** the system SHALL:
- Verify each share is valid hex-encoded string
- Check that share count meets threshold requirement
- Verify shares are unique (no duplicates)
- Reject reconstruction if validation fails
- Return clear error messages for invalid inputs

#### Scenario: Detecting insufficient shares

**GIVEN** a secret has threshold=3  
**WHEN** user provides only 2 shares  
**THEN** the system SHALL:
- Reject reconstruction attempt
- Show error: "Need 3 shares but only 2 provided"
- Explain which shares are missing (if determinable)
- NOT attempt SSS.combine() with insufficient shares

#### Scenario: Handling corrupted shares

**GIVEN** a user provides 3 shares, one is corrupted  
**WHEN** attempting reconstruction  
**THEN** the system SHALL:
- Detect hex decoding failure
- Identify which share is corrupted
- Show error: "Share #2 is corrupted or invalid"
- Suggest re-entering or retrieving from backup
- NOT proceed with reconstruction
