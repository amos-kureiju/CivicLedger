# CivicLedger: Resilient Local Voucher Clearinghouse for Community Mutual Aid

**Competition:** STACK 2026 by GDGoC ITB  
**Selected Case:** Case 2 — Stronger Communities and Everyday Services  
**Team Name:** `Run.exe`  
**Team Members & Contributions:**
- **Amos Belsing Arta Baringbing** (Team Leader — System Architecture, Clearinghouse Backend, Offline Cryptography & Mobile Integration)
- **Jessica Ruth** (UX Research, Elderly-Accessible Community Interface & User Testing)
- **Jonathan Pasaribu** (Backend API, Data Modeling, Reconciliation Audit & Validation)

**Full Technical Documentation:** [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md)  
**Studi Kasus Pengujian (Test Cases):** [`docs/STUDI_KASUS_PENGUJIAN.md`](docs/STUDI_KASUS_PENGUJIAN.md)  
**Mobile Companion App (React Native + Expo):** [`mobile/README.md`](mobile/README.md)

---

## 1. Overview & Problem Addressed

Community mutual aid programs across underserved Indonesian communities often struggle with fragmented paper or spreadsheet voucher tracking, delayed verification, duplicate claims, and unreliable mobile internet connectivity at neighborhood stalls (*warung/kedai sembako*). Manual reconciliation erodes accountability and trust between organizers, beneficiaries, and participating local merchants.

**CivicLedger** is a resilient, general-purpose voucher clearinghouse built for any community organization, village, or neighborhood mutual aid initiative in Indonesia. It pairs:
- **Web Portal & Offline-First PWA (`src/`):** Primarily designed for **Community Organizers (Pengurus Bansos)** to manage beneficiaries, issue cryptographically signed commodity-locked vouchers, monitor offline reconciliation, disburse merchant settlements, print paper slips for non-smartphone residents, and export audit reports (CSV/JSON) — while also supporting full browser-based POS testing.
- **Mobile Companion App (`mobile/`):** A single React Native + Expo app for field users (**Beneficiaries** and **Local Merchants**), automatically adapting its screens based on the signed-in account.
- **Golang + PostgreSQL Clearinghouse Backend (`backend/`):** Deterministic validation, duplicate prevention, conflict reconciliation, and SHA-256 hash-chained transaction ledger.

---

## 2. Core User Flow & Implemented Features (Semifinal Prototype)

1. **Role-Based Authentication & Recovery:**
   - Login (email or phone number), registration, change password, and 2-step 6-digit OTP password reset (salted `scrypt` hashing + HMAC session cookie).
   - Accessibility controls across Web and Mobile: **Large Text (`A+`)** toggle for elderly users and **Daylight / Dark Mode** theme switch.
2. **Organizer Console (Web):**
   - Manage registered beneficiary households (pre-seeded with 20 synthetic sample records) and participating local merchants (4 sample stalls).
   - Issue commodity-locked vouchers with unique single-use nonces and **HMAC-SHA256** signatures.
   - Filter and search vouchers (`ACTIVE`, `REDEEMED`, `SETTLED`) and beneficiaries.
3. **Beneficiary Wallet (Mobile App + Web Print/SMS Fallback):**
   - Smartphone beneficiaries display a full-screen high-contrast QR code and 6-character code (`CL-8841-K9`) with 1-tap WhatsApp/SMS share and merchant Google Maps lookup.
   - Non-smartphone or elderly residents receive a printed paper slip or SMS code from the organizer.
4. **Offline-First Merchant POS (Mobile App + Web PWA):**
   - Verifies voucher signatures locally on-device in milliseconds (`Web Crypto API` on Web; pure-JS RFC 2104 `HMAC-SHA256` on Mobile) and prevents local double-spending (`IndexedDB` / `AsyncStorage`).
   - Buffers offline transactions with unique `client_tx_id` identifiers and includes live **Tamper Fraud Test** and **Duplicate Claim Test** controls.
5. **Clearinghouse Reconciliation, Hash-Chained Ledger & Reporting:**
   - Batch-synchronizes buffered offline transactions; server-side validation rejects duplicate or forged claims and logs every decision in the **Reconciliation Audit Log**.
   - Chains committed transactions via **SHA-256** (`prev_hash` → `tx_hash`) with live integrity verification, merchant settlement receipts, and 1-click **CSV / JSON** export.

---

## 3. Demo Accounts (Synthetic Data)

| Role | Email / Phone | Password | Primary Platform |
| --- | --- | --- | --- |
| **Organizer (Pengurus Bansos)** | `pengurus@civicledger.id` / `0811-6200-0101` | `pengurus2026` | Web (`http://localhost:3000`) |
| **Local Merchant (Pemilik Kedai)** | `kedai@civicledger.id` / `0812-6300-4821` | `kedai2026` | Mobile App & Web PWA |
| **Beneficiary (Warga Penerima)** | `warga@civicledger.id` / `0812-6311-4401` | `warga2026` | Mobile App & Web Slip |

