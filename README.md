# CivicLedger: Resilient Local Voucher Clearinghouse for Community Mutual Aid

**Competition:** STACK 2026 by GDGoC ITB  
**Selected Case:** Case 2 — Stronger Communities and Everyday Services  
**Team Name:** `Run.exe`  
**Team Members:**
- **Amos Belsing Arta Baringbing** (Team Leader)
- **Jessica Ruth**
- **Jonathan Pasaribu**

---

## 1. Overview & Problem Addressed

Community mutual aid programs in underserved Indonesian neighborhoods often struggle with fragmented paper or spreadsheet voucher tracking, delayed verification, duplicate claims, and unreliable mobile internet connectivity at dense alley stalls (*warung kelontong*). Manual reconciliation erodes accountability and trust between community organizers, beneficiaries, and participating local merchants.

**CivicLedger** is an offline-first Progressive Web Application (PWA) paired with a **Golang + PostgreSQL** clearinghouse backend. It enables community organizers to issue unique, cryptographically signed, commodity-locked vouchers that beneficiaries can redeem at local micro-merchants via QR code or 6-character SMS/printed codes—even during internet outages—with automated duplicate prevention and server-side conflict reconciliation upon reconnection.

---

## 2. Core User Flow & Implemented Features (Semifinal Prototype)

1. **Organizer Console (Registration & Voucher Issuance):**
   - Register verified beneficiary households and onboard local participating merchants (*warungs*).
   - Allocate commodity-locked aid packages (e.g., *Local Rice Staple Pack 5 Kg*, *Family Protein Pack*) and issue vouchers with single-use nonces and **HMAC-SHA256** signatures.
   - Search and filter the community voucher registry by status (`ACTIVE`, `REDEEMED`, `SETTLED`).
2. **Beneficiary Wallet (Inclusive Dual-Channel Presentation):**
   - Smartphone users display a dynamic cryptographic QR code.
   - Elderly or non-smartphone users use a 6-character alphanumeric token (`CL-8841-K9`) with 1-click **Copy SMS Slip** and **Print Paper Slip** support.
3. **Merchant POS (Offline-First Verification & Conflict Lab):**
   - Works in any standard mobile/desktop browser with optional Web Camera QR detection (`BarcodeDetector` API) or manual short-code entry.
   - Verifies voucher signatures client-side in milliseconds via the **Web Cryptography API (`window.crypto.subtle`)** and checks local anti-double-spend nonces in **IndexedDB (`CivicLedgerOfflineDB`)**.
   - Buffers offline transactions with unique transaction identifiers (`client_tx_id`) and provides live **Tamper Fraud Test** and **Simulate Offline Conflict** controls.
4. **Clearinghouse, Conflict Reconciliation & Hash-Chained Ledger:**
   - Synchronizes buffered offline transactions in batches; server-side validation rejects duplicate claims or invalid signatures and records every decision in the **Reconciliation Audit Log**.
   - Chains committed redemptions in a **SHA-256 Hash-Chained Ledger** (`prev_hash` → `tx_hash`) with live **Verify Hash-Chain Integrity** auditing.
   - Aggregates unsettled merchant balances into SHA-256 hashed settlement batch receipts.
5. **Reporting & Export:**
   - Real-time operational metrics (redemption rate, offline vs online sync ratio, blocked duplicate/fraud attempts, merchant turnover charts).
   - 1-click **Export Ledger CSV** and **Export Full Audit JSON**.

---

## 3. Technology Stack

- **Frontend / PWA:** React 19, Next.js 15, TypeScript, Tailwind CSS, Service Worker, IndexedDB, Web Cryptography API (`crypto.subtle`), `qrcode`.
- **Backend REST API:** Golang (`net/http`, Go 1.22+ pattern routing, HMAC-SHA256 & SHA-256 hash chaining, unit tests in `backend/main_test.go`).
- **Database:** PostgreSQL 16 (`backend/schema.sql` + `github.com/lib/pq`) with automatic local JSON fallback when `DATABASE_URL` is unset.
- **Containerization:** Docker & Docker Compose (`docker-compose.yml`).
- **AI Usage in Product:** None required in the core deterministic clearinghouse engine.

---

## 4. Running Locally

### Recommended Full Stack (React PWA + Golang REST API)

**Terminal 1 — Start the Golang Backend API (`http://localhost:8081`):**
```bash
cd backend
go run .
```
*(Runs with local persistent JSON storage out of the box; set `DATABASE_URL` to connect to PostgreSQL.)*

**Terminal 2 — Start the React / Next.js PWA (`http://localhost:3000`):**
```bash
npm install
npm run dev
```
Open `http://localhost:3000`. The Next.js `/api/clearinghouse` proxy automatically connects to the Golang API at `http://127.0.0.1:8081` (and gracefully falls back to its built-in engine if the Go server is not running).

### Full Stack with PostgreSQL via Docker Compose
```bash
docker compose up --build
```
Then run `npm run dev` (the Go API inside Docker exposes port `8081` connected to PostgreSQL 16 on port `5432`).

### Run Golang Automated Tests
```bash
cd backend
go test -v ./...
```

---

## 5. Known Limitations & Simulated Functionality (STACK 2026 Compliance)

- **Synthetic Demonstration Data:** Pre-loaded residents (`WGA-0401`–`WGA-0404`) and merchants (`WRG-01`–`WRG-03`) are synthetic demonstration records representing RT/RW Coblong, Bandung.
- **Simulated Disbursement Rails:** Settlement batches compute verifiable SHA-256 receipts and update ledger balances without executing live BI-FAST or QRIS bank transfers.
- **Prototype Shared Verification Secret:** Client-side offline HMAC verification currently uses a neighborhood shared key (`CIVICLEDGER_HMAC_SECRET`); upgrading to asymmetric public-key verification is reserved as a Final Day task.

---

## 6. Planned Final Day Build Tasks

To retain substantive development work for the STACK 2026 Final Day Build Session:
1. **Asymmetric Ed25519 Offline Verification:** Replace shared HMAC-SHA256 signing with server-held Ed25519 private keys and browser-cached public keys so merchant devices cannot forge vouchers.
2. **Role-Based Authentication & Authorized Device Provisioning:** Add JWT authentication for organizers and device registration/revocation lists for participating merchants.
3. **SMS Dispatch Webhook & Pilot Usability Polish:** Integrate automated SMS voucher slip dispatch for non-smartphone beneficiaries and apply usability refinements gathered from early community validation.

---

## 7. Third-Party Resources & Material AI Assistance Disclosure

- **Open-Source Frameworks & Libraries:** React, Next.js, Tailwind CSS, Lucide Icons, `qrcode`, Go standard library, `github.com/lib/pq`, PostgreSQL.
- **References:**
  - APJII (Asosiasi Penyelenggara Jasa Internet Indonesia), *Survei Penetrasi Internet Indonesia 2025*.
  - TNP2K & World Bank Indonesia, *Evaluations of Non-Cash Food Assistance (BPNT / Program Sembako) and e-Warong Operations in Indonesia*.
  - GSMA, *The State of Mobile Internet Connectivity 2026*.
  - World Bank, *Global Findex Database 2025*.
- **Material AI Assistance Disclosure:** AI coding assistance (Google Gemini / Antigravity) was used to scaffold and refine the React/Next.js PWA interface, IndexedDB offline queue wrapper, Golang REST API handlers, and PostgreSQL schema based on Team `Run.exe`'s architectural design and abstract specification. All business logic, cryptographic flows, tests, and documentation were reviewed, verified, and maintained by the team.
