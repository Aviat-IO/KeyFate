# Implementation Tasks

## 1. Create Migration Script

- [x] 1.1 Create `frontend/scripts/migrate-and-start.sh` with migration + server
      start logic
- [x] 1.2 Add error handling for migration failures
- [x] 1.3 Add logging for migration start/success/failure
- [x] 1.4 Make script executable (`chmod +x`)

## 2. Update Dockerfile

- [x] 2.1 Copy migration script to container:
      `COPY scripts/migrate-and-start.sh /app/scripts/`
- [x] 2.2 Set script permissions:
      `RUN chmod +x /app/scripts/migrate-and-start.sh`
- [x] 2.3 Update CMD or ENTRYPOINT to use wrapper script
- [x] 2.4 Ensure drizzle-kit is available in production dependencies

## 3. Update Package.json

- [x] 3.1 Verify `db:migrate` script works in production environment
- [x] 3.2 Ensure drizzle-kit is in dependencies (not devDependencies)
- [x] 3.3 Add `db:migrate:prod` script if needed with production-specific config

## 4. Test in Staging

- [ ] 4.1 Deploy to staging with new migration script
- [ ] 4.2 Verify migrations run automatically on startup
- [ ] 4.3 Check Cloud Run logs for migration execution
- [ ] 4.4 Test that application starts correctly after migrations
- [ ] 4.5 Test deployment with no pending migrations (should skip gracefully)
- [ ] 4.6 Test deployment with failing migration (should fail deployment)

## 5. Deploy to Production

- [ ] 5.1 Review staging test results
- [ ] 5.2 Deploy to production during maintenance window
- [ ] 5.3 Monitor Cloud Run logs during deployment
- [ ] 5.4 Verify migrations executed successfully
- [ ] 5.5 Verify application started and is serving traffic

## 6. Documentation

- [ ] 6.1 Update README with new deployment process
- [ ] 6.2 Document how to handle migration failures
- [ ] 6.3 Update Makefile to remove manual migration steps for remote
      environments
- [ ] 6.4 Document rollback procedure
