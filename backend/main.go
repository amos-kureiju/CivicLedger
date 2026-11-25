package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

const (
	genesisHash     = "0000000000000000000000000000000000000000000000000000000000000000"
	defaultSecret   = "CIVICLEDGER_RT04_RW08_COBLONG_HMAC_SECRET_2026"
	defaultPoolIDR  = int64(8500000)
	localStateFile  = ".civicledger-go-state.json"
)

// ==================== DOMAIN MODELS ====================

type Beneficiary struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	RtRw          string `json:"rt_rw"`
	Category      string `json:"category"`
	Phone         string `json:"phone"`
	HouseholdSize int    `json:"household_size"`
	VerifiedBy    string `json:"verified_by"`
}

type Merchant struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	Owner               string `json:"owner"`
	RtRw                string `json:"rt_rw"`
	BankAccount         string `json:"bank_account"`
	UnsettledBalanceIDR int64  `json:"unsettled_balance_idr"`
	TotalSettledIDR     int64  `json:"total_settled_idr"`
	RedemptionCount     int    `json:"redemption_count"`
}

type CommodityItem struct {
	Code       string `json:"code"`
	Name       string `json:"name"`
	Items      string `json:"items"`
	NominalIDR int64  `json:"nominal_idr"`
}

type Voucher struct {
	ID                     string  `json:"id"`
	ShortCode              string  `json:"short_code"`
	BeneficiaryID          string  `json:"beneficiary_id"`
	BeneficiaryName        string  `json:"beneficiary_name"`
	RtRw                   string  `json:"rt_rw"`
	CommodityCode          string  `json:"commodity_code"`
	CommodityName          string  `json:"commodity_name"`
	CommodityItems         string  `json:"commodity_items"`
	NominalIDR             int64   `json:"nominal_idr"`
	Nonce                  string  `json:"nonce"`
	IssuedAt               string  `json:"issued_at"`
	ExpiresAt              string  `json:"expires_at"`
	HMACSignature          string  `json:"hmac_signature"`
	Status                 string  `json:"status"`
	RedeemedByMerchantID   *string `json:"redeemed_by_merchant_id,omitempty"`
	RedeemedByMerchantName *string `json:"redeemed_by_merchant_name,omitempty"`
	RedeemedAt             *string `json:"redeemed_at,omitempty"`
	SettlementBatchID      *string `json:"settlement_batch_id,omitempty"`
}

type LedgerEntry struct {
	ID                string  `json:"id"`
	ClientTxID        string  `json:"client_tx_id"`
	VoucherID         string  `json:"voucher_id"`
	ShortCode         string  `json:"short_code"`
	BeneficiaryID     string  `json:"beneficiary_id"`
	MerchantID        string  `json:"merchant_id"`
	MerchantName      string  `json:"merchant_name"`
	CommodityName     string  `json:"commodity_name"`
	NominalIDR        int64   `json:"nominal_idr"`
	HMACSignature     string  `json:"hmac_signature"`
	PrevHash          string  `json:"prev_hash"`
	TxHash            string  `json:"tx_hash"`
	SyncMode          string  `json:"sync_mode"`
	Timestamp         string  `json:"timestamp"`
	SettlementBatchID *string `json:"settlement_batch_id,omitempty"`
}

type SettlementBatch struct {
	ID             string `json:"id"`
	MerchantID     string `json:"merchant_id"`
	MerchantName   string `json:"merchant_name"`
	BankAccount    string `json:"bank_account"`
	VoucherCount   int    `json:"voucher_count"`
	TotalAmountIDR int64  `json:"total_amount_idr"`
	BatchHash      string `json:"batch_hash"`
	SettledAt      string `json:"settled_at"`
}

type ReconciliationLog struct {
	ID           string `json:"id"`
	ClientTxID   string `json:"client_tx_id"`
	VoucherID    string `json:"voucher_id"`
	ShortCode    string `json:"short_code"`
	MerchantID   string `json:"merchant_id"`
	MerchantName string `json:"merchant_name"`
	Outcome      string `json:"outcome"` // SYNCED | DUPLICATE_CONFLICT | INVALID_SIGNATURE | EXPIRED | NOT_FOUND
	Reason       string `json:"reason"`
	ProcessedAt  string `json:"processed_at"`
}

type ChainVerificationResult struct {
	Valid        bool   `json:"valid"`
	CheckedCount int    `json:"checked_count"`
	HeadHash     string `json:"head_hash"`
	BrokenAtID   string `json:"broken_at_id,omitempty"`
	Message      string `json:"message"`
}

type ClearinghouseState struct {
	PoolTotalIDR       int64               `json:"pool_total_idr"`
	FraudBlockedCount  int                 `json:"fraud_blocked_count"`
	Beneficiaries      []Beneficiary       `json:"beneficiaries"`
	Merchants          []Merchant          `json:"merchants"`
	Vouchers           []Voucher           `json:"vouchers"`
	Ledger             []LedgerEntry       `json:"ledger"`
	SettlementBatches  []SettlementBatch   `json:"settlement_batches"`
	ReconciliationLogs []ReconciliationLog `json:"reconciliation_logs"`
	CommodityCatalog   []CommodityItem     `json:"commodity_catalog"`
	BackendEngine      string              `json:"backend_engine"`
}

// ==================== COMMODITY CATALOG ====================

var commodityCatalog = []CommodityItem{
	{
		Code:       "PKG-BERAS-5KG",
		Name:       "Paket Beras Lokal Medium (5 Kg)",
		Items:      "Beras Medium 5 Kg (Khusus Pangan, Non-Tunai)",
		NominalIDR: 72500,
	},
	{
		Code:       "PKG-PROTEIN-01",
		Name:       "Paket Gizi & Protein Keluarga",
		Items:      "Telur Ayam 1 Kg + Tempe 2 Papan + Tahu 10 Potong",
		NominalIDR: 42000,
	},
	{
		Code:       "PKG-DAPUR-02",
		Name:       "Paket Minyak Goreng & Pokok Dapur",
		Items:      "Minyak Goreng 2 Liter + Gula Pasir 1 Kg + Garam Beryodium",
		NominalIDR: 51000,
	},
	{
		Code:       "PKG-DARURAT-FULL",
		Name:       "Paket Sembako Darurat Lengkap",
		Items:      "Beras 5 Kg + Telur 1 Kg + Minyak Goreng 1L + Susu Anak",
		NominalIDR: 115000,
	},
}

func findCommodity(code string) (CommodityItem, bool) {
	for _, c := range commodityCatalog {
		if c.Code == code {
			return c, true
		}
	}
	return CommodityItem{}, false
}

// ==================== CRYPTOGRAPHIC HELPERS ====================

func getHMACSecret() string {
	if s := os.Getenv("CIVICLEDGER_HMAC_SECRET"); s != "" {
		return s
	}
	return defaultSecret
}

