# Share Export Implementation Tasks

## 1. Backend API

- [ ] 1.1 Create export API endpoint `POST /api/secrets/:id/export`
- [ ] 1.2 Add rate limiting (max 3 exports per secret per hour)
- [ ] 1.3 Add audit logging for share exports
- [ ] 1.4 Validate user ownership and Pro tier status
- [ ] 1.5 Generate export file with metadata (secret ID, share index, timestamp)

## 2. Export File Format

- [ ] 2.1 Define JSON export schema with version field
- [ ] 2.2 Include reconstruction instructions in export
- [ ] 2.3 Include offline tool download links
- [ ] 2.4 Add checksum for integrity verification

## 3. Frontend UI

- [ ] 3.1 Add "Export Share" button to secret detail page (Pro only)
- [ ] 3.2 Create ShareExportDialog component with warnings
- [ ] 3.3 Show export file download progress
- [ ] 3.4 Display last export date on secret card

## 4. Backup Reminders

- [ ] 4.1 Add `last_share_export_at` field to secrets table
- [ ] 4.2 Create cron job to send backup reminder emails (quarterly)
- [ ] 4.3 Add reminder preference setting in user settings

## 5. Documentation

- [ ] 5.1 Update FAQ with share export information
- [ ] 5.2 Create offline reconstruction guide
- [ ] 5.3 Document export file format for developers
- [ ] 5.4 Add data sovereignty section to security page

## 6. Testing

- [ ] 6.1 Unit tests for export file generation
- [ ] 6.2 Integration tests for export API endpoint
- [ ] 6.3 E2E test: export → offline reconstruction
- [ ] 6.4 Test rate limiting behavior
