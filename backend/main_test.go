package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func newTestService() *ClearinghouseService {
	return NewClearinghouseService("", "")
}

func TestIssueRedeemAndDoubleSpendPrevention(t *testing.T) {
	svc := newTestService()

	// 1. Issue a new voucher
	v, _, err := svc.IssueVoucher(IssueVoucherInput{
		BeneficiaryID: "WGA-0401",
		CommodityCode: "PKG-BERAS-5KG",
		ValidityHours: 48,
	})
	if err != nil {
		t.Fatalf("expected voucher issuance to succeed, got error: %v", err)
	}
	if v.Status != "ACTIVE" || v.HMACSignature == "" {
		t.Fatalf("unexpected voucher state: %+v", v)
	}

	// 2. Reject tampered signature
	_, _, _, _, tamperErr := svc.RedeemVoucher(RedeemVoucherInput{
		ClientTxID:          "CTX-TAMPER-1",
		VoucherID:           v.ID,
		MerchantID:          "WRG-01",
		ClientHMACSignature: "deadbeef00000000",
	})
	if tamperErr == nil || tamperErr.Outcome != "INVALID_SIGNATURE" {
		t.Fatalf("expected INVALID_SIGNATURE error, got: %+v", tamperErr)
	}

	// 3. Valid redemption succeeds
	redeemed, entry, _, _, redeemErr := svc.RedeemVoucher(RedeemVoucherInput{
		ClientTxID:          "CTX-VALID-1",
		VoucherID:           v.ID,
		MerchantID:          "WRG-01",
		ClientHMACSignature: v.HMACSignature,
	})
	if redeemErr != nil {
		t.Fatalf("expected valid redemption to succeed, got: %+v", redeemErr)
	}
	if redeemed.Status != "REDEEMED" || entry.TxHash == "" {
		t.Fatalf("unexpected redeemed state: %+v", redeemed)
	}

	// 4. Duplicate redemption is blocked (Anti-Double-Spend)
	_, _, _, _, dupErr := svc.RedeemVoucher(RedeemVoucherInput{
		ClientTxID:          "CTX-DUP-2",
		VoucherID:           v.ID,
		MerchantID:          "WRG-02",
		ClientHMACSignature: v.HMACSignature,
	})
	if dupErr == nil || dupErr.Outcome != "DUPLICATE_CONFLICT" {
		t.Fatalf("expected DUPLICATE_CONFLICT error, got: %+v", dupErr)
	}

	// 5. Hash chain verification passes
	chain := svc.VerifyChain()
	if !chain.Valid || chain.CheckedCount < 2 {
		t.Fatalf("expected valid hash chain with >=2 entries, got: %+v", chain)
	}
}

func TestOfflineBatchSyncConflictReconciliation(t *testing.T) {
	svc := newTestService()

	v, _, err := svc.IssueVoucher(IssueVoucherInput{
		BeneficiaryID: "WGA-0402",
		CommodityCode: "PKG-PROTEIN-01",
		ValidityHours: 24,
	})
	if err != nil {
		t.Fatalf("issue failed: %v", err)
	}

	// Two offline merchant devices submit the SAME voucher in one batch
	results, synced, conflicts, _ := svc.BatchSync([]BatchSyncItem{
		{
			ClientTxID:    "CTX-OFF-1",
			VoucherID:     v.ID,
			ShortCode:     v.ShortCode,
			MerchantID:    "WRG-01",
			MerchantName:  "Warung Kelontong Berkah Bu Yati",
			HMACSignature: v.HMACSignature,
		},
		{
			ClientTxID:    "CTX-OFF-2",
			VoucherID:     v.ID,
			ShortCode:     v.ShortCode,
			MerchantID:    "WRG-02",
			MerchantName:  "Toko Sembako Pak Asep Mandiri",
			HMACSignature: v.HMACSignature,
		},
	})

	if synced != 1 || conflicts != 1 || len(results) != 2 {
		t.Fatalf("expected 1 synced & 1 conflict, got synced=%d conflicts=%d results=%+v", synced, conflicts, results)
	}
	if results[0].Status != "SYNCED" || results[1].Outcome != "DUPLICATE_CONFLICT" {
		t.Fatalf("unexpected reconciliation outcomes: %+v", results)
	}
}

func TestHTTPHealthAndMerchantRegistration(t *testing.T) {
	svc := newTestService()
	router := buildRouter(svc)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from /health, got %d", rec.Code)
	}

	body, _ := json.Marshal(AddMerchantInput{
		Name:        "Warung Sembako Maju Jaya",
		Owner:       "Pak Budi",
		RtRw:        "RT 03 / RW 08 Coblong",
		BankAccount: "BRI / QRIS •• 7788",
	})
	mReq := httptest.NewRequest(http.MethodPost, "/api/v1/merchants", bytes.NewReader(body))
	mRec := httptest.NewRecorder()
	router.ServeHTTP(mRec, mReq)
	if mRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created from /merchants, got %d: %s", mRec.Code, mRec.Body.String())
	}
}