func buildCanonicalVoucherMessage(voucherID, beneficiaryID, commodityCode string, nominalIDR int64, nonce, expiresAt string) string {
	return fmt.Sprintf("%s|%s|%s|%d|%s|%s", voucherID, beneficiaryID, commodityCode, nominalIDR, nonce, expiresAt)
}

func signVoucherHMAC(voucherID, beneficiaryID, commodityCode string, nominalIDR int64, nonce, expiresAt string) string {
	mac := hmac.New(sha256.New, []byte(getHMACSecret()))
	mac.Write([]byte(buildCanonicalVoucherMessage(voucherID, beneficiaryID, commodityCode, nominalIDR, nonce, expiresAt)))
	return hex.EncodeToString(mac.Sum(nil))
}

func computeLedgerTxHash(prevHash, voucherID, merchantID string, nominalIDR int64, timestamp, hmacSig string) string {
	payload := fmt.Sprintf("%s|%s|%s|%d|%s|%s", prevHash, voucherID, merchantID, nominalIDR, timestamp, hmacSig)
	sum := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(sum[:])
}

func computeSHA256Hex(input string) string {
	sum := sha256.Sum256([]byte(input))
	return hex.EncodeToString(sum[:])
}

func randomHex(nBytes int) string {
	b := make([]byte, nBytes)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func randomIntRange(minVal, maxVal int64) int64 {
	n, err := rand.Int(rand.Reader, big.NewInt(maxVal-minVal))
	if err != nil {
		return minVal + 1234
	}
	return minVal + n.Int64()
}

func verifyLedgerChain(entries []LedgerEntry) ChainVerificationResult {
	if len(entries) == 0 {
		return ChainVerificationResult{
			Valid:        true,
			CheckedCount: 0,
			HeadHash:     genesisHash,
			Message:      "Buku besar masih kosong; jangkar hash genesis utuh.",
		}
	}

	// Entries are stored newest-first; validate oldest -> newest
	expectedPrev := genesisHash
	for i := len(entries) - 1; i >= 0; i-- {
		e := entries[i]
		if e.PrevHash != expectedPrev {
			return ChainVerificationResult{
				Valid:        false,
				CheckedCount: len(entries) - i,
				HeadHash:     entries[0].TxHash,
				BrokenAtID:   e.ID,
				Message:      fmt.Sprintf("Terdeteksi pemutusan rantai hash pada transaksi %s.", e.ID),
			}
		}
		recomputed := computeLedgerTxHash(e.PrevHash, e.VoucherID, e.MerchantID, e.NominalIDR, e.Timestamp, e.HMACSignature)
		if !strings.EqualFold(recomputed, e.TxHash) {
			return ChainVerificationResult{
				Valid:        false,
				CheckedCount: len(entries) - i,
				HeadHash:     entries[0].TxHash,
				BrokenAtID:   e.ID,
				Message:      fmt.Sprintf("Terdeteksi manipulasi payload buku besar pada transaksi %s.", e.ID),
			}
		}
		expectedPrev = e.TxHash
	}

	return ChainVerificationResult{
		Valid:        true,
		CheckedCount: len(entries),
		HeadHash:     entries[0].TxHash,
		Message:      fmt.Sprintf("Seluruh %d entri buku besar terverifikasi utuh terhadap rantai hash SHA-256.", len(entries)),
	}
}

// ==================== INITIAL SYNTHETIC SEED ====================

func buildInitialSeedState(engine string) *ClearinghouseState {
	now := time.Now().UTC()
	issuedIso := now.Add(-3 * time.Hour).Format(time.RFC3339)
	expIso := now.Add(69 * time.Hour).Format(time.RFC3339)
	earlierRedeemedIso := now.Add(-5 * time.Hour).Format(time.RFC3339)
	settledIso := now.Add(-24 * time.Hour).Format(time.RFC3339)

	beneficiaries := []Beneficiary{
		{
			ID:            "WGA-0401",
			Name:          "Ibu Siti Aminah (Lansia)",
			RtRw:          "RT 04 / RW 08 Coblong, Bandung",
			Category:      "Keluarga Lansia Rentan",
			Phone:         "0812-2104-8891 (SMS / Kode Cetak)",
			HouseholdSize: 2,
			VerifiedBy:    "Koordinator RT 04 — Pak H. Dedi",
		},
		{
			ID:            "WGA-0402",
			Name:          "Keluarga Pak Deden Suryana",
			RtRw:          "RT 04 / RW 08 Coblong, Bandung",
			Category:      "Pekerja Harian Lepas Terdampak",
			Phone:         "0857-9412-3302 (QR Web Ponsel)",
			HouseholdSize: 4,
			VerifiedBy:    "Koordinator RT 04 — Pak H. Dedi",
		},
		{
			ID:            "WGA-0403",
			Name:          "Ibu Rina Kartika",
			RtRw:          "RT 02 / RW 08 Coblong, Bandung",
			Category:      "Kepala Keluarga Perempuan",
			Phone:         "0813-2289-7104 (QR Web Ponsel)",
			HouseholdSize: 3,
			VerifiedBy:    "Relawan Posyandu RW 08",
		},
		{
			ID:            "WGA-0404",
			Name:          "Pak Maman Abdurrahman",
			RtRw:          "RT 05 / RW 08 Coblong, Bandung",
			Category:      "Pemulihan Medis & Rentan",
			Phone:         "0896-5541-0029 (SMS / Kode Cetak)",
			HouseholdSize: 3,
			VerifiedBy:    "Ketua RW 08 — Ir. Bambang",
		},
	}

	merchants := []Merchant{
		{
			ID:                  "WRG-01",
			Name:                "Warung Kelontong Berkah Bu Yati",
			Owner:               "Ibu Yati Rohayati",
			RtRw:                "RT 04 / RW 08 (Gg. Sangkuriang Dalam)",
			BankAccount:         "BRI Simpedes / QRIS •• 4821",
			UnsettledBalanceIDR: 72500,
			TotalSettledIDR:     480000,
			RedemptionCount:     5,
		},
		{
			ID:                  "WRG-02",
			Name:                "Toko Sembako Pak Asep Mandiri",
			Owner:               "Pak Asep Sunandar",
			RtRw:                "RT 02 / RW 08 (Jl. Cisitu Lama)",
			BankAccount:         "Bank BJB Mikro / QRIS •• 9012",
			UnsettledBalanceIDR: 51000,
			TotalSettledIDR:     350000,
			RedemptionCount:     4,
		},
		{
			ID:                  "WRG-03",
			Name:                "Warung Sayur & Pangan Teh Euis",
			Owner:               "Teh Euis Komariah",
			RtRw:                "RT 05 / RW 08 (Gg. Dago Pojok)",
			BankAccount:         "Mandiri Mikro / GoPay Merchant •• 3319",
			UnsettledBalanceIDR: 0,
			TotalSettledIDR:     290000,
			RedemptionCount:     3,
		},
	}

	v1Sig := signVoucherHMAC("VCH-2026-8841", "WGA-0401", "PKG-BERAS-5KG", 72500, "n9f81a2b4c6d", expIso)
	v2Sig := signVoucherHMAC("VCH-2026-7732", "WGA-0402", "PKG-DARURAT-FULL", 115000, "a3c5e7f91b2d", expIso)
	v3Sig := signVoucherHMAC("VCH-2026-6619", "WGA-0403", "PKG-PROTEIN-01", 42000, "d4e8f1a09c3b", expIso)
	v4Sig := signVoucherHMAC("VCH-2026-5508", "WGA-0404", "PKG-BERAS-5KG", 72500, "b7c2d9e41f8a", expIso)

	m1ID := "WRG-01"
	m1Name := "Warung Kelontong Berkah Bu Yati"

	vouchers := []Voucher{
		{
			ID:              "VCH-2026-8841",
			ShortCode:       "CL-8841-K9",
			BeneficiaryID:   "WGA-0401",
			BeneficiaryName: "Ibu Siti Aminah (Lansia)",
			RtRw:            "RT 04 / RW 08 Coblong, Bandung",
			CommodityCode:   "PKG-BERAS-5KG",
			CommodityName:   "Paket Beras Lokal Medium (5 Kg)",
			CommodityItems:  "Beras Medium 5 Kg (Khusus Pangan, Non-Tunai)",
			NominalIDR:      72500,
			Nonce:           "n9f81a2b4c6d",
			IssuedAt:        issuedIso,
			ExpiresAt:       expIso,
			HMACSignature:   v1Sig,
			Status:          "ACTIVE",
		},
		{
			ID:              "VCH-2026-7732",
			ShortCode:       "CL-7732-M4",
			BeneficiaryID:   "WGA-0402",
			BeneficiaryName: "Keluarga Pak Deden Suryana",
			RtRw:            "RT 04 / RW 08 Coblong, Bandung",
			CommodityCode:   "PKG-DARURAT-FULL",
			CommodityName:   "Paket Sembako Darurat Lengkap",
			CommodityItems:  "Beras 5 Kg + Telur 1 Kg + Minyak Goreng 1L + Susu Anak",
			NominalIDR:      115000,
			Nonce:           "a3c5e7f91b2d",
			IssuedAt:        issuedIso,
			ExpiresAt:       expIso,
			HMACSignature:   v2Sig,
			Status:          "ACTIVE",
		},
		{
			ID:              "VCH-2026-6619",
			ShortCode:       "CL-6619-P2",
			BeneficiaryID:   "WGA-0403",
			BeneficiaryName: "Ibu Rina Kartika",
			RtRw:            "RT 02 / RW 08 Coblong, Bandung",
			CommodityCode:   "PKG-PROTEIN-01",
			CommodityName:   "Paket Gizi & Protein Keluarga",
			CommodityItems:  "Telur Ayam 1 Kg + Tempe 2 Papan + Tahu 10 Potong",
			NominalIDR:      42000,
			Nonce:           "d4e8f1a09c3b",
			IssuedAt:        issuedIso,
			ExpiresAt:       expIso,
			HMACSignature:   v3Sig,
			Status:          "ACTIVE",
		},
		{
			ID:                     "VCH-2026-5508",
			ShortCode:              "CL-5508-R7",
			BeneficiaryID:          "WGA-0404",
			BeneficiaryName:        "Pak Maman Abdurrahman",
			RtRw:                   "RT 05 / RW 08 Coblong, Bandung",
			CommodityCode:          "PKG-BERAS-5KG",
			CommodityName:          "Paket Beras Lokal Medium (5 Kg)",
			CommodityItems:         "Beras Medium 5 Kg (Khusus Pangan, Non-Tunai)",
			NominalIDR:             72500,
			Nonce:                  "b7c2d9e41f8a",
			IssuedAt:               earlierRedeemedIso,
			ExpiresAt:              expIso,
			HMACSignature:          v4Sig,
			Status:                 "REDEEMED",
			RedeemedByMerchantID:   &m1ID,
			RedeemedByMerchantName: &m1Name,
			RedeemedAt:             &earlierRedeemedIso,
		},
	}

	tx1Hash := computeLedgerTxHash(genesisHash, "VCH-2026-5508", "WRG-01", 72500, earlierRedeemedIso, v4Sig)
	ledger := []LedgerEntry{
		{
			ID:            "TX-9F2A10C4",
			ClientTxID:    "CTX-SEED-5508",
			VoucherID:     "VCH-2026-5508",
			ShortCode:     "CL-5508-R7",
			BeneficiaryID: "WGA-0404",
			MerchantID:    "WRG-01",
			MerchantName:  "Warung Kelontong Berkah Bu Yati",
			CommodityName: "Paket Beras Lokal Medium (5 Kg)",
			NominalIDR:    72500,
			HMACSignature: v4Sig,
			PrevHash:      genesisHash,
			TxHash:        tx1Hash,
			SyncMode:      "OFFLINE_BATCH_SYNC",
			Timestamp:     earlierRedeemedIso,
		},
	}

	settlementBatches := []SettlementBatch{
		{
			ID:             "STL-2026-A81F09",
			MerchantID:     "WRG-01",
			MerchantName:   "Warung Kelontong Berkah Bu Yati",
			BankAccount:    "BRI Simpedes / QRIS •• 4821",
			VoucherCount:   4,
			TotalAmountIDR: 480000,
			BatchHash:      computeSHA256Hex("STL-2026-A81F09|WRG-01|480000"),
			SettledAt:      settledIso,
		},
		{
			ID:             "STL-2026-B42C11",
			MerchantID:     "WRG-02",
			MerchantName:   "Toko Sembako Pak Asep Mandiri",
			BankAccount:    "Bank BJB Mikro / QRIS •• 9012",
			VoucherCount:   3,
			TotalAmountIDR: 350000,
			BatchHash:      computeSHA256Hex("STL-2026-B42C11|WRG-02|350000"),
			SettledAt:      settledIso,
		},
	}

	reconciliationLogs := []ReconciliationLog{
		{
			ID:           "REC-SEED-001",
			ClientTxID:   "CTX-SEED-5508",
			VoucherID:    "VCH-2026-5508",
			ShortCode:    "CL-5508-R7",
			MerchantID:   "WRG-01",
			MerchantName: "Warung Kelontong Berkah Bu Yati",
			Outcome:      "SYNCED",
			Reason:       "Penukaran offline terverifikasi melalui HMAC-SHA256 dan dicatat ke buku besar rantai hash.",
			ProcessedAt:  earlierRedeemedIso,
		},
	}

	return &ClearinghouseState{
		PoolTotalIDR:       defaultPoolIDR,
		FraudBlockedCount:  0,
		Beneficiaries:      beneficiaries,
		Merchants:          merchants,
		Vouchers:           vouchers,
		Ledger:             ledger,
		SettlementBatches:  settlementBatches,
		ReconciliationLogs: reconciliationLogs,
		CommodityCatalog:   commodityCatalog,
		BackendEngine:      engine,
	}
}

// ==================== CLEARINGHOUSE SERVICE ====================

type ClearinghouseService struct {
	mu        sync.RWMutex
	db        *sql.DB
	state     *ClearinghouseState
	statePath string
	engine    string
}

func NewClearinghouseService(dsn string, statePath string) *ClearinghouseService {
	svc := &ClearinghouseService{
		statePath: statePath,
		engine:    "GO_LOCAL",
	}

	if dsn != "" {
		db, err := sql.Open("postgres", dsn)
		if err == nil {
			db.SetMaxOpenConns(10)
			db.SetConnMaxLifetime(5 * time.Minute)
			if pingErr := db.Ping(); pingErr == nil {
				if migErr := svc.initPostgres(db); migErr == nil {
					svc.db = db
					svc.engine = "GO_POSTGRES"
					log.Println("[CivicLedger Go API] Connected to PostgreSQL with ACID transaction support.")
				} else {
					log.Printf("[CivicLedger Go API] PostgreSQL schema init failed (%v), falling back to local JSON store.", migErr)
					_ = db.Close()
				}
			} else {
				log.Printf("[CivicLedger Go API] PostgreSQL unreachable (%v), falling back to local JSON store.", pingErr)
				_ = db.Close()
			}
		}
	}

	if svc.db != nil {
		loaded, err := svc.loadFromPostgres()
		if err != nil || len(loaded.Beneficiaries) == 0 {
			seed := buildInitialSeedState(svc.engine)
			svc.state = seed
			if saveErr := svc.persistToPostgres(seed); saveErr != nil {
				log.Printf("[CivicLedger Go API] Failed seeding PostgreSQL: %v", saveErr)
			}
		} else {
			svc.state = loaded
		}
	} else {
		svc.state = svc.loadFromFile()
	}

	return svc
}

func (s *ClearinghouseService) initPostgres(db *sql.DB) error {
	schemaBytes, err := os.ReadFile("schema.sql")
	if err != nil {
		// Try relative to backend dir if invoked from repo root
		schemaBytes, err = os.ReadFile(filepath.Join("backend", "schema.sql"))
		if err != nil {
			return err
		}
	}
	_, err = db.Exec(string(schemaBytes))
	return err
}

func (s *ClearinghouseService) loadFromFile() *ClearinghouseState {
	if s.statePath != "" {
		if raw, err := os.ReadFile(s.statePath); err == nil {
			var st ClearinghouseState
			if jsonErr := json.Unmarshal(raw, &st); jsonErr == nil && len(st.Beneficiaries) > 0 {
				st.CommodityCatalog = commodityCatalog
				st.BackendEngine = s.engine
				return &st
			}
		}
	}
	seed := buildInitialSeedState(s.engine)
	s.saveToFile(seed)
	return seed
}

func (s *ClearinghouseService) saveToFile(st *ClearinghouseState) {
	if s.statePath == "" {
		return
	}
	if raw, err := json.MarshalIndent(st, "", "  "); err == nil {
		_ = os.WriteFile(s.statePath, raw, 0644)
	}
}

func (s *ClearinghouseService) loadFromPostgres() (*ClearinghouseState, error) {
	st := &ClearinghouseState{
		PoolTotalIDR:       defaultPoolIDR,
		Beneficiaries:      []Beneficiary{},
		Merchants:          []Merchant{},
		Vouchers:           []Voucher{},
		Ledger:             []LedgerEntry{},
		SettlementBatches:  []SettlementBatch{},
		ReconciliationLogs: []ReconciliationLog{},
		CommodityCatalog:   commodityCatalog,
		BackendEngine:      s.engine,
	}

	_ = s.db.QueryRow(`SELECT value_int FROM system_config WHERE key = 'pool_total_idr'`).Scan(&st.PoolTotalIDR)
	_ = s.db.QueryRow(`SELECT value_int FROM system_config WHERE key = 'fraud_blocked_count'`).Scan(&st.FraudBlockedCount)

	rows, err := s.db.Query(`SELECT id, name, rt_rw, category, phone, household_size, verified_by FROM beneficiaries ORDER BY id ASC`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var b Beneficiary
		if err := rows.Scan(&b.ID, &b.Name, &b.RtRw, &b.Category, &b.Phone, &b.HouseholdSize, &b.VerifiedBy); err == nil {
			st.Beneficiaries = append(st.Beneficiaries, b)
		}
	}
	rows.Close()

	mRows, err := s.db.Query(`SELECT id, name, owner, rt_rw, bank_account, unsettled_balance_idr, total_settled_idr, redemption_count FROM merchants ORDER BY id ASC`)
	if err == nil {
		for mRows.Next() {
			var m Merchant
			if err := mRows.Scan(&m.ID, &m.Name, &m.Owner, &m.RtRw, &m.BankAccount, &m.UnsettledBalanceIDR, &m.TotalSettledIDR, &m.RedemptionCount); err == nil {
				st.Merchants = append(st.Merchants, m)
			}
		}
		mRows.Close()
	}

	vRows, err := s.db.Query(`SELECT id, short_code, beneficiary_id, beneficiary_name, rt_rw, commodity_code, commodity_name, commodity_items, nominal_idr, nonce, issued_at, expires_at, hmac_signature, status, redeemed_by_merchant_id, redeemed_by_merchant_name, redeemed_at, settlement_batch_id FROM vouchers ORDER BY issued_at DESC`)
	if err == nil {
		for vRows.Next() {
			var v Voucher
			var rmID, rmName, rAt, sbID sql.NullString
			if err := vRows.Scan(&v.ID, &v.ShortCode, &v.BeneficiaryID, &v.BeneficiaryName, &v.RtRw, &v.CommodityCode, &v.CommodityName, &v.CommodityItems, &v.NominalIDR, &v.Nonce, &v.IssuedAt, &v.ExpiresAt, &v.HMACSignature, &v.Status, &rmID, &rmName, &rAt, &sbID); err == nil {
				if rmID.Valid {
					v.RedeemedByMerchantID = &rmID.String
				}
				if rmName.Valid {
					v.RedeemedByMerchantName = &rmName.String
				}
				if rAt.Valid {
					v.RedeemedAt = &rAt.String
				}
				if sbID.Valid {
					v.SettlementBatchID = &sbID.String
				}
				st.Vouchers = append(st.Vouchers, v)
			}
		}
		vRows.Close()
	}

	lRows, err := s.db.Query(`SELECT id, client_tx_id, voucher_id, short_code, beneficiary_id, merchant_id, merchant_name, commodity_name, nominal_idr, hmac_signature, prev_hash, tx_hash, sync_mode, timestamp, settlement_batch_id FROM ledger_entries ORDER BY timestamp DESC`)
	if err == nil {
		for lRows.Next() {
			var l LedgerEntry
			var sbID sql.NullString
			if err := lRows.Scan(&l.ID, &l.ClientTxID, &l.VoucherID, &l.ShortCode, &l.BeneficiaryID, &l.MerchantID, &l.MerchantName, &l.CommodityName, &l.NominalIDR, &l.HMACSignature, &l.PrevHash, &l.TxHash, &l.SyncMode, &l.Timestamp, &sbID); err == nil {
				if sbID.Valid {
					l.SettlementBatchID = &sbID.String
				}
				st.Ledger = append(st.Ledger, l)
			}
		}
		lRows.Close()
	}

	bRows, err := s.db.Query(`SELECT id, merchant_id, merchant_name, bank_account, voucher_count, total_amount_idr, batch_hash, settled_at FROM settlement_batches ORDER BY settled_at DESC`)
	if err == nil {
		for bRows.Next() {
			var b SettlementBatch
			if err := bRows.Scan(&b.ID, &b.MerchantID, &b.MerchantName, &b.BankAccount, &b.VoucherCount, &b.TotalAmountIDR, &b.BatchHash, &b.SettledAt); err == nil {
				st.SettlementBatches = append(st.SettlementBatches, b)
			}
		}
		bRows.Close()
	}

	rRows, err := s.db.Query(`SELECT id, client_tx_id, voucher_id, short_code, merchant_id, merchant_name, outcome, reason, processed_at FROM reconciliation_logs ORDER BY processed_at DESC`)
	if err == nil {
		for rRows.Next() {
			var r ReconciliationLog
			if err := rRows.Scan(&r.ID, &r.ClientTxID, &r.VoucherID, &r.ShortCode, &r.MerchantID, &r.MerchantName, &r.Outcome, &r.Reason, &r.ProcessedAt); err == nil {
				st.ReconciliationLogs = append(st.ReconciliationLogs, r)
			}
		}
		rRows.Close()
	}

	return st, nil
}

func (s *ClearinghouseService) persistToPostgres(st *ClearinghouseState) error {
	if s.db == nil {
		return nil
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	tables := []string{"reconciliation_logs", "settlement_batches", "ledger_entries", "vouchers", "merchants", "beneficiaries", "system_config"}
	for _, tbl := range tables {
		if _, err = tx.Exec("DELETE FROM " + tbl); err != nil {
			return err
		}
	}

	if _, err = tx.Exec(`INSERT INTO system_config (key, value_int) VALUES ('pool_total_idr', $1), ('fraud_blocked_count', $2)`, st.PoolTotalIDR, st.FraudBlockedCount); err != nil {
		return err
	}

	for _, b := range st.Beneficiaries {
		if _, err = tx.Exec(`INSERT INTO beneficiaries (id, name, rt_rw, category, phone, household_size, verified_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			b.ID, b.Name, b.RtRw, b.Category, b.Phone, b.HouseholdSize, b.VerifiedBy); err != nil {
			return err
		}
	}

	for _, m := range st.Merchants {
		if _, err = tx.Exec(`INSERT INTO merchants (id, name, owner, rt_rw, bank_account, unsettled_balance_idr, total_settled_idr, redemption_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			m.ID, m.Name, m.Owner, m.RtRw, m.BankAccount, m.UnsettledBalanceIDR, m.TotalSettledIDR, m.RedemptionCount); err != nil {
			return err
		}
	}

	for _, v := range st.Vouchers {
		if _, err = tx.Exec(`INSERT INTO vouchers (id, short_code, beneficiary_id, beneficiary_name, rt_rw, commodity_code, commodity_name, commodity_items, nominal_idr, nonce, issued_at, expires_at, hmac_signature, status, redeemed_by_merchant_id, redeemed_by_merchant_name, redeemed_at, settlement_batch_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
			v.ID, v.ShortCode, v.BeneficiaryID, v.BeneficiaryName, v.RtRw, v.CommodityCode, v.CommodityName, v.CommodityItems, v.NominalIDR, v.Nonce, v.IssuedAt, v.ExpiresAt, v.HMACSignature, v.Status, v.RedeemedByMerchantID, v.RedeemedByMerchantName, v.RedeemedAt, v.SettlementBatchID); err != nil {
			return err
		}
	}

	for _, l := range st.Ledger {
		if _, err = tx.Exec(`INSERT INTO ledger_entries (id, client_tx_id, voucher_id, short_code, beneficiary_id, merchant_id, merchant_name, commodity_name, nominal_idr, hmac_signature, prev_hash, tx_hash, sync_mode, timestamp, settlement_batch_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
			l.ID, l.ClientTxID, l.VoucherID, l.ShortCode, l.BeneficiaryID, l.MerchantID, l.MerchantName, l.CommodityName, l.NominalIDR, l.HMACSignature, l.PrevHash, l.TxHash, l.SyncMode, l.Timestamp, l.SettlementBatchID); err != nil {
			return err
		}
	}

	for _, b := range st.SettlementBatches {
		if _, err = tx.Exec(`INSERT INTO settlement_batches (id, merchant_id, merchant_name, bank_account, voucher_count, total_amount_idr, batch_hash, settled_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			b.ID, b.MerchantID, b.MerchantName, b.BankAccount, b.VoucherCount, b.TotalAmountIDR, b.BatchHash, b.SettledAt); err != nil {
			return err
		}
	}

	for _, r := range st.ReconciliationLogs {
		if _, err = tx.Exec(`INSERT INTO reconciliation_logs (id, client_tx_id, voucher_id, short_code, merchant_id, merchant_name, outcome, reason, processed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			r.ID, r.ClientTxID, r.VoucherID, r.ShortCode, r.MerchantID, r.MerchantName, r.Outcome, r.Reason, r.ProcessedAt); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *ClearinghouseService) persistLocked() {
	if s.db != nil {
		if err := s.persistToPostgres(s.state); err != nil {
			log.Printf("[CivicLedger Go API] PostgreSQL persist error: %v", err)
		}
	} else {
		s.saveToFile(s.state)
	}
}

func (s *ClearinghouseService) GetState() ClearinghouseState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cp := *s.state
	cp.BackendEngine = s.engine
	return cp
}

// ==================== DOMAIN OPERATIONS ====================

type AddBeneficiaryInput struct {
	Name          string `json:"name"`
	RtRw          string `json:"rt_rw"`
	Category      string `json:"category"`
	Phone         string `json:"phone"`
	HouseholdSize int    `json:"household_size"`
}

func (s *ClearinghouseService) AddBeneficiary(in AddBeneficiaryInput) (Beneficiary, ClearinghouseState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	name := strings.TrimSpace(in.Name)
	rtRw := strings.TrimSpace(in.RtRw)
	if name == "" || rtRw == "" {
		return Beneficiary{}, ClearinghouseState{}, errors.New("beneficiary name and RT/RW are required")
	}
	if in.HouseholdSize <= 0 {
		in.HouseholdSize = 3
	}
	if strings.TrimSpace(in.Category) == "" {
		in.Category = "Verified Vulnerable Household"
	}
	if strings.TrimSpace(in.Phone) == "" {
		in.Phone = "0812-0000-1111 (SMS / Mobile Web)"
	}

	ben := Beneficiary{
		ID:            fmt.Sprintf("WGA-04%02d", len(s.state.Beneficiaries)+10),
		Name:          name,
		RtRw:          rtRw,
		Category:      strings.TrimSpace(in.Category),
		Phone:         strings.TrimSpace(in.Phone),
		HouseholdSize: in.HouseholdSize,
		VerifiedBy:    "RT 04 Coordinator — Pak H. Dedi",
	}
	s.state.Beneficiaries = append(s.state.Beneficiaries, ben)
	s.persistLocked()
	return ben, *s.state, nil
}

type AddMerchantInput struct {
	Name        string `json:"name"`
	Owner       string `json:"owner"`
	RtRw        string `json:"rt_rw"`
	BankAccount string `json:"bank_account"`
}

func (s *ClearinghouseService) AddMerchant(in AddMerchantInput) (Merchant, ClearinghouseState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	name := strings.TrimSpace(in.Name)
	owner := strings.TrimSpace(in.Owner)
	if name == "" || owner == "" {
		return Merchant{}, ClearinghouseState{}, errors.New("merchant stall name and owner are required")
	}
	if strings.TrimSpace(in.RtRw) == "" {
		in.RtRw = "RT 04 / RW 08 Coblong, Bandung"
	}
	if strings.TrimSpace(in.BankAccount) == "" {
		in.BankAccount = "QRIS Micro Merchant •• 0000"
	}

	m := Merchant{
		ID:          fmt.Sprintf("WRG-%02d", len(s.state.Merchants)+1),
		Name:        name,
		Owner:       owner,
		RtRw:        strings.TrimSpace(in.RtRw),
		BankAccount: strings.TrimSpace(in.BankAccount),
	}
	s.state.Merchants = append(s.state.Merchants, m)
	s.persistLocked()
	return m, *s.state, nil
}

type IssueVoucherInput struct {
	BeneficiaryID string `json:"beneficiary_id"`
	CommodityCode string `json:"commodity_code"`
	ValidityHours int    `json:"validity_hours"`
}

func (s *ClearinghouseService) IssueVoucher(in IssueVoucherInput) (Voucher, ClearinghouseState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var ben *Beneficiary
	for i := range s.state.Beneficiaries {
		if s.state.Beneficiaries[i].ID == in.BeneficiaryID {
			ben = &s.state.Beneficiaries[i]
			break
		}
	}
	if ben == nil {
		return Voucher{}, ClearinghouseState{}, errors.New("beneficiary not found")
	}

	cat, ok := findCommodity(in.CommodityCode)
	if !ok {
		return Voucher{}, ClearinghouseState{}, errors.New("invalid commodity package code")
	}

	if in.ValidityHours <= 0 {
		in.ValidityHours = 72
	}

	now := time.Now().UTC()
	issuedAt := now.Format(time.RFC3339)
	expiresAt := now.Add(time.Duration(in.ValidityHours) * time.Hour).Format(time.RFC3339)

	randNum := randomIntRange(1000, 9999)
	suffix := strings.ToUpper(randomHex(1))
	voucherID := fmt.Sprintf("VCH-2026-%d", randNum)
	shortCode := fmt.Sprintf("CL-%d-%s", randNum, suffix)
	nonce := randomHex(6)

	sig := signVoucherHMAC(voucherID, ben.ID, cat.Code, cat.NominalIDR, nonce, expiresAt)

	v := Voucher{
		ID:              voucherID,
		ShortCode:       shortCode,
		BeneficiaryID:   ben.ID,
		BeneficiaryName: ben.Name,
		RtRw:            ben.RtRw,
		CommodityCode:   cat.Code,
		CommodityName:   cat.Name,
		CommodityItems:  cat.Items,
		NominalIDR:      cat.NominalIDR,
		Nonce:           nonce,
		IssuedAt:        issuedAt,
		ExpiresAt:       expiresAt,
		HMACSignature:   sig,
		Status:          "ACTIVE",
	}

	s.state.Vouchers = append([]Voucher{v}, s.state.Vouchers...)
	if s.state.PoolTotalIDR >= cat.NominalIDR {
		s.state.PoolTotalIDR -= cat.NominalIDR
	} else {
		s.state.PoolTotalIDR = 0
	}
	s.persistLocked()
	return v, *s.state, nil
}

type RedeemVoucherInput struct {
	ClientTxID          string `json:"client_tx_id"`
	VoucherID           string `json:"voucher_id"`
	ShortCode           string `json:"short_code"`
	MerchantID          string `json:"merchant_id"`
	ClientHMACSignature string `json:"client_hmac_signature"`
	SyncMode            string `json:"sync_mode"`
	RedeemedAt          string `json:"redeemed_at"`
}

type RedeemError struct {
	Code    int
	Outcome string
	Message string
}

func (e *RedeemError) Error() string { return e.Message }

func (s *ClearinghouseService) redeemLocked(in RedeemVoucherInput) (Voucher, LedgerEntry, Merchant, *RedeemError) {
	clientTxID := strings.TrimSpace(in.ClientTxID)
	if clientTxID == "" {
		clientTxID = "CTX-" + strings.ToUpper(randomHex(4))
	}

	// Idempotency check by unique client_tx_id
	for _, existing := range s.state.Ledger {
		if existing.ClientTxID == clientTxID {
			return Voucher{}, LedgerEntry{}, Merchant{}, &RedeemError{
				Code:    http.StatusConflict,
				Outcome: "DUPLICATE_CONFLICT",
				Message: fmt.Sprintf("Duplicate transaction identifier %s already committed in ledger.", clientTxID),
			}
		}
	}

	var vIdx = -1
	cleanShort := strings.ToUpper(strings.TrimSpace(in.ShortCode))
	for i := range s.state.Vouchers {
		if (in.VoucherID != "" && s.state.Vouchers[i].ID == in.VoucherID) ||
			(cleanShort != "" && strings.ToUpper(s.state.Vouchers[i].ShortCode) == cleanShort) {
			vIdx = i
			break
		}
	}
	if vIdx == -1 {
		return Voucher{}, LedgerEntry{}, Merchant{}, &RedeemError{
			Code:    http.StatusNotFound,
			Outcome: "NOT_FOUND",
			Message: "Voucher not found in clearinghouse registry.",
		}
	}

	var mIdx = -1
	for i := range s.state.Merchants {
		if s.state.Merchants[i].ID == in.MerchantID {
			mIdx = i
			break
		}
	}
	if mIdx == -1 {
		return Voucher{}, LedgerEntry{}, Merchant{}, &RedeemError{
			Code:    http.StatusNotFound,
			Outcome: "NOT_FOUND",
			Message: "Participating merchant not found.",
		}
	}

	v := &s.state.Vouchers[vIdx]
	m := &s.state.Merchants[mIdx]

	if v.Status != "ACTIVE" {
		s.state.FraudBlockedCount++
		prevMerchant := "warung mitra lain"
		if v.RedeemedByMerchantName != nil {
			prevMerchant = *v.RedeemedByMerchantName
		}
		return Voucher{}, LedgerEntry{}, Merchant{}, &RedeemError{
			Code:    http.StatusConflict,
			Outcome: "DUPLICATE_CONFLICT",
			Message: fmt.Sprintf("Ditolak (Anti-Double-Spend): Voucher %s sudah berstatus %s (telah ditukar di %s).", v.ShortCode, v.Status, prevMerchant),
		}
	}

	if expTime, err := time.Parse(time.RFC3339, v.ExpiresAt); err == nil && time.Now().UTC().After(expTime) {
		v.Status = "EXPIRED"
		return Voucher{}, LedgerEntry{}, Merchant{}, &RedeemError{
			Code:    http.StatusGone,
			Outcome: "EXPIRED",
			Message: fmt.Sprintf("Voucher %s sudah kedaluwarsa.", v.ShortCode),
		}
	}

	expectedSig := signVoucherHMAC(v.ID, v.BeneficiaryID, v.CommodityCode, v.NominalIDR, v.Nonce, v.ExpiresAt)
	if in.ClientHMACSignature != "" && !hmac.Equal([]byte(strings.ToLower(in.ClientHMACSignature)), []byte(strings.ToLower(expectedSig))) {
		s.state.FraudBlockedCount++
		return Voucher{}, LedgerEntry{}, Merchant{}, &RedeemError{
			Code:    http.StatusForbidden,
			Outcome: "INVALID_SIGNATURE",
			Message: "Verifikasi kriptografi gagal: tanda tangan HMAC-SHA256 tidak cocok (indikasi manipulasi payload).",
		}
	}

	nowIso := in.RedeemedAt
	if strings.TrimSpace(nowIso) == "" {
		nowIso = time.Now().UTC().Format(time.RFC3339)
	}

	prevHash := genesisHash
	if len(s.state.Ledger) > 0 {
		prevHash = s.state.Ledger[0].TxHash
	}
	txHash := computeLedgerTxHash(prevHash, v.ID, m.ID, v.NominalIDR, nowIso, expectedSig)

	syncMode := "ONLINE"
	if in.SyncMode == "OFFLINE_BATCH_SYNC" {
		syncMode = "OFFLINE_BATCH_SYNC"
	}

	mID := m.ID
	mName := m.Name
	v.Status = "REDEEMED"
	v.RedeemedByMerchantID = &mID
	v.RedeemedByMerchantName = &mName
	v.RedeemedAt = &nowIso

	m.UnsettledBalanceIDR += v.NominalIDR
	m.RedemptionCount++

	entry := LedgerEntry{
		ID:            "TX-" + strings.ToUpper(randomHex(4)),
		ClientTxID:    clientTxID,
		VoucherID:     v.ID,
		ShortCode:     v.ShortCode,
		BeneficiaryID: v.BeneficiaryID,
		MerchantID:    m.ID,
		MerchantName:  m.Name,
		CommodityName: v.CommodityName,
		NominalIDR:    v.NominalIDR,
		HMACSignature: expectedSig,
		PrevHash:      prevHash,
		TxHash:        txHash,
		SyncMode:      syncMode,
		Timestamp:     nowIso,
	}

	s.state.Ledger = append([]LedgerEntry{entry}, s.state.Ledger...)
	return *v, entry, *m, nil
}

func (s *ClearinghouseService) RedeemVoucher(in RedeemVoucherInput) (Voucher, LedgerEntry, Merchant, ClearinghouseState, *RedeemError) {
	s.mu.Lock()
	defer s.mu.Unlock()

	v, entry, m, rErr := s.redeemLocked(in)
	if rErr != nil {
		s.persistLocked()
		return Voucher{}, LedgerEntry{}, Merchant{}, ClearinghouseState{}, rErr
	}
	s.persistLocked()
	return v, entry, m, *s.state, nil
}

type BatchSyncItem struct {
	QueueID       string `json:"queue_id"`
	ClientTxID    string `json:"client_tx_id"`
	VoucherID     string `json:"voucher_id"`
	ShortCode     string `json:"short_code"`
	MerchantID    string `json:"merchant_id"`
	MerchantName  string `json:"merchant_name"`
	HMACSignature string `json:"hmac_signature"`
	RedeemedAt    string `json:"redeemed_at"`
}

type BatchSyncResultItem struct {
	ClientTxID   string `json:"client_tx_id"`
	VoucherID    string `json:"voucher_id"`
	ShortCode    string `json:"short_code"`
	MerchantName string `json:"merchant_name"`
	Status       string `json:"status"` // SYNCED | CONFLICT
	Outcome      string `json:"outcome"`
	Reason       string `json:"reason"`
}

func (s *ClearinghouseService) BatchSync(items []BatchSyncItem) ([]BatchSyncResultItem, int, int, ClearinghouseState) {
	s.mu.Lock()
	defer s.mu.Unlock()

	results := make([]BatchSyncResultItem, 0, len(items))
	syncedCount := 0
	conflictCount := 0
	nowIso := time.Now().UTC().Format(time.RFC3339)

	for _, item := range items {
		ctxID := item.ClientTxID
		if ctxID == "" {
			ctxID = item.QueueID
		}
		if ctxID == "" {
			ctxID = "CTX-" + strings.ToUpper(randomHex(4))
		}

		v, _, m, rErr := s.redeemLocked(RedeemVoucherInput{
			ClientTxID:          ctxID,
			VoucherID:           item.VoucherID,
			ShortCode:           item.ShortCode,
			MerchantID:          item.MerchantID,
			ClientHMACSignature: item.HMACSignature,
			SyncMode:            "OFFLINE_BATCH_SYNC",
			RedeemedAt:          item.RedeemedAt,
		})

		mName := item.MerchantName
		if m.Name != "" {
			mName = m.Name
		}

		if rErr != nil {
			conflictCount++
			recLog := ReconciliationLog{
				ID:           "REC-" + strings.ToUpper(randomHex(3)),
				ClientTxID:   ctxID,
				VoucherID:    item.VoucherID,
				ShortCode:    item.ShortCode,
				MerchantID:   item.MerchantID,
				MerchantName: mName,
				Outcome:      rErr.Outcome,
				Reason:       rErr.Message,
				ProcessedAt:  nowIso,
			}
			s.state.ReconciliationLogs = append([]ReconciliationLog{recLog}, s.state.ReconciliationLogs...)
			results = append(results, BatchSyncResultItem{
				ClientTxID:   ctxID,
				VoucherID:    item.VoucherID,
				ShortCode:    item.ShortCode,
				MerchantName: mName,
				Status:       "CONFLICT",
				Outcome:      rErr.Outcome,
				Reason:       rErr.Message,
			})
			continue
		}

		syncedCount++
		recLog := ReconciliationLog{
			ID:           "REC-" + strings.ToUpper(randomHex(3)),
			ClientTxID:   ctxID,
			VoucherID:    v.ID,
			ShortCode:    v.ShortCode,
			MerchantID:   m.ID,
			MerchantName: m.Name,
			Outcome:      "SYNCED",
			Reason:       "Transaksi offline divalidasi oleh server Golang dan dicatat ke buku besar rantai hash.",
			ProcessedAt:  nowIso,
		}
		s.state.ReconciliationLogs = append([]ReconciliationLog{recLog}, s.state.ReconciliationLogs...)
		results = append(results, BatchSyncResultItem{
			ClientTxID:   ctxID,
			VoucherID:    v.ID,
			ShortCode:    v.ShortCode,
			MerchantName: m.Name,
			Status:       "SYNCED",
			Outcome:      "SYNCED",
			Reason:       recLog.Reason,
		})
	}

	s.persistLocked()
	return results, syncedCount, conflictCount, *s.state
}

func (s *ClearinghouseService) SettleMerchants(merchantID string) ([]SettlementBatch, ClearinghouseState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	nowIso := time.Now().UTC().Format(time.RFC3339)
	created := []SettlementBatch{}

	for i := range s.state.Merchants {
		m := &s.state.Merchants[i]
		if m.UnsettledBalanceIDR <= 0 {
			continue
		}
		if merchantID != "" && m.ID != merchantID {
			continue
		}

		batchID := "STL-2026-" + strings.ToUpper(randomHex(3))
		amount := m.UnsettledBalanceIDR
		vCount := 0
		for j := range s.state.Vouchers {
			v := &s.state.Vouchers[j]
			if v.Status == "REDEEMED" && v.RedeemedByMerchantID != nil && *v.RedeemedByMerchantID == m.ID {
				v.Status = "SETTLED"
				v.SettlementBatchID = &batchID
				vCount++
			}
		}
		if vCount == 0 {
			vCount = 1
		}

		for j := range s.state.Ledger {
			l := &s.state.Ledger[j]
			if l.MerchantID == m.ID && l.SettlementBatchID == nil {
				l.SettlementBatchID = &batchID
			}
		}

		m.TotalSettledIDR += amount
		m.UnsettledBalanceIDR = 0

		batch := SettlementBatch{
			ID:             batchID,
			MerchantID:     m.ID,
			MerchantName:   m.Name,
			BankAccount:    m.BankAccount,
			VoucherCount:   vCount,
			TotalAmountIDR: amount,
			BatchHash:      computeSHA256Hex(fmt.Sprintf("%s|%s|%d|%s", batchID, m.ID, amount, nowIso)),
			SettledAt:      nowIso,
		}
		s.state.SettlementBatches = append([]SettlementBatch{batch}, s.state.SettlementBatches...)
		created = append(created, batch)
	}

	if len(created) == 0 {
		return nil, ClearinghouseState{}, errors.New("no unsettled merchant balances available for settlement")
	}

	s.persistLocked()
	return created, *s.state, nil
}

func (s *ClearinghouseService) ResetDemo() ClearinghouseState {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state = buildInitialSeedState(s.engine)
	s.persistLocked()
	return *s.state
}

func (s *ClearinghouseService) VerifyChain() ChainVerificationResult {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return verifyLedgerChain(s.state.Ledger)
}

// ==================== HTTP ROUTER & HANDLERS ====================

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func buildRouter(svc *ClearinghouseService) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"service": "civicledger-go-clearinghouse",
			"engine":  svc.engine,
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})

	mux.HandleFunc("GET /api/v1/state", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, svc.GetState())
	})

	mux.HandleFunc("GET /api/v1/ledger/verify", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, svc.VerifyChain())
	})

	mux.HandleFunc("POST /api/v1/beneficiaries", func(w http.ResponseWriter, r *http.Request) {
		var in AddBeneficiaryInput
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
			return
		}
		ben, st, err := svc.AddBeneficiary(in)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "beneficiary": ben, "state": st})
	})

	mux.HandleFunc("POST /api/v1/merchants", func(w http.ResponseWriter, r *http.Request) {
		var in AddMerchantInput
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
			return
		}
		m, st, err := svc.AddMerchant(in)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "merchant": m, "state": st})
	})

	mux.HandleFunc("POST /api/v1/vouchers/issue", func(w http.ResponseWriter, r *http.Request) {
		var in IssueVoucherInput
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
			return
		}
		v, st, err := svc.IssueVoucher(in)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "voucher": v, "state": st})
	})

	mux.HandleFunc("POST /api/v1/vouchers/redeem", func(w http.ResponseWriter, r *http.Request) {
		var in RedeemVoucherInput
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
			return
		}
		v, entry, m, st, rErr := svc.RedeemVoucher(in)
		if rErr != nil {
			writeJSON(w, rErr.Code, map[string]string{"error": rErr.Message, "outcome": rErr.Outcome})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":           true,
			"voucher":      v,
			"ledger_entry": entry,
			"merchant":     m,
			"state":        st,
		})
	})

	mux.HandleFunc("POST /api/v1/sync/batch", func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			Redemptions []BatchSyncItem `json:"redemptions"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
			return
		}
		results, syncedCount, conflictCount, st := svc.BatchSync(payload.Redemptions)
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":             true,
			"synced_count":   syncedCount,
			"conflict_count": conflictCount,
			"results":        results,
			"state":          st,
		})
	})

	mux.HandleFunc("POST /api/v1/settlements", func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			MerchantID string `json:"merchant_id"`
		}
		_ = json.NewDecoder(r.Body).Decode(&payload)
		batches, st, err := svc.SettleMerchants(payload.MerchantID)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"batches": batches,
			"state":   st,
		})
	})

	mux.HandleFunc("POST /api/v1/reset", func(w http.ResponseWriter, r *http.Request) {
		st := svc.ResetDemo()
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "state": st})
	})

	return withCORS(mux)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	dsn := os.Getenv("DATABASE_URL")
	svc := NewClearinghouseService(dsn, localStateFile)

	addr := ":" + port
	log.Printf("[CivicLedger Go API] Listening on http://localhost%s (engine=%s)", addr, svc.engine)
	if err := http.ListenAndServe(addr, buildRouter(svc)); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
