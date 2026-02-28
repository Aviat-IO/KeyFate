## 1. Export System

- [x] 1.1 Create `frontend/src/lib/export-recovery-kit.ts` utility
- [x] 1.2 Build standalone recovery HTML template (embedded in export-recovery-kit.ts)
- [x] 1.3 Bundle shamirs-secret-sharing into standalone HTML (GF(256) implementation embedded)
- [x] 1.4 Create `frontend/src/app/api/secrets/[id]/export-share/route.ts` API endpoint
- [x] 1.5 Add ExportRecoveryKitButton component to secret details page
- [x] 1.6 Implement ZIP generation with JSZip
- [ ] 1.7 Test offline recovery flow (manual testing recommended)
- [x] 1.8 Add export functionality tests

## 2. Nostr Integration

- [ ] 2.1 Add nostr-tools dependency
- [ ] 2.2 Create `frontend/src/lib/nostr/` module structure
- [ ] 2.3 Implement Nostr keypair generation for users
- [ ] 2.4 Create share publishing function (NIP-17 encrypted)
- [ ] 2.5 Configure recommended relay list
- [ ] 2.6 Add Nostr share publishing on secret creation
- [ ] 2.7 Build relay query function for recipients
- [ ] 2.8 Integrate Nostr recovery into standalone tool
- [ ] 2.9 Add Nostr settings to user preferences
- [ ] 2.10 Test cross-relay persistence

## 3. Decentralized Storage

- [ ] 3.1 Evaluate IPFS providers (Pinata vs Web3.Storage)
- [ ] 3.2 Create `frontend/src/lib/decentralized-storage/` module
- [ ] 3.3 Implement IPFS upload function
- [ ] 3.4 Implement Arweave upload function (Pro tier)
- [ ] 3.5 Store CIDs in secret metadata
- [ ] 3.6 Add CID to Nostr event tags
- [ ] 3.7 Integrate IPFS retrieval into recovery tool
- [ ] 3.8 Test gateway fallback behavior

## 4. Automatic Disclosure Triggers

- [ ] 4.1 Research Sarcophagus SDK integration
- [ ] 4.2 Design Nostr oracle bot architecture
- [ ] 4.3 Implement oracle bot (Node.js service)
- [ ] 4.4 Deploy to redundant infrastructure
- [ ] 4.5 Create smart contract for check-in tracking (optional)
- [ ] 4.6 Integrate Chainlink Automation (optional)
- [ ] 4.7 Test automatic disclosure end-to-end

## 5. Bitcoin Timelocks (Future)

- [ ] 5.1 Design wallet integration UX
- [ ] 5.2 Add bitcoinjs-lib dependency
- [ ] 5.3 Implement CLTV transaction creation
- [ ] 5.4 Build renewal workflow
- [ ] 5.5 Create Bitcoin recovery documentation
- [ ] 5.6 Test timelock expiration and broadcast

## 6. Documentation & Testing

- [ ] 6.1 Update user documentation for export feature
- [ ] 6.2 Create recovery guide for recipients
- [ ] 6.3 Add integration tests for all storage backends
- [ ] 6.4 Document disaster recovery procedures
- [ ] 6.5 Create FAQ for service continuity