---

## 4. Technology Stack

- **Web / PWA:** React 19, Next.js 15, TypeScript, Tailwind CSS, Service Worker, IndexedDB, Web Cryptography API (`crypto.subtle`), `qrcode`.
- **Mobile App:** React Native, Expo (SDK 58), TypeScript, `AsyncStorage`, `react-native-qrcode-svg`, pure-JS RFC 2104 HMAC-SHA256.
- **Backend REST API:** Golang (`net/http`, Go 1.22+ routing, HMAC-SHA256 & SHA-256 hash chaining, automated unit tests in `backend/main_test.go`).
- **Database:** PostgreSQL 16 (`backend/schema.sql` + `github.com/lib/pq`) with automatic local JSON fallback when `DATABASE_URL` is unset.
- **Containerization:** Docker & Docker Compose (`docker-compose.yml`).
- **AI Usage in Product:** None required in the core deterministic clearinghouse engine.

---

## 5. Running Locally

### 1) Golang Backend API (`http://localhost:8081`)
```bash
cd backend
go run .
```
*(Runs with local persistent JSON storage out of the box; set `DATABASE_URL` to connect to PostgreSQL 16 via `docker compose up --build`.)*

### 2) Web Portal & PWA (`http://localhost:3000`)
```bash
npm install
npm run dev
```

### 3) Mobile Companion App (`mobile/`, port `8085`)
- **On Android / iOS phone via Expo Go (ngrok tunnel):**
  ```bash
  npm run mobile:tunnel
  ```
- **In desktop browser (mobile frame preview at `http://localhost:8085`):**
  ```bash
  npm run mobile:web
  ```

### 4) Run Automated Tests
```bash
cd backend
go test -v ./...
```

---

## 6. Known Limitations & Simulated Functionality (STACK 2026 Compliance)

- **Synthetic Regional Sample Dataset:** Pre-loaded records (20 synthetic residents `WGA-0401`–`WGA-0420` and 4 sample stalls `WRG-01`–`WRG-04`) are synthetic demonstration data representing a sample Indonesian community pilot; the platform itself is region-agnostic and supports registering any community or region.
- **Simulated Disbursement & Local OTP:** Settlement batches compute verifiable SHA-256 receipts without executing live BI-FAST/QRIS bank transfers, and password-reset OTP codes are displayed locally for offline-safe demonstration without an external SMS gateway.
- **Prototype Shared Verification Key:** Offline HMAC-SHA256 verification currently defaults to a demo key (configurable via environment variable); upgrading to asymmetric public-key signing is intentionally reserved for the Final Day Build Session.

---

## 7. Planned Final Day Build Tasks (Substantive Remaining Work)

Per STACK 2026 Final Phase requirements, 3 substantive tasks are reserved for the Final Day Build Session:
1. **Asymmetric Ed25519 Offline Verification:** Replace shared-key HMAC-SHA256 signing with server-held Ed25519 private keys and cached public keys on merchant devices so compromised stalls cannot forge vouchers.
2. **Native Camera QR Scanner on Mobile:** Integrate `expo-camera` barcode scanning directly into the Mobile Merchant POS screen for rapid 1-second checkout.
3. **Production PostgreSQL Deployment & SMS/WhatsApp Slip Webhook:** Deploy the Go clearinghouse with live PostgreSQL persistence and connect an automated SMS/WhatsApp slip dispatch webhook for non-smartphone beneficiaries.

---

## 8. Third-Party Resources & Material AI Assistance Disclosure

- **Open-Source Frameworks & Libraries:** React, Next.js, Tailwind CSS, Lucide Icons, `qrcode`, React Native, Expo, `react-native-qrcode-svg`, Go standard library, `github.com/lib/pq`, PostgreSQL.
- **References:**
  - GSMA, *The State of Mobile Internet Connectivity 2026*.
  - World Bank, *Global Findex Database 2025*.
  - APJII, *Survei Penetrasi Internet Indonesia 2025*.
  - TNP2K & World Bank Indonesia, *Evaluations of Non-Cash Food Assistance (BPNT / Program Sembako) and e-Warong Operations in Indonesia*.
- **Material AI Assistance Disclosure:** AI coding assistance (Google Gemini / Antigravity) was used to scaffold and refine the React/Next.js PWA interface, React Native + Expo mobile companion screens, IndexedDB/AsyncStorage offline wrappers, Golang REST API handlers, and PostgreSQL schema under Team `Run.exe`'s architectural design and specification. All cryptographic flows, business logic, automated tests, and documentation were reviewed, tested, and verified by the team.
